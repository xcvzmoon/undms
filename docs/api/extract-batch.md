# extractBatch

```ts
extractBatch(inputs: ExtractionInput[], options?: BatchOptions): Promise<BatchResult>
```

```ts
import { extractBatch, ExtractionSelection } from 'undms';

const result = await extractBatch(
  [
    { data: Buffer.from('first'), id: 'document' },
    { data: Buffer.from('second'), id: 'document' },
  ],
  {
    concurrency: 2,
    extraction: { selection: ExtractionSelection.Text },
  },
);

for (const { index, outcome } of result.items) {
  if (outcome.status !== 'error') console.log(index, outcome.result.text);
}
console.log(result.summary);
```

`items` retain input order and contain `index` and `outcome`. Repeated IDs and repeated inputs remain separate documents. Summary fields are `successCount`, `partialCount`, and `errorCount`. Empty input returns an empty list and zero counts.

Per-document options live under `extraction`. `concurrency` defaults to the native worker count, accepts 1–32, and is capped by worker availability. `maxDocuments` defaults to 1000 and accepts up to 10,000. `maxTotalInputBytes` defaults to 128 MiB and `maxTotalOutputBytes` to 64 MiB (both accept up to 256 MiB); input accounting measures Buffer bytes; output accounting includes estimated identity, metadata, warnings, and result overhead.

Document errors remain individual outcomes. Invalid batch options, total input limits, overload, total output limits, or infrastructure failures reject the whole request. A rejected batch returns no partial batch object.
