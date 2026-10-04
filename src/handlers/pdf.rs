use crate::types::*;
use lopdf::{Document, Object};
#[derive(Default)]
pub struct PdfHandler;
impl PdfHandler {
  pub fn new() -> Self {
    Self
  }
  fn resolved<'a>(document: &'a Document, object: &'a Object) -> Option<&'a Object> {
    document.dereference(object).ok().map(|(_, value)| value)
  }
  fn inherited<'a>(
    document: &'a Document,
    page: &'a lopdf::Dictionary,
    key: &[u8],
  ) -> Option<&'a Object> {
    let mut current = page;
    for _ in 0..64 {
      if let Ok(value) = current.get(key) {
        return Self::resolved(document, value);
      }
      current = Self::resolved(document, current.get(b"Parent").ok()?)?
        .as_dict()
        .ok()?;
    }
    None
  }
  fn extract_page_size(document: &Document, page: &lopdf::Dictionary) -> Option<Dimensions> {
    let values = Self::inherited(document, page, b"CropBox")
      .or_else(|| Self::inherited(document, page, b"MediaBox"))?
      .as_array()
      .ok()?;
    if values.len() != 4 {
      return None;
    }
    let number = |v: &Object| match v {
      Object::Integer(n) => Some(*n as f64),
      Object::Real(n) => Some(f64::from(*n)),
      _ => None,
    };
    let width = (number(&values[2])? - number(&values[0])?).abs();
    let height = (number(&values[3])? - number(&values[1])?).abs();
    (width.is_finite() && height.is_finite()).then_some(Dimensions { width, height })
  }
  fn properties(document: &Document) -> DocumentProperties {
    let Some(info) = document
      .trailer
      .get(b"Info")
      .ok()
      .and_then(|o| Self::resolved(document, o))
      .and_then(|o| o.as_dict().ok())
    else {
      return DocumentProperties::default();
    };
    let field = |key: &[u8]| {
      info
        .get(key)
        .ok()
        .and_then(|o| Self::resolved(document, o))
        .and_then(|o| lopdf::decode_text_string(o).ok())
    };
    DocumentProperties {
      title: field(b"Title"),
      author: field(b"Author"),
      subject: field(b"Subject"),
      creator: field(b"Creator"),
      producer: field(b"Producer"),
      created: field(b"CreationDate"),
      modified: field(b"ModDate"),
    }
  }
}
impl DocumentHandler for PdfHandler {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let document = Document::load_mem(content)
      .map_err(|e| ExtractionError::invalid(format!("PDF parsing failed: {e}")))?;
    let pages = document.get_pages();
    let page_count = u32::try_from(pages.len())
      .map_err(|_| ExtractionError::limit("PDF page count exceeds supported range"))?;
    let page_size_points = pages
      .values()
      .next()
      .and_then(|id| document.get_dictionary(*id).ok())
      .and_then(|page| Self::extract_page_size(&document, page));
    let mut output = HandlerOutput::new(
      options.needs_text().then(String::new),
      FormatMetadata::Pdf(PdfMetadata {
        page_count,
        page_size_points,
      }),
      options,
    );
    if let Some(metadata) = output.metadata.as_mut() {
      metadata.properties = Self::properties(&document);
    }
    if !options.needs_text() {
      return Ok(output);
    }
    let text = output.text.as_mut().expect("text requested");
    let mut succeeded = 0usize;
    for page in pages.keys() {
      match document.extract_text(&[*page]) {
        Ok(page_text) => {
          succeeded += 1;
          for line in page_text
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
          {
            if !text.is_empty() {
              push_text(text, "\n", options)?;
            }
            push_text(text, line, options)?;
          }
        }
        Err(error) => warn(
          &mut output.warnings,
          ExtractionWarning {
            code: "PDF_PAGE_FAILED",
            message: error.to_string(),
            location: Some(format!("page:{page}")),
            partial: true,
          },
          options,
        ),
      }
    }
    if !options.metadata && !pages.is_empty() && succeeded == 0 {
      return Err(ExtractionError::invalid("all PDF pages failed to extract"));
    }
    Ok(output)
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  use lopdf::dictionary;
  #[test]
  fn inherited_page_box() {
    let mut document = Document::with_version("1.7");
    let parent =
      document.add_object(dictionary! {"MediaBox"=>vec![0.into(),0.into(),612.into(),792.into()]});
    let page = dictionary! {"Parent"=>parent};
    let size = PdfHandler::extract_page_size(&document, &page).unwrap();
    assert_eq!(size.width, 612.0);
    assert_eq!(size.height, 792.0);
  }
  #[test]
  fn cyclic_page_parent_is_bounded() {
    let mut document = Document::with_version("1.7");
    let id = document.new_object_id();
    document
      .objects
      .insert(id, Object::Dictionary(dictionary! {"Parent"=>id}));
    assert!(
      PdfHandler::extract_page_size(&document, document.get_dictionary(id).unwrap()).is_none()
    );
  }
  #[test]
  fn info_decodes_utf16() {
    let mut document = Document::with_version("1.7");
    let info = document.add_object(
      dictionary! {"Title"=>Object::String(vec![0xfe,0xff,0,0x41],lopdf::StringFormat::Literal)},
    );
    document.trailer.set("Info", info);
    assert_eq!(
      PdfHandler::properties(&document).title.as_deref(),
      Some("A")
    );
  }
  fn damaged_page_pdf() -> Vec<u8> {
    let mut document = Document::with_version("1.7");
    let pages = document.new_object_id();
    let stream = document.add_object(lopdf::Stream::new(dictionary! {}, b"Tf".to_vec()));
    let page=document.add_object(dictionary!{"Type"=>"Page","Parent"=>pages,"Contents"=>stream,"MediaBox"=>vec![0.into(),0.into(),612.into(),792.into()]});
    document.objects.insert(
      pages,
      Object::Dictionary(dictionary! {"Type"=>"Pages","Count"=>1,"Kids"=>vec![page.into()]}),
    );
    let catalog = document.add_object(dictionary! {"Type"=>"Catalog","Pages"=>pages});
    document.trailer.set("Root", catalog);
    let mut bytes = Vec::new();
    document.save_to(&mut bytes).unwrap();
    bytes
  }
  #[test]
  fn metadata_does_not_extract_damaged_page() {
    let options = ResolvedOptions {
      text: false,
      statistics: false,
      ..Default::default()
    };
    let output = PdfHandler::new()
      .extract(&damaged_page_pdf(), &options)
      .unwrap();
    assert!(output.warnings.is_empty());
    assert!(output.text.is_none());
    assert!(output.metadata.is_some());
  }
  #[test]
  fn page_failure_preserves_metadata() {
    let output = PdfHandler::new()
      .extract(&damaged_page_pdf(), &ResolvedOptions::default())
      .unwrap();
    assert!(output.metadata.is_some());
    assert_eq!(output.warnings.len(), 1);
    assert!(output.warnings[0].partial);
    assert_eq!(output.warnings[0].location.as_deref(), Some("page:1"));
  }
  #[test]
  fn inherited_crop_box_precedes_local_media_box() {
    let mut document = Document::with_version("1.7");
    let parent =
      document.add_object(dictionary! {"CropBox"=>vec![0.into(),0.into(),100.into(),100.into()]});
    let page =
      dictionary! {"Parent"=>parent,"MediaBox"=>vec![0.into(),0.into(),600.into(),800.into()]};
    assert_eq!(
      PdfHandler::extract_page_size(&document, &page)
        .unwrap()
        .width,
      100.0
    );
  }
  #[test]
  fn all_page_failure_is_fatal_for_text_only() {
    let options = ResolvedOptions {
      metadata: false,
      statistics: false,
      ..Default::default()
    };
    assert_eq!(
      PdfHandler::new()
        .extract(&damaged_page_pdf(), &options)
        .unwrap_err()
        .code,
      ErrorCode::InvalidDocument
    );
  }
}
