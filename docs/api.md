# undms API Documentation

Complete reference for all exports from the `undms` library.

## Table of Contents

- [Functions](#functions)
- [Interfaces](#interfaces)
- [Type Aliases](#type-aliases)

---

## Functions

### `extract`

Extracts text and metadata from input documents, grouped by MIME type.

```ts
function extract(documents: Document[]): GroupedDocuments[];
```

**Parameters:**

- `documents` - Input document list. Each document should include `name`, `type` (MIME), and `buffer` content.

**Returns:** Array of `GroupedDocuments`, each containing documents of a specific MIME type.

**Example:**

```ts
import { extract } from 'undms';

const result = extract([
  {
    name: 'note.txt',
    size: 12,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('hello world!'),
  },
]);

console.log(result[0].documents[0].content); // 'hello world!'
console.log(result[0].documents[0].metadata?.text?.wordCount); // 2
```

---

### `computeDocumentSimilarity`

Extracts documents and computes similarity against reference texts.

```ts
function computeDocumentSimilarity(
  documents: Document[],
  referenceTexts: string[],
  similarityThreshold?: number,
  similarityMethod?: string,
): GroupedDocumentsWithSimilarity[];
```

**Parameters:**

- `documents` - Documents to extract and compare.
- `referenceTexts` - Candidate reference texts.
- `similarityThreshold` - Minimum score (0-100) to include a match. Defaults to `30.0`.
- `similarityMethod` - One of `jaccard`, `ngram`, `levenshtein`, `hybrid`. Defaults to `hybrid`.

**Returns:** Grouped documents with `similarityMatches` for references whose score meets the threshold.

**Example:**

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

---

### `computeTextSimilarity`

Computes similarity matches for plain text input without file extraction.

```ts
function computeTextSimilarity(
  sourceText: string,
  referenceTexts: string[],
  similarityThreshold?: number,
  similarityMethod?: string,
): SimilarityMatch[];
```

**Parameters:**

- `sourceText` - Source text to compare.
- `referenceTexts` - Candidate reference texts.
- `similarityThreshold` - Minimum score (0-100) to include a match. Defaults to `30.0`.
- `similarityMethod` - One of `jaccard`, `ngram`, `levenshtein`, `hybrid`. Defaults to `hybrid`.

**Returns:** Array of `SimilarityMatch` values.

**Example:**

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

---

## Interfaces

### Document

Input document interface for extraction.

```ts
interface Document {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: Buffer;
}
```

**Properties:**

- `name` - File name
- `size` - File size in bytes
- `type` - MIME type (e.g., `text/plain`, `application/pdf`)
- `lastModified` - Last modified timestamp
- `webkitRelativePath` - File path (for web compatibility)
- `buffer` - File content as a Buffer

---

### DocumentMetadata

Metadata result for extracted documents.

```ts
interface DocumentMetadata {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: MetadataPayload;
  error?: string;
}
```

---

### DocumentMetadataWithSimilarity

Document metadata with similarity results.

```ts
interface DocumentMetadataWithSimilarity {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: MetadataPayload;
  error?: string;
  similarityMatches: SimilarityMatch[];
}
```

---

### GroupedDocuments

Documents grouped by MIME type.

```ts
interface GroupedDocuments {
  mimeType: string;
  documents: DocumentMetadata[];
}
```

---

### GroupedDocumentsWithSimilarity

Grouped documents with similarity data.

```ts
interface GroupedDocumentsWithSimilarity {
  mimeType: string;
  documents: DocumentMetadataWithSimilarity[];
}
```

---

### SimilarityMatch

Similarity comparison result.

```ts
interface SimilarityMatch {
  referenceIndex: number;
  similarityPercentage: number;
}
```

**Properties:**

- `referenceIndex` - Index into the reference texts array
- `similarityPercentage` - Similarity score (0-100)

---

### MetadataPayload

Complete metadata payload with format-specific fields.

```ts
interface MetadataPayload {
  text?: TextMetadata;
  docx?: DocxMetadata;
  xlsx?: XlsxMetadata;
  pdf?: PdfMetadata;
  image?: ImageMetadata;
}
```

---

### TextMetadata

Text content statistics.

```ts
interface TextMetadata {
  lineCount: number;
  wordCount: number;
  characterCount: number;
  nonWhitespaceCharacterCount: number;
}
```

**Extracted for:** All text-based formats (text, DOCX, XLSX, PDF, images)

---

### DocxMetadata

DOCX-specific metadata.

```ts
interface DocxMetadata {
  paragraphCount: number;
  tableCount: number;
  imageCount: number;
  hyperlinkCount: number;
}
```

---

### XlsxMetadata

XLSX-specific metadata.

```ts
interface XlsxMetadata {
  sheetCount: number;
  sheetNames: string[];
  rowCount: number;
  columnCount: number;
  cellCount: number;
}
```

---

### PdfMetadata

PDF-specific metadata.

```ts
interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  producer?: string;
  pageSize?: PdfPageSize;
  pageCount: number;
}
```

---

### PdfPageSize

PDF page dimensions.

```ts
interface PdfPageSize {
  width: number;
  height: number;
}
```

---

### ImageMetadata

Image-specific metadata.

```ts
interface ImageMetadata {
  width: number;
  height: number;
  format?: string;
  cameraMake?: string;
  cameraModel?: string;
  datetimeOriginal?: string;
  location: ImageLocation;
}
```

---

### ImageLocation

GPS coordinates from EXIF data.

```ts
interface ImageLocation {
  latitude?: number;
  longitude?: number;
}
```

---

## Usage Examples

### Extract from multiple file types

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'report.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Text content'),
  },
  {
    name: 'data.xlsx',
    size: 2048,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(xlsxBuffer),
  },
  {
    name: 'document.pdf',
    size: 4096,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfBuffer),
  },
];

const results = extract(documents);
```

### Find similar documents

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
];

const referenceTexts = [
  'The quick brown fox jumps over the lazy dog',
  'Something completely different',
  'A lazy dog resting in the sun',
];

const results = computeDocumentSimilarity(documents, referenceTexts, 50, 'hybrid');

results.forEach((group) => {
  group.documents.forEach((doc) => {
    console.log(`${doc.name}:`);
    doc.similarityMatches.forEach((match) => {
      console.log(
        `  - Matches reference ${match.referenceIndex}: ${match.similarityPercentage.toFixed(1)}%`,
      );
    });
  });
});
```

### Compare plain text

```ts
import { computeTextSimilarity } from 'undms';

const source = 'machine learning is a subset of artificial intelligence';

const references = [
  'machine learning is a subset of artificial intelligence',
  'deep learning is a subset of machine learning',
  'artificial intelligence encompasses machine learning',
];

const results = computeTextSimilarity(source, references, 70, 'ngram');

console.log('Matches above threshold:');
results.forEach((match) => {
  console.log(`  Reference ${match.referenceIndex}: ${match.similarityPercentage.toFixed(1)}%`);
});
```

### Handle errors gracefully

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'corrupted.pdf',
    size: 100,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('not a real PDF'),
  },
];

const results = extract(documents);
const doc = results[0].documents[0];

if (doc.error) {
  console.error(`Extraction failed: ${doc.error}`);
} else {
  console.log(`Content: ${doc.content}`);
}
```
