# UNDMS

![undms](./undms.png)

[![CI](https://img.shields.io/github/actions/workflow/status/xcvzmoon/undms/CI.yaml?branch=main&color=black)](https://github.com/xcvzmoon/undms/actions/workflows/CI.yaml)
[![license](https://img.shields.io/github/license/xcvzmoon/undms?color=black)](https://github.com/xcvzmoon/undms/blob/main/LICENSE)
[![npm version](https://img.shields.io/npm/v/undms?color=black)](https://www.npmjs.com/package/undms)
[![npm downloads](https://img.shields.io/npm/dm/undms?color=black)](https://www.npmjs.com/package/undms)

High-performance document text and metadata extraction library with similarity comparison, built with napi-rs for Node.js and Bun.

## Installation

```bash
bun add undms
# or
npm install undms
```

## Features

- **Multi-format extraction** - Text, DOCX, XLSX, PDF, and images
- **Similarity comparison** - Compare documents against reference texts using multiple algorithms
- **Rich metadata** - Extract format-specific metadata (EXIF, PDF info, DOCX stats, etc.)
- **OCR support** - Extract text from images using Tesseract
- **Parallel processing** - Documents are processed concurrently for performance
- **TypeScript support** - Full type definitions included

## Supported Formats

| Format | MIME Type                                                                       | Features                                          |
| ------ | ------------------------------------------------------------------------------- | ------------------------------------------------- |
| Text   | `text/*`, `application/json`, `application/xml`, etc.                           | Content + line/word/character counts              |
| DOCX   | `application/vnd.openxmlformats-officedocument.wordprocessingml.document`       | Paragraphs, tables, images, hyperlinks            |
| XLSX   | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`             | Cell content, sheets, rows, columns               |
| PDF    | `application/pdf`                                                               | Text, title, author, subject, producer, page info |
| Images | `image/jpeg`, `image/png`, `image/gif`, `image/bmp`, `image/tiff`, `image/webp` | OCR text, EXIF data, GPS location                 |

## Quick Start

```ts
import { extract, computeDocumentSimilarity, computeTextSimilarity } from 'undms';

const documents = [
  {
    name: 'report.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Document content here...'),
  },
];

const result = extract(documents);
console.log(result[0].documents[0].content);
```

## API Reference

### `extract(documents)`

Extracts text and metadata from input documents. Results are grouped by MIME type.

**Parameters:**

- `documents` - Array of `Document` objects

**Returns:** `GroupedDocuments[]`

```ts
const result = extract([
  {
    name: 'document.pdf',
    size: 1024,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfData),
  },
]);
```

### `computeDocumentSimilarity(documents, referenceTexts, threshold?, method?)`

Extracts documents and computes similarity against reference texts.

**Parameters:**

- `documents` - Array of `Document` objects
- `referenceTexts` - Candidate reference texts to compare against
- `threshold` - Minimum score (0-100) to include a match (default: 30)
- `method` - Similarity algorithm: `'jaccard'`, `'ngram'`, `'levenshtein'`, or `'hybrid'` (default)

**Returns:** `GroupedDocumentsWithSimilarity[]`

```ts
const result = computeDocumentSimilarity(
  documents,
  ['reference text A', 'reference text B'],
  70,
  'hybrid',
);
```

### `computeTextSimilarity(sourceText, referenceTexts, threshold?, method?)`

Computes similarity for plain text without file extraction.

**Parameters:**

- `sourceText` - Source text to compare
- `referenceTexts` - Candidate reference texts
- `threshold` - Minimum score (0-100) to include a match (default: 30)
- `method` - Similarity algorithm (default: `'hybrid'`)

**Returns:** `SimilarityMatch[]`

```ts
const matches = computeTextSimilarity(
  'alpha beta gamma',
  ['alpha beta gamma', 'different text'],
  80,
  'jaccard',
);
```

## Type Definitions

### Document

Input document interface.

```ts
interface Document {
  name: string;
  size: number;
  type: string; // MIME type
  lastModified: number;
  webkitRelativePath: string;
  buffer: Buffer;
}
```

### DocumentMetadata

Extracted document result.

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

### GroupedDocuments

Documents grouped by MIME type.

```ts
interface GroupedDocuments {
  mimeType: string;
  documents: DocumentMetadata[];
}
```

### GroupedDocumentsWithSimilarity

Grouped documents with similarity matches.

```ts
interface GroupedDocumentsWithSimilarity {
  mimeType: string;
  documents: DocumentMetadataWithSimilarity[];
}
```

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

### SimilarityMatch

Similarity comparison result.

```ts
interface SimilarityMatch {
  referenceIndex: number;
  similarityPercentage: number;
}
```

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

### DocxMetadata

DOCX document statistics.

```ts
interface DocxMetadata {
  paragraphCount: number;
  tableCount: number;
  imageCount: number;
  hyperlinkCount: number;
}
```

### XlsxMetadata

XLSX spreadsheet statistics.

```ts
interface XlsxMetadata {
  sheetCount: number;
  sheetNames: string[];
  rowCount: number;
  columnCount: number;
  cellCount: number;
}
```

### PdfMetadata

PDF document information.

```ts
interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  producer?: string;
  pageSize?: PdfPageSize;
  pageCount: number;
}

interface PdfPageSize {
  width: number;
  height: number;
}
```

### ImageMetadata

Image file information.

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

interface ImageLocation {
  latitude?: number;
  longitude?: number;
}
```

## Similarity Methods

| Method        | Description                                   |
| ------------- | --------------------------------------------- |
| `jaccard`     | Set-based similarity using Jaccard index      |
| `ngram`       | N-gram token matching (default: trigrams)     |
| `levenshtein` | Edit distance-based similarity                |
| `hybrid`      | Weighted combination of all methods (default) |

The similarity score is computed as a weighted blend of content similarity (80%) and metadata similarity (20%).

## Error Handling

All functions handle errors gracefully:

- **Extraction errors** - Returned in the `error` field of `DocumentMetadata`
- **Unsupported formats** - Returns empty content with `application/octet-stream` encoding
- **Similarity errors** - Returns empty matches array

```ts
const result = extract(documents);
if (result[0].documents[0].error) {
  console.error('Extraction failed:', result[0].documents[0].error);
}
```

## Troubleshooting

- **OCR is slow** - Large images take time; consider resizing before processing
- **Missing GPS data** - Not all images contain EXIF location; `location` object exists but fields may be undefined
- **Empty PDF text** - Some PDFs are image-based; OCR is not currently applied to PDFs
- **Unicode handling** - All similarity methods support Unicode text

## Development

### Requirements

- Rust (latest stable)
- Node.js 18+
- pnpm

### Build

```bash
pnpm build
```

### Test

```bash
pnpm test
```

### Benchmark

```bash
pnpm bench
```

## License

MIT
