use crate::types::TextStatistics;
pub fn statistics(text: &str) -> TextStatistics {
  let mut value = TextStatistics::default();
  if text.is_empty() {
    return value;
  }
  if text.is_ascii() {
    value.line_count = 1;
    value.character_count = text.len() as u64;
    let mut word = false;
    let mut cr = false;
    for &byte in text.as_bytes() {
      if byte == b'\r' || (byte == b'\n' && !cr) {
        value.line_count += 1;
      }
      cr = byte == b'\r';
      // Rust's ASCII byte predicate omits vertical tab, which char whitespace includes.
      if byte.is_ascii_whitespace() || byte == 0x0b {
        word = false;
      } else {
        value.non_whitespace_character_count += 1;
        if !word {
          value.word_count += 1;
          word = true;
        }
      }
    }
    return value;
  }
  value.line_count = 1;
  let mut word = false;
  let mut cr = false;
  for c in text.chars() {
    value.character_count += 1;
    if c == '\r' || (c == '\n' && !cr) {
      value.line_count += 1;
    }
    cr = c == '\r';
    if c.is_whitespace() {
      word = false;
    } else {
      value.non_whitespace_character_count += 1;
      if !word {
        value.word_count += 1;
        word = true;
      }
    }
  }
  value
}
#[cfg(test)]
mod tests {
  use super::*;
  #[test]
  fn counts_empty_unicode_and_line_endings() {
    assert_eq!(statistics(""), TextStatistics::default());
    let s = statistics("a\r\n🙂\r");
    assert_eq!(s.line_count, 3);
    assert_eq!(s.word_count, 2);
    assert_eq!(s.character_count, 5);
  }
  #[test]
  fn ascii_and_unicode_statistics_agree_on_whitespace_and_newlines() {
    let ascii = "a\t b\u{b}c\u{c}d\r\ne\rf\ng ";
    let unicode = ascii.replace('a', "é");
    assert_eq!(statistics(ascii), statistics(&unicode));
    let counts = statistics(ascii);
    assert_eq!(counts.word_count, 7);
    assert_eq!(counts.line_count, 4);
    assert_eq!(counts.non_whitespace_character_count, 7);
  }
}
