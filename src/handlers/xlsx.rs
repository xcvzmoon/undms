use crate::engine::archive::Archive;
use crate::handlers::docx::core_properties;
use crate::types::*;
use calamine::{DataType, Reader, Xlsx, open_workbook_from_rs};
use std::io::Cursor;
#[derive(Default)]
pub struct XlsxHandler;
impl XlsxHandler {
  pub fn new() -> Self {
    Self
  }
}
impl DocumentHandler for XlsxHandler {
  fn extract(&self, content: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let mut archive = Archive::new(content, options)?;
    // Calamine owns its ZIP reader. Validate actual inflation first, even when
    // directory size claims lie. This intentionally decompresses entries twice.
    archive.validate_inflation()?;
    let mut workbook: Xlsx<_> = open_workbook_from_rs::<Xlsx<_>, _>(Cursor::new(content))
      .map_err(|e| ExtractionError::invalid(e.to_string()))?;
    let names = workbook.sheet_names().to_vec();
    let mut sheets = Vec::with_capacity(names.len());
    let mut text = String::new();
    let mut warnings = Vec::new();
    let mut succeeded = 0usize;
    for name in names {
      let parsed = (|| -> ExtractionResult<_> {
        let mut reader = workbook
          .worksheet_cells_reader(&name)
          .map_err(|error| ExtractionError::invalid(error.to_string()))?;
        let mut cells = std::collections::BTreeMap::new();
        let mut row_count = 0;
        let mut column_count = 0;
        let mut cell_count = 0;
        let mut text_bytes = 0usize;
        while let Some(cell) = reader
          .next_cell()
          .map_err(|error| ExtractionError::invalid(error.to_string()))?
        {
          if cell.get_value().is_empty() {
            continue;
          }
          let (row, col) = cell.get_position();
          row_count = row_count.max(
            row
              .checked_add(1)
              .ok_or_else(|| ExtractionError::limit("worksheet row overflow"))?,
          );
          column_count = column_count.max(
            col
              .checked_add(1)
              .ok_or_else(|| ExtractionError::limit("worksheet column overflow"))?,
          );
          cell_count += 1;
          if options.needs_text() {
            let remaining = options.limits.max_output_bytes.saturating_sub(text.len());
            if u64::from(row_count) * u64::from(column_count) > remaining as u64 {
              return Err(ExtractionError::limit(
                "worksheet coordinates exceed maxOutputBytes",
              ));
            }
            // Charge conservative node/string overhead before inserting into the map.
            if cells.len() >= remaining / 128 {
              return Err(ExtractionError::limit(
                "worksheet cell storage exceeds output budget",
              ));
            }
            let value = calamine::Data::from(cell.get_value().clone()).to_string();
            text_bytes = text_bytes
              .checked_add(value.len())
              .ok_or_else(|| ExtractionError::limit("worksheet text size overflow"))?;
            if text_bytes > options.limits.max_output_bytes.saturating_sub(text.len()) {
              return Err(ExtractionError::limit(
                "worksheet text exceeds maxOutputBytes",
              ));
            }
            if text_bytes
              .checked_add((cells.len() + 1).saturating_mul(128))
              .is_none_or(|cost| cost > remaining)
            {
              return Err(ExtractionError::limit(
                "worksheet cell storage exceeds output budget",
              ));
            }
            if cells.insert((row, col), value).is_some() {
              return Err(ExtractionError::invalid(
                "duplicate worksheet cell coordinates",
              ));
            }
          }
        }
        Ok((cells, row_count, column_count, cell_count))
      })();
      let (cells, row_count, column_count, cell_count) = match parsed {
        Ok(parsed) => parsed,
        Err(error) if error.code == ErrorCode::LimitExceeded => return Err(error),
        Err(error) => {
          warn(
            &mut warnings,
            ExtractionWarning {
              code: "SHEET_FAILED",
              message: error.to_string(),
              location: Some(name.clone()),
              partial: true,
            },
            options,
          );
          sheets.push(SheetMetadata {
            name,
            ..Default::default()
          });
          continue;
        }
      };
      if options.needs_text() {
        if u64::from(row_count) * u64::from(column_count.max(1))
          > options.limits.max_output_bytes as u64
        {
          return Err(ExtractionError::limit(
            "worksheet coordinates exceed maxOutputBytes",
          ));
        }
        if succeeded > 0 {
          push_text(&mut text, "\n\n", options)?;
        }
        push_text(&mut text, "Sheet: ", options)?;
        push_text(&mut text, &name, options)?;
        if row_count > 0 {
          push_text(&mut text, "\n", options)?;
          for row in 0..row_count {
            if row > 0 {
              push_text(&mut text, "\n", options)?;
            }
            for col in 0..column_count {
              if col > 0 {
                push_text(&mut text, "\t", options)?;
              }
              if let Some(cell) = cells.get(&(row, col)) {
                push_text(&mut text, cell, options)?;
              }
            }
          }
        }
      }
      succeeded += 1;
      sheets.push(SheetMetadata {
        name,
        row_count,
        column_count,
        cell_count,
      });
    }
    if succeeded == 0 && !sheets.is_empty() {
      return Err(ExtractionError::invalid("all worksheets failed to parse"));
    }
    let mut output = HandlerOutput::new(
      options.needs_text().then_some(text),
      FormatMetadata::Xlsx(SpreadsheetMetadata { sheets }),
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
  use std::io::Write;
  fn workbook(second: &str) -> Vec<u8> {
    let parts = [
      (
        "[Content_Types].xml",
        r#"<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/></Types>"#,
      ),
      (
        "xl/workbook.xml",
        r#"<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Sparse" sheetId="1" r:id="rId1"/><sheet name="Second" sheetId="2" r:id="rId2"/></sheets></workbook>"#,
      ),
      (
        "xl/_rels/workbook.xml.rels",
        r#"<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet2.xml"/></Relationships>"#,
      ),
      (
        "xl/worksheets/sheet1.xml",
        r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="2"><c r="B2" t="inlineStr"><is><t>A</t></is></c><c r="D2"><v>42</v></c></row><row r="4"><c r="C4" t="b"><v>1</v></c></row></sheetData></worksheet>"#,
      ),
      ("xl/worksheets/sheet2.xml", second),
    ];
    let mut zip = zip::ZipWriter::new(Cursor::new(Vec::new()));
    for (path, xml) in parts {
      zip
        .start_file(path, zip::write::SimpleFileOptions::default())
        .unwrap();
      zip.write_all(xml.as_bytes()).unwrap();
    }
    zip.finish().unwrap().into_inner()
  }
  #[test]
  fn sparse_coordinates_order_and_extents() {
    let bytes = workbook(
      r#"<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData><row r="1"><c r="A1" t="inlineStr"><is><t>last</t></is></c></row></sheetData></worksheet>"#,
    );
    let output = XlsxHandler::new()
      .extract(&bytes, &ResolvedOptions::default())
      .unwrap();
    assert_eq!(
      output.text.as_deref(),
      Some("Sheet: Sparse\n\t\t\t\n\tA\t\t42\n\t\t\t\n\t\ttrue\t\n\nSheet: Second\nlast")
    );
    let FormatMetadata::Xlsx(metadata) = output.metadata.unwrap().format else {
      panic!()
    };
    assert_eq!(metadata.sheets[0].row_count, 4);
    assert_eq!(metadata.sheets[0].column_count, 4);
    assert_eq!(metadata.sheets[0].cell_count, 3);
  }
  #[test]
  fn failed_sheet_warns_and_selection() {
    let bytes = workbook("invalid");
    let options = ResolvedOptions {
      text: false,
      statistics: false,
      ..Default::default()
    };
    let output = XlsxHandler::new().extract(&bytes, &options).unwrap();
    assert!(output.text.is_none());
    assert_eq!(output.warnings.len(), 1);
    assert!(output.warnings[0].partial);
  }
  #[test]
  fn corrupt_archive() {
    assert!(
      XlsxHandler::new()
        .extract(b"invalid", &ResolvedOptions::default())
        .is_err()
    );
  }
  #[test]
  fn declared_inflation_budget_is_enforced() {
    let bytes = workbook("invalid");
    let mut options = ResolvedOptions::default();
    options.limits.max_decompressed_bytes = 10;
    assert_eq!(
      XlsxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
  #[test]
  fn actual_inflation_rejects_forged_size_claims() {
    let mut bytes = workbook("invalid");
    for index in 0..bytes.len().saturating_sub(28) {
      let offset = if bytes[index..].starts_with(b"PK\x01\x02") {
        Some(24)
      } else if bytes[index..].starts_with(b"PK\x03\x04") {
        Some(22)
      } else {
        None
      };
      if let Some(offset) = offset {
        bytes[index + offset..index + offset + 4].copy_from_slice(&1u32.to_le_bytes());
      }
    }
    let mut options = ResolvedOptions {
      metadata: false,
      statistics: false,
      ..Default::default()
    };
    options.limits.max_decompressed_bytes = 128;
    assert_eq!(
      XlsxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
  #[test]
  fn worksheet_storage_is_bounded_before_collection() {
    let bytes = workbook("invalid");
    let mut options = ResolvedOptions::default();
    options.limits.max_output_bytes = 128;
    assert_eq!(
      XlsxHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
}
