# Image processing

```ts
import { readFile } from 'node:fs/promises';
import { extract, OcrMode } from 'undms';

const outcome = await extract(
  { data: await readFile('page.png') },
  {
    ocr: OcrMode.Fast,
    limits: { maxImagePixels: 12_000_000 },
  },
);
if (outcome.status !== 'error') {
  console.log(outcome.result.text);
  const format = outcome.result.metadata?.format;
  if (format?.kind === 'image') {
    console.log(format.details.width, format.details.height, format.details.location);
  }
}
```

OCR uses embedded ocrs/rten models, loaded lazily on the first OCR request. Fast, balanced, and accurate modes control preprocessing work; recognition quality depends on the source image. Disabled mode skips recognition. Metadata-only requests avoid model initialization.

EXIF properties and GPS coordinates appear only when present and readable. Large images are checked against pixel limits before decoding. Scanned PDF pages are not routed through image OCR.
