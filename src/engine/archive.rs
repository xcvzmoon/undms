use crate::types::{ExtractionError, ExtractionResult, ResolvedOptions};
use std::io::{Cursor, Read};
use zip::ZipArchive;
pub struct Archive<'a> {
  inner: ZipArchive<Cursor<&'a [u8]>>,
  remaining: usize,
  limit: usize,
}
impl<'a> Archive<'a> {
  pub fn new(bytes: &'a [u8], options: &ResolvedOptions) -> ExtractionResult<Self> {
    let inner =
      ZipArchive::new(Cursor::new(bytes)).map_err(|e| ExtractionError::invalid(e.to_string()))?;
    if inner.len() > options.limits.max_archive_entries {
      return Err(ExtractionError::count_limit(
        "archive exceeds maxArchiveEntries",
        "maxArchiveEntries",
        options.limits.max_archive_entries as u64,
        inner.len() as u64,
      ));
    }
    Ok(Self {
      inner,
      remaining: options.limits.max_decompressed_bytes,
      limit: options.limits.max_decompressed_bytes,
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
        remaining = remaining.checked_sub(read).ok_or_else(|| {
          ExtractionError::byte_limit(
            "archive exceeds maxDecompressedBytes",
            "maxDecompressedBytes",
            self.limit,
            self.limit.saturating_add(1),
            true,
          )
        })?;
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
    let max_entry_bytes = self.remaining;
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
        return Err(ExtractionError::byte_limit(
          "archive exceeds maxDecompressedBytes",
          "maxDecompressedBytes",
          self.limit,
          self.limit.saturating_add(1),
          true,
        ));
      };
      self.remaining = remaining;
      let required = bytes.len() + read;
      if bytes.capacity() < required {
        let target = required
          .max(bytes.capacity().saturating_mul(2))
          .min(max_entry_bytes);
        bytes
          .try_reserve_exact(target - bytes.len())
          .map_err(|_| ExtractionError::limit("unable to allocate bounded archive entry"))?;
      }
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
  fn compressed_archive(parts: &[(&str, usize)]) -> Vec<u8> {
    let mut writer = zip::ZipWriter::new(Cursor::new(Vec::new()));
    let block = [b'x'; 64 * 1024];
    for (name, size) in parts {
      writer
        .start_file(
          *name,
          zip::write::SimpleFileOptions::default()
            .compression_method(zip::CompressionMethod::Deflated),
        )
        .unwrap();
      let mut remaining = *size;
      while remaining > 0 {
        let count = remaining.min(block.len());
        writer.write_all(&block[..count]).unwrap();
        remaining -= count;
      }
    }
    writer.finish().unwrap().into_inner()
  }
  #[test]
  fn inflation_above_old_ceiling_is_supported_without_materializing_it() {
    let size = 512 * 1024 * 1024 + 1;
    let bytes = compressed_archive(&[("large.xml", size)]);
    assert!(bytes.len() < 1024 * 1024);
    let mut options = ResolvedOptions::default();
    options.limits.max_decompressed_bytes = size;
    Archive::new(&bytes, &options)
      .unwrap()
      .validate_inflation()
      .unwrap();
    options.limits.max_decompressed_bytes = size - 1;
    let error = Archive::new(&bytes, &options)
      .unwrap()
      .validate_inflation()
      .unwrap_err();
    let details = error.limit_details.unwrap();
    assert_eq!(details.name, "maxDecompressedBytes");
    assert_eq!(details.configured, (size - 1) as u64);
    assert_eq!(details.observed_at_least_bytes, Some(size as u64));
  }
  #[test]
  fn inflation_is_cumulative_for_audits_and_reads_including_repeated_reads() {
    let bytes = compressed_archive(&[("a", 5), ("b", 6)]);
    let mut options = ResolvedOptions::default();
    options.limits.max_decompressed_bytes = 11;
    Archive::new(&bytes, &options)
      .unwrap()
      .validate_inflation()
      .unwrap();
    let mut archive = Archive::new(&bytes, &options).unwrap();
    assert_eq!(archive.read("a").unwrap().len(), 5);
    assert_eq!(archive.read("b").unwrap().len(), 6);
    let error = archive.read("a").unwrap_err();
    assert_eq!(
      error.limit_details.unwrap().observed_at_least_bytes,
      Some(12)
    );
    options.limits.max_decompressed_bytes = 10;
    assert!(
      Archive::new(&bytes, &options)
        .unwrap()
        .validate_inflation()
        .is_err()
    );
    let mut archive = Archive::new(&bytes, &options).unwrap();
    assert!(archive.read("a").is_ok());
    assert!(archive.read("b").is_err());
  }
  #[test]
  fn entry_buffer_growth_stays_within_the_remaining_budget() {
    let bytes = compressed_archive(&[("a", 20_000)]);
    let mut options = ResolvedOptions::default();
    options.limits.max_decompressed_bytes = 20_001;
    let mut archive = Archive::new(&bytes, &options).unwrap();
    let content = archive.read("a").unwrap();
    assert_eq!(content.len(), 20_000);
    assert!(content.capacity() <= 20_001);
  }
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
