# Getting Started

Welcome to undms - a high-performance document text and metadata extraction library with built-in similarity comparison.

## Installation

Install undms using your preferred package manager:

::: code-group

```bash [pnpm]
pnpm add undms
```

```bash [npm]
npm install undms
```

```bash [yarn]
yarn add undms
```

```bash [bun]
bun add undms
```

:::

## Requirements

- **Node.js**: 12.22+, 14.17+, 15.12+, or 16+ (excluding Node 13.x)
- **Rust**: Latest stable (for development/building from source)

## Quick Start

Extract text and metadata from documents in just a few lines:

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'report.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Hello, World! This is a sample document.'),
  },
];

const result = extract(documents);

console.log(result[0].documents[0].content);
// Output: "Hello, World! This is a sample document."

console.log(result[0].documents[0].metadata?.text);
// Output: { lineCount: 1, wordCount: 6, characterCount: 35, nonWhitespaceCharacterCount: 31 }
```

## Basic Usage

### Extract from a File

Read a file from disk and extract its contents:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const fileBuffer = fs.readFileSync('./document.pdf');

const documents = [
  {
    name: 'document.pdf',
    size: fileBuffer.length,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: fileBuffer,
  },
];

const results = extract(documents);

for (const group of results) {
  for (const doc of group.documents) {
    console.log(`File: ${doc.name}`);
    console.log(`Content: ${doc.content.substring(0, 100)}...`);
    console.log(`Processing time: ${doc.processingTime.toFixed(2)}ms`);
  }
}
```

### Extract from Multiple Files

Process multiple documents of different types at once:

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'notes.txt',
    size: 500,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Plain text content...'),
  },
  {
    name: 'report.docx',
    size: 2500,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(docxBuffer),
  },
  {
    name: 'data.xlsx',
    size: 4000,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(xlsxBuffer),
  },
  {
    name: 'document.pdf',
    size: 8000,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfBuffer),
  },
];

const results = extract(documents);
console.log(`Processed ${documents.length} documents`);
```

### Compute Document Similarity

Compare extracted documents against reference texts:

```ts
import { computeDocumentSimilarity } from 'undms';

const documents = [
  {
    name: 'essay.txt',
    size: 1000,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Machine learning is a subset of artificial intelligence...'),
  },
];

const referenceTexts = [
  'Machine learning is a subset of artificial intelligence',
  'Deep learning is a specialized form of machine learning',
  'Natural language processing enables computers to understand human language',
];

const results = computeDocumentSimilarity(
  documents,
  referenceTexts,
  50, // threshold
  'hybrid', // method
);

console.log(results[0].documents[0].similarityMatches);
// Output: [{ referenceIndex: 0, similarityPercentage: 100 }]
```

### Compute Text Similarity

Compare plain text without file extraction:

```ts
import { computeTextSimilarity } from 'undms';

const sourceText = 'The quick brown fox jumps over the lazy dog';

const referenceTexts = [
  'The quick brown fox jumps over the lazy dog',
  'A quick brown fox jumps over a lazy dog',
  'Something completely different',
];

const matches = computeTextSimilarity(sourceText, referenceTexts, 70, 'hybrid');

matches.forEach((match) => {
  console.log(`Reference ${match.referenceIndex}: ${match.similarityPercentage.toFixed(1)}%`);
});
```

## Next Steps

- [Supported Formats](/guide/supported-formats) - Learn about all supported file types
- [Architecture](/guide/architecture) - Understand how undms works internally
- [Similarity Algorithms](/guide/similarity) - Deep dive into comparison methods
- [API Reference](/api/extract) - Complete function documentation
