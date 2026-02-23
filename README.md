# undms

![https://github.com/xcvzmoon/undms/actions](https://github.com/xcvzmoon/undms/workflows/ci/badge.svg)

Text and metadata extraction library for document files with text similarity comparison, built with napi-rs.

## Installation

```bash
bun add undms
```

## Features

- Extracts text and metadata from document files
- Computes similarity between extracted documents and reference texts
- Works in Node.js and Bun (via N-API)

## Supported formats

- Text: `text/*`, plus JSON/XML/JS/TS MIME variants
- DOCX: `application/vnd.openxmlformats-officedocument.wordprocessingml.document`
- XLSX: `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`
- PDF: `application/pdf`
- Images: `image/jpeg`, `image/png`, `image/gif`, `image/bmp`, `image/tiff`, `image/webp`

## Metadata schema

Each extracted document may include a `metadata` payload with these optional fields:

```ts
type MetadataPayload = {
  text?: {
    lineCount: number;
    wordCount: number;
    characterCount: number;
    nonWhitespaceCharacterCount: number;
  };
  docx?: {
    paragraphCount: number;
    tableCount: number;
    imageCount: number;
    hyperlinkCount: number;
  };
  xlsx?: {
    sheetCount: number;
    sheetNames: string[];
    rowCount: number;
    columnCount: number;
    cellCount: number;
  };
  pdf?: {
    title?: string;
    author?: string;
    subject?: string;
    producer?: string;
    pageSize?: { width: number; height: number };
    pageCount: number;
  };
  image?: {
    width: number;
    height: number;
    format?: string;
    cameraMake?: string;
    cameraModel?: string;
    datetimeOriginal?: string;
    location: {
      latitude?: number;
      longitude?: number;
    };
  };
};
```

## Handler details

- Text: decodes content (UTF-8 by default) and provides text metadata.
- DOCX: extracts paragraphs, plus paragraph/table/image/hyperlink counts.
- XLSX: extracts cell text and reports sheet/row/column/cell counts.
- PDF: extracts text and document info (title/author/subject/producer) and page size/count when available.
- Images: runs OCR to extract text and reads EXIF for camera details and GPS location when present.

## Troubleshooting

- OCR is CPU-intensive; large images can be slow.
- EXIF GPS fields depend on the source image; if absent, `location` still exists but latitude/longitude are undefined.
- PDF metadata fields are optional and may be empty when the source file does not include them.
- If OCR returns empty text, check that the image has legible, high-contrast text.

## Usage

```ts
import { extract, computeDocumentSimilarity, computeTextSimilarity } from 'undms';

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

const matches = computeDocumentSimilarity(
  result[0].documents.map((doc) => ({
    name: doc.name,
    size: doc.size,
    type: result[0].mimeType,
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(doc.content),
  })),
  ['reference text A', 'reference text B'],
  70,
  'hybrid',
);

const textMatches = computeTextSimilarity('alpha beta gamma', ['alpha beta gamma'], 99, 'hybrid');
```

## API

### `extract(documents)`

Extracts text and metadata from input documents. Output is grouped by MIME type.

### `computeDocumentSimilarity(documents, referenceTexts, threshold?, method?)`

Extracts documents and computes similarity against the reference texts.

### `computeTextSimilarity(sourceText, referenceTexts, threshold?, method?)`

Computes similarity for raw text without file extraction.

## Development

### Requirements

- Rust (latest stable)
- Node.js 12+ (for Node-API)
- Bun

### Build

```bash
bun run build
```

### Test

```bash
bun run test
```

### Benchmarks

```bash
bun run bench
bun run bench:sweep
```
