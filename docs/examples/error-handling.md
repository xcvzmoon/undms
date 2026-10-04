# Error handling

```ts
import { extract } from 'undms';

try {
  const outcome = await extract({ data: Buffer.from('document'), mimeType: 'application/unknown' });
  if (outcome.status === 'error') {
    console.error(outcome.source.name, outcome.error.code, outcome.error.message);
  } else {
    console.log(outcome.result.text);
    for (const warning of outcome.result.warnings) console.warn(warning.location, warning.message);
  }
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : String(error));
}
```

Unsupported formats, format mismatches, decoding errors, corrupt documents, and per-document limits resolve as error outcomes. A recoverable page, slide, or sheet failure can produce a partial result. Partial results preserve available metadata and text.

Malformed request options, scheduler overload, and infrastructure failures throw or reject. Whole-batch budgets also reject. Overload indicates that the native request or reserved-byte capacity is full; bound your application's outstanding requests before retrying.
