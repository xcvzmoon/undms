use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, PdfMetadata, PdfPageSize, build_text_metadata};
use lopdf::{Document, Object};
use pdf_extract::extract_text_from_mem;

pub struct PdfHandler;

impl PdfHandler {
  pub fn new() -> Self {
    Self
  }

  fn extract_text_with_metadata(&self, content: &[u8]) -> Result<(String, PdfMetadata), String> {
    match extract_text_from_mem(content) {
      Ok(text) => {
        let cleaned = text
          .lines()
          .map(|line| line.trim())
          .filter(|line| !line.is_empty())
          .collect::<Vec<_>>()
          .join("\n");

        let mut pdf_metadata = self.extract_pdf_metadata(content);

        if pdf_metadata.page_count == 0 {
          let page_breaks = text.matches('\x0c').count() as u32;
          pdf_metadata.page_count = if text.trim().is_empty() {
            0
          } else {
            page_breaks + 1
          };
        }

        Ok((cleaned, pdf_metadata))
      }
      Err(error) => Err(format!("PDF extraction failed: {}", error)),
    }
  }

  fn extract_pdf_metadata(&self, content: &[u8]) -> PdfMetadata {
    let mut title = None;
    let mut author = None;
    let mut subject = None;
    let mut producer = None;
    let mut page_size = None;
    let mut page_count = 0u32;

    if let Ok(document) = Document::load_mem(content) {
      let pages = document.get_pages();
      page_count = pages.len() as u32;

      if let Some((_, first_page_id)) = pages.iter().next() {
        if let Ok(Object::Dictionary(page_dict)) = document.get_object(*first_page_id) {
          if let Some(size) = Self::extract_page_size(&document, page_dict) {
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
