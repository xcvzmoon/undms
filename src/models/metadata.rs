use napi_derive::napi;

#[napi(object)]
#[derive(Debug)]
pub struct TextMetadata {
  pub line_count: u32,
  pub word_count: u32,
  pub character_count: u32,
  pub non_whitespace_character_count: u32,
}

#[napi(object)]
#[derive(Debug)]
pub struct DocxMetadata {
  pub paragraph_count: u32,
  pub table_count: u32,
  pub image_count: u32,
  pub hyperlink_count: u32,
}

#[napi(object)]
#[derive(Debug)]
pub struct XlsxMetadata {
  pub sheet_count: u32,
  pub sheet_names: Vec<String>,
  pub row_count: u32,
  pub column_count: u32,
  pub cell_count: u32,
}

#[napi(object)]
#[derive(Debug)]
pub struct PdfMetadata {
  pub title: Option<String>,
  pub author: Option<String>,
  pub subject: Option<String>,
  pub producer: Option<String>,
  pub page_size: Option<PdfPageSize>,
  pub page_count: u32,
}

#[napi(object)]
#[derive(Debug)]
pub struct PdfPageSize {
  pub width: f64,
  pub height: f64,
}

#[napi(object)]
#[derive(Debug)]
pub struct ImageLocation {
  pub latitude: Option<f64>,
  pub longitude: Option<f64>,
}

#[napi(object)]
#[derive(Debug)]
pub struct ImageMetadata {
  pub width: u32,
  pub height: u32,
  pub format: Option<String>,
  pub camera_make: Option<String>,
  pub camera_model: Option<String>,
  pub datetime_original: Option<String>,
  pub location: ImageLocation,
}

#[napi(object)]
#[derive(Debug)]
pub struct MetadataPayload {
  pub text: Option<TextMetadata>,
  pub docx: Option<DocxMetadata>,
  pub xlsx: Option<XlsxMetadata>,
  pub pdf: Option<PdfMetadata>,
  pub image: Option<ImageMetadata>,
}

pub fn build_text_metadata(content: &str) -> Option<TextMetadata> {
  if content.is_empty() {
    return None;
  }

  Some(TextMetadata {
    line_count: content.lines().count() as u32,
    word_count: content.split_whitespace().count() as u32,
    character_count: content.chars().count() as u32,
    non_whitespace_character_count: content
      .chars()
      .filter(|character| !character.is_whitespace())
      .count() as u32,
  })
}
