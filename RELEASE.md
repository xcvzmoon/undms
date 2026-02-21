# Release v1.0.0

Initial release of undms - a high-performance text and metadata extraction library built with Rust and napi-rs.

## Features

### Document Extraction

Extract text and metadata from various document formats:

- **Text files**: `text/*`, JSON, XML, JavaScript, TypeScript
- **Microsoft Word**: `.docx` files (Office Open XML)
- **Microsoft Excel**: `.xlsx` files (Office Open XML)
- **PDF**: `.pdf` files with text extraction and metadata
- **Images**: JPEG, PNG, GIF, BMP, TIFF, WebP with OCR and EXIF support

### Text Similarity Comparison

Compare extracted documents against reference texts using multiple algorithms:

- **Jaccard similarity**: Set-based comparison
- **Levenshtein distance**: Edit distance-based comparison
- **Hybrid**: Combined approach for better accuracy

### Metadata Extraction

Each format provides rich metadata:

| Format | Metadata                                                   |
| ------ | ---------------------------------------------------------- |
| Text   | Line count, word count, character count                    |
| DOCX   | Paragraph count, table count, image count, hyperlink count |
| XLSX   | Sheet names, row/column/cell counts                        |
| PDF    | Title, author, subject, producer, page count, page size    |
| Images | Dimensions, format, camera details, GPS location (EXIF)    |

## API

```ts
import { extract, computeDocumentSimilarity, computeTextSimilarity } from 'undms';

// Extract text and metadata from documents
const result = extract([document]);

// Compare documents against reference texts
const matches = computeDocumentSimilarity(documents, referenceTexts, threshold, method);

// Compare raw text without file extraction
const textMatches = computeTextSimilarity(sourceText, referenceTexts, threshold, method);
```

## Platform Support

Pre-built binaries for:

- Windows x64
- macOS x64 (Intel)
- macOS ARM64 (Apple Silicon)
- Linux x64

## Requirements

- Node.js 12.22.0+ or Bun

## Installation

```bash
bun add undms
# or
npm install undms
# or
pnpm add undms
```

## License

MIT
