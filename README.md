# UNDMS

[![CI](https://img.shields.io/github/actions/workflow/status/xcvzmoon/undms/ci.yaml?branch=main)](https://github.com/xcvzmoon/undms/actions/workflows/ci.yaml)
[![npm version](https://img.shields.io/npm/v/undms)](https://www.npmjs.com/package/undms)

Async document text and metadata extraction for Node.js, built in Rust with napi-rs. Supports plain text, DOCX, XLSX, PPTX, PDF, and images. Image OCR uses ocrs and rten with embedded models.

## Install

Requires Node.js 20 or later.

```sh
pnpm add undms
```

## Extract a document

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

`extract(input, options?)` returns `Promise<ExtractionOutcome>`. Document failures resolve with `status: 'error'`. Invalid arguments, scheduler overload, and infrastructure failures throw or reject. Handle both through `try`/`catch` when needed.

Inputs contain `data: Buffer` and optional `id`, `name`, and `mimeType`. Bytes are copied before processing, so later Buffer mutations cannot change the document. SharedArrayBuffer-backed Buffers are rejected.

## Process a batch

```ts
import { extractBatch } from 'undms';

const batch = await extractBatch(
  [
    { data: Buffer.from('first'), id: 'a', mimeType: 'text/plain' },
    { data: Buffer.from('second'), id: 'b', mimeType: 'text/plain' },
  ],
  { concurrency: 2 },
);

for (const { index, outcome } of batch.items) {
  console.log(index, outcome.status);
}
console.log(batch.summary);
```

Results stay in input order, including duplicate IDs. Each document has its own outcome; a failed document does not discard successful items. Batch budget and infrastructure failures reject the whole request.

## Select work

```ts
import { ExtractionSelection, OcrMode, extract } from 'undms';

const outcome = await extract(
  { data: imageBuffer },
  {
    selection: ExtractionSelection.Metadata,
    ocr: OcrMode.Disabled,
    metrics: true,
  },
);
```

The default selection is both text and metadata, including text statistics. Metadata-only selection skips text extraction and OCR unless `statistics: true` requests text statistics. Text-only selection omits metadata. Import `ExtractionSelection`, `OcrMode`, and `DecodingPolicy` for typed option values.

## Results and limits

Outcomes are a tagged union: `success`, `partial`, or `error`. Successful and partial results contain source identity, optional text/encoding/metadata, warnings, and optional timing metrics. Metadata separates common `properties`, optional `statistics`, and tagged `format` details.

Native work uses bounded CPU workers and a separate image/OCR worker. Per-document and batch limits constrain inputs, outputs, ZIP expansion, archive entry counts, and image pixels. Calamine and lopdf allocate internally; these limits are not a hard process-memory or timeout sandbox.

This package supports native Node.js extraction. Browser and WebAssembly support are outside the scope of this refactor.

## Benchmarks

Tinybench compares eight real government reports, statistical workbooks and training slide decks against officeparser, Mammoth and pdf-parse. The recorded run uses Apple M1, Node v24.21.0, three fresh process rounds per workload, and a separate sustained CPU phase.

Warm milliseconds per document; lower is faster. Singles average the per-file medians equally. Batches contain distinct files and report amortized cost.

| Format / mode | undms | officeparser | mammoth | pdf-parse |
| ------------- | ----: | -----------: | ------: | --------: |
| DOCX · single |  2.04 |        79.31 |   45.48 |         — |
| XLSX · single | 61.56 |       278.41 |       — |         — |
| PPTX · single |  0.74 |        14.39 |       — |         — |
| PDF · single  | 37.34 |       165.73 |       — |     44.39 |
| DOCX · batch  |  1.60 |        81.16 |   47.29 |         — |
| XLSX · batch  | 58.70 |       261.73 |       — |         — |
| PPTX · batch  |  0.58 |        15.83 |       — |         — |
| PDF · batch   | 29.18 |       117.88 |       — |     44.45 |
| MIXED · batch | 16.44 |       131.92 |       — |         — |

![Real-document batch extraction latency](benchmark/published/latency.svg)

CPU utilization is measured from OS process counters: 100% means one occupied core. [CPU, memory, methodology and provenance](benchmark/published/report.md) · [Raw measurements](benchmark/published/results.json). This is a small corpus; output policies differ and the results do not establish an accuracy ranking.

Reproduce with `pnpm bench:packages`, or use `--corpus manifest.json` for your own documents. See [benchmark instructions](benchmark/README.md).

### Image OCR

Three real SROIE receipt scans are compared against Tesseract.js using reusable workers and reference transcriptions. This run uses ocrs balanced mode and Tesseract English LSTM best_int, with three fresh process rounds per workload.

Warm milliseconds per image; batch values are amortized across the three distinct receipts.

| Format / mode  |  undms | tesseract.js |
| -------------- | -----: | -----------: |
| IMAGE · single | 576.90 |       634.14 |
| IMAGE · batch  | 622.49 |       286.98 |

![Receipt OCR batch latency](benchmark/published/images/latency.svg)

On these receipts, undms has lower average single-image latency; Tesseract.js has lower batch latency and lower character/word error rates on all three images. Native OCR uses a serial lane while Tesseract reuses up to three workers for this batch. The configurations differ, and this small corpus does not establish a general OCR ranking.

[Per-image accuracy, CPU, memory, cold starts and cleanup](benchmark/published/images/report.md) · [Raw measurements](benchmark/published/images/results.json). Reproduce with `pnpm bench:ocr`; use `pnpm bench:packages --images` to include images alongside the document suite.

## Develop

Use pnpm and a stable Rust toolchain.

```sh
pnpm install
pnpm build
pnpm test
pnpm lint
vp run fmt
```

Compare this workspace with the active published release using `pnpm bench:compare`, or with other Node.js extraction packages using `pnpm bench:packages`. See [benchmark instructions](benchmark/README.md) for version selection, OCR, workload filtering, and generated reports.

Generated bindings and TypeScript declarations come from the Rust API; edit the Rust source to change them. Native targets cover macOS, Windows, and Linux as configured in `scripts/napi.config.ts`. The TypeScript wrapper in `scripts/napi.ts` passes a temporary JSON config to napi and generates platform packages named `@undms/<platform>`. Use `pnpm run create-npm-dirs` to generate package manifests; build, artifact, and version scripts use the same wrapper.

## Release

Run `pnpm release --dry-run` to preview the configured major release, then `pnpm release` to bump the Node package and Rust crate, write the changelog, commit, tag, and push. GitHub release creation is enabled; provide `GENBUMPPUSH_GITHUB_TOKEN` through the environment. Release commits using `release: v<version>` trigger CI; `.github/workflows/publish.yaml` publishes the tested native packages using npm trusted publishing after CI succeeds. Configure each package's trusted publisher before releasing; see [.github/RELEASING.md](.github/RELEASING.md).

## License

MIT
