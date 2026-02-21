use crate::models::metadata::MetadataPayload;
use napi_derive::napi;

#[napi(object)]
pub struct SimilarityMatch {
  pub reference_index: u32,
  pub similarity_percentage: f64,
}

#[napi(object)]
pub struct DocumentMetadataWithSimilarity {
  pub name: String,
  pub size: f64,
  pub processing_time: f64,
  pub encoding: String,
  pub content: String,
  pub metadata: Option<MetadataPayload>,
  pub error: Option<String>,
  pub similarity_matches: Vec<SimilarityMatch>,
}

#[napi(object)]
pub struct GroupedDocumentsWithSimilarity {
  pub mime_type: String,
  pub documents: Vec<DocumentMetadataWithSimilarity>,
}
