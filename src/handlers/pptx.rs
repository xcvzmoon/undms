use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, PptxMetadata, build_text_metadata};
use quick_xml::Reader;
use quick_xml::escape::unescape;
use quick_xml::events::Event;
use std::io::{Cursor, Read};
use zip::ZipArchive;

pub struct PptxHandler;

impl PptxHandler {
  pub fn new() -> Self {
    Self
  }

  fn validate_mime_type(&self, mime_type: &str) -> bool {
    mime_type == "application/vnd.openxmlformats-officedocument.presentationml.presentation"
      || mime_type == "application/pptx"
  }

  fn extract_text_with_metadata(&self, content: &[u8]) -> Result<(String, PptxMetadata), String> {
    let mut archive = ZipArchive::new(Cursor::new(content))
      .map_err(|error| format!("Failed to read PPTX: {}", error))?;

    let slide_paths = Self::collect_slide_paths(&mut archive)?;
    if slide_paths.is_empty() {
      return Err("Failed to read PPTX: no slide XML parts found".to_string());
    }

    let mut slides = Vec::with_capacity(slide_paths.len());
    for slide_path in &slide_paths {
      let slide_xml = Self::read_zip_entry(&mut archive, slide_path)?;
      let slide_text = Self::extract_slide_text(&slide_xml)?;
      if !slide_text.is_empty() {
        slides.push(slide_text);
      }
    }

    let core_properties = Self::read_zip_entry(&mut archive, "docProps/core.xml").ok();
    let (title, author, subject) = core_properties
      .as_deref()
      .map(Self::extract_core_properties)
      .unwrap_or((None, None, None));

    Ok((
      slides.join("\n\n"),
      PptxMetadata {
        title,
        author,
        subject,
        slide_count: slide_paths.len() as u32,
      },
    ))
  }

  fn collect_slide_paths(archive: &mut ZipArchive<Cursor<&[u8]>>) -> Result<Vec<String>, String> {
    let mut slide_paths = Vec::new();

    for index in 0..archive.len() {
      let file = archive
        .by_index(index)
        .map_err(|error| format!("Failed to read PPTX: {}", error))?;
      let name = file.name().to_string();

      if name.starts_with("ppt/slides/slide") && name.ends_with(".xml") {
        slide_paths.push(name);
      }
    }

    slide_paths.sort_by_key(|path| Self::slide_number(path));
    Ok(slide_paths)
  }

  fn slide_number(path: &str) -> u32 {
    path
      .trim_start_matches("ppt/slides/slide")
      .trim_end_matches(".xml")
      .parse()
      .unwrap_or(u32::MAX)
  }

  fn read_zip_entry(archive: &mut ZipArchive<Cursor<&[u8]>>, path: &str) -> Result<String, String> {
    let mut file = archive
      .by_name(path)
      .map_err(|error| format!("Failed to read PPTX: {}", error))?;
    let mut xml = String::new();
    file
      .read_to_string(&mut xml)
      .map_err(|error| format!("Failed to read PPTX: {}", error))?;
    Ok(xml)
  }

  fn extract_slide_text(xml: &str) -> Result<String, String> {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut in_text_node = false;
    let mut text = String::new();

    loop {
      match reader.read_event() {
        Ok(Event::Start(event)) => match event.local_name().as_ref() {
          b"t" => in_text_node = true,
          b"br" => Self::push_line_break(&mut text),
          _ => {}
        },
        Ok(Event::Empty(event)) => {
          if event.local_name().as_ref() == b"br" {
            Self::push_line_break(&mut text);
          }
        }
        Ok(Event::End(event)) => match event.local_name().as_ref() {
          b"t" => in_text_node = false,
          b"p" => Self::push_line_break(&mut text),
          _ => {}
        },
        Ok(Event::Text(event)) if in_text_node => {
          if let Ok(decoded) = event.decode() {
            match unescape(&decoded) {
              Ok(unescaped) => text.push_str(&unescaped),
              Err(_) => text.push_str(&decoded),
            }
          }
        }
        Ok(Event::Eof) => break,
        Err(error) => return Err(format!("Failed to parse PPTX XML: {}", error)),
        _ => {}
      }
    }

    Ok(text.trim().to_string())
  }

  fn push_line_break(text: &mut String) {
    if !text.is_empty() && !text.ends_with('\n') {
      text.push('\n');
    }
  }

  fn extract_core_properties(xml: &str) -> (Option<String>, Option<String>, Option<String>) {
    let mut reader = Reader::from_str(xml);
    reader.config_mut().trim_text(true);

    let mut current_tag = None;
    let mut title = None;
    let mut author = None;
    let mut subject = None;

    loop {
      match reader.read_event() {
        Ok(Event::Start(event)) => {
          current_tag = match event.local_name().as_ref() {
            b"title" => Some("title"),
            b"creator" => Some("creator"),
            b"subject" => Some("subject"),
            _ => None,
          };
        }
        Ok(Event::End(_)) => current_tag = None,
        Ok(Event::Text(event)) => {
          let Some(tag) = current_tag else {
            continue;
          };

          if let Ok(decoded) = event.decode() {
            let value = match unescape(&decoded) {
              Ok(unescaped) => unescaped.into_owned(),
              Err(_) => decoded.into_owned(),
            };

            if value.is_empty() {
              continue;
            }

            match tag {
              "title" => title = Some(value),
              "creator" => author = Some(value),
              "subject" => subject = Some(value),
              _ => {}
            }
          }
        }
        Ok(Event::Eof) => break,
        Err(_) => return (title, author, subject),
        _ => {}
      }
    }

    (title, author, subject)
  }

  fn build_metadata(&self, content: &str, pptx_metadata: PptxMetadata) -> MetadataPayload {
    let text_metadata = build_text_metadata(content);

    MetadataPayload {
      text: text_metadata,
      docx: None,
      xlsx: None,
      pptx: Some(pptx_metadata),
      pdf: None,
      image: None,
    }
  }
}

impl DocumentHandler for PptxHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    self.validate_mime_type(mime_type)
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    match self.extract_text_with_metadata(content) {
      Ok((text, pptx_metadata)) => {
        let metadata = self.build_metadata(&text, pptx_metadata);
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

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn extract_slide_text_preserves_paragraph_breaks() {
    let xml = r#"
      <p:sld xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">
        <p:cSld>
          <p:spTree>
            <p:sp>
              <p:txBody>
                <a:p><a:r><a:t>Hello</a:t></a:r></a:p>
                <a:p><a:r><a:t>World</a:t></a:r></a:p>
              </p:txBody>
            </p:sp>
          </p:spTree>
        </p:cSld>
      </p:sld>
    "#;

    let result = PptxHandler::extract_slide_text(xml).expect("slide text should parse");

    assert_eq!(result, "Hello\nWorld");
  }
}
