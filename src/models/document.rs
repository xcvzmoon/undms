use crate::models::metadata::MetadataPayload;

use napi::bindgen_prelude::Buffer;
use napi_derive::napi;

#[napi(object)]
pub struct Document {
  pub name: String,
  pub size: f64,
  pub r#type: String,
  pub last_modified: f64,
  pub webkit_relative_path: String,
  pub buffer: Buffer,
}

#[napi(object)]
pub struct DocumentMetadata {
  pub name: String,
  pub size: f64,
  pub processing_time: f64,
  pub encoding: String,
  pub content: String,
  pub metadata: Option<MetadataPayload>,
  pub error: Option<String>,
}

#[napi(object)]
pub struct GroupedDocuments {
  pub mime_type: String,
  pub documents: Vec<DocumentMetadata>,
}
