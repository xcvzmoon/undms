# computeDocumentSimilarity

Extracts documents and computes similarity against reference texts.

## Function Signature

```ts
function computeDocumentSimilarity(
  documents: Document[],
  referenceTexts: string[],
  similarityThreshold?: number,
  similarityMethod?: string,
): GroupedDocumentsWithSimilarity[];
```

## Parameters

| Parameter             | Type         | Required | Default    | Description                                                 |
| --------------------- | ------------ | -------- | ---------- | ----------------------------------------------------------- |
| `documents`           | `Document[]` | Yes      | -          | Documents to extract and compare                            |
| `referenceTexts`      | `string[]`   | Yes      | -          | Candidate reference texts                                   |
| `similarityThreshold` | `number`     | No       | `30.0`     | Minimum score (0-100) to include a match                    |
| `similarityMethod`    | `string`     | No       | `'hybrid'` | One of: `'jaccard'`, `'ngram'`, `'levenshtein'`, `'hybrid'` |

## Returns

`GroupedDocumentsWithSimilarity[]` — Documents grouped by MIME type, each with similarity matches.

## Example

### Basic Usage

```ts
import { computeDocumentSimilarity } from 'undms';

const result = computeDocumentSimilarity(
  [
    {
      name: 'document.txt',
      size: 100,
      type: 'text/plain',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: Buffer.from('hello world from undms'),
    },
  ],
  ['hello world from undms', 'different text'],
  90,
  'hybrid',
);

console.log(result[0].documents[0].similarityMatches);
// [{ referenceIndex: 0, similarityPercentage: 100 }]
```

### Finding Similar Documents

```ts
import { computeDocumentSimilarity } from 'undms';

const documents = [
  {
    name: 'doc1.txt',
    size: 100,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('The quick brown fox jumps over the lazy dog'),
  },
  {
    name: 'doc2.txt',
    size: 100,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('A quick brown fox jumps over a lazy dog'),
  },
  {
    name: 'doc3.txt',
    size: 100,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Something completely different here'),
  },
];

const referenceTexts = [
  'The quick brown fox jumps over the lazy dog',
  'A lazy dog resting in the sun',
  'Completely unrelated content about cooking',
];

const results = computeDocumentSimilarity(documents, referenceTexts, 50, 'hybrid');

results.forEach((group) => {
  console.log(`\nMIME Type: ${group.mimeType}`);
  group.documents.forEach((doc) => {
    console.log(`Document: ${doc.name}`);
    console.log(`Content: ${doc.content}`);

    if (doc.similarityMatches.length > 0) {
      console.log('Similarity Matches:');
      doc.similarityMatches.forEach((match) => {
        console.log(
          `  - Reference ${match.referenceIndex} (${referenceTexts[match.referenceIndex]}): ` +
            `${match.similarityPercentage.toFixed(1)}%`,
        );
      });
    } else {
      console.log('No matches above threshold');
    }
  });
});
```

### Using Different Methods

```ts
import { computeDocumentSimilarity } from 'undms';

const document = {
  name: 'sample.txt',
  size: 500,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: Buffer.from('machine learning is a subset of artificial intelligence'),
};

const references = [
  'machine learning is a subset of artificial intelligence',
  'deep learning is a specialized form of machine learning',
  'artificial intelligence encompasses machine learning techniques',
  'the weather is sunny today',
];

// Jaccard - word set comparison
const jaccardResults = computeDocumentSimilarity([document], references, 30, 'jaccard');

// N-gram - character trigram matching
const ngramResults = computeDocumentSimilarity([document], references, 30, 'ngram');

// Levenshtein - edit distance
const levenshteinResults = computeDocumentSimilarity([document], references, 30, 'levenshtein');

// Hybrid - combined (default)
const hybridResults = computeDocumentSimilarity([document], references, 30, 'hybrid');

console.log('Jaccard:', jaccardResults[0].documents[0].similarityMatches);
console.log('N-gram:', ngramResults[0].documents[0].similarityMatches);
console.log('Levenshtein:', levenshteinResults[0].documents[0].similarityMatches);
console.log('Hybrid:', hybridResults[0].documents[0].similarityMatches);
```

### Plagiarism Detection

```ts
import { computeDocumentSimilarity } from 'undms';

interface Submission {
  student: string;
  content: string;
}

const submissions: Submission[] = [
  { student: 'Alice', content: 'Machine learning enables computers to learn from data' },
  { student: 'Bob', content: 'Machine learning allows computers to learn from data' },
  { student: 'Charlie', content: 'Deep learning uses neural networks to process data' },
];

const referenceSources = [
  'Machine learning is a subset of artificial intelligence that enables computers to learn from data',
  'Deep learning is a specialized form of machine learning using neural networks',
];

const documents = submissions.map((s) => ({
  name: `${s.student}.txt`,
  size: s.content.length,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: Buffer.from(s.content),
}));

const threshold = 60;
const results = computeDocumentSimilarity(documents, referenceSources, threshold, 'hybrid');

console.log(`Plagiarism Check (threshold: ${threshold}%)\n`);

results.forEach((group) => {
  group.documents.forEach((doc) => {
    const student = submissions.find((s) => `${s.student}.txt` === doc.name);
    console.log(`Student: ${student?.student}`);

    if (doc.similarityMatches.length > 0) {
      doc.similarityMatches.forEach((match) => {
        console.log(
          `  ⚠️  Potential match with source ${match.referenceIndex}: ` +
            `${match.similarityPercentage.toFixed(1)}%`,
        );
      });
    } else {
      console.log('  ✅ No significant matches found');
    }
    console.log();
  });
});
```

### Working with PDFs

```ts
import { computeDocumentSimilarity } from 'undms';
import * as fs from 'fs';

function checkPdfSimilarity(pdfPath: string, references: string[]) {
  const pdfBuffer = fs.readFileSync(pdfPath);

  const result = computeDocumentSimilarity(
    [
      {
        name: pdfPath,
        size: pdfBuffer.length,
        type: 'application/pdf',
        lastModified: Date.now(),
        webkitRelativePath: '',
        buffer: pdfBuffer,
      },
    ],
    references,
    40,
    'hybrid',
  );

  const doc = result[0].documents[0];

  return {
    content: doc.content,
    matches: doc.similarityMatches.map((m) => ({
      reference: references[m.referenceIndex],
      similarity: m.similarityPercentage,
    })),
  };
}

const references = [
  'Introduction to machine learning algorithms',
  'Advanced data structures and algorithms',
  'Web development best practices',
];

const result = checkPdfSimilarity('./research_paper.pdf', references);

console.log('Extracted Content Preview:');
console.log(result.content.substring(0, 200));
console.log('\nSimilarity Matches:');
result.matches.forEach((m) => {
  console.log(`  ${m.similarity.toFixed(1)}% - ${m.reference}`);
});
```

### Adjusting Threshold

```ts
import { computeDocumentSimilarity } from 'undms';

const document = {
  name: 'text.txt',
  size: 100,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: Buffer.from('The quick brown fox jumps over the lazy dog'),
};

const references = [
  'The quick brown fox jumps over the lazy dog', // 100%
  'A quick brown fox jumps over a lazy dog', // ~85%
  'Quick brown fox lazy dog', // ~70%
  'The cat sat on the mat', // ~20%
];

// High threshold - only exact matches
const strictResults = computeDocumentSimilarity([document], references, 90, 'hybrid');

// Medium threshold - close variations
const moderateResults = computeDocumentSimilarity([document], references, 60, 'hybrid');

// Low threshold - any similarity
const lenientResults = computeDocumentSimilarity([document], references, 20, 'hybrid');

console.log('Strict (90%):', strictResults[0].documents[0].similarityMatches.length, 'matches');
console.log('Moderate (60%):', moderateResults[0].documents[0].similarityMatches.length, 'matches');
console.log('Lenient (20%):', lenientResults[0].documents[0].similarityMatches.length, 'matches');
```

## Error Handling

```ts
import { computeDocumentSimilarity } from 'undms';

const documents = [
  {
    name: 'corrupted.docx',
    size: 100,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('not a real docx'),
  },
];

const results = computeDocumentSimilarity(documents, ['reference text'], 50, 'hybrid');

const doc = results[0].documents[0];

// Handle extraction errors
if (doc.error) {
  console.log('Extraction error:', doc.error);
  console.log('Content may be incomplete or empty');
}

// Similarity still computed on available content
console.log('Similarity matches:', doc.similarityMatches);
```
