# Similarity Algorithms

undms provides multiple algorithms for comparing text similarity, each with different strengths and use cases.

## Overview

| Method        | Best For                 | Time Complexity | Unicode Support |
| ------------- | ------------------------ | --------------- | --------------- |
| `jaccard`     | Word-level comparison    | O(n + m)        | ✅              |
| `ngram`       | Character-level matching | O(n × m)        | ✅              |
| `levenshtein` | Exact edit distance      | O(n × m)        | ✅              |
| `hybrid`      | Balanced accuracy        | Varies          | ✅              |

## Usage

### Choosing a Method

```ts
import { computeTextSimilarity } from 'undms';

const source = 'machine learning';

// Word-level comparison
const jaccardResult = computeTextSimilarity(source, [...refs], 50, 'jaccard');

// Character-level matching
const ngramResult = computeTextSimilarity(source, [...refs], 50, 'ngram');

// Edit distance
const levenshteinResult = computeTextSimilarity(source, [...refs], 50, 'levenshtein');

// Best overall accuracy (default)
const hybridResult = computeTextSimilarity(source, [...refs], 50, 'hybrid');
```

## Jaccard Index

The Jaccard index measures similarity based on the intersection and union of word sets.

### How It Works

1. Tokenize both texts into words
2. Create sets of unique words
3. Calculate: `|A ∩ B| / |A ∪ B|`

### Example

```ts
const source = 'the quick brown fox';
const references = ['the quick brown fox jumps', 'a slow lazy dog', 'quick brown fox the'];

const results = computeTextSimilarity(source, references, 0, 'jaccard');

// Results:
// Reference 0: 80% (the, quick, brown, fox are in both)
// Reference 1: 0% (no common words)
// Reference 2: 100% (same words, different order)
```

### Strengths

- Order-independent: "quick brown fox" matches "brown quick fox"
- Fast computation
- Good for plagiarism detection

### Weaknesses

- Ignores word frequency
- Poor at detecting partial matches

### Use Cases

- Document deduplication
- Plagiarism detection
- Category classification

## N-gram Similarity

N-gram similarity compares character sequences (typically trigrams) between texts.

### How It Works

1. Split text into character n-grams (default: trigrams)
2. Compare the sets of n-grams
3. Calculate Jaccard-like similarity

### Example

```ts
const source = 'hello';
const references = ['hello world', 'hallo', 'xlxo'];

const results = computeTextSimilarity(source, references, 0, 'ngram');

// N-grams for "hello": { "hel", "ell", "llo" }
// Reference 0: 60% (hel, ell, llo vs hel, ell, lo ,o w, wo, or, rl, ld)
// Reference 1: 66% (hel, ell, llo vs hal, all, llo)
// Reference 2: 33% (hel, ell, llo vs xl, lx, xo)
```

### Strengths

- Catches typos and misspellings
- Handles character-level variations
- Good for fuzzy matching

### Weaknesses

- Sensitive to word boundaries
- Can produce false positives with short text

### Use Cases

- Fuzzy string matching
- Spell checking
- DNA sequence analysis

## Levenshtein Distance

Measures the minimum number of single-character edits needed to transform one string into another.

### How It Works

1. Calculate edit distance (insertions, deletions, substitutions)
2. Normalize by max string length
3. Convert to similarity percentage

### Operations

| Operation  | Example        | Cost |
| ---------- | -------------- | ---- |
| Insert     | `cat` → `cats` | 1    |
| Delete     | `cats` → `cat` | 1    |
| Substitute | `cat` → `bat`  | 1    |

### Example

```ts
const source = 'kitten';
const references = ['sitting', 'kitten', 'bitten'];

const results = computeTextSimilarity(source, references, 0, 'levenshtein');

// "kitten" → "sitting": 3 edits (k→s, e→i, n→g) = 57%
// "kitten" → "kitten": 0 edits = 100%
// "kitten" → "bitten": 1 edit (k→b) = 83%
```

### Strengths

- Precise edit distance measurement
- Good for short strings
- Intuitive similarity metric

### Weaknesses

- Slower than Jaccard/N-gram for long texts
- Doesn't handle word order

### Use Cases

- Spell correction
- DNA sequencing
- Data cleaning

## Hybrid Method

The hybrid method combines all three algorithms for the most accurate results.

### How It Works

1. Calculate similarity using all three methods
2. Apply weighted average:
   - Jaccard: 33%
   - N-gram: 33%
   - Levenshtein: 34%
3. Combine with metadata similarity

### Example

```ts
const source = 'artificial intelligence is growing rapidly';
const references = [
  'artificial intelligence is a growing field',
  'machine learning is part of AI',
  'the weather is nice today',
];

const results = computeTextSimilarity(source, references, 0, 'hybrid');

// Reference 0: High score - matches "artificial intelligence", "growing"
// Reference 1: Medium score - partial match via "intelligence" and "AI"
// Reference 2: Low score - no meaningful overlap
```

### When to Use Hybrid

- Default and recommended for most use cases
- When accuracy is more important than speed
- For general-purpose text comparison
- When you're unsure which method to use

## Threshold

The threshold parameter filters out low-similarity matches.

### How It Works

```ts
const results = computeTextSimilarity(
  source,
  references,
  50, // threshold: only return matches >= 50%
  'hybrid',
);

// Only matches with similarity >= threshold are returned
```

### Choosing a Threshold

| Threshold | Use Case           |
| --------- | ------------------ |
| 90-100%   | Near-exact matches |
| 70-90%    | Close variations   |
| 50-70%    | Related content    |
| 30-50%    | Loose similarity   |

### Example: Practical Usage

```ts
const plagiarismThreshold = 80;
const relatedContentThreshold = 50;

// Check for potential plagiarism
const plagiarismResults = computeTextSimilarity(
  studentEssay,
  referenceTexts,
  plagiarismThreshold,
  'jaccard',
);

// Find related documents
const relatedResults = computeTextSimilarity(
  article,
  documentCorpus,
  relatedContentThreshold,
  'hybrid',
);
```

## Document vs. Text Similarity

### computeDocumentSimilarity

Extracts document content first, then compares:

```ts
const results = computeDocumentSimilarity(
  [
    {
      name: 'document.pdf',
      size: 1000,
      type: 'application/pdf',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: Buffer.from(pdfBuffer),
    },
  ],
  ['reference text'],
  50,
  'hybrid',
);
```

Returns `GroupedDocumentsWithSimilarity` with both extracted content and similarity matches.

### computeTextSimilarity

Compares raw text directly:

```ts
const results = computeTextSimilarity('already extracted text', ['reference text'], 50, 'hybrid');
```

Returns `SimilarityMatch[]` with similarity results only.

## Performance Comparison

```ts
import { computeTextSimilarity } from 'undms';

const source = 'a'.repeat(1000);
const references = Array(100)
  .fill(null)
  .map((_, i) => `reference ${i}`);

console.time('jaccard');
computeTextSimilarity(source, references, 30, 'jaccard');
console.timeEnd('jaccard'); // ~2ms

console.time('ngram');
computeTextSimilarity(source, references, 30, 'ngram');
console.timeEnd('ngram'); // ~15ms

console.time('levenshtein');
computeTextSimilarity(source, references, 30, 'levenshtein');
console.timeEnd('levenshtein'); // ~50ms

console.time('hybrid');
computeTextSimilarity(source, references, 30, 'hybrid');
console.timeEnd('hybrid'); // ~70ms
```

## Unicode Support

All methods fully support Unicode text:

```ts
const results = computeTextSimilarity(
  'こんにちは世界', // Japanese
  ['こんにちは', 'hello world'],
  30,
  'hybrid',
);

const results2 = computeTextSimilarity(
  'Émoji 🎉 et accents', // French with emoji
  ['émoji et accent', 'other text'],
  30,
  'hybrid',
);
```

## Best Practices

1. **Use `hybrid` for general purposes** - Best accuracy with minimal configuration

2. **Use `jaccard` for large documents** - Fast and efficient

3. **Use `ngram` for typos and fuzzy matching** - Catches character-level errors

4. **Use `levenshtein` for short strings** - Precise for short text

5. **Adjust threshold based on use case:**
   - High threshold (80+) for exact/near-exact matches
   - Low threshold (30-50) for related content discovery
