# extract

```ts
extract(input: ExtractionInput, options?: ExtractionOptions): Promise<ExtractionOutcome>
```

Extract one document. Inputs contain an ordinary `Buffer` in `data`; optional `id` and `name` are echoed as source identity. `mimeType` is a hint, normalized without its parameters. Signatures identify supported documents and reject conflicting declared formats.

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

`success` means processing completed. `partial` means a recoverable content failure left usable output; inspect `warnings` and their locations. `error` carries a structured document error with source information. Invalid request options, overload, and infrastructure failures throw or reject and require `try`/`catch`.

Input bytes are copied during the call before native workers run. Mutating the Buffer afterward is safe. Buffers backed by SharedArrayBuffer are rejected because concurrent writes cannot produce a reliable snapshot.

See [options and result types](/api/types) and [batch extraction](/api/extract-batch).
