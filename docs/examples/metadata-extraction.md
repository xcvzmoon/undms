# Metadata extraction

```ts
import { readFile } from 'node:fs/promises';
import { extract, ExtractionSelection } from 'undms';

const outcome = await extract(
  { data: await readFile('report.xlsx') },
  {
    selection: ExtractionSelection.Metadata,
  },
);

if (outcome.status !== 'error') {
  const metadata = outcome.result.metadata;
  if (metadata?.format.kind === 'xlsx') {
    for (const sheet of metadata.format.details.sheets) {
      console.log(sheet.name, sheet.rowCount, sheet.columnCount, sheet.cellCount);
    }
  }
}
```

Metadata-only requests skip text construction and OCR. Enable `statistics: true` when text statistics are needed; that requires internal text extraction even though the returned text is omitted.
