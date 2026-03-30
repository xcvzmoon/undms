use std::collections::HashSet;

#[derive(Debug, Clone, Copy)]
pub enum SimilarityMethod {
  Jaccard,
  Ngram,
  Levenshtein,
  Hybrid,
}

pub fn jaccard(source: &str, target: &str) -> f64 {
  let source_words: HashSet<String> = source
    .split_whitespace()
    .map(|word| word.to_lowercase())
    .collect();
  let target_words: HashSet<String> = target
    .split_whitespace()
    .map(|word| word.to_lowercase())
    .collect();

  let intersection = source_words.intersection(&target_words).count();
  let union = source_words.union(&target_words).count();

  if union == 0 {
    return 0.0;
  }

  (intersection as f64 / union as f64) * 100.0
}

pub fn ngram(source: &str, target: &str, n: usize) -> f64 {
  let source_ngrams = char_ngrams(source, n);
  let target_ngrams = char_ngrams(target, n);
  let intersection_size = source_ngrams.intersection(&target_ngrams).count();
  let union_size = source_ngrams.union(&target_ngrams).count();

  if union_size == 0 {
    return 0.0;
  }

  (intersection_size as f64 / union_size as f64) * 100.0
}

fn char_ngrams(text: &str, n: usize) -> HashSet<String> {
  let cleaned = text
    .to_lowercase()
    .split_whitespace()
    .collect::<Vec<_>>()
    .join(" ");

  if cleaned.len() < n {
    return HashSet::new();
  }

  cleaned
    .chars()
    .collect::<Vec<_>>()
    .windows(n)
    .map(|window| window.iter().collect::<String>())
    .collect()
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
}
