use crate::types::*;
use chardetng::EncodingDetector;
use encoding_rs::Encoding;
pub struct TextHandler;
impl TextHandler {
  pub fn new() -> Self {
    Self
  }
}
impl DocumentHandler for TextHandler {
  fn extract(&self, bytes: &[u8], options: &ResolvedOptions) -> ExtractionResult<HandlerOutput> {
    let mut output = HandlerOutput::new(None, FormatMetadata::Text, options);
    if !options.needs_text() {
      return Ok(output);
    }
    let (bom, skip) = Encoding::for_bom(bytes).map_or((None, 0), |(e, n)| (Some(e), n));
    let explicit = options
      .encoding
      .as_ref()
      .and_then(|e| Encoding::for_label(e.as_bytes()));
    if bom.zip(explicit).is_some_and(|(a, b)| a != b) {
      return Err(ExtractionError::new(
        ErrorCode::DecodeFailed,
        "decode",
        "encoding override conflicts with BOM",
      ));
    }
    let data = &bytes[skip..];
    let utf8 = std::str::from_utf8(data);
    let encoding = if let Some(e) = bom.or(explicit) {
      e
    } else if utf8.is_ok() {
      encoding_rs::UTF_8
    } else {
      let mut detector = EncodingDetector::new();
      detector.feed(data, true);
      detector.guess(None, true)
    };
    let (text, errors) = if encoding == encoding_rs::UTF_8 {
      match utf8 {
        Ok(text) => {
          if text.len() > options.limits.max_output_bytes {
            return Err(ExtractionError::limit(
              "decoded text exceeds maxOutputBytes",
            ));
          }
          (text.to_owned(), false)
        }
        Err(_) if !options.replace_invalid => {
          return Err(ExtractionError::new(
            ErrorCode::DecodeFailed,
            "decode",
            "invalid text encoding sequence",
          ));
        }
        Err(_) => decode_bounded(encoding, data, options)?,
      }
    } else {
      decode_bounded(encoding, data, options)?
    };
    if errors {
      warn(
        &mut output.warnings,
        ExtractionWarning {
          code: "DECODE_REPLACED",
          message: "Invalid sequences replaced with U+FFFD".into(),
          location: None,
          partial: false,
        },
        options,
      );
    }
    output.encoding = Some(encoding.name().to_ascii_lowercase());
    output.text = Some(text);
    Ok(output)
  }
}
fn decode_bounded(
  encoding: &'static Encoding,
  data: &[u8],
  options: &ResolvedOptions,
) -> ExtractionResult<(String, bool)> {
  let mut decoder = encoding.new_decoder_without_bom_handling();
  let mut output = String::new();
  let mut offset = 0;
  let mut replaced = false;
  let mut scratch = [0u8; 8192];
  loop {
    let (result, read, written, errors) =
      decoder.decode_to_utf8(&data[offset..], &mut scratch, true);
    offset += read;
    replaced |= errors;
    if errors && !options.replace_invalid {
      return Err(ExtractionError::new(
        ErrorCode::DecodeFailed,
        "decode",
        "invalid text encoding sequence",
      ));
    }
    let text = std::str::from_utf8(&scratch[..written]).map_err(|_| {
      ExtractionError::new(
        ErrorCode::InternalError,
        "decode",
        "decoder produced invalid UTF-8",
      )
    })?;
    push_text(&mut output, text, options)?;
    if result == encoding_rs::CoderResult::InputEmpty {
      return Ok((output, replaced));
    }
  }
}
#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn handles_bom_and_empty() {
    let h = TextHandler::new();
    let o = ResolvedOptions::default();
    assert_eq!(
      h.extract(b"\xef\xbb\xbfhello", &o).unwrap().text.as_deref(),
      Some("hello")
    );
    assert_eq!(
      h.extract(b"\xff\xfeh\0i\0", &o).unwrap().text.as_deref(),
      Some("hi")
    );
    assert_eq!(h.extract(b"", &o).unwrap().text.as_deref(), Some(""));
  }
  #[test]
  fn strict_and_replacement() {
    let mut o = ResolvedOptions {
      encoding: Some("utf-8".into()),
      ..Default::default()
    };
    assert!(TextHandler::new().extract(&[255], &o).is_err());
    o.replace_invalid = true;
    assert_eq!(
      TextHandler::new()
        .extract(&[255], &o)
        .unwrap()
        .warnings
        .len(),
      1
    );
  }
  #[test]
  fn incremental_decode_preserves_boundaries_and_enforces_expansion_limit() {
    let mut options = ResolvedOptions {
      encoding: Some("utf-16le".into()),
      ..Default::default()
    };
    let text = format!("{}🙂end", "é".repeat(5000));
    let mut bytes: Vec<u8> = text.encode_utf16().flat_map(u16::to_le_bytes).collect();
    assert_eq!(
      TextHandler::new()
        .extract(&bytes, &options)
        .unwrap()
        .text
        .as_deref(),
      Some(text.as_str())
    );
    bytes.extend_from_slice(&0xd800u16.to_le_bytes());
    assert_eq!(
      TextHandler::new()
        .extract(&bytes, &options)
        .unwrap_err()
        .code,
      ErrorCode::DecodeFailed
    );
    options.replace_invalid = true;
    let output = TextHandler::new().extract(&bytes, &options).unwrap();
    assert_eq!(output.text.as_deref(), Some(format!("{text}�").as_str()));
    assert_eq!(output.warnings.len(), 1);
    options.encoding = Some("windows-1252".into());
    options.limits.max_output_bytes = 10;
    assert_eq!(
      TextHandler::new()
        .extract(&[0x80; 4], &options)
        .unwrap_err()
        .code,
      ErrorCode::LimitExceeded
    );
  }
}
