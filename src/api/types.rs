use crate::types as domain;
use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

#[napi(string_enum = "lowercase")]
pub enum DocumentFormat {
  Text,
  Docx,
  Xlsx,
  Pptx,
  Pdf,
  Image,
}
impl From<domain::DocumentFormat> for DocumentFormat {
  fn from(value: domain::DocumentFormat) -> Self {
    match value {
      domain::DocumentFormat::Text => Self::Text,
      domain::DocumentFormat::Docx => Self::Docx,
      domain::DocumentFormat::Xlsx => Self::Xlsx,
      domain::DocumentFormat::Pptx => Self::Pptx,
      domain::DocumentFormat::Pdf => Self::Pdf,
      domain::DocumentFormat::Image => Self::Image,
    }
  }
}

#[napi(string_enum = "UPPER_SNAKE")]
pub enum ErrorCode {
  UnsupportedFormat,
  FormatMismatch,
  InvalidDocument,
  DecodeFailed,
  LimitExceeded,
  OcrFailed,
  InternalError,
}
impl From<domain::ErrorCode> for ErrorCode {
  fn from(value: domain::ErrorCode) -> Self {
    match value {
      domain::ErrorCode::UnsupportedFormat => Self::UnsupportedFormat,
      domain::ErrorCode::FormatMismatch => Self::FormatMismatch,
      domain::ErrorCode::InvalidDocument => Self::InvalidDocument,
      domain::ErrorCode::DecodeFailed => Self::DecodeFailed,
      domain::ErrorCode::LimitExceeded => Self::LimitExceeded,
      domain::ErrorCode::OcrFailed => Self::OcrFailed,
      domain::ErrorCode::InternalError => Self::InternalError,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct SourceInfo {
  pub id: Option<String>,
  pub name: Option<String>,
  pub byte_length: f64,
  pub declared_mime_type: Option<String>,
  pub mime_type: Option<String>,
  pub format: Option<DocumentFormat>,
}
impl From<domain::SourceInfo> for SourceInfo {
  fn from(value: domain::SourceInfo) -> Self {
    Self {
      id: value.id,
      name: value.name,
      byte_length: value.byte_length as f64,
      declared_mime_type: value.declared_mime_type,
      mime_type: value.mime_type,
      format: value.format.map(Into::into),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct DocumentProperties {
  pub title: Option<String>,
  pub author: Option<String>,
  pub subject: Option<String>,
  pub creator: Option<String>,
  pub producer: Option<String>,
  pub created: Option<String>,
  pub modified: Option<String>,
}
impl From<domain::DocumentProperties> for DocumentProperties {
  fn from(value: domain::DocumentProperties) -> Self {
    Self {
      title: value.title,
      author: value.author,
      subject: value.subject,
      creator: value.creator,
      producer: value.producer,
      created: value.created,
      modified: value.modified,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct TextStatistics {
  pub line_count: f64,
  pub word_count: f64,
  pub character_count: f64,
  pub non_whitespace_character_count: f64,
}
impl From<domain::TextStatistics> for TextStatistics {
  fn from(value: domain::TextStatistics) -> Self {
    Self {
      line_count: value.line_count as f64,
      word_count: value.word_count as f64,
      character_count: value.character_count as f64,
      non_whitespace_character_count: value.non_whitespace_character_count as f64,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct WordMetadata {
  pub paragraph_count: u32,
  pub table_count: u32,
  pub image_count: u32,
  pub hyperlink_count: u32,
}
impl From<domain::WordMetadata> for WordMetadata {
  fn from(value: domain::WordMetadata) -> Self {
    Self {
      paragraph_count: value.paragraph_count,
      table_count: value.table_count,
      image_count: value.image_count,
      hyperlink_count: value.hyperlink_count,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct SheetMetadata {
  pub name: String,
  pub row_count: u32,
  pub column_count: u32,
  pub cell_count: f64,
}
impl From<domain::SheetMetadata> for SheetMetadata {
  fn from(value: domain::SheetMetadata) -> Self {
    Self {
      name: value.name,
      row_count: value.row_count,
      column_count: value.column_count,
      cell_count: value.cell_count as f64,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct SpreadsheetMetadata {
  pub sheets: Vec<SheetMetadata>,
}
impl From<domain::SpreadsheetMetadata> for SpreadsheetMetadata {
  fn from(value: domain::SpreadsheetMetadata) -> Self {
    Self {
      sheets: value.sheets.into_iter().map(Into::into).collect(),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct PresentationMetadata {
  pub slide_count: u32,
}
impl From<domain::PresentationMetadata> for PresentationMetadata {
  fn from(value: domain::PresentationMetadata) -> Self {
    Self {
      slide_count: value.slide_count,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct Dimensions {
  pub width: f64,
  pub height: f64,
}
impl From<domain::Dimensions> for Dimensions {
  fn from(value: domain::Dimensions) -> Self {
    Self {
      width: value.width,
      height: value.height,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct PdfMetadata {
  pub page_count: u32,
  pub page_size_points: Option<Dimensions>,
}
impl From<domain::PdfMetadata> for PdfMetadata {
  fn from(value: domain::PdfMetadata) -> Self {
    Self {
      page_count: value.page_count,
      page_size_points: value.page_size_points.map(Into::into),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct GeoLocation {
  pub latitude: Option<f64>,
  pub longitude: Option<f64>,
}
impl From<domain::GeoLocation> for GeoLocation {
  fn from(value: domain::GeoLocation) -> Self {
    Self {
      latitude: value.latitude,
      longitude: value.longitude,
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct ImageMetadata {
  pub width: u32,
  pub height: u32,
  pub format: Option<String>,
  pub camera_make: Option<String>,
  pub camera_model: Option<String>,
  pub datetime_original: Option<String>,
  pub location: GeoLocation,
}
impl From<domain::ImageMetadata> for ImageMetadata {
  fn from(value: domain::ImageMetadata) -> Self {
    Self {
      width: value.width,
      height: value.height,
      format: value.format,
      camera_make: value.camera_make,
      camera_model: value.camera_model,
      datetime_original: value.datetime_original,
      location: value.location.into(),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct DocumentMetadata {
  pub properties: DocumentProperties,
  pub statistics: Option<TextStatistics>,
  pub format: FormatMetadata,
}
impl From<domain::DocumentMetadata> for DocumentMetadata {
  fn from(value: domain::DocumentMetadata) -> Self {
    Self {
      properties: value.properties.into(),
      statistics: value.statistics.map(Into::into),
      format: value.format.into(),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct ExtractionError {
  pub code: ErrorCode,
  pub message: String,
  pub stage: String,
}
impl From<domain::ExtractionError> for ExtractionError {
  fn from(value: domain::ExtractionError) -> Self {
    Self {
      code: value.code.into(),
      message: value.message,
      stage: value.stage.to_string(),
    }
  }
}

#[napi(object, object_from_js = false)]
pub struct ExtractionWarning {
  pub code: String,
  pub message: String,
  pub location: Option<String>,
}
impl From<domain::ExtractionWarning> for ExtractionWarning {
  fn from(value: domain::ExtractionWarning) -> Self {
    Self {
      code: value.code.to_string(),
      message: value.message,
      location: value.location,
    }
  }
}

#[napi(object)]
pub struct ExtractionInput {
  pub data: Buffer,
  pub id: Option<String>,
  pub name: Option<String>,
  pub mime_type: Option<String>,
}
#[napi(
  discriminant = "kind",
  discriminant_case = "lowercase",
  object_from_js = false
)]
pub enum FormatMetadata {
  Text {},
  Docx { details: WordMetadata },
  Xlsx { details: SpreadsheetMetadata },
  Pptx { details: PresentationMetadata },
  Pdf { details: PdfMetadata },
  Image { details: ImageMetadata },
}
impl From<domain::FormatMetadata> for FormatMetadata {
  fn from(value: domain::FormatMetadata) -> Self {
    match value {
      domain::FormatMetadata::Text => Self::Text {},
      domain::FormatMetadata::Docx(v) => Self::Docx { details: v.into() },
      domain::FormatMetadata::Xlsx(v) => Self::Xlsx { details: v.into() },
      domain::FormatMetadata::Pptx(v) => Self::Pptx { details: v.into() },
      domain::FormatMetadata::Pdf(v) => Self::Pdf { details: v.into() },
      domain::FormatMetadata::Image(v) => Self::Image { details: v.into() },
    }
  }
}
#[napi(object, object_from_js = false)]
pub struct ProcessingMetrics {
  pub queue_time_ms: f64,
  pub processing_time_ms: f64,
}
#[napi(object, object_from_js = false)]
pub struct ExtractionResult {
  pub source: SourceInfo,
  pub text: Option<String>,
  pub encoding: Option<String>,
  pub metadata: Option<DocumentMetadata>,
  pub warnings: Vec<ExtractionWarning>,
  pub metrics: Option<ProcessingMetrics>,
}
#[napi(
  discriminant = "status",
  discriminant_case = "lowercase",
  object_from_js = false
)]
pub enum ExtractionOutcome {
  Success {
    result: ExtractionResult,
  },
  Partial {
    result: ExtractionResult,
  },
  Error {
    source: SourceInfo,
    error: ExtractionError,
  },
}
#[napi(object, object_from_js = false)]
pub struct BatchItemResult {
  pub index: u32,
  pub outcome: ExtractionOutcome,
}
#[napi(object, object_from_js = false)]
pub struct BatchSummary {
  pub success_count: u32,
  pub partial_count: u32,
  pub error_count: u32,
}
#[napi(object, object_from_js = false)]
pub struct BatchResult {
  pub items: Vec<BatchItemResult>,
  pub summary: BatchSummary,
}
