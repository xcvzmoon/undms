use crate::engine::archive::Archive;
use crate::types::*;
use quick_xml::{NsReader, events::Event, name::ResolveResult};

#[derive(Default)]
pub struct DocxHandler;
impl DocxHandler {
  pub fn new() -> Self {
    Self
  }
}
const WORD: &str = "http://schemas.openxmlformats.org/wordprocessingml/2006/main";
pub(crate) fn xml_error(error: impl std::fmt::Display) -> ExtractionError {
  ExtractionError::invalid(error.to_string())
}
/// Visits namespace-resolved XML, preserving text and rejecting truncated documents and DTDs.
pub(crate) fn visit_xml(
  xml: &str,
  mut visit: impl FnMut(&str, &[u8], bool, Option<&str>) -> ExtractionResult<()>,
) -> ExtractionResult<()> {
  let mut reader = NsReader::from_str(xml);
  let mut depth = 0usize;
  let mut root = false;
  loop {
    let (ns, event) = reader.read_resolved_event().map_err(xml_error)?;
    let namespace = match &ns {
      ResolveResult::Bound(ns) => std::str::from_utf8(ns.as_ref()).map_err(xml_error)?,
      ResolveResult::Unbound => "",
      ResolveResult::Unknown(_) => {
        return Err(ExtractionError::invalid("undeclared XML namespace"));
      }
    };
    match event {
      Event::Start(e) => {
        if depth == 0 && root {
          return Err(ExtractionError::invalid("multiple XML roots"));
        }
        root = true;
        depth += 1;
        visit(namespace, e.local_name().as_ref(), true, None)?;
      }
      Event::Empty(e) => {
        if depth == 0 {
          if root {
            return Err(ExtractionError::invalid("multiple XML roots"));
          }
          root = true;
        }
        visit(namespace, e.local_name().as_ref(), true, None)?;
        visit(namespace, e.local_name().as_ref(), false, None)?;
      }
      Event::End(e) => {
        depth = depth
          .checked_sub(1)
          .ok_or_else(|| ExtractionError::invalid("unexpected XML closing tag"))?;
        visit(namespace, e.local_name().as_ref(), false, None)?;
      }
      Event::Text(e) => {
        let decoded = e.decode().map_err(xml_error)?;
        visit("", b"", true, Some(&decoded))?;
      }
      Event::CData(e) => {
        let decoded = e.decode().map_err(xml_error)?;
        visit("", b"", true, Some(&decoded))?;
      }
      Event::GeneralRef(e) => {
        let name = e.decode().map_err(xml_error)?;
        let encoded = format!("&{name};");
        let value = quick_xml::escape::unescape(&encoded).map_err(xml_error)?;
        visit("", b"", true, Some(&value))?;
      }
      Event::DocType(_) => return Err(ExtractionError::invalid("XML DTDs are unsupported")),
      Event::Eof => {
        if depth != 0 || !root {
          return Err(ExtractionError::invalid("incomplete XML document"));
        }
        break;
      }
      _ => {}
    }
  }
  Ok(())
}
pub(crate) fn core_properties(
  archive: &mut Archive<'_>,
  options: &ResolvedOptions,
  output: &mut HandlerOutput,
) -> ExtractionResult<()> {
  if !options.metadata || !archive.contains("docProps/core.xml") {
    return Ok(());
  }
  let xml = match archive.xml("docProps/core.xml") {
    Ok(xml) => xml,
    Err(error) if error.code == ErrorCode::LimitExceeded => return Err(error),
    Err(error) => {
      warn(
        &mut output.warnings,
        ExtractionWarning {
          code: "INVALID_PROPERTIES",
          message: error.message,
          location: Some("docProps/core.xml".into()),
          partial: true,
        },
        options,
      );
      return Ok(());
    }
  };
  let mut current = Vec::new();
  let mut properties = DocumentProperties::default();
  let mut property_bytes = 0usize;
  let parsed = visit_xml(&xml, |ns, name, start, text| {
    if let Some(value) = text {
      let target = match current.as_slice() {
        b"title" => &mut properties.title,
        b"creator" => &mut properties.author,
        b"subject" => &mut properties.subject,
        b"created" => &mut properties.created,
        b"modified" => &mut properties.modified,
        _ => return Ok(()),
      };
      property_bytes = property_bytes
        .checked_add(value.len())
        .ok_or_else(|| ExtractionError::limit("property size overflow"))?;
      if property_bytes > options.limits.max_output_bytes {
        return Err(ExtractionError::limit(
          "document properties exceed maxOutputBytes",
        ));
      }
      push_text(target.get_or_insert_with(String::new), value, options)?;
    } else if start {
      current = if ns == "http://purl.org/dc/elements/1.1/" || ns == "http://purl.org/dc/terms/" {
        name.to_vec()
      } else {
        Vec::new()
      };
    } else {
      current.clear();
    }
    Ok(())
  });
  if let Err(error) = parsed {
    if error.code == ErrorCode::LimitExceeded {
      return Err(error);
    }
    warn(
      &mut output.warnings,
      ExtractionWarning {
        code: "INVALID_PROPERTIES",
        message: error.message,
        location: Some("docProps/core.xml".into()),
        partial: true,
      },
      options,
    );
  } else if let Some(metadata) = output.metadata.as_mut() {
    metadata.properties = properties;
  }
  Ok(())
}
impl DocumentHandler for DocxHandler {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let mut archive = Archive::new(content, options)?;
    let xml = archive.xml("word/document.xml")?;
    let mut text = String::new();
    let mut metadata = WordMetadata::default();
    let mut in_text = false;
    visit_xml(&xml, |namespace, name, start, value| {
      if let Some(value) = value {
        if in_text && options.needs_text() {
          push_text(&mut text, value, options)?;
        }
        return Ok(());
      }
      if namespace != WORD && namespace != "http://purl.oclc.org/ooxml/wordprocessingml/main" {
        return Ok(());
      }
      match (name, start) {
        (b"t", true) => in_text = true,
        (b"t", false) => in_text = false,
        (b"p", true) => metadata.paragraph_count += 1,
        (b"tbl", true) => metadata.table_count += 1,
        (b"drawing", true) | (b"pict", true) => metadata.image_count += 1,
        (b"hyperlink", true) => metadata.hyperlink_count += 1,
        (b"tab", true) if options.needs_text() => push_text(&mut text, "\t", options)?,
        (b"br", true) | (b"cr", true) | (b"p", false) if options.needs_text() => {
          push_text(&mut text, "\n", options)?
        }
        _ => {}
      }
      Ok(())
    })?;
    if text.ends_with('\n') {
      text.pop();
    }
    let mut output = HandlerOutput::new(
      options.needs_text().then_some(text),
      FormatMetadata::Docx(metadata),
      options,
    );
    core_properties(&mut archive, options, &mut output)?;
    Ok(output)
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  use std::io::{Cursor, Write};
  pub(crate) fn archive(parts: &[(&str, &str)]) -> Vec<u8> {
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
  fn nested_text_and_selection() {
    let bytes = archive(&[(
      "word/document.xml",
      r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t> A&amp;B </w:t><w:tab/><w:br/></w:r><w:hyperlink><w:r><w:t>link</w:t></w:r></w:hyperlink></w:p><w:tbl><w:tr><w:tc><w:p><w:r><w:t>cell</w:t></w:r></w:p></w:tc></w:tr></w:tbl></w:body></w:document>"#,
    )]);
    let output = DocxHandler::new()
      .extract(&bytes, &ResolvedOptions::default())
      .unwrap();
    assert_eq!(output.text.as_deref(), Some(" A&B \t\nlink\ncell"));
    let FormatMetadata::Docx(metadata) = output.metadata.unwrap().format else {
      panic!()
    };
    assert_eq!(metadata.paragraph_count, 2);
    assert_eq!(metadata.table_count, 1);
    assert_eq!(metadata.hyperlink_count, 1);
    let options = ResolvedOptions {
      text: false,
      statistics: false,
      ..Default::default()
    };
    assert!(
      DocxHandler::new()
        .extract(&bytes, &options)
        .unwrap()
        .text
        .is_none()
    );
  }
  #[test]
  fn rejects_truncated_xml_and_output_limit() {
    let bytes = archive(&[("word/document.xml", "<document>")]);
    assert!(
      DocxHandler::new()
        .extract(&bytes, &ResolvedOptions::default())
        .is_err()
    );
    let mut options = ResolvedOptions::default();
    options.limits.max_output_bytes = 1;
    let bytes = archive(&[(
      "word/document.xml",
      r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:t>abc</w:t></w:document>"#,
    )]);
    assert_eq!(
      DocxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
  #[test]
  fn core_properties_preserve_entities_and_dates() {
    let bytes = archive(&[
      (
        "word/document.xml",
        r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"#,
      ),
      (
        "docProps/core.xml",
        r#"<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/"><dc:title>A&amp;B</dc:title><dc:creator>Writer</dc:creator><dcterms:created>2020-01-01T00:00:00Z</dcterms:created></cp:coreProperties>"#,
      ),
    ]);
    let output = DocxHandler::new()
      .extract(&bytes, &ResolvedOptions::default())
      .unwrap();
    let properties = output.metadata.unwrap().properties;
    assert_eq!(properties.title.as_deref(), Some("A&B"));
    assert_eq!(properties.author.as_deref(), Some("Writer"));
    assert_eq!(properties.created.as_deref(), Some("2020-01-01T00:00:00Z"));
  }
  #[test]
  fn invalid_properties_are_partial_and_property_growth_is_bounded() {
    let body =
      r#"<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"/>"#;
    let bytes = archive(&[
      ("word/document.xml", body),
      ("docProps/core.xml", "<broken>"),
    ]);
    let output = DocxHandler::new()
      .extract(&bytes, &ResolvedOptions::default())
      .unwrap();
    assert!(output.warnings[0].partial);
    let properties = format!(
      r#"<p xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:title>{}</dc:title></p>"#,
      "x".repeat(400)
    );
    let bytes = archive(&[
      ("word/document.xml", body),
      ("docProps/core.xml", &properties),
    ]);
    let mut options = ResolvedOptions::default();
    options.limits.max_output_bytes = 128;
    assert_eq!(
      DocxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
}
