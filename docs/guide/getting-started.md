# Getting started

Install on Node.js 20 or later:

```sh
pnpm add undms
```

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

Both package-root ESM named imports and CommonJS `require('undms')` are supported by the native build. Extraction always returns a Promise.

Use [extractBatch](/api/extract-batch) for multiple documents. A MIME hint is optional for detectable signatures and UTF-8 text; provide `mimeType` for legacy encoded text. Strong signatures conflicting with a declared format return `FORMAT_MISMATCH`.

## Migrating existing callers

Call `await extract({ data, id?, name?, mimeType? })` for one document, or `await extractBatch(inputs)` for a list. Results contain individual outcomes and retain input order. Handle `success` and `partial` through `outcome.result`; handle document errors through `outcome.error`. File size is measured from the Buffer. The API no longer accepts browser File-shaped metadata or groups results by MIME type.

Comparison APIs have been removed. See [types](/api/types) for the extraction contract.
