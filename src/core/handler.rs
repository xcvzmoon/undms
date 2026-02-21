use crate::models::metadata::MetadataPayload;

pub struct ExtractionResult {
  pub content: Option<String>,
  pub encoding: Option<String>,
  pub metadata: Option<MetadataPayload>,
  pub error: Option<String>,
}

pub trait DocumentHandler: Send + Sync {
  fn is_supported(&self, mime_type: &str) -> bool;
  fn extract(&self, content: &[u8]) -> ExtractionResult;
}
