pub mod options;
pub mod types;
use crate::{
  engine::{self, Input, Processed, scheduler::Admission},
  types::{self as domain, SourceInfo},
};
use futures_util::{StreamExt, stream::FuturesUnordered};
use napi::{
  Env, Error, Result, Status,
  bindgen_prelude::{Buffer, FromNapiValue, PromiseRaw, ToNapiValue},
};
use napi_derive::napi;
use options::{invalid, resolve, resolve_batch};
use std::{sync::Arc, time::Instant};
use types::*;
fn infrastructure(message: String) -> Error {
  Error::new(Status::GenericFailure, message)
}
struct InspectedInput {
  input: ExtractionInput,
  byte_length: usize,
}
fn inspect(env: &Env, mut input: ExtractionInput) -> Result<InspectedInput> {
  if input.id.as_ref().is_some_and(|v| v.len() > 1024)
    || input.name.as_ref().is_some_and(|v| v.len() > 4096)
    || input.mime_type.as_ref().is_some_and(|v| v.len() > 256)
  {
    return Err(invalid("input identity or MIME hint too long"));
  }
  // Napi object getters may have detached the view since initial argument conversion.
  // Never dereference the cached Buffer, even to get its length. Inspect its canonical
  // backing and reconstruct the view while on its owning JS thread before reading.
  let raw = unsafe { Buffer::to_napi_value(env.raw(), input.data)? };
  let mut backing = std::ptr::null_mut();
  let mut length = 0;
  let mut view_type = napi::sys::TypedarrayType::uint8_array;
  let status = unsafe {
    napi::sys::napi_get_typedarray_info(
      env.raw(),
      raw,
      &mut view_type,
      &mut length,
      std::ptr::null_mut(),
      &mut backing,
      std::ptr::null_mut(),
    )
  };
  if status != napi::sys::Status::napi_ok || view_type != napi::sys::TypedarrayType::uint8_array {
    return Err(invalid("invalid input byte view"));
  }
  {
    let mut ordinary = false;
    if unsafe { napi::sys::napi_is_arraybuffer(env.raw(), backing, &mut ordinary) }
      != napi::sys::Status::napi_ok
      || !ordinary
    {
      return Err(invalid("shared-backed buffers are not supported"));
    }
    let mut detached = false;
    if unsafe { napi::sys::napi_is_detached_arraybuffer(env.raw(), backing, &mut detached) }
      != napi::sys::Status::napi_ok
      || detached
    {
      return Err(invalid("detached input buffers are not supported"));
    }
  }
  input.data = unsafe { Buffer::from_napi_value(env.raw(), raw)? };
  Ok(InspectedInput {
    input,
    byte_length: length,
  })
}
fn snapshot(input: InspectedInput, options: &domain::ResolvedOptions) -> Input {
  let InspectedInput { input, byte_length } = input;
  let source = SourceInfo {
    id: input.id,
    name: input.name,
    byte_length,
    declared_mime_type: input
      .mime_type
      .map(|v| {
        v.split(';')
          .next()
          .unwrap_or("")
          .trim()
          .to_ascii_lowercase()
      })
      .filter(|v| !v.is_empty()),
    ..Default::default()
  };
  let pre_error = (byte_length > options.limits.max_input_bytes)
    .then(|| domain::ExtractionError::limit("input exceeds maxInputBytes"));
  let bytes = if pre_error.is_some() {
    Vec::new()
  } else {
    input.data.to_vec()
  };
  Input {
    source,
    bytes,
    pre_error,
  }
}
impl From<Processed> for ExtractionOutcome {
  fn from(value: Processed) -> Self {
    match value.output {
      Err(e) => Self::Error {
        source: value.source.into(),
        error: e.into(),
      },
      Ok(output) => {
        let partial = output.warnings.iter().any(|w| w.partial);
        let result = ExtractionResult {
          source: value.source.into(),
          text: output.text,
          encoding: output.encoding,
          metadata: output.metadata.map(Into::into),
          warnings: output.warnings.into_iter().map(Into::into).collect(),
          metrics: value.metrics.then_some(ProcessingMetrics {
            queue_time_ms: value.queue_time_ms,
            processing_time_ms: value.processing_time_ms,
          }),
        };
        if partial {
          Self::Partial { result }
        } else {
          Self::Success { result }
        }
      }
    }
  }
}
// The reservation stays alive through final JavaScript conversion, including failure.
pub struct Admitted<T> {
  value: T,
  _admission: Arc<Admission>,
}
impl<T: ToNapiValue> ToNapiValue for Admitted<T> {
  unsafe fn to_napi_value(env: napi::sys::napi_env, value: Self) -> Result<napi::sys::napi_value> {
    let result = unsafe { T::to_napi_value(env, value.value) };
    drop(value._admission);
    result
  }
}
/// Extract one document asynchronously. Document failures resolve as error outcomes.
#[napi(ts_return_type = "Promise<ExtractionOutcome>")]
pub fn extract(
  env: &Env,
  input: ExtractionInput,
  options: Option<options::ExtractionOptions>,
) -> Result<PromiseRaw<'_, Admitted<ExtractionOutcome>>> {
  let options = Arc::new(resolve(options)?);
  let input = inspect(env, input)?;
  let reserved = (if input.byte_length > options.limits.max_input_bytes {
    0
  } else {
    input.byte_length
  })
  .checked_add(options.limits.max_output_bytes)
  .ok_or_else(|| invalid("input size overflow"))?;
  let admission = Arc::new(Admission::reserve(reserved).map_err(infrastructure)?);
  let input = snapshot(input, &options);
  let submitted = Instant::now();
  env.spawn_future(async move {
    let value = engine::scheduler::run(input, options, submitted, Arc::clone(&admission))
      .await
      .map_err(infrastructure)?
      .into();
    Ok(Admitted {
      value,
      _admission: admission,
    })
  })
}
/// Extract an ordered batch with per-document failure isolation and bounded concurrency.
#[napi(ts_return_type = "Promise<BatchResult>")]
pub fn extract_batch(
  env: &Env,
  inputs: Vec<ExtractionInput>,
  options: Option<options::BatchOptions>,
) -> Result<PromiseRaw<'_, Admitted<BatchResult>>> {
  let options = resolve_batch(options)?;
  if inputs.len() > options.max_documents {
    return Err(invalid("batch exceeds maxDocuments"));
  }
  let inputs = inputs
    .into_iter()
    .map(|i| inspect(env, i))
    .collect::<Result<Vec<_>>>()?;
  let total = inputs
    .iter()
    .try_fold(0usize, |n, i| n.checked_add(i.byte_length))
    .ok_or_else(|| invalid("batch size overflow"))?;
  if total > options.max_input {
    return Err(invalid("batch exceeds maxTotalInputBytes"));
  }
  let reserved = total
    .checked_add(options.max_output)
    .and_then(|v| v.checked_add(options.concurrency * options.extraction.limits.max_output_bytes))
    .ok_or_else(|| invalid("batch reservation overflow"))?;
  let admission = Arc::new(Admission::reserve(reserved).map_err(infrastructure)?);
  let options_arc = Arc::new(options.extraction);
  let inputs = inputs
    .into_iter()
    .map(|i| snapshot(i, &options_arc))
    .collect::<Vec<_>>();
  let submitted = Instant::now();
  env.spawn_future(async move {
    let count = inputs.len();
    let (mut images, mut cpu): (std::collections::VecDeque<_>, std::collections::VecDeque<_>) =
      inputs
        .into_iter()
        .enumerate()
        .partition(|(_, i)| engine::image_job(i, &options_arc));
    let mut image_active = false;
    let mut active = FuturesUnordered::new();
    let mut results: Vec<Option<BatchItemResult>> = (0..count).map(|_| None).collect();
    let mut summary = BatchSummary {
      success_count: 0,
      partial_count: 0,
      error_count: 0,
    };
    let mut total_output = 0usize;
    loop {
      while active.len() < options.concurrency {
        let image = !image_active && !images.is_empty();
        let next = if image {
          images.pop_front()
        } else {
          cpu.pop_front()
        };
        let Some((index, input)) = next else {
          break;
        };
        if image {
          image_active = true;
        }
        let opts = Arc::clone(&options_arc);
        let guard = Arc::clone(&admission);
        active.push(async move {
          (
            index,
            image,
            engine::scheduler::run(input, opts, submitted, guard).await,
          )
        });
      }
      let Some((index, image, result)) = active.next().await else {
        break;
      };
      if image {
        image_active = false;
      }
      let result = result.map_err(infrastructure)?;
      total_output = total_output
        .checked_add(result.output_bytes())
        .ok_or_else(|| infrastructure("batch output size overflow".into()))?;
      if total_output > options.max_output {
        return Err(infrastructure(
          "LIMIT_EXCEEDED: batch exceeds maxTotalOutputBytes".into(),
        ));
      }
      let outcome = result.into();
      match &outcome {
        ExtractionOutcome::Success { .. } => summary.success_count += 1,
        ExtractionOutcome::Partial { .. } => summary.partial_count += 1,
        ExtractionOutcome::Error { .. } => summary.error_count += 1,
      };
      results[index] = Some(BatchItemResult {
        index: index as u32,
        outcome,
      });
    }
    let items = results
      .into_iter()
      .collect::<Option<Vec<_>>>()
      .ok_or_else(|| infrastructure("incomplete extraction batch".into()))?;
    Ok(Admitted {
      value: BatchResult { items, summary },
      _admission: admission,
    })
  })
}
