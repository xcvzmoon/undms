use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, PdfMetadata, PdfPageSize, build_text_metadata};
use lopdf::{Document, Object};

pub struct PdfHandler;

impl PdfHandler {
  pub fn new() -> Self {
    Self
  }

  fn extract_text_with_metadata(&self, content: &[u8]) -> Result<(String, PdfMetadata), String> {
    let document =
      Document::load_mem(content).map_err(|e| format!("PDF extraction failed: {}", e))?;

    let pages = document.get_pages();
    let page_count = pages.len() as u32;

    let mut text = String::new();
    for (page_num, _) in pages.iter() {
      if let Ok(page_text) = document.extract_text(&[*page_num]) {
        text.push_str(&page_text);
        text.push('\n');
      }
    }

    let mut cleaned = String::new();
    for line in text.lines().map(str::trim).filter(|line| !line.is_empty()) {
      if !cleaned.is_empty() {
        cleaned.push('\n');
      }
      cleaned.push_str(line);
    }

    let mut pdf_metadata = self.extract_pdf_metadata(&document, page_count);

    if pdf_metadata.page_count == 0 {
      pdf_metadata.page_count = page_count;
    }

    Ok((cleaned, pdf_metadata))
  }

  fn extract_pdf_metadata(&self, document: &Document, page_count: u32) -> PdfMetadata {
    let mut title = None;
    let mut author = None;
    let mut subject = None;
    let mut producer = None;
    let mut page_size = None;

    let pages = document.get_pages();

    if let Some((_, first_page_id)) = pages.iter().next() {
      if let Ok(Object::Dictionary(page_dict)) = document.get_object(*first_page_id) {
        if let Some(size) = Self::extract_page_size(document, page_dict) {
          page_size = Some(size);
        }
      }
    }

    if let Ok(Object::Reference(info_ref)) = document.trailer.get(b"Info") {
      if let Ok(Object::Dictionary(info_dict)) = document.get_object(*info_ref) {
        title = Self::extract_info_string(&info_dict, b"Title");
        author = Self::extract_info_string(&info_dict, b"Author");
        subject = Self::extract_info_string(&info_dict, b"Subject");
        producer = Self::extract_info_string(&info_dict, b"Producer");
      }
    }

    PdfMetadata {
      title,
      author,
      subject,
      producer,
      page_size,
      page_count,
    }
  }

  fn extract_page_size(document: &Document, page_dict: &lopdf::Dictionary) -> Option<PdfPageSize> {
    let media_box = page_dict
      .get(b"MediaBox")
      .ok()
      .or_else(|| page_dict.get(b"CropBox").ok())?;

    let resolved = match media_box {
      Object::Reference(object_id) => document.get_object(*object_id).ok()?.clone(),
      other => other.clone(),
    };

    let array = match resolved {
      Object::Array(values) => values,
      _ => return None,
    };

    if array.len() != 4 {
      return None;
    }

    let llx = Self::object_to_f64(&array[0])?;
    let lly = Self::object_to_f64(&array[1])?;
    let urx = Self::object_to_f64(&array[2])?;
    let ury = Self::object_to_f64(&array[3])?;

    Some(PdfPageSize {
      width: (urx - llx).abs(),
      height: (ury - lly).abs(),
    })
  }

  fn object_to_f64(object: &Object) -> Option<f64> {
    match object {
      Object::Real(value) => Some((*value).into()),
      Object::Integer(value) => Some(*value as f64),
      _ => None,
    }
  }

  fn extract_info_string(info: &lopdf::Dictionary, key: &[u8]) -> Option<String> {
    match info.get(key).ok()? {
      Object::String(bytes, _) => Some(String::from_utf8_lossy(bytes).to_string()),
      Object::Name(bytes) => Some(String::from_utf8_lossy(bytes).to_string()),
      _ => None,
    }
  }

  fn build_metadata(&self, content: &str, pdf_metadata: PdfMetadata) -> MetadataPayload {
    let text_metadata = build_text_metadata(content);

    MetadataPayload {
      text: text_metadata,
      docx: None,
      xlsx: None,
      pdf: Some(pdf_metadata),
      image: None,
    }
  }
}

impl DocumentHandler for PdfHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    mime_type == "application/pdf"
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    match self.extract_text_with_metadata(content) {
      Ok((text, pdf_metadata)) => {
        let metadata = self.build_metadata(&text, pdf_metadata);
        ExtractionResult {
          content: Some(text),
          encoding: Some("utf-8".to_string()),
          metadata: Some(metadata),
          error: None,
        }
      }
      Err(error) => ExtractionResult {
        content: None,
        encoding: Some("utf-8".to_string()),
        metadata: None,
        error: Some(error),
      },
    }
  }
}
