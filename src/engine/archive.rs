use crate::types::{ExtractionError, ExtractionResult, ResolvedOptions};
use std::io::{Cursor, Read};
use zip::ZipArchive;
pub struct Archive<'a> {
  inner: ZipArchive<Cursor<&'a [u8]>>,
  remaining: usize,
}
impl<'a> Archive<'a> {
  pub fn new(bytes: &'a [u8], options: &ResolvedOptions) -> ExtractionResult<Self> {
    let inner =
      ZipArchive::new(Cursor::new(bytes)).map_err(|e| ExtractionError::invalid(e.to_string()))?;
    if inner.len() > options.limits.max_archive_entries {
      return Err(ExtractionError::limit("archive exceeds maxArchiveEntries"));
    }
    Ok(Self {
      inner,
      remaining: options.limits.max_decompressed_bytes,
    })
  }
  /// Audit actual inflation before handing the archive to an independent parser.
  /// Uses a fixed discard buffer; central-directory size claims are not trusted.
  pub fn validate_inflation(&mut self) -> ExtractionResult<()> {
    let mut remaining = self.remaining;
    let mut buffer = [0u8; 8192];
    for index in 0..self.inner.len() {
      let mut entry = self
        .inner
        .by_index(index)
        .map_err(|e| ExtractionError::invalid(e.to_string()))?;
      loop {
        let capacity = remaining.min(buffer.len() - 1) + 1;
        let read = entry
          .read(&mut buffer[..capacity])
          .map_err(|e| ExtractionError::invalid(e.to_string()))?;
        if read == 0 {
          break;
        }
        remaining = remaining
          .checked_sub(read)
          .ok_or_else(|| ExtractionError::limit("archive exceeds maxDecompressedBytes"))?;
      }
    }
    Ok(())
  }
  pub fn contains(&self, path: &str) -> bool {
    self.inner.file_names().any(|n| n == path)
  }
  pub fn read(&mut self, path: &str) -> ExtractionResult<Vec<u8>> {
    let mut entry = self
      .inner
      .by_name(path)
      .map_err(|e| ExtractionError::invalid(format!("{path}: {e}")))?;
    let mut bytes = Vec::new();
    let mut buffer = [0u8; 8192];
    loop {
      let capacity = self.remaining.min(buffer.len() - 1) + 1;
      let read = entry
        .read(&mut buffer[..capacity])
        .map_err(|e| ExtractionError::invalid(e.to_string()))?;
      if read == 0 {
        break;
      }
      let Some(remaining) = self.remaining.checked_sub(read) else {
        self.remaining = 0;
        return Err(ExtractionError::limit(
          "archive exceeds maxDecompressedBytes",
        ));
      };
      self.remaining = remaining;
      bytes.extend_from_slice(&buffer[..read]);
    }
    Ok(bytes)
  }
  pub fn xml(&mut self, path: &str) -> ExtractionResult<String> {
    String::from_utf8(self.read(path)?).map_err(|e| ExtractionError::invalid(e.to_string()))
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  use std::io::Write;
  #[test]
  fn failed_crc_read_still_consumes_inflation_budget() {
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    writer
      .start_file("part.xml", zip::write::SimpleFileOptions::default())
      .unwrap();
    writer.write_all(&vec![b'x'; 10000]).unwrap();
    let mut bytes = writer.finish().unwrap().into_inner();
    let central = bytes.windows(4).position(|v| v == b"PK\x01\x02").unwrap();
    bytes[central + 16..central + 20].copy_from_slice(&0u32.to_le_bytes());
    let mut options = ResolvedOptions::default();
    options.limits.max_decompressed_bytes = 30000;
    let mut archive = Archive::new(&bytes, &options).unwrap();
    assert!(archive.read("part.xml").is_err());
    assert_eq!(archive.remaining, 20000);
  }
}
