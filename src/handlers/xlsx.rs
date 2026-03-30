use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, XlsxMetadata, build_text_metadata};
use calamine::{DataType, Reader, Xlsx, open_workbook_from_rs};
use std::io::Cursor;

pub struct XlsxHandler;

impl XlsxHandler {
  pub fn new() -> Self {
    Self
  }

  fn extract_text_from_xlsx(&self, content: &[u8]) -> Result<(String, XlsxMetadata), String> {
    let cursor = Cursor::new(content);
    let mut workbook: Xlsx<_> =
      open_workbook_from_rs(cursor).map_err(|e| format!("Failed to open Excel file: {}", e))?;

    let mut text = String::new();

    let sheet_names = workbook.sheet_names().to_vec();
    let mut sheet_count = 0u32;
    let mut row_count = 0u32;
    let mut column_count = 0u32;
    let mut cell_count = 0u32;

    for sheet_name in &sheet_names {
      if let Ok(range) = workbook.worksheet_range(sheet_name) {
        sheet_count += 1;

        if !text.is_empty() {
          text.push_str("\n\n");
        }

        text.push_str(&format!("Sheet: {}\n", sheet_name));

        for row in range.rows() {
          let mut row_has_value = false;
          let mut row_column_count = 0u32;
          let mut first_cell = true;

          for cell in row.iter() {
            if cell.is_empty() {
              continue;
            }

            let value = cell.to_string();
            if value.is_empty() {
              continue;
            }

            row_has_value = true;
            row_column_count += 1;
            cell_count += 1;

            if !first_cell {
              text.push('\t');
            }
            text.push_str(&value);
            first_cell = false;
          }

          if row_has_value {
            row_count += 1;
            text.push('\n');
          }

          if row_column_count > column_count {
            column_count = row_column_count;
          }
        }
      }
    }

    Ok((
      text.trim().to_string(),
      XlsxMetadata {
        sheet_count,
        sheet_names,
        row_count,
        column_count,
        cell_count,
      },
    ))
  }

  fn build_metadata(&self, content: &str, xlsx_metadata: XlsxMetadata) -> MetadataPayload {
    let text_metadata = build_text_metadata(content);

    MetadataPayload {
      text: text_metadata,
      docx: None,
      xlsx: Some(xlsx_metadata),
      pdf: None,
      image: None,
    }
  }
}

impl DocumentHandler for XlsxHandler {
  fn is_supported(&self, mime_type: &str) -> bool {
    mime_type == "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
      || mime_type == "application/vnd.ms-excel"
      || mime_type == "application/xlsx"
  }

  fn extract(&self, content: &[u8]) -> ExtractionResult {
    match self.extract_text_from_xlsx(content) {
      Ok((text, xlsx_metadata)) => {
        let metadata = self.build_metadata(&text, xlsx_metadata);
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
