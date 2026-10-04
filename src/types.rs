//! Portable extraction values. This module has no Node or WASM runtime dependencies.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum DocumentFormat {
  Text,
  Docx,
  Xlsx,
  Pptx,
  Pdf,
  Image,
}
#[derive(Clone, Debug, Default)]
pub struct SourceInfo {
  pub id: Option<String>,
  pub name: Option<String>,
  pub byte_length: usize,
  pub declared_mime_type: Option<String>,
  pub mime_type: Option<String>,
  pub format: Option<DocumentFormat>,
}
#[derive(Clone, Debug, Default)]
pub struct DocumentProperties {
  pub title: Option<String>,
  pub author: Option<String>,
  pub subject: Option<String>,
  pub creator: Option<String>,
  pub producer: Option<String>,
  pub created: Option<String>,
  pub modified: Option<String>,
}
#[derive(Clone, Debug, Default, PartialEq, Eq)]
pub struct TextStatistics {
  pub line_count: u64,
  pub word_count: u64,
  pub character_count: u64,
  pub non_whitespace_character_count: u64,
}
#[derive(Clone, Debug, Default)]
pub struct WordMetadata {
  pub paragraph_count: u32,
  pub table_count: u32,
  pub image_count: u32,
  pub hyperlink_count: u32,
}
#[derive(Clone, Debug, Default)]
pub struct SheetMetadata {
  pub name: String,
  pub row_count: u32,
  pub column_count: u32,
  pub cell_count: u64,
}
#[derive(Clone, Debug, Default)]
pub struct SpreadsheetMetadata {
  pub sheets: Vec<SheetMetadata>,
}
#[derive(Clone, Debug, Default)]
pub struct PresentationMetadata {
  pub slide_count: u32,
}
#[derive(Clone, Debug)]
pub struct Dimensions {
  pub width: f64,
  pub height: f64,
}
#[derive(Clone, Debug, Default)]
pub struct PdfMetadata {
  pub page_count: u32,
  pub page_size_points: Option<Dimensions>,
}
#[derive(Clone, Debug, Default)]
pub struct GeoLocation {
  pub latitude: Option<f64>,
  pub longitude: Option<f64>,
}
#[derive(Clone, Debug, Default)]
pub struct ImageMetadata {
  pub width: u32,
  pub height: u32,
  pub format: Option<String>,
  pub camera_make: Option<String>,
  pub camera_model: Option<String>,
  pub datetime_original: Option<String>,
  pub location: GeoLocation,
}
#[derive(Clone, Debug)]
pub enum FormatMetadata {
  Text,
  Docx(WordMetadata),
  Xlsx(SpreadsheetMetadata),
  Pptx(PresentationMetadata),
  Pdf(PdfMetadata),
  Image(ImageMetadata),
}
#[derive(Clone, Debug)]
pub struct DocumentMetadata {
  pub properties: DocumentProperties,
  pub statistics: Option<TextStatistics>,
  pub format: FormatMetadata,
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum ErrorCode {
  UnsupportedFormat,
  FormatMismatch,
  InvalidDocument,
  DecodeFailed,
  LimitExceeded,
  OcrFailed,
  InternalError,
}
impl ErrorCode {
  pub fn name(self) -> &'static str {
    match self {
      Self::UnsupportedFormat => "UNSUPPORTED_FORMAT",
      Self::FormatMismatch => "FORMAT_MISMATCH",
      Self::InvalidDocument => "INVALID_DOCUMENT",
      Self::DecodeFailed => "DECODE_FAILED",
      Self::LimitExceeded => "LIMIT_EXCEEDED",
      Self::OcrFailed => "OCR_FAILED",
      Self::InternalError => "INTERNAL_ERROR",
    }
  }
}
#[derive(Clone, Debug)]
pub struct ExtractionError {
  pub code: ErrorCode,
  pub message: String,
  pub stage: &'static str,
}
impl ExtractionError {
  pub fn new(code: ErrorCode, stage: &'static str, message: impl Into<String>) -> Self {
    Self {
      code,
      stage,
      message: message.into(),
    }
  }
  pub fn invalid(message: impl Into<String>) -> Self {
    Self::new(ErrorCode::InvalidDocument, "parse", message)
  }
  pub fn limit(message: impl Into<String>) -> Self {
    Self::new(ErrorCode::LimitExceeded, "limits", message)
  }
}
impl std::fmt::Display for ExtractionError {
  fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
    write!(f, "{}: {}", self.code.name(), self.message)
  }
}
impl std::error::Error for ExtractionError {}
pub type ExtractionResult<T> = Result<T, ExtractionError>;
#[derive(Clone, Debug)]
pub struct ExtractionWarning {
  pub code: &'static str,
  pub message: String,
  pub location: Option<String>,
  pub partial: bool,
}
#[derive(Debug)]
pub struct HandlerOutput {
  pub text: Option<String>,
  pub encoding: Option<String>,
  pub metadata: Option<DocumentMetadata>,
  pub warnings: Vec<ExtractionWarning>,
}
impl HandlerOutput {
  pub fn new(text: Option<String>, format: FormatMetadata, options: &ResolvedOptions) -> Self {
    Self {
      text,
      encoding: None,
      metadata: options.metadata.then_some(DocumentMetadata {
        properties: DocumentProperties::default(),
        statistics: None,
        format,
      }),
      warnings: Vec::new(),
    }
  }
}
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
pub enum OcrPolicy {
  Disabled,
  Fast,
  Balanced,
  Accurate,
}
#[derive(Clone, Debug)]
pub struct ResourceLimits {
  pub max_input_bytes: usize,
  pub max_output_bytes: usize,
  pub max_decompressed_bytes: usize,
  pub max_archive_entries: usize,
  pub max_image_pixels: u64,
  pub max_warnings: usize,
}
impl Default for ResourceLimits {
  fn default() -> Self {
    Self {
      max_input_bytes: 64 * 1024 * 1024,
      max_output_bytes: 16 * 1024 * 1024,
      max_decompressed_bytes: 128 * 1024 * 1024,
      max_archive_entries: 10_000,
      max_image_pixels: 20_000_000,
      max_warnings: 100,
    }
  }
}
#[derive(Clone, Debug)]
pub struct ResolvedOptions {
  pub text: bool,
  pub metadata: bool,
  pub statistics: bool,
  pub encoding: Option<String>,
  pub replace_invalid: bool,
  pub ocr: OcrPolicy,
  pub metrics: bool,
  pub limits: ResourceLimits,
}
impl Default for ResolvedOptions {
  fn default() -> Self {
    Self {
      text: true,
      metadata: true,
      statistics: true,
      encoding: None,
      replace_invalid: false,
      ocr: OcrPolicy::Balanced,
      metrics: false,
      limits: ResourceLimits::default(),
    }
  }
}
impl ResolvedOptions {
  pub fn needs_text(&self) -> bool {
    self.text || (self.metadata && self.statistics)
  }
}
pub trait DocumentHandler: Send + Sync {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput>;
}

/// Enforces the output budget while constructing strings, not after allocation.
pub fn push_text(
  output: &mut String,
  value: &str,
  options: &ResolvedOptions,
) -> ExtractionResult<()> {
  if output
    .len()
    .checked_add(value.len())
    .is_none_or(|n| n > options.limits.max_output_bytes)
  {
    return Err(ExtractionError::limit(
      "extracted text exceeds maxOutputBytes",
    ));
  }
  let required = output.len() + value.len();
  if output.capacity() < required {
    let target = required
      .max(output.capacity().saturating_mul(2))
      .min(options.limits.max_output_bytes);
    output
      .try_reserve_exact(target - output.len())
      .map_err(|_| ExtractionError::limit("unable to allocate bounded text output"))?;
  }
  output.push_str(value);
  Ok(())
}
pub fn warn(
  warnings: &mut Vec<ExtractionWarning>,
  warning: ExtractionWarning,
  options: &ResolvedOptions,
) {
  if warnings.len() < options.limits.max_warnings {
    warnings.push(warning);
  } else if let Some(last) = warnings.last_mut() {
    last.code = "WARNINGS_TRUNCATED";
    last.message = "Additional warnings omitted".into();
    last.partial = true;
    last.location = None;
  }
}
