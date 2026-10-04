# Public API reference

This reference reflects the repository's current `index.d.ts`. Verify the installed
version's declarations when working in another consumer project. Import from
`undms`; ESM named imports and CommonJS `require('undms')` are supported.

## Functions and inputs

```ts
extract(input: ExtractionInput, options?: ExtractionOptions): Promise<ExtractionOutcome>
extractBatch(inputs: ExtractionInput[], options?: BatchOptions): Promise<BatchResult>
```

`ExtractionInput`: required `data: Buffer`; optional `id`, `name`, `mimeType`
strings. No path, URL, stream, or base64-string overload exists. Convert a
validated base64 payload to a Buffer explicitly. Fetch remote content separately
with the application's URL/access/size policy.

`name` is identity metadata; filename extensions are not used for format detection.
`mimeType` declares the intended format and is checked against recognized byte
signatures. For non-UTF-8 text without a BOM, declare a text MIME type in addition
to the encoding:

```ts
import { extract, DecodingPolicy } from 'undms';

const outcome = await extract(
  { data: Buffer.from([0x63, 0x61, 0x66, 0xe9]), name: 'cafe.txt', mimeType: 'text/plain' },
  { text: { encoding: 'windows-1252', decoding: DecodingPolicy.Strict } },
);
// A successful result contains text: 'café'. Without mimeType, these bytes fail detection.
```

`text.encoding` influences text decoding, not format detection.

Supported document families: plain text, DOCX, XLSX, PPTX, PDF, and images.
Do not assume legacy binary DOC/XLS/PPT, arbitrary archives, or every image codec
is supported. XLSX extraction returns text plus sheet dimensions, not a general
spreadsheet editing API. PDF extraction is not a layout-preserving renderer.

## Outcome and result

```ts
type ExtractionOutcome =
  | { status: 'success'; result: ExtractionResult }
  | { status: 'partial'; result: ExtractionResult }
  | { status: 'error'; source: SourceInfo; error: ExtractionError };
```

`ExtractionResult` has `source`, optional `text`, `encoding`, `metadata`,
`metrics`, and required `warnings: ExtractionWarning[]`.

`SourceInfo`: optional `id`, `name`, `declaredMimeType`, `mimeType`, `format`;
required `byteLength`. `ExtractionError`: `code`, `message`, `stage`.
`ExtractionWarning`: `code`, `message`, optional `location`.

Error codes: `UNSUPPORTED_FORMAT`, `FORMAT_MISMATCH`, `INVALID_DOCUMENT`,
`DECODE_FAILED`, `LIMIT_EXCEEDED`, `OCR_FAILED`, `INTERNAL_ERROR`.
These describe resolved document failures, not every reason a call can throw or
its Promise can reject. Invalid options and admission failures can throw before
a Promise is returned. Wrap the call itself and its `await` in `try`/`catch`;
attaching `.catch()` to the return value alone is insufficient.

## Options

`ExtractionOptions`:

| Field | Values / purpose |
| --- | --- |
| `selection` | `ExtractionSelection.Text`, `.Metadata`, `.Both` |
| `statistics` | Boolean; can request text analysis even with metadata-only selection |
| `text.encoding` | Optional string encoding hint for text |
| `text.decoding` | `DecodingPolicy.Strict` or `.Replace` |
| `ocr` | `OcrMode.Disabled`, `.Fast`, `.Balanced`, `.Accurate` |
| `limits` | Per-document resource limits below |
| `metrics` | Boolean; opt into queue/processing timing |

Per-document limits: `maxInputBytes`, `maxOutputBytes`, `maxDecompressedBytes`,
`maxArchiveEntries`, `maxImagePixels`, `maxWarnings`.

`BatchOptions`: `extraction?: ExtractionOptions`, `concurrency?: number`,
`maxTotalInputBytes?: number`, `maxTotalOutputBytes?: number`,
`maxDocuments?: number`. Per-document options belong under `extraction`, not at
the batch's top level. Choose positive validated budgets rather than using zero
as a disable flag.

`statistics: true` requires `Metadata` or `Both` selection; text-only selection
rejects this combination synchronously. `concurrency` must be an integer from
1 to 32. Effective concurrency is capped by the CPU worker pool (currently at
most four workers). Image OCR runs through a separate serial lane; a larger batch
concurrency does not provide parallel image OCR. `maxDocuments` accepts 1–10,000.
Treat these implementation caps as version-specific; verify installed behavior.

`BatchResult`: `items: { index: number; outcome: ExtractionOutcome }[]`,
`summary: { successCount: number; partialCount: number; errorCount: number }`.

## Metadata narrowing

`DocumentMetadata` contains `properties`, optional `statistics`, and `format`.
Common properties: optional `title`, `author`, `subject`, `creator`, `producer`,
`created`, `modified`. Statistics: `lineCount`, `wordCount`, `characterCount`,
`nonWhitespaceCharacterCount`.

Narrow the `format.kind` discriminant before accessing `details`:

| kind | details |
| --- | --- |
| `text` | No `details` field |
| `docx` | `paragraphCount`, `tableCount`, `imageCount`, `hyperlinkCount` |
| `xlsx` | `sheets[]`: `name`, `rowCount`, `columnCount`, `cellCount` |
| `pptx` | `slideCount` |
| `pdf` | `pageCount`, optional `pageSizePoints: { width, height }` |
| `image` | `width`, `height`, optional `format`, camera make/model, datetime; `location` with optional latitude/longitude |

```ts
import { extract, ExtractionSelection, OcrMode } from 'undms';

const outcome = await extract(
  { data: imageBuffer, name: 'photo.jpeg' },
  { selection: ExtractionSelection.Metadata, ocr: OcrMode.Disabled },
);
if (outcome.status !== 'error') {
  const format = outcome.result.metadata?.format;
  if (format?.kind === 'image') {
    console.log(format.details.width, format.details.height);
  }
}
```

Do not assume text, metadata, EXIF, properties, or timing fields are always present.
