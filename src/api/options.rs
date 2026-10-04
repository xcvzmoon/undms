use crate::types::{self, OcrPolicy, ResolvedOptions};
use napi::{Error, Result, Status};
use napi_derive::napi;
#[napi(string_enum = "lowercase")]
pub enum ExtractionSelection {
  Text,
  Metadata,
  Both,
}
#[napi(string_enum = "lowercase")]
pub enum DecodingPolicy {
  Strict,
  Replace,
}
#[napi(string_enum = "lowercase")]
pub enum OcrMode {
  Disabled,
  Fast,
  Balanced,
  Accurate,
}
#[napi(object)]
pub struct TextOptions {
  pub encoding: Option<String>,
  pub decoding: Option<DecodingPolicy>,
}
#[napi(object)]
pub struct ResourceLimits {
  pub max_input_bytes: Option<f64>,
  pub max_output_bytes: Option<f64>,
  pub max_decompressed_bytes: Option<f64>,
  pub max_archive_entries: Option<u32>,
  pub max_image_pixels: Option<f64>,
  pub max_warnings: Option<u32>,
}
#[napi(object)]
pub struct ExtractionOptions {
  pub selection: Option<ExtractionSelection>,
  pub statistics: Option<bool>,
  pub text: Option<TextOptions>,
  pub ocr: Option<OcrMode>,
  pub limits: Option<ResourceLimits>,
  pub metrics: Option<bool>,
}
#[napi(object)]
pub struct BatchOptions {
  pub extraction: Option<ExtractionOptions>,
  pub concurrency: Option<u32>,
  pub max_total_input_bytes: Option<f64>,
  pub max_total_output_bytes: Option<f64>,
  pub max_documents: Option<u32>,
}
pub fn invalid(message: impl Into<String>) -> Error {
  Error::new(Status::InvalidArg, message.into())
}
fn limit(value: Option<f64>, default: usize, name: &str, cap: usize) -> Result<usize> {
  match value {
    None => Ok(default),
    Some(v) if v.is_finite() && v >= 1.0 && v.fract() == 0.0 && v <= cap as f64 => Ok(v as usize),
    _ => Err(invalid(format!(
      "{name} must be a positive integer <= {cap}"
    ))),
  }
}
pub fn resolve(options: Option<ExtractionOptions>) -> Result<ResolvedOptions> {
  let mut out = ResolvedOptions::default();
  let Some(options) = options else {
    return Ok(out);
  };
  match options.selection.unwrap_or(ExtractionSelection::Both) {
    ExtractionSelection::Text => {
      out.metadata = false;
      out.statistics = false
    }
    ExtractionSelection::Metadata => {
      out.text = false;
      out.statistics = false
    }
    ExtractionSelection::Both => {}
  }
  if let Some(statistics) = options.statistics {
    if statistics && !out.metadata {
      return Err(invalid("statistics requires metadata selection"));
    }
    out.statistics = statistics;
  }
  out.metrics = options.metrics.unwrap_or(false);
  out.ocr = match options.ocr.unwrap_or(OcrMode::Balanced) {
    OcrMode::Disabled => OcrPolicy::Disabled,
    OcrMode::Fast => OcrPolicy::Fast,
    OcrMode::Balanced => OcrPolicy::Balanced,
    OcrMode::Accurate => OcrPolicy::Accurate,
  };
  if let Some(text) = options.text {
    out.encoding = text.encoding.map(|s| s.to_ascii_lowercase());
    if out
      .encoding
      .as_ref()
      .is_some_and(|s| encoding_rs::Encoding::for_label(s.as_bytes()).is_none())
    {
      return Err(invalid("unknown text encoding"));
    }
    out.replace_invalid = matches!(text.decoding, Some(DecodingPolicy::Replace));
  }
  if let Some(v) = options.limits {
    let d = types::ResourceLimits::default();
    out.limits = types::ResourceLimits {
      max_input_bytes: limit(
        v.max_input_bytes,
        d.max_input_bytes,
        "maxInputBytes",
        256 * 1024 * 1024,
      )?,
      max_output_bytes: limit(
        v.max_output_bytes,
        d.max_output_bytes,
        "maxOutputBytes",
        64 * 1024 * 1024,
      )?,
      max_decompressed_bytes: limit(
        v.max_decompressed_bytes,
        d.max_decompressed_bytes,
        "maxDecompressedBytes",
        512 * 1024 * 1024,
      )?,
      max_archive_entries: v
        .max_archive_entries
        .unwrap_or(d.max_archive_entries as u32) as usize,
      max_image_pixels: limit(
        v.max_image_pixels,
        d.max_image_pixels as usize,
        "maxImagePixels",
        100_000_000,
      )? as u64,
      max_warnings: v.max_warnings.unwrap_or(d.max_warnings as u32) as usize,
    };
    if out.limits.max_archive_entries == 0
      || out.limits.max_archive_entries > 100_000
      || out.limits.max_warnings == 0
      || out.limits.max_warnings > 1000
    {
      return Err(invalid(
        "archive entries and warnings must be positive and bounded",
      ));
    }
  }
  Ok(out)
}
pub struct ResolvedBatchOptions {
  pub extraction: ResolvedOptions,
  pub concurrency: usize,
  pub max_input: usize,
  pub max_output: usize,
  pub max_documents: usize,
}
pub fn resolve_batch(options: Option<BatchOptions>) -> Result<ResolvedBatchOptions> {
  let v = options.unwrap_or(BatchOptions {
    extraction: None,
    concurrency: None,
    max_total_input_bytes: None,
    max_total_output_bytes: None,
    max_documents: None,
  });
  let concurrency = v
    .concurrency
    .unwrap_or(crate::engine::scheduler::worker_count() as u32) as usize;
  if concurrency == 0 || concurrency > 32 {
    return Err(invalid("concurrency must be between 1 and 32"));
  }
  let max_documents = v.max_documents.unwrap_or(1000) as usize;
  if max_documents == 0 || max_documents > 10_000 {
    return Err(invalid("maxDocuments must be between 1 and 10000"));
  }
  Ok(ResolvedBatchOptions {
    extraction: resolve(v.extraction)?,
    concurrency: concurrency.min(crate::engine::scheduler::worker_count()),
    max_input: limit(
      v.max_total_input_bytes,
      128 * 1024 * 1024,
      "maxTotalInputBytes",
      256 * 1024 * 1024,
    )?,
    max_output: limit(
      v.max_total_output_bytes,
      64 * 1024 * 1024,
      "maxTotalOutputBytes",
      256 * 1024 * 1024,
    )?,
    max_documents,
  })
}
