---
layout: home
title: undms
titleTemplate: Document text and metadata extraction
hero:
  name: undms
  text: Async document extraction
  tagline: Text, metadata, and image OCR through one Rust engine
  image:
    src: /undms.png
    alt: undms logo
  actions:
    - theme: brand
      text: Get started
      link: /guide/getting-started
    - theme: alt
      text: API reference
      link: /api/extract
features:
  - title: Document formats
    details: Plain text, DOCX, XLSX, PPTX, PDF, and images.
  - title: Ordered batches
    details: Bounded concurrency with an outcome for every input document.
  - title: Typed results
    details: Tagged outcomes and format metadata with reusable options.
  - title: Image OCR
    details: Embedded ocrs/rten models, initialized when OCR is requested.
---

## Example

```ts
import { readFile } from 'node:fs/promises';
import { extract } from 'undms';

const outcome = await extract({
  data: await readFile('report.pdf'),
  name: 'report.pdf',
});

if (outcome.status === 'error') {
  console.error(outcome.error.code, outcome.error.message);
} else {
  console.log(outcome.result.text);
  console.log(outcome.result.metadata);
  console.log(outcome.result.warnings);
}
```
