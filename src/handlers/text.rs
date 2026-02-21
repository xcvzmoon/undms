use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, build_text_metadata};
use chardetng::EncodingDetector;
use encoding_rs::Encoding;

pub struct TextHandler;

impl TextHandler {
  pub fn new() -> Self {
    Self
  }

  fn detect_encoding(&self, content: &[u8]) -> String {
    let mut detector = EncodingDetector::new();
    detector.feed(content, true);

    let encoding = detector.guess(None, true);
    encoding.name().to_string()
  }

  fn validate_mime_type(&self, mime_type: &str) -> bool {
    mime_type.starts_with("text/")
      || matches!(
        mime_type,
        "application/json"
          | "application/xml"
          | "application/javascript"
          | "application/typescript"
          | "application/x-javascript"
          | "application/xhtml+xml"
          | "application/ld+json"
      )
  }

  fn decode_text(&self, encoding_name: &str, content: &[u8]) -> String {
    let encoding = Encoding::for_label(encoding_name.as_bytes()).unwrap_or(encoding_rs::UTF_8);
    let (decoded, _encoding_used, had_errors) = encoding.decode(content);

    if had_errors {
      String::new()
    } else {
      decoded.to_string()
    }
  }

  fn build_text_metadata(&self, content: &str) -> Option<MetadataPayload> {
    build_text_metadata(content).map(|text| MetadataPayload {
      text: Some(text),
      docx: None,
      xlsx: None,
      pdf: None,
      image: None,
    })
  }
}

impl DocumentHandler for TextHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    self.validate_mime_type(mime_type)
      || mime_type == "text/csv"
      || mime_type == "text/tsv"
      || mime_type == "text/tab-separated-values"
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    let encoding = self.detect_encoding(content);
    let text = self.decode_text(&encoding, content);
    let normalized_encoding = encoding.to_ascii_lowercase();

    if text.is_empty() && !content.is_empty() {
      ExtractionResult {
        content: None,
        encoding: Some(normalized_encoding),
        metadata: None,
        error: Some("Failed to decode text content".to_string()),
      }
    } else {
      let metadata = self.build_text_metadata(&text);
      ExtractionResult {
        content: Some(text),
        encoding: Some(normalized_encoding),
        metadata,
        error: None,
      }
    }
  }
}
