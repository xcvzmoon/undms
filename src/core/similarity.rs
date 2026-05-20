use ahash::{AHashSet, AHasher};
use std::hash::Hasher;

const NGRAM_HASH_BASE: u64 = 1_315_423_911;

#[derive(Debug, Clone, Copy)]
pub enum SimilarityMethod {
  Jaccard,
  Ngram,
  Levenshtein,
  Hybrid,
}

pub fn jaccard(source: &str, target: &str) -> f64 {
  let source_words: AHashSet<u64> = source.split_whitespace().map(lowercase_hash).collect();
  let target_words: AHashSet<u64> = target.split_whitespace().map(lowercase_hash).collect();

  let intersection = source_words.intersection(&target_words).count();
  let union = source_words.union(&target_words).count();

  if union == 0 {
    return 0.0;
  }

  (intersection as f64 / union as f64) * 100.0
}

pub fn ngram(source: &str, target: &str, n: usize) -> f64 {
  if n == 0 {
    return 0.0;
  }

  let source_len = source.chars().count();
  let target_len = target.chars().count();
  let max_len = source_len.max(target_len);
  let min_len = source_len.min(target_len);

  if max_len > 0 && (max_len as f64 / min_len.max(1) as f64) > 3.0 {
    return 0.0;
  }

  if source_len < n || target_len < n {
    return 0.0;
  }

  let source_ngrams = rolling_ngram_hashes(source, n);
  let target_ngrams = rolling_ngram_hashes(target, n);
  let max_set_size = source_ngrams.len().max(target_ngrams.len());
  let min_set_size = source_ngrams.len().min(target_ngrams.len());

  if max_set_size > 0 && (max_set_size as f64 / min_set_size.max(1) as f64) > 5.0 {
    return 0.0;
  }

  let intersection_size = source_ngrams.intersection(&target_ngrams).count();
  let union_size = source_ngrams.union(&target_ngrams).count();

  if union_size == 0 {
    return 0.0;
  }

  (intersection_size as f64 / union_size as f64) * 100.0
}

fn lowercase_hash(word: &str) -> u64 {
  let mut hasher = AHasher::default();

  if word.is_ascii() {
    for byte in word.bytes() {
      hasher.write_u8(byte.to_ascii_lowercase());
    }
  } else {
    for character in word.chars().flat_map(char::to_lowercase) {
      hasher.write_u32(character as u32);
    }
  }

  hasher.finish()
}

fn rolling_ngram_hashes(text: &str, n: usize) -> AHashSet<u64> {
  let cleaned = normalize_similarity_text(text);
  let chars: Vec<char> = cleaned.chars().collect();

  if chars.len() < n {
    return AHashSet::new();
  }

  let mut hashes = AHashSet::with_capacity(chars.len().saturating_sub(n - 1));

  chars
    .windows(n)
    .map(|window| {
      window.iter().fold(0_u64, |hash, character| {
        hash
          .wrapping_mul(NGRAM_HASH_BASE)
          .wrapping_add(*character as u64)
      })
    })
    .for_each(|hash| {
      hashes.insert(hash);
    });

  hashes
}

fn normalize_similarity_text(text: &str) -> String {
  let mut normalized = String::with_capacity(text.len());
  let mut previous_was_whitespace = false;

  for character in text.chars().flat_map(char::to_lowercase) {
    if character.is_whitespace() {
      if !normalized.is_empty() && !previous_was_whitespace {
        normalized.push(' ');
        previous_was_whitespace = true;
      }
      continue;
    }

    normalized.push(character);
    previous_was_whitespace = false;
  }

  if normalized.ends_with(' ') {
    normalized.pop();
  }

  normalized
}

pub fn levenshtein(source: &str, target: &str, max_distance: Option<usize>) -> f64 {
  let max_length = source.chars().count().max(target.chars().count());
  if max_length == 0 {
    return 100.0;
  }

  let distance = bounded_levenshtein(source, target, max_distance);
  if let Some(max) = max_distance {
    if distance > max {
      return 0.0;
    }
  }

  ((max_length - distance) as f64 / max_length as f64) * 100.0
}

fn bounded_levenshtein(source: &str, target: &str, max_distance: Option<usize>) -> usize {
  let source_chars: Vec<char> = source.chars().collect();
  let target_chars: Vec<char> = target.chars().collect();

  if source_chars.is_empty() {
    return target_chars.len();
  }

  if target_chars.is_empty() {
    return source_chars.len();
  }

  let source_len = source_chars.len();
  let target_len = target_chars.len();

  let (rows, columns, use_swap) = if source_len < target_len {
    (source_len + 1, target_len + 1, false)
  } else {
    (target_len + 1, source_len + 1, true)
  };

  let (s_chars, t_chars) = if use_swap {
    (&target_chars, &source_chars)
  } else {
    (&source_chars, &target_chars)
  };

  let mut previous: Vec<usize> = (0..columns).collect();
  let mut current: Vec<usize> = vec![0; columns];

  for row in 1..rows {
    current[0] = row;
    let mut row_min = row;

    for column in 1..columns {
      let cost = if s_chars[row - 1] == t_chars[column - 1] {
        0
      } else {
        1
      };

      current[column] = (current[column - 1] + 1)
        .min(previous[column] + 1)
        .min(previous[column - 1] + cost);

      row_min = row_min.min(current[column]);
    }

    if let Some(max_dist) = max_distance {
      if row_min > max_dist {
        return max_dist + 1;
      }
    }

    std::mem::swap(&mut previous, &mut current);
  }

  previous[columns - 1]
}

pub fn hybrid(source: &str, target: &str) -> f64 {
  let jaccard_score = jaccard(source, target);
  if jaccard_score < 20.0 {
    return jaccard_score;
  }

  let source_char_count = source.chars().count();
  let target_char_count = target.chars().count();

  if source_char_count < 1000 && target_char_count < 1000 {
    let max_length = source_char_count.max(target_char_count);
    let max_allowed_distance = (max_length as f64 * 0.8) as usize;
    let distance = bounded_levenshtein(source, target, Some(max_allowed_distance));

    if distance > max_allowed_distance {
      return 20.0;
    }

    return ((max_length - distance) as f64 / max_length as f64) * 100.0;
  }

  ngram(source, target, 3)
}

pub fn similarity(source: &str, target: &str, method: SimilarityMethod) -> f64 {
  match method {
    SimilarityMethod::Jaccard => jaccard(source, target),
    SimilarityMethod::Ngram => ngram(source, target, 3),
    SimilarityMethod::Levenshtein => levenshtein(source, target, None),
    SimilarityMethod::Hybrid => hybrid(source, target),
  }
}

#[cfg(test)]
mod tests {
  use super::*;

  #[test]
  fn levenshtein_uses_character_count_for_unicode_strings() {
    let score = levenshtein("é", "e", None);

    assert_eq!(score, 0.0);
  }

  #[test]
  fn normalize_similarity_text_collapses_whitespace_once() {
    assert_eq!(
      normalize_similarity_text("  Alpha\n\tBeta   Gamma  "),
      "alpha beta gamma"
    );
  }

  #[test]
  fn jaccard_matches_case_insensitive_unicode_words() {
    assert_eq!(jaccard("Éclair 中文", "éclair 中文"), 100.0);
  }

  #[test]
  fn ngram_returns_zero_for_wildly_different_lengths() {
    assert_eq!(ngram("abc", &"abc".repeat(20), 3), 0.0);
  }

  #[test]
  fn ngram_matches_unicode_text() {
    assert_eq!(ngram("Résumé 中文 text", "résumé 中文 text", 3), 100.0);
  }
}
