use crate::engine::archive::Archive;
use crate::handlers::docx::{core_properties, visit_xml, xml_error};
use crate::types::*;
use quick_xml::{NsReader, events::Event, name::ResolveResult};
use std::collections::HashMap;
#[derive(Default)]
pub struct PptxHandler;
impl PptxHandler {
  pub fn new() -> Self {
    Self
  }
}
fn slide_text(xml: &str, options: &ResolvedOptions) -> ExtractionResult<String> {
  let mut text = String::new();
  let mut in_text = false;
  visit_xml(xml, |ns, name, start, value| {
    if let Some(value) = value {
      if in_text {
        push_text(&mut text, value, options)?;
      }
      return Ok(());
    }
    if ns != "http://schemas.openxmlformats.org/drawingml/2006/main"
      && ns != "http://purl.oclc.org/ooxml/drawingml/main"
    {
      return Ok(());
    }
    match (name, start) {
      (b"t", true) => in_text = true,
      (b"t", false) => in_text = false,
      (b"br", true) | (b"p", false) => push_text(&mut text, "\n", options)?,
      _ => {}
    }
    Ok(())
  })?;
  if text.ends_with('\n') {
    text.pop();
  }
  Ok(text)
}
fn slide_paths(archive: &mut Archive<'_>) -> ExtractionResult<Vec<String>> {
  let relationships = archive.xml("ppt/_rels/presentation.xml.rels")?;
  visit_xml(&relationships, |_, _, _, _| Ok(()))?;
  let mut reader = NsReader::from_str(&relationships);
  let mut targets = HashMap::new();
  loop {
    let (namespace, event) = reader.read_resolved_event().map_err(xml_error)?;
    let namespace = match &namespace {
      ResolveResult::Bound(ns) => ns.as_ref(),
      _ => b"",
    };
    match event {
      Event::Empty(e) | Event::Start(e)
        if e.local_name().as_ref() == b"Relationship"
          && namespace == b"http://schemas.openxmlformats.org/package/2006/relationships" =>
      {
        let mut id = None;
        let mut target = None;
        let mut kind = None;
        let mut external = false;
        for attr in e.attributes() {
          let attr = attr.map_err(xml_error)?;
          let value = attr
            .decode_and_unescape_value(reader.decoder())
            .map_err(xml_error)?
            .into_owned();
          match attr.key.as_ref() {
            b"Id" => id = Some(value),
            b"Target" => target = Some(value),
            b"Type" => kind = Some(value),
            b"TargetMode" => external = value == "External",
            _ => {}
          }
        }
        if !external
          && kind.is_some_and(|kind| kind.ends_with("/slide"))
          && let (Some(id), Some(target)) = (id, target)
        {
          let mut components = if target.starts_with('/') {
            Vec::new()
          } else {
            vec!["ppt"]
          };
          for part in target.split('/') {
            match part {
              "" | "." => {}
              ".." => {
                if components.pop().is_none() {
                  return Err(ExtractionError::invalid("invalid slide relationship path"));
                }
              }
              _ => components.push(part),
            }
          }
          targets.insert(id, components.join("/"));
        }
      }
      Event::Eof => break,
      _ => {}
    }
  }
  let presentation = archive.xml("ppt/presentation.xml")?;
  visit_xml(&presentation, |_, _, _, _| Ok(()))?;
  let mut reader = NsReader::from_str(&presentation);
  let mut paths = Vec::new();
  loop {
    let (namespace, event) = reader.read_resolved_event().map_err(xml_error)?;
    let namespace = match &namespace {
      ResolveResult::Bound(ns) => ns.as_ref(),
      _ => b"",
    };
    match event {
      Event::Start(e) | Event::Empty(e)
        if e.local_name().as_ref() == b"sldId"
          && (namespace == b"http://schemas.openxmlformats.org/presentationml/2006/main"
            || namespace == b"http://purl.oclc.org/ooxml/presentationml/main") =>
      {
        let mut id = None;
        for attr in e.attributes() {
          let attr = attr.map_err(xml_error)?;
          if attr.key.local_name().as_ref() == b"id" && attr.key.as_ref().contains(&b':') {
            id = Some(
              attr
                .decode_and_unescape_value(reader.decoder())
                .map_err(xml_error)?
                .into_owned(),
            );
          }
        }
        let path = id
          .and_then(|id| targets.get(&id))
          .ok_or_else(|| ExtractionError::invalid("unresolved slide relationship"))?;
        paths.push(path.clone());
      }
      Event::Eof => break,
      _ => {}
    }
  }
  Ok(paths)
}
impl DocumentHandler for PptxHandler {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let mut archive = Archive::new(content, options)?;
    let paths = slide_paths(&mut archive)?;
    let mut text = String::new();
    let mut warnings = Vec::new();
    let mut succeeded = 0usize;
    if options.needs_text() {
      for path in &paths {
        match archive.xml(path).and_then(|xml| slide_text(&xml, options)) {
          Ok(slide) => {
            if succeeded > 0 {
              push_text(&mut text, "\n\n", options)?;
            }
            push_text(&mut text, &slide, options)?;
            succeeded += 1;
          }
          Err(error) if error.code != ErrorCode::LimitExceeded => warn(
            &mut warnings,
            ExtractionWarning {
              code: "SLIDE_FAILED",
              message: error.message,
              location: Some(path.clone()),
              partial: true,
            },
            options,
          ),
          Err(error) => return Err(error),
        }
      }
    }
    if options.needs_text() && !options.metadata && !paths.is_empty() && succeeded == 0 {
      return Err(ExtractionError::invalid("all slides failed to extract"));
    }
    let mut output = HandlerOutput::new(
      options.needs_text().then_some(text),
      FormatMetadata::Pptx(PresentationMetadata {
        slide_count: paths.len() as u32,
      }),
      options,
    );
    output.warnings = warnings;
    core_properties(&mut archive, options, &mut output)?;
    Ok(output)
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  use std::io::{Cursor, Write};
  fn archive(parts: &[(&str, &str)]) -> Vec<u8> {
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (path, xml) in parts {
      zip
        .start_file(*path, zip::write::SimpleFileOptions::default())
        .unwrap();
      zip.write_all(xml.as_bytes()).unwrap();
    }
    zip.finish().unwrap().into_inner()
  }
  #[test]
  fn namespace_whitespace_and_breaks() {
    assert_eq!(slide_text(r#"<slide xmlns:d="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:x="urn:foreign"><d:p><d:r><d:t> A </d:t></d:r><d:r><d:t>&amp; B</d:t></d:r><d:br/><d:r><d:t>C</d:t></d:r><x:t>ignore</x:t></d:p></slide>"#,&ResolvedOptions::default()).unwrap()," A & B\nC");
  }
  #[test]
  fn presentation_order_and_metadata_only() {
    let bytes = archive(&[
      (
        "ppt/presentation.xml",
        r#"<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId id="1" r:id="second"/><p:sldId id="2" r:id="first"/></p:sldIdLst></p:presentation>"#,
      ),
      (
        "ppt/_rels/presentation.xml.rels",
        r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="first" Target="slides/slide1.xml" Type="urn:slide/slide"/><Relationship Id="second" Target="slides/slide2.xml" Type="urn:slide/slide"/></Relationships>"#,
      ),
      (
        "ppt/slides/slide1.xml",
        r#"<s xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:t>First</a:t></a:p></s>"#,
      ),
      (
        "ppt/slides/slide2.xml",
        r#"<s xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"><a:p><a:t>Second</a:t></a:p></s>"#,
      ),
    ]);
    assert_eq!(
      PptxHandler::new()
        .extract(&bytes, &ResolvedOptions::default())
        .unwrap()
        .text
        .as_deref(),
      Some("Second\n\nFirst")
    );
    let options = ResolvedOptions {
      text: false,
      statistics: false,
      ..Default::default()
    };
    assert!(
      PptxHandler::new()
        .extract(&bytes, &options)
        .unwrap()
        .text
        .is_none()
    );
  }
  #[test]
  fn missing_slide_preserves_metadata_but_all_failed_text_only_is_fatal() {
    let bytes = archive(&[
      (
        "ppt/presentation.xml",
        r#"<p:presentation xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><p:sldIdLst><p:sldId r:id="missing"/></p:sldIdLst></p:presentation>"#,
      ),
      (
        "ppt/_rels/presentation.xml.rels",
        r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="missing" Target="slides/missing.xml" Type="urn:slide/slide"/></Relationships>"#,
      ),
    ]);
    let output = PptxHandler::new()
      .extract(&bytes, &ResolvedOptions::default())
      .unwrap();
    assert!(output.metadata.is_some());
    assert_eq!(output.warnings.len(), 1);
    assert!(output.warnings[0].partial);
    let options = ResolvedOptions {
      metadata: false,
      statistics: false,
      ..Default::default()
    };
    assert_eq!(
      PptxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::InvalidDocument
    );
  }
}
