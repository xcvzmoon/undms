# Types and options

The generated `index.d.ts` is the public contract. Import its reusable types instead of declaring a second version in application code.

## Input and outcomes

```ts
import type { ExtractionInput, ExtractionOutcome } from 'undms';

const input: ExtractionInput = {
  data: Buffer.from('hello'),
  id: 'document-1',
  name: 'note.txt',
  mimeType: 'text/plain',
};

function text(outcome: ExtractionOutcome): string | undefined {
  switch (outcome.status) {
    case 'success':
    case 'partial':
      return outcome.result.text;
    case 'error':
      throw new Error(`${outcome.error.code}: ${outcome.error.message}`);
  }
}
```

`ExtractionResult` contains `source`, optional `text`, optional `encoding`, optional `metadata`, `warnings`, and optional `metrics`. `SourceInfo` contains measured `byteLength` and optional `id`, `name`, `declaredMimeType`, effective `mimeType`, and optional detected `format: DocumentFormat`.

`ExtractionError` contains `code: ErrorCode`, `message`, and `stage`. Current document codes include `UNSUPPORTED_FORMAT`, `FORMAT_MISMATCH`, `INVALID_DOCUMENT`, `DECODE_FAILED`, `LIMIT_EXCEEDED`, `OCR_FAILED`, and `INTERNAL_ERROR`. `ExtractionWarning` contains `code`, `message`, and optional `location`.

`DocumentFormat` exports Text, Docx, Xlsx, Pptx, Pdf, and Image with lowercase runtime values. `ErrorCode` exports UnsupportedFormat, FormatMismatch, InvalidDocument, DecodeFailed, LimitExceeded, OcrFailed, and InternalError with the uppercase runtime codes above. Use these generated string enums when comparing typed source/error fields:

```ts
import { DocumentFormat, ErrorCode, extract } from 'undms';

const outcome = await extract({ data: Buffer.from('hello') });
if (outcome.status === 'error') {
  if (outcome.error.code === ErrorCode.UnsupportedFormat) console.error('Unsupported document');
} else if (outcome.result.source.format === DocumentFormat.Text) {
  console.log(outcome.result.text);
}
```

## Metadata

`DocumentMetadata` separates `properties: DocumentProperties`, optional `statistics: TextStatistics`, and `format: FormatMetadata`.

Common properties are optional title, author, subject, creator, producer, created, and modified values. Statistics contain line, word, Unicode scalar character, and non-whitespace scalar character counts. They do not count grapheme clusters. Empty text has zero counts. CRLF counts as one line break; lone CR and LF each count as a break. A trailing break includes the trailing empty line.

Narrow `format.kind` before accessing `format.details`:

| Kind    | Details                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------ |
| `text`  | No details field                                                                                             |
| `docx`  | `WordMetadata`: paragraphCount, tableCount, imageCount, hyperlinkCount                                       |
| `xlsx`  | `SpreadsheetMetadata`: ordered sheets with name, rowCount, columnCount, cellCount                            |
| `pptx`  | `PresentationMetadata`: slideCount                                                                           |
| `pdf`   | `PdfMetadata`: pageCount, optional pageSizePoints with width/height                                          |
| `image` | `ImageMetadata`: width/height, optional format/camera/EXIF values, location with optional latitude/longitude |

Spreadsheet extents include leading empty coordinates; cell counts include populated cells. Common document properties are outside format details.

## Options

```ts
import { DecodingPolicy, ExtractionSelection, OcrMode, extract } from 'undms';

await extract(
  { data: Buffer.from('hello'), mimeType: 'text/plain' },
  {
    selection: ExtractionSelection.Both,
    statistics: true,
    text: { encoding: 'utf-8', decoding: DecodingPolicy.Strict },
    ocr: OcrMode.Balanced,
    metrics: true,
    limits: { maxInputBytes: 8 * 1024 * 1024 },
  },
);
```

`ExtractionSelection` exports `Text`, `Metadata`, and `Both`. `DecodingPolicy` exports `Strict` and `Replace`. `OcrMode` exports `Disabled`, `Fast`, `Balanced`, and `Accurate`. These are generated string enums; TypeScript callers should import the enum members for option values. JavaScript callers can use their lowercase string values.

Selection defaults to `Both`. Statistics default to true for both selection and false for metadata-only selection. Text-only requests cannot enable statistics. Metadata-only requests with `statistics: true` parse text internally but omit it from the result. `metrics` defaults to false and adds queue/processing durations in milliseconds when enabled.

Decoding defaults to strict. An explicit supported encoding overrides detection; conflicts with a BOM return a decoding error. Replacement decoding adds a warning when invalid sequences are replaced. OCR defaults to balanced.

## Resource limits

| Option               | Default    | Maximum     |
| -------------------- | ---------- | ----------- |
| maxInputBytes        | 64 MiB     | 256 MiB     |
| maxOutputBytes       | 16 MiB     | 64 MiB      |
| maxDecompressedBytes | 128 MiB    | 512 MiB     |
| maxArchiveEntries    | 10,000     | 100,000     |
| maxImagePixels       | 20,000,000 | 100,000,000 |
| maxWarnings          | 100        | 1000        |

Limits must be positive integers within validated caps. Source identity is also bounded: ID to 1024 UTF-8 bytes, name to 4096 bytes, and MIME hint to 256 bytes. Shared or detached Buffer backing and non-byte typed-array views are rejected during input validation. `maxOutputBytes` applies to the result budget, including estimated metadata/warning overhead, so an extremely small limit may fail even when extracted text is short. See [performance](/advanced/performance) for in-process parser limitations.

`BatchOptions` contains optional `extraction`, `concurrency`, `maxTotalInputBytes`, `maxTotalOutputBytes`, and `maxDocuments`. `BatchResult` contains ordered `BatchItemResult[]` and `BatchSummary`.
