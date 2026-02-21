mod core;
mod handlers;
mod models;

use core::handler::{DocumentHandler, ExtractionResult};
use core::similarity::{SimilarityMethod, similarity};
use dashmap::DashMap;
use handlers::docx::DocxHandler;
use handlers::image::ImageHandler;
use handlers::pdf::PdfHandler;
use handlers::text::TextHandler;
use handlers::xlsx::XlsxHandler;
use models::document::{Document, DocumentMetadata, GroupedDocuments};
use models::metadata::{MetadataPayload, TextMetadata, build_text_metadata};
use models::similarity::{
  DocumentMetadataWithSimilarity, GroupedDocumentsWithSimilarity, SimilarityMatch,
};
use napi_derive::napi;
use rayon::prelude::*;
use std::collections::HashMap;
use std::sync::Arc;
use std::sync::OnceLock;
use std::time::Instant;

type HandlerRegistry = Arc<Vec<Arc<dyn DocumentHandler>>>;

static HANDLER_REGISTRY: OnceLock<HandlerRegistry> = OnceLock::new();

struct ProcessedDocument {
  content: String,
  encoding: String,
  metadata: Option<MetadataPayload>,
  error: Option<String>,
  processing_time: f64,
  size: f64,
}

fn create_handler_registry() -> HandlerRegistry {
  HANDLER_REGISTRY
    .get_or_init(|| {
      Arc::new(vec![
        Arc::new(TextHandler::new()),
        Arc::new(DocxHandler::new()),
        Arc::new(XlsxHandler::new()),
        Arc::new(PdfHandler::new()),
        Arc::new(ImageHandler::new()),
      ])
    })
    .clone()
}

fn find_handler<'a>(
  mime_type: &str,
  handlers: &'a [Arc<dyn DocumentHandler>],
) -> Option<&'a Arc<dyn DocumentHandler>> {
  handlers
    .iter()
    .find(|handler| handler.is_supported(mime_type))
}

fn extract_document_content(
  document: &Document,
  handler: Option<&Arc<dyn DocumentHandler>>,
) -> ProcessedDocument {
  let start = Instant::now();
  let content_ref = document.buffer.as_ref();
  let size = content_ref.len() as f64;
  let extraction_result = match handler {
    Some(handler) => handler.extract(content_ref),
    None => ExtractionResult {
      content: Some(String::new()),
      encoding: Some("application/octet-stream".to_string()),
      metadata: None,
      error: None,
    },
  };
  let elapsed_ms = start.elapsed().as_secs_f64() * 1000.0;

  if let Some(error) = extraction_result.error.as_ref() {
    eprintln!("Error extracting {}: {}", document.name, error);
  }

  ProcessedDocument {
    content: extraction_result.content.unwrap_or_default(),
    encoding: extraction_result
      .encoding
      .unwrap_or_else(|| "application/octet-stream".to_string()),
    metadata: extraction_result.metadata,
    error: extraction_result.error,
    processing_time: elapsed_ms,
    size,
  }
}

fn group_by_mime_type(documents: &[Document]) -> HashMap<String, Vec<&Document>> {
  documents
    .iter()
    .fold(HashMap::new(), |mut accumulator, document| {
      accumulator
        .entry(document.r#type.clone())
        .or_insert_with(Vec::new)
        .push(document);
      accumulator
    })
}

/// Extracts content and metadata from input documents, grouped by MIME type.
///
/// # Parameters
/// - `documents`: Input document list. Each document should include
///   `name`, `type` (MIME), and `buffer` content.
///
/// # Returns
/// Returns a list of groups keyed by MIME type.
/// Each document entry contains:
/// - `content`: Extracted plain text (empty when unsupported)
/// - `encoding`: Detected encoding (or `application/octet-stream`)
/// - `metadata`: Structured metadata payload when available
/// - `error`: Extraction error message when extraction fails
/// - `processing_time`: Extraction time in milliseconds
///
/// # Example
/// ```ts
/// import { extract } from 'undms';
///
/// const result = extract([
///   {
///     name: 'note.txt',
///     size: 12,
///     type: 'text/plain',
///     lastModified: Date.now(),
///     webkitRelativePath: '',
///     buffer: Buffer.from('hello world!'),
///   },
/// ]);
/// ```
#[napi]
pub fn extract(documents: Vec<Document>) -> Vec<GroupedDocuments> {
  let handlers = create_handler_registry();
  let grouped: DashMap<String, Vec<DocumentMetadata>> = DashMap::new();
  let by_type = group_by_mime_type(&documents);

  by_type.par_iter().for_each(|(mime_type, docs)| {
    let handler = find_handler(mime_type, &handlers);
    let metadata_list: Vec<DocumentMetadata> = docs
      .iter()
      .map(|document| {
        let extracted = extract_document_content(document, handler);

        DocumentMetadata {
          name: document.name.clone(),
          size: extracted.size,
          processing_time: extracted.processing_time,
          content: extracted.content,
          encoding: extracted.encoding,
          metadata: extracted.metadata,
          error: extracted.error,
        }
      })
      .collect();

    grouped.insert(mime_type.clone(), metadata_list);
  });

  grouped
    .into_iter()
    .map(|(mime_type, documents)| GroupedDocuments {
      mime_type,
      documents,
    })
    .collect()
}

/// Extracts documents and computes similarity against reference texts.
///
/// Similarity is computed as a weighted blend of:
/// - content similarity (method-selected)
/// - metadata similarity (currently text metadata)
///
/// # Parameters
/// - `documents`: Documents to extract and compare.
/// - `reference_texts`: Candidate reference texts.
/// - `similarity_threshold`: Minimum score (0-100) to include a match.
///   Defaults to `30.0` when omitted.
/// - `similarity_method`: One of `jaccard`, `ngram`, `levenshtein`, `hybrid`.
///   Defaults to `hybrid` when omitted or invalid.
///
/// # Returns
/// Grouped documents with `similarity_matches` for references
/// whose score is greater than or equal to `similarity_threshold`.
///
/// # Example
/// ```ts
/// import { computeDocumentSimilarity } from 'undms';
///
/// const result = computeDocumentSimilarity(
///   [document],
///   ['reference text A', 'reference text B'],
///   70,
///   'hybrid',
/// );
/// ```
#[napi]
pub fn compute_document_similarity(
  documents: Vec<Document>,
  reference_texts: Vec<String>,
  similarity_threshold: Option<f64>,
  similarity_method: Option<String>,
) -> Vec<GroupedDocumentsWithSimilarity> {
  let threshold = similarity_threshold.unwrap_or(30.0);
  let method = parse_similarity_method(similarity_method.as_deref());
  let handlers = create_handler_registry();
  let grouped: DashMap<String, Vec<DocumentMetadataWithSimilarity>> = DashMap::new();
  let by_type = group_by_mime_type(&documents);

  by_type.par_iter().for_each(|(mime_type, docs)| {
    let handler = find_handler(mime_type, &handlers);
    let metadata_list: Vec<DocumentMetadataWithSimilarity> = docs
      .iter()
      .map(|document| {
        let extracted = extract_document_content(document, handler);
        let similarity_matches = compute_similarity_matches(
          &extracted.content,
          &extracted.metadata,
          &extracted.error,
          &reference_texts,
          method,
          threshold,
        );

        DocumentMetadataWithSimilarity {
          name: document.name.clone(),
          size: extracted.size,
          processing_time: extracted.processing_time,
          encoding: extracted.encoding,
          content: extracted.content,
          metadata: extracted.metadata,
          error: extracted.error,
          similarity_matches,
        }
      })
      .collect();

    grouped.insert(mime_type.clone(), metadata_list);
  });

  grouped
    .into_iter()
    .map(|(mime_type, documents)| GroupedDocumentsWithSimilarity {
      mime_type,
      documents,
    })
    .collect()
}

fn parse_similarity_method(method: Option<&str>) -> SimilarityMethod {
  match method {
    Some("jaccard") => SimilarityMethod::Jaccard,
    Some("ngram") => SimilarityMethod::Ngram,
    Some("levenshtein") => SimilarityMethod::Levenshtein,
    Some("hybrid") | None => SimilarityMethod::Hybrid,
    _ => SimilarityMethod::Hybrid,
  }
}

fn compute_similarity_matches(
  content: &str,
  metadata: &Option<MetadataPayload>,
  extraction_error: &Option<String>,
  reference_texts: &[String],
  method: SimilarityMethod,
  threshold: f64,
) -> Vec<SimilarityMatch> {
  if content.is_empty() || extraction_error.is_some() {
    return Vec::new();
  }

  let source_text_metadata = metadata.as_ref().and_then(|payload| payload.text.as_ref());

  reference_texts
    .par_iter()
    .enumerate()
    .filter_map(|(index, reference_text)| {
      let content_similarity = similarity(content, reference_text, method);
      let reference_metadata = build_text_metadata(reference_text);
      let combined_similarity = combine_similarity(
        content_similarity,
        source_text_metadata,
        reference_metadata.as_ref(),
      );

      if combined_similarity >= threshold {
        Some(SimilarityMatch {
          reference_index: index as u32,
          similarity_percentage: combined_similarity,
        })
      } else {
        None
      }
    })
    .collect()
}

fn field_similarity(left: u32, right: u32) -> f64 {
  let max = left.max(right);
  if max == 0 {
    return 100.0;
  }

  let difference = left.abs_diff(right) as f64;
  ((1.0 - (difference / max as f64)) * 100.0).max(0.0)
}

fn text_metadata_similarity(source: &TextMetadata, target: &TextMetadata) -> f64 {
  let line_similarity = field_similarity(source.line_count, target.line_count);
  let word_similarity = field_similarity(source.word_count, target.word_count);
  let character_similarity = field_similarity(source.character_count, target.character_count);
  let non_whitespace_similarity = field_similarity(
    source.non_whitespace_character_count,
    target.non_whitespace_character_count,
  );

  (line_similarity + word_similarity + character_similarity + non_whitespace_similarity) / 4.0
}

fn combine_similarity(
  content_similarity: f64,
  source_metadata: Option<&TextMetadata>,
  reference_metadata: Option<&TextMetadata>,
) -> f64 {
  match (source_metadata, reference_metadata) {
    (Some(source), Some(reference)) => {
      let metadata_similarity = text_metadata_similarity(source, reference);
      (content_similarity * 0.8) + (metadata_similarity * 0.2)
    }
    _ => content_similarity,
  }
}

/// Computes similarity matches for plain text input without file extraction.
///
/// # Parameters
/// - `source_text`: Source text to compare.
/// - `reference_texts`: Candidate reference texts.
/// - `similarity_threshold`: Minimum score (0-100) to include a match.
///   Defaults to `30.0` when omitted.
/// - `similarity_method`: One of `jaccard`, `ngram`, `levenshtein`, `hybrid`.
///   Defaults to `hybrid` when omitted or invalid.
///
/// # Returns
/// A list of `SimilarityMatch` values containing:
/// - `reference_index`: Index into `reference_texts`
/// - `similarity_percentage`: Final similarity score
///
/// # Example
/// ```ts
/// import { computeTextSimilarity } from 'undms';
///
/// const matches = computeTextSimilarity(
///   'alpha beta gamma',
///   ['alpha beta gamma', 'other'],
///   80,
///   'jaccard',
/// );
/// ```
#[napi]
pub fn compute_text_similarity(
  source_text: String,
  reference_texts: Vec<String>,
  similarity_threshold: Option<f64>,
  similarity_method: Option<String>,
) -> Vec<SimilarityMatch> {
  let threshold = similarity_threshold.unwrap_or(30.0);
  let method = parse_similarity_method(similarity_method.as_deref());
  let source_metadata = build_text_metadata(&source_text).map(|text| MetadataPayload {
    text: Some(text),
    docx: None,
    xlsx: None,
    pdf: None,
    image: None,
  });

  compute_similarity_matches(
    &source_text,
    &source_metadata,
    &None,
    &reference_texts,
    method,
    threshold,
  )
}

#[cfg(test)]
mod tests {
  use super::*;
  use napi::bindgen_prelude::Buffer;

  struct FailingHandler;

  impl DocumentHandler for FailingHandler {
    fn is_supported(&self, _mime_type: &str) -> bool {
      true
    }

    fn extract(&self, _content: &[u8]) -> ExtractionResult {
      ExtractionResult {
        content: None,
        encoding: Some("utf-8".to_string()),
        metadata: None,
        error: Some("forced extraction failure".to_string()),
      }
    }
  }

  #[test]
  fn extract_document_content_propagates_handler_error() {
    let document = Document {
      name: "broken.txt".to_string(),
      size: 2.0,
      r#type: "text/plain".to_string(),
      last_modified: 0.0,
      webkit_relative_path: String::new(),
      buffer: Buffer::from(vec![0xff, 0xfe]),
    };
    let handler: Arc<dyn DocumentHandler> = Arc::new(FailingHandler);

    let result = extract_document_content(&document, Some(&handler));

    assert_eq!(result.content, "");
    assert_eq!(result.encoding, "utf-8");
    assert_eq!(result.error.as_deref(), Some("forced extraction failure"));
    assert!(result.processing_time >= 0.0);
    assert_eq!(result.size, 2.0);
  }

  #[test]
  fn compute_similarity_matches_returns_empty_on_extraction_error() {
    let reference_texts = vec!["alpha beta".to_string()];
    let matches = compute_similarity_matches(
      "alpha beta",
      &None,
      &Some("forced extraction failure".to_string()),
      &reference_texts,
      SimilarityMethod::Hybrid,
      0.0,
    );

    assert!(matches.is_empty());
  }
}
