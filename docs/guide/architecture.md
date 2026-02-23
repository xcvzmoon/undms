# Architecture

Understanding the internal architecture of undms helps you optimize performance and extend functionality.

## Overview

undms is built with a modular handler-based architecture using Rust for core processing and napi-rs for Node.js bindings.

```
┌─────────────────────────────────────────────────────────────┐
│                      Node.js Layer                          │
│  ┌─────────────┐  ┌──────────────┐  ┌────────────────────┐  │
│  │   extract   │  │ computeDoc   │  │ computeText        │  │
│  │             │  │ Similarity   │  │ Similarity         │  │
│  └─────────────┘  └──────────────┘  └────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │ NAPI (Native ABI)
┌────────────────────────────▼────────────────────────────────┐
│                      Rust Core                               │
│  ┌─────────────────────────────────────────────────────┐    │
│  │              Handler Registry                       │    │
│  │  ┌─────────┐ ┌─────────┐ ┌────────┐ ┌─────────┐  │    │
│  │  │  Text   │ │  DOCX   │ │  XLSX  │ │   PDF   │  │    │
│  │  │ Handler │ │ Handler │ │ Handler│ │ Handler │  │    │
│  │  └─────────┘ └─────────┘ └────────┘ └─────────┘  │    │
│  │  ┌─────────┐                                     │    │
│  │  │  Image  │                                     │    │
│  │  │ Handler │                                     │    │
│  │  └─────────┘                                     │    │
│  └─────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────┐    │
│  │           Similarity Engine                         │    │
│  │  ┌──────────┐ ┌─────────┐ ┌────────────┐         │    │
│  │  │ Jaccard  │ │ N-gram  │ │ Levenshtein│         │    │
│  │  └──────────┘ └─────────┘ └────────────┘         │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

## Handler System

Each document format is processed by a dedicated handler that implements the `DocumentHandler` trait.

### Handler Interface

```rust
trait DocumentHandler {
    fn is_supported(&self, mime_type: &str) -> bool;
    fn extract(&self, buffer: &[u8]) -> ExtractionResult;
}
```

### Built-in Handlers

| Handler        | MIME Types                                                                | Responsibilities                                   |
| -------------- | ------------------------------------------------------------------------- | -------------------------------------------------- |
| `TextHandler`  | `text/*`, `application/json`, `application/xml`                           | Parse text, count lines/words/characters           |
| `DocxHandler`  | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | Parse DOCX XML, extract paragraphs, tables, images |
| `XlsxHandler`  | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | Parse XLSX workbook, extract cells and sheets      |
| `PdfHandler`   | `application/pdf`                                                         | Extract PDF text and metadata                      |
| `ImageHandler` | `image/*`                                                                 | OCR text extraction, EXIF parsing, GPS coordinates |

### Handler Selection

When you call `extract()`, undms iterates through the registered handlers to find the first one that supports the document's MIME type:

```rust
fn find_handler<'a>(
    mime_type: &str,
    handlers: &'a [Arc<dyn DocumentHandler>],
) -> Option<&'a Arc<dyn DocumentHandler>> {
    handlers
        .iter()
        .find(|handler| handler.is_supported(mime_type))
}
```

If no handler matches, the document is processed with a default handler that returns empty content.

## Parallel Processing

undms uses [Rayon](https://github.com/rayon-rs/rayon) for parallel document processing, significantly improving performance when processing multiple documents.

### Processing Flow

```
┌──────────────────────────────────────────────────────────┐
│                   Input Documents                         │
└──────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│              Group by MIME Type                          │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐        │
│  │  text/*     │ │  pdf        │ │  image/*    │        │
│  └─────────────┘ └─────────────┘ └─────────────┘        │
└──────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│           Parallel Extraction (Rayon)                    │
│  ┌────────┐ ┌────────┐ ┌────────┐ ┌────────┐          │
│  │ Doc 1  │ │ Doc 2  │ │ Doc 3  │ │ Doc 4  │  ...     │
│  │   ▼    │ │   ▼    │ │   ▼    │ │   ▼    │          │
│  └────────┘ └────────┘ └────────┘ └────────┘          │
│        │        │        │        │                     │
│        └────────┴────────┴────────┘                     │
│                 (parallel)                               │
└──────────────────────────┬───────────────────────────────┘
                          │
                          ▼
┌──────────────────────────────────────────────────────────┐
│                Output: Grouped Results                   │
└──────────────────────────────────────────────────────────┘
```

### Example: Processing Time

```ts
import { extract } from 'undms';

// Create 10 test documents
const documents = Array.from({ length: 10 }, (_, i) => ({
  name: `document_${i}.txt`,
  size: 1000,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: Buffer.from('Sample content for document ' + i),
}));

const start = performance.now();
const results = extract(documents);
const elapsed = performance.now() - start;

console.log(`Processed 10 documents in ${elapsed.toFixed(2)}ms`);
console.log(`Average: ${(elapsed / 10).toFixed(2)}ms per document`);
```

## Similarity Engine

The similarity engine compares extracted text against reference texts using configurable algorithms.

### Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                   Similarity Request                       │
│  ┌─────────────────┐  ┌──────────────────┐                  │
│  │  Source Text    │  │ Reference Texts  │                │
│  └────────┬────────┘  └────────┬─────────┘                 │
└───────────┼────────────────────┼───────────────────────────┘
            │                    │
            ▼                    ▼
┌─────────────────────────────────────────────────────────────┐
│                  Method Selection                           │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  jaccard | ngram | levenshtein | hybrid             │  │
│  └──────────────────────────────────────────────────────┘  │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Scoring Pipeline                         │
│  ┌─────────────┐    ┌─────────────┐    ┌──────────────┐   │
│  │   Content   │───▶│   Weight    │───▶│   Combined   │   │
│  │   Score     │    │   (80%)     │    │   Score      │   │
│  └─────────────┘    └─────────────┘    └──────────────┘   │
│  ┌─────────────┐    ┌─────────────┐                        │
│  │  Metadata   │───▶│   Weight    │                        │
│  │   Score     │    │   (20%)     │                        │
│  └─────────────┘    └─────────────┘                        │
└────────────────────────────┬────────────────────────────────┘
                             │
                             ▼
┌─────────────────────────────────────────────────────────────┐
│                    Similarity Matches                       │
│  ┌─────────────────────────────────────────────────────┐    │
│  │ [{ referenceIndex: 0, similarityPercentage: 85 }]   │    │
│  └─────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────┘
```

### Hybrid Method

The default `hybrid` method combines multiple algorithms for more accurate results:

1. **Jaccard Index** (33%): Set-based similarity using word tokens
2. **N-gram Similarity** (33%): Character-level trigram matching
3. **Levenshtein Distance** (34%): Edit distance normalization

The final score is a weighted combination:

- Content similarity: 80%
- Metadata similarity: 20%

## Error Handling

Errors are handled gracefully at each layer:

### Handler Level

```rust
fn extract(&self, buffer: &[u8]) -> ExtractionResult {
    match self.parse_buffer(buffer) {
        Ok(content) => ExtractionResult {
            content: Some(content),
            encoding: Some(self.encoding()),
            metadata: Some(self.extract_metadata(buffer)),
            error: None,
        },
        Err(e) => ExtractionResult {
            content: None,
            encoding: Some("application/octet-stream".to_string()),
            metadata: None,
            error: Some(e.to_string()),
        },
    }
}
```

### API Level

```ts
const result = extract(documents);

for (const group of result) {
  for (const doc of group.documents) {
    if (doc.error) {
      console.error(`Error processing ${doc.name}: ${doc.error}`);
    } else {
      console.log(`Successfully extracted ${doc.name}`);
    }
  }
}
```

## Performance Characteristics

### Memory Usage

- Each document is processed independently
- Memory is released immediately after processing
- No global state between extractions

### CPU Usage

- Parallel processing utilizes all available cores
- Similarity calculations are CPU-intensive
- OCR is the most computationally expensive operation

### Benchmarks

| Operation        | 10 Documents | 100 Documents |
| ---------------- | ------------ | ------------- |
| Text extraction  | ~5ms         | ~45ms         |
| DOCX extraction  | ~30ms        | ~280ms        |
| PDF extraction   | ~50ms        | ~480ms        |
| Image (with OCR) | ~120ms       | ~1150ms       |
| Similarity check | ~5ms         | ~50ms         |

## Extensibility

To add support for a new format, implement the `DocumentHandler` trait:

```rust
use napi::Result;

pub trait DocumentHandler: Send + Sync {
    fn is_supported(&self, mime_type: &str) -> bool;
    fn extract(&self, buffer: &[u8]) -> ExtractionResult;
}
```

See [Extensibility](/advanced/extensibility) for more details.
