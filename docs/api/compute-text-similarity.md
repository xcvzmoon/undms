# computeTextSimilarity

Computes similarity matches for plain text input without file extraction.

## Function Signature

```ts
function computeTextSimilarity(
  sourceText: string,
  referenceTexts: string[],
  similarityThreshold?: number,
  similarityMethod?: string,
): SimilarityMatch[];
```

## Parameters

| Parameter             | Type       | Required | Default    | Description                                                 |
| --------------------- | ---------- | -------- | ---------- | ----------------------------------------------------------- |
| `sourceText`          | `string`   | Yes      | -          | Source text to compare                                      |
| `referenceTexts`      | `string[]` | Yes      | -          | Candidate reference texts                                   |
| `similarityThreshold` | `number`   | No       | `30.0`     | Minimum score (0-100) to include a match                    |
| `similarityMethod`    | `string`   | No       | `'hybrid'` | One of: `'jaccard'`, `'ngram'`, `'levenshtein'`, `'hybrid'` |

## Returns

`SimilarityMatch[]` — Array of matches where each match includes:

- `referenceIndex`: Index into the reference texts array
- `similarityPercentage`: Similarity score (0-100)

## Example

### Basic Usage

```ts
import { computeTextSimilarity } from 'undms';

const matches = computeTextSimilarity(
  'alpha beta gamma',
  ['alpha beta gamma', 'other content'],
  80,
  'jaccard',
);

console.log(matches);
// [{ referenceIndex: 0, similarityPercentage: 100 }]
```

### Finding Similar Text

```ts
import { computeTextSimilarity } from 'undms';

const source = 'machine learning is a subset of artificial intelligence';

const references = [
  'machine learning is a subset of artificial intelligence',
  'deep learning is a subset of machine learning',
  'artificial intelligence encompasses machine learning',
  'the weather is nice today',
];

const matches = computeTextSimilarity(source, references, 50, 'hybrid');

console.log('Similarity matches:');
matches.forEach((match) => {
  console.log(
    `  Reference ${match.referenceIndex}: ${match.similarityPercentage.toFixed(1)}% - "${references[match.referenceIndex]}"`,
  );
});
```

### Document Classification

```ts
import { computeTextSimilarity } from 'undms';

const document = `
Photosynthesis is the process used by plants to convert light energy into chemical energy.
Plants use chlorophyll in their leaves to capture sunlight and combine it with carbon dioxide
and water to produce glucose and oxygen. This process is essential for life on Earth as it
produces the oxygen we breathe and forms the base of most food chains.
`.trim();

const categories = {
  'Science/Technology': [
    'machine learning artificial intelligence algorithms',
    'computer programming software development',
    'photosynthesis chemical reaction energy',
  ],
  Sports: [
    'football basketball soccer match',
    'athlete competition tournament score',
    'training exercise fitness workout',
  ],
  Business: [
    'marketing sales revenue profit',
    'investment stock market finance',
    'company startup entrepreneurship',
  ],
  Entertainment: [
    'movie music concert film',
    'actor actress performance show',
    'gaming video game entertainment',
  ],
};

function classifyDocument(text: string): string {
  const allReferences = Object.values(categories).flat();
  const categoryOffsets: number[] = [];

  for (const refs of Object.values(categories)) {
    categoryOffsets.push(refs.length);
  }

  const matches = computeTextSimilarity(text, allReferences, 30, 'hybrid');

  const categoryScores: Record<string, number> = {};
  let offset = 0;

  for (const [category, refs] of Object.entries(categories)) {
    const categoryMatches = matches.filter(
      (m) => m.referenceIndex >= offset && m.referenceIndex < offset + refs.length,
    );

    const totalScore = categoryMatches.reduce((sum, m) => sum + m.similarityPercentage, 0);
    categoryScores[category] = totalScore;
    offset += refs.length;
  }

  return Object.entries(categoryScores).sort((a, b) => b[1] - a[1])[0][0];
}

const category = classifyDocument(document);
console.log(`Document category: ${category}`);
// Output: Document category: Science/Technology
```

### Content Deduplication

```ts
import { computeTextSimilarity } from 'undms';

const articles = [
  {
    id: 1,
    title: 'Introduction to Python',
    content: 'Python is a high-level programming language...',
  },
  {
    id: 2,
    title: 'Python Basics',
    content: 'Python is a high-level programming language designed for readability...',
  },
  {
    id: 3,
    title: 'Advanced JavaScript',
    content: 'JavaScript is a versatile language for web development...',
  },
  {
    id: 4,
    title: 'Python Tips',
    content: 'Python is a high-level programming language with clean syntax...',
  },
];

function findDuplicates(articles: typeof articles, threshold = 70): [number, number][] {
  const duplicates: [number, number][] = [];

  for (let i = 0; i < articles.length; i++) {
    for (let j = i + 1; j < articles.length; j++) {
      const matches = computeTextSimilarity(
        articles[i].content,
        [articles[j].content],
        threshold,
        'hybrid',
      );

      if (matches.length > 0) {
        duplicates.push([articles[i].id, articles[j].id]);
        console.log(
          `Potential duplicate: "${articles[i].title}" (${articles[j].content.substring(0, 30)}...)`,
        );
      }
    }
  }

  return duplicates;
}

const duplicates = findDuplicates(articles);
// Will identify articles 1, 2, and 4 as potential duplicates
```

### Keyword Extraction by Similarity

```ts
import { computeTextSimilarity } from 'undms';

const document = `
The quick brown fox jumps over the lazy dog. This is a classic pangram that contains
every letter of the English alphabet. Programming languages like Python, JavaScript,
and Rust are commonly used for software development. Machine learning and artificial
intelligence are rapidly growing fields in technology.
`.trim();

const keywords = [
  'programming',
  'python',
  'javascript',
  'rust',
  'machine learning',
  'artificial intelligence',
  'AI',
  'ML',
  'fox',
  'dog',
  'alphabet',
  'pangram',
  'technology',
  'software',
  'development',
];

const threshold = 30;

const matches = computeTextSimilarity(document, keywords, threshold, 'ngram');

console.log('Extracted keywords:');
matches
  .sort((a, b) => b.similarityPercentage - a.similarityPercentage)
  .forEach((m) => {
    console.log(`  ${keywords[m.referenceIndex]}: ${m.similarityPercentage.toFixed(1)}%`);
  });
```

### Text Comparison Methods

```ts
import { computeTextSimilarity } from 'undms';

const source = 'hello world';
const references = [
  'hello world', // Exact match
  'hello', // Subset
  'helo world', // Typo
  'world hello', // Reversed
  'goodbye world', // Partial
];

console.log('Method Comparison:\n');

['jaccard', 'ngram', 'levenshtein', 'hybrid'].forEach((method) => {
  const matches = computeTextSimilarity(source, references, 0, method);

  console.log(`${method}:`);
  matches.forEach((m) => {
    console.log(`  "${references[m.referenceIndex]}": ${m.similarityPercentage.toFixed(1)}%`);
  });
  console.log();
});
```

### Fuzzy Search

```ts
import { computeTextSimilarity } from 'undms';

interface SearchableItem {
  id: string;
  title: string;
  content: string;
}

const items: SearchableItem[] = [
  { id: '1', title: 'Python Tutorial', content: 'Learn Python programming from scratch' },
  { id: '2', title: 'JavaScript Guide', content: 'Master JavaScript development' },
  { id: '3', title: 'Rust Cookbook', content: 'Advanced Rust programming techniques' },
  { id: '4', title: 'TypeScript Basics', content: 'Introduction to TypeScript language' },
];

function fuzzySearch(query: string, items: SearchableItem[], threshold = 30) {
  const allContents = items.map((item) => item.content);
  const matches = computeTextSimilarity(query, allContents, threshold, 'ngram');

  const results = matches
    .map((m) => ({
      item: items[m.referenceIndex],
      similarity: m.similarityPercentage,
    }))
    .sort((a, b) => b.similarity - a.similarity);

  return results;
}

const searchResults = fuzzySearch('learn programming python', items);

console.log('Search Results:');
searchResults.forEach((result) => {
  console.log(`  ${result.similarity.toFixed(1)}% - ${result.item.title}`);
});
```

### String Similarity for Validation

```ts
import { computeTextSimilarity } from 'undms';

interface ValidationRule {
  name: string;
  validValues: string[];
  threshold: number;
}

const rules: ValidationRule[] = [
  { name: 'Country', validValues: ['USA', 'Canada', 'Mexico', 'Brazil'], threshold: 70 },
  { name: 'Currency', validValues: ['USD', 'EUR', 'GBP', 'JPY'], threshold: 60 },
  { name: 'Status', validValues: ['pending', 'approved', 'rejected'], threshold: 80 },
];

function validate(value: string): { valid: boolean; suggestion?: string } {
  for (const rule of rules) {
    const validValues = rule.validValues;
    const matches = computeTextSimilarity(value, validValues, rule.threshold, 'hybrid');

    if (matches.length > 0) {
      return { valid: true };
    }
  }

  // Find closest match for suggestion
  const allValues = rules.flatMap((r) => r.validValues);
  const matches = computeTextSimilarity(value, allValues, 20, 'levenshtein');

  if (matches.length > 0) {
    const bestMatch = matches[0];
    return {
      valid: false,
      suggestion: allValues[bestMatch.referenceIndex],
    };
  }

  return { valid: false };
}

console.log(validate('united states')); // { valid: true }
console.log(validate('US')); // { valid: true }
console.log(validate('pnding')); // { valid: false, suggestion: 'pending' }
console.log(validate('aprove')); // { valid: false, suggestion: 'approved' }
console.log(validate('random')); // { valid: false }
```

### Unicode Support

```ts
import { computeTextSimilarity } from 'undms';

// Japanese
const japanese = computeTextSimilarity(
  'こんにちは世界',
  ['こんにちは', 'hello world', 'こんばんは'],
  30,
  'hybrid',
);
console.log('Japanese:', japanese);

// Chinese
const chinese = computeTextSimilarity(
  '机器学习',
  ['机器学习', '深度学习', '人工智能'],
  30,
  'hybrid',
);
console.log('Chinese:', chinese);

// French with accents
const french = computeTextSimilarity('été', ['ete', 'ete', 'hiver'], 30, 'levenshtein');
console.log('French:', french);

// Emoji
const emoji = computeTextSimilarity(
  'hello 🎉 world',
  ['hello world', 'hi 👋', 'hey 🎊'],
  30,
  'ngram',
);
console.log('Emoji:', emoji);
```
