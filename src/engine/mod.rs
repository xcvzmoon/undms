pub mod archive;
pub mod scheduler;
use crate::{handlers, metadata, types::*};
use std::{
  panic::{AssertUnwindSafe, catch_unwind},
  time::Instant,
};
#[derive(Debug)]
pub struct Input {
  pub source: SourceInfo,
  pub bytes: Vec<u8>,
  pub pre_error: Option<ExtractionError>,
}
#[derive(Debug)]
pub struct Processed {
  pub source: SourceInfo,
  pub output: ExtractionResult<HandlerOutput>,
  pub queue_time_ms: f64,
  pub processing_time_ms: f64,
  pub metrics: bool,
}
impl Processed {
  pub fn output_bytes(&self) -> usize {
    let identity = self.source.id.as_ref().map_or(0, String::len)
      + self.source.name.as_ref().map_or(0, String::len);
    match &self.output {
      Err(e) => identity + e.message.len() + 128,
      Ok(o) => {
        let text = o.text.as_ref().map_or(0, String::len);
        let meta = o.metadata.as_ref().map_or(0, |m| {
          let p = &m.properties;
          let props = [
            &p.title,
            &p.author,
            &p.subject,
            &p.creator,
            &p.producer,
            &p.created,
            &p.modified,
          ]
          .iter()
          .map(|v| v.as_ref().map_or(0, String::len))
          .sum::<usize>();
          let detail = match &m.format {
            FormatMetadata::Xlsx(v) => v.sheets.iter().map(|s| s.name.len() + 128).sum(),
            FormatMetadata::Image(v) => {
              [
                &v.camera_make,
                &v.camera_model,
                &v.datetime_original,
                &v.format,
              ]
              .iter()
              .map(|v| v.as_ref().map_or(0, String::len))
              .sum::<usize>()
                + 256
            }
            _ => 256,
          };
          props + detail + 256
        });
        identity
          + text
          + meta
          + o
            .warnings
            .iter()
            .map(|w| w.message.len() + w.location.as_ref().map_or(0, String::len) + 128)
            .sum::<usize>()
          + 256
      }
    }
  }
}
fn declared_format(mime: &str) -> Option<DocumentFormat> {
  match mime {
    m if m.starts_with("text/") => Some(DocumentFormat::Text),
    "application/json"
    | "application/xml"
    | "application/javascript"
    | "application/typescript"
    | "application/x-javascript"
    | "application/xhtml+xml"
    | "application/ld+json" => Some(DocumentFormat::Text),
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    | "application/docx" => Some(DocumentFormat::Docx),
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" | "application/xlsx" => {
      Some(DocumentFormat::Xlsx)
    }
    "application/vnd.openxmlformats-officedocument.presentationml.presentation"
    | "application/pptx" => Some(DocumentFormat::Pptx),
    "application/pdf" => Some(DocumentFormat::Pdf),
    "image/jpeg" | "image/jpg" | "image/png" | "image/gif" | "image/bmp" | "image/tiff"
    | "image/webp" => Some(DocumentFormat::Image),
    _ => None,
  }
}
pub fn image_job(input: &Input, options: &ResolvedOptions) -> bool {
  if !options.needs_text() || options.ocr == OcrPolicy::Disabled || input.pre_error.is_some() {
    return false;
  }
  input
    .source
    .declared_mime_type
    .as_deref()
    .and_then(declared_format)
    == Some(DocumentFormat::Image)
    || image::guess_format(&input.bytes).is_ok()
}
fn resolve_format(input: &Input, options: &ResolvedOptions) -> ExtractionResult<DocumentFormat> {
  let bytes = &input.bytes;
  let hint = input.source.declared_mime_type.as_deref();
  let declared = hint.and_then(declared_format);
  if hint.is_some_and(|h| h != "application/octet-stream") && declared.is_none() {
    return Err(ExtractionError::new(
      ErrorCode::UnsupportedFormat,
      "detect",
      "unsupported declared MIME type",
    ));
  }
  let detected = if bytes.starts_with(b"%PDF-") {
    Some(DocumentFormat::Pdf)
  } else if image::guess_format(bytes).is_ok() {
    Some(DocumentFormat::Image)
  } else if bytes.starts_with(b"PK\x03\x04") {
    let archive = archive::Archive::new(bytes, options)?;
    if archive.contains("word/document.xml") {
      Some(DocumentFormat::Docx)
    } else if archive.contains("xl/workbook.xml") {
      Some(DocumentFormat::Xlsx)
    } else if archive.contains("ppt/presentation.xml") {
      Some(DocumentFormat::Pptx)
    } else {
      None
    }
  } else {
    None
  };
  if declared.zip(detected).is_some_and(|(a, b)| a != b) {
    return Err(ExtractionError::new(
      ErrorCode::FormatMismatch,
      "detect",
      "declared MIME type conflicts with document signature",
    ));
  }
  if let Some(format) = detected.or(declared) {
    return Ok(format);
  }
  if std::str::from_utf8(bytes).is_ok() && !bytes.contains(&0)
    || encoding_rs::Encoding::for_bom(bytes).is_some()
  {
    return Ok(DocumentFormat::Text);
  }
  Err(ExtractionError::new(
    ErrorCode::UnsupportedFormat,
    "detect",
    "unable to identify a supported format; provide mimeType for encoded text",
  ))
}
fn effective_mime(format: DocumentFormat, bytes: &[u8]) -> String {
  match format {
    DocumentFormat::Text => "text/plain".into(),
    DocumentFormat::Docx => {
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document".into()
    }
    DocumentFormat::Xlsx => {
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet".into()
    }
    DocumentFormat::Pptx => {
      "application/vnd.openxmlformats-officedocument.presentationml.presentation".into()
    }
    DocumentFormat::Pdf => "application/pdf".into(),
    DocumentFormat::Image => image::guess_format(bytes)
      .map(|f| f.to_mime_type().to_string())
      .unwrap_or_else(|_| "application/octet-stream".into()),
  }
}
pub fn process(mut input: Input, options: &ResolvedOptions, submitted: Instant) -> Processed {
  let start = Instant::now();
  let queue_time_ms = start.duration_since(submitted).as_secs_f64() * 1000.;
  let output = catch_unwind(AssertUnwindSafe(|| {
    if let Some(error) = input.pre_error.take() {
      return Err(error);
    }
    let format = resolve_format(&input, options)?;
    input.source.format = Some(format);
    input.source.mime_type = Some(if format == DocumentFormat::Text {
      input
        .source
        .declared_mime_type
        .clone()
        .unwrap_or_else(|| "text/plain".into())
    } else {
      effective_mime(format, &input.bytes)
    });
    let mut output = match format {
      DocumentFormat::Text => handlers::text::TextHandler::new().extract(&input.bytes, options),
      DocumentFormat::Docx => handlers::docx::DocxHandler::new().extract(&input.bytes, options),
      DocumentFormat::Xlsx => handlers::xlsx::XlsxHandler::new().extract(&input.bytes, options),
      DocumentFormat::Pptx => handlers::pptx::PptxHandler::new().extract(&input.bytes, options),
      DocumentFormat::Pdf => handlers::pdf::PdfHandler::new().extract(&input.bytes, options),
      DocumentFormat::Image => scheduler::image_handler().extract(&input.bytes, options),
    }?;
    if options.statistics
      && let Some(meta) = output.metadata.as_mut()
    {
      meta.statistics = Some(metadata::statistics(output.text.as_deref().unwrap_or("")));
    }
    if !options.text {
      output.text = None;
    }
    Ok(output)
  }))
  .unwrap_or_else(|_| {
    Err(ExtractionError::new(
      ErrorCode::InternalError,
      "parse",
      "document parser panicked",
    ))
  });
  let mut result = Processed {
    source: input.source,
    output,
    queue_time_ms,
    processing_time_ms: start.elapsed().as_secs_f64() * 1000.,
    metrics: options.metrics,
  };
  if result.output_bytes() > options.limits.max_output_bytes {
    result.output = Err(ExtractionError::limit("result exceeds maxOutputBytes"));
  }
  result
}
#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn unsupported_is_error() {
    let input = Input {
      source: SourceInfo {
        declared_mime_type: Some("application/unknown".into()),
        ..Default::default()
      },
      bytes: b"test".to_vec(),
      pre_error: None,
    };
    assert_eq!(
      process(input, &ResolvedOptions::default(), Instant::now())
        .output
        .unwrap_err()
        .code,
      ErrorCode::UnsupportedFormat
    );
  }
  #[test]
  fn strong_signature_rejects_conflicting_hint() {
    let input = Input {
      source: SourceInfo {
        declared_mime_type: Some("text/plain".into()),
        ..Default::default()
      },
      bytes: b"%PDF-1.4".to_vec(),
      pre_error: None,
    };
    assert_eq!(
      process(input, &ResolvedOptions::default(), Instant::now())
        .output
        .unwrap_err()
        .code,
      ErrorCode::FormatMismatch
    );
  }
}
