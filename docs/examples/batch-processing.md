# Batch processing

```ts
import { readFile } from 'node:fs/promises';
import { extractBatch } from 'undms';

const paths = ['report.pdf', 'notes.docx'];
const inputs = await Promise.all(
  paths.map(async (name) => ({
    name,
    data: await readFile(name),
  })),
);
const batch = await extractBatch(inputs, { concurrency: 2 });

for (const { index, outcome } of batch.items) {
  if (outcome.status === 'error') {
    console.error(paths[index], outcome.error.code);
  } else {
    console.log(paths[index], outcome.result.text);
  }
}
console.log(batch.summary);
```

Use a bounded number of files per batch to control application-side read buffers. The API copies inputs before processing, and total input bytes have a separate batch limit. Higher concurrency does not necessarily improve throughput, particularly for OCR, which uses a dedicated native worker.
