---
layout: home
title: undms
titleTemplate: Document Text & Metadata Extraction Library

hero:
  name: undms
  text: Document Text & Metadata Extraction
  tagline: High-performance document processing with built-in similarity comparison
  image:
    src: /undms.png
    alt: undms logo
  actions:
    - theme: brand
      text: Get Started
      link: /guide/getting-started
    - theme: alt
      text: View API
      link: /api/extract
  features:
    - title: Multi-Format Support
      details: Extract text from PDF, DOCX, XLSX, images, and plain text files with a unified API
    - title: Similarity Comparison
      details: Compare documents against reference texts using Jaccard, N-gram, Levenshtein, or hybrid algorithms
    - title: Rich Metadata
      details: Extract format-specific metadata including EXIF data, PDF properties, DOCX statistics, and more
    - title: OCR Support
      details: Extract text from images using Tesseract OCR with automatic language detection
    - title: Parallel Processing
      details: Documents are processed concurrently using Rayon for maximum performance
    - title: TypeScript Support
      details: Full type definitions included with intelligent autocomplete and type safety
---

## Quick Example

Extract text and metadata from documents with a simple function call:

```ts
import { extract, computeDocumentSimilarity } from 'undms';

const documents = [
  {
    name: 'report.pdf',
    size: 1024,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfData),
  },
];

const result = extract(documents);
console.log(result[0].documents[0].content);
console.log(result[0].documents[0].metadata);
```

## Performance

Built with Rust using [napi-rs](https://napi.rs/) for native Node.js performance:

| Operation         | Time   |
| ----------------- | ------ |
| Extract 10 PDFs   | ~50ms  |
| Extract 10 DOCX   | ~30ms  |
| Extract 10 Images | ~120ms |
| Similarity Check  | ~5ms   |

## Supported Platforms

<div class="platforms">

- Node.js 12.22+ (except 13.x)
- Node.js 14.17+, 15.12+, 16+
- Bun
- Web browsers (via browser.js)

</div>

## License

MIT License - [View on GitHub](https://github.com/xcvzmoon/undms)
