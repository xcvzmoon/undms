use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{DocxMetadata, MetadataPayload, build_text_metadata};
use docx_rs::{DocumentChild, DrawingData, ParagraphChild, RunChild, read_docx};

pub struct DocxHandler;

impl DocxHandler {
  pub fn new() -> Self {
    Self
  }

  fn validate_mime_type(&self, mime_type: &str) -> bool {
    mime_type == "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      || mime_type == "application/docx"
  }

  fn extract_text(&self, content: &[u8]) -> Result<String, String> {
    let docx = read_docx(content).map_err(|error| format!("Failed to read DOCX: {}", error))?;
    let mut text = String::new();

    for child in &docx.document.children {
      if let DocumentChild::Paragraph(para) = child {
        for run in &para.children {
          if let ParagraphChild::Run(run_child) = run {
            for run_content in &run_child.children {
              if let RunChild::Text(text_node) = run_content {
                text.push_str(&text_node.text);
              }
            }
          }
        }
        text.push('\n');
      }
    }

    Ok(text.trim().to_string())
  }

  fn count_paragraphs(&self, docx: &docx_rs::Docx) -> u32 {
    docx
      .document
      .children
      .iter()
      .filter(|child| matches!(child, DocumentChild::Paragraph(_)))
      .count() as u32
  }

  fn count_tables(&self, docx: &docx_rs::Docx) -> u32 {
    docx
      .document
      .children
      .iter()
      .filter(|child| matches!(child, DocumentChild::Table(_)))
      .count() as u32
  }

  fn count_images(&self, docx: &docx_rs::Docx) -> u32 {
    let mut count = 0u32;

    for child in &docx.document.children {
      if let DocumentChild::Paragraph(para) = child {
        for run in &para.children {
          if let ParagraphChild::Run(run_child) = run {
            for run_content in &run_child.children {
              if let RunChild::Drawing(drawing) = run_content {
                if matches!(drawing.data, Some(DrawingData::Pic(_))) {
                  count += 1;
                }
              }
            }
          }
        }
      }
    }

    count
  }

  fn count_hyperlinks(&self, docx: &docx_rs::Docx) -> u32 {
    let mut count = 0u32;

    for child in &docx.document.children {
      if let DocumentChild::Paragraph(para) = child {
        for child in &para.children {
          if matches!(child, ParagraphChild::Hyperlink(_)) {
            count += 1;
          }
        }
      }
    }

    count
  }

  fn build_metadata(&self, content: &str, docx: &docx_rs::Docx) -> Option<MetadataPayload> {
    let text_metadata = build_text_metadata(content);

    let docx_metadata = DocxMetadata {
      paragraph_count: self.count_paragraphs(docx),
      table_count: self.count_tables(docx),
      image_count: self.count_images(docx),
      hyperlink_count: self.count_hyperlinks(docx),
    };

    Some(MetadataPayload {
      text: text_metadata,
      docx: Some(docx_metadata),
      xlsx: None,
      pdf: None,
      image: None,
    })
  }
}

impl DocumentHandler for DocxHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    self.validate_mime_type(mime_type)
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    match read_docx(content) {
      Ok(docx) => {
        let text_result = self.extract_text(content);
        match text_result {
          Ok(text) => {
            let metadata = self.build_metadata(&text, &docx);
            ExtractionResult {
              content: Some(text),
              encoding: Some("utf-8".to_string()),
              metadata,
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
      Err(error) => ExtractionResult {
        content: None,
        encoding: Some("utf-8".to_string()),
        metadata: None,
        error: Some(format!("Failed to read DOCX: {}", error)),
      },
    }
  }
}

#[cfg(test)]
mod tests {
  use super::*;
  use std::fs;

  #[test]
  fn test_docx_handler_parses_generated_docx() {
    let docx_bytes = fs::read("/tmp/test.docx").expect("Failed to read test.docx");

    let handler = DocxHandler::new();
    let result = handler.extract(&docx_bytes);

    println!("Content: {:?}", result.content);
    println!("Error: {:?}", result.error);
    println!("Metadata: {:?}", result.metadata);

    assert!(result.content.is_some(), "Should have content");
    assert!(
      result.error.is_none(),
      "Should not have error: {:?}",
      result.error
    );
    assert!(result.metadata.is_some(), "Should have metadata");

    let content = result.content.unwrap();
    assert!(
      content.contains("Test content"),
      "Content should contain 'Test content'"
    );
  }

  #[test]
  fn test_validate_mime_type() {
    let handler = DocxHandler::new();

    assert!(handler.validate_mime_type(
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    ));
    assert!(handler.validate_mime_type("application/docx"));
    assert!(!handler.validate_mime_type("text/plain"));
    assert!(!handler.validate_mime_type("application/pdf"));
  }

  #[test]
  fn test_is_supported() {
    let handler = DocxHandler::new();

    assert!(
      handler
        .is_supported("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
    );
    assert!(handler.is_supported("application/docx"));
    assert!(!handler.is_supported("text/plain"));
    assert!(!handler.is_supported("application/pdf"));
  }
}
