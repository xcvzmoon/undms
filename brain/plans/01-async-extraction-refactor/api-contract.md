# Implemented reusable API contract

Back to [[plans/01-async-extraction-refactor/overview]]. Checked against native Rust API and generated declarations on 2026-10-04. Consumer reference: `docs/api/types.md`.

## Functions and outcomes

- `extract(input, options?)`: `Promise<ExtractionOutcome>`.
- `extractBatch(inputs, options?)`: `Promise<BatchResult>`.
- Outcome union: `{status:'success',result}`, `{status:'partial',result}`, or `{status:'error',source,error}`. There is no separate public `ExtractionFailure` type.
- Invalid options/backing storage, admission overload, and infrastructure failures throw or reject. Document format/parser/limit failures resolve as error outcomes.
- Batch items contain `index` and `outcome`; source identity lives inside the outcome. Input order and duplicate IDs are preserved. Empty batches return zero summary counts.
- Partial indicates lost requested content with recoverable output. Informational warnings such as decoding replacement or malformed optional properties need not imply partial status.

## Reusable type families

- `ExtractionInput`: required ordinary `data: Buffer`; optional `id`, `name`, `mimeType`. No browser adapter or filesystem input.
- `SourceInfo`: measured byteLength; optional id/name/declaredMimeType/mimeType/format (DocumentFormat enum).
- `ExtractionResult`: source, optional text/encoding/metadata/metrics, warnings.
- `ExtractionError`: ErrorCode enum plus message/stage strings. `ExtractionWarning`: code/message and optional location.
- `DocumentMetadata`: common properties, optional statistics, tagged format metadata.
- `FormatMetadata`: text has only kind; docx/xlsx/pptx/pdf/image have kind and matching details. Generated union supports narrowing without casts.
- `DocumentProperties`, `TextStatistics`, `Dimensions`, `GeoLocation`, and format details are separately reusable. PDF pageSizePoints uses points; image width/height use pixels.
- `BatchItemResult`, `BatchSummary`, `BatchResult` reuse the same outcome; summary has successCount/partialCount/errorCount and no aggregate duration.

## Options and defaults

- `ExtractionOptions`: selection, statistics, text, ocr, limits, metrics. No public FormatOptions or OcrOptions object is implemented.
- DocumentFormat has Text/Docx/Xlsx/Pptx/Pdf/Image; ErrorCode has UnsupportedFormat/FormatMismatch/InvalidDocument/DecodeFailed/LimitExceeded/OcrFailed/InternalError.
- Generated option enum members: ExtractionSelection.Text/Metadata/Both; DecodingPolicy.Strict/Replace; OcrMode.Disabled/Fast/Balanced/Accurate.
- Default both selection enables statistics. Metadata-only disables text/statistics; explicit statistics:true scans text internally without returning it. Text-only cannot enable statistics.
- Text policy accepts supported encoding and strict/replacement decoding. BOM/override resolve before UTF-8 validation/guessing. A contradictory BOM and override produces a document DECODE_FAILED outcome; an unknown encoding is an invocation error.
- OCR defaults to balanced for requested image text; no scanned-PDF OCR. Metrics default off; durations exclude initial JS input copy and final conversion.
- Limits: input64MiB/output16MiB/decompressed128MiB/entries10000/pixels20million/warnings100. Validated caps and parser exceptions are documented in `docs/api/types.md` and `docs/advanced/performance.md`.
- Batch defaults: concurrency native CPU workers (1–4); documents1000/input128MiB/output64MiB. Requested concurrency1–32 is capped by worker availability. Caps: documents10000/input256MiB/output256MiB.

## Ownership and numeric rules

- NAPI captures input values, then canonical backing inspection rejects shared/detached buffers and refreshes views after reentrant getters. Snapshots occur before dispatch; later caller mutations do not change extraction.
- JS counters are numbers, domain counters use usize/u64; practical input/archive/image/output bounds constrain returned counts. Metrics are finite nonnegative milliseconds.
- Omitted text is unrequested; empty text is requested but empty. Encoding describes decoded text sources, not binary document output.
- Empty statistics are zero; Unicode scalar characters and Unicode whitespace words are counted. CRLF is one break; lone CR/LF are breaks; trailing breaks add empty lines.
- Cancellation, progress, filesystem inputs, streaming binary parsing, browser/WASM, and deadlines are excluded. Dropping a Promise is not a cancellation contract.
