# Benchmarks

Compare the refactored workspace with the active published `undms` release:

```sh
pnpm bench:compare
```

This builds the workspace in release mode, resolves the registry's `latest` version, and installs that exact version under `node_modules/.cache/undms-comparison/`. It does not change the root dependencies or lockfile. The release uses its native prebuilt package; the workspace uses its freshly built native addon.

The default comparison runs 15 shared workloads: small/large/Unicode text, CSV, DOCX, XLSX, PPTX, PDF, ten-document batches, and a mixed twenty-document batch. Each implementation/workload gets three fresh processes, one cold call, three extra warmups, and twenty timed warm calls. Process order alternates between rounds. Inputs are prepared before timing, and their byte hashes must match.

Results go to `benchmark/results/<timestamp>/comparison.md` and `comparison.json`. The Markdown report compares p50/p95 extraction latency, completed documents per second, a scheduled timer's p95 latency, cold extraction, peak RSS, and text hashes. JSON retains all process samples, versions, paths, and input/output hashes. A negative latency change means faster refactored extraction.

```sh
# Short full-suite smoke run
pnpm bench:compare --iterations 3 --warmups 1 --rounds 1

# Pin the active release and choose a report directory
pnpm bench:compare --release-version 1.5.1 --output benchmark/results/active-vs-refactor

# Use an existing pre-refactor package directory instead of the registry
pnpm bench:compare --release-path /absolute/path/to/old-package

# Include OCR (substantially longer)
pnpm bench:compare --ocr --iterations 5 --warmups 1 --rounds 2

# Run only one workload, including OCR independently
pnpm bench:compare --only ocr-single --iterations 5 --warmups 1 --rounds 2

# List flags and workload names
pnpm bench:compare --help
```

`--release-path` must contain `package.json` and a working legacy extraction binding with its native addon. Use the existing package in place; no branch/workspace switching is needed. The script expects the old grouped `extract(Document[])` API on that side and the new single/batch API in this workspace.

Both versions extract text and metadata with their defaults. Single refactored workloads call `extract`; the release receives a one-item array. Batch workloads use each version's batch entry point. OCR uses each version's default candidate policy, so its timing does not imply equal passes or accuracy. Comparison functions are excluded.

Extraction is awaited through completion. Result shape, metadata presence, document identities/counts, and content are checked outside the timed call; empty/failed extraction aborts the run. Full and whitespace-normalized text hashes from each process's first call expose formatting/content differences, but do not certify metadata or OCR accuracy parity. Warm calls validate result shape, identities/counts, metadata presence and content. No async scheduling-only timing is reported.

A 1 ms timer is scheduled immediately before each warm call and allowed to run before result validation. Its observed latency shows call-time blocking, including snapshot copying; it is separate from extraction duration. Throughput excludes timer waits and validation. Binding load is outside cold extraction and recorded separately. Peak RSS includes Node, the TypeScript loader, fixtures, parsers, results, and validation; it is not a native memory ceiling. Runs are sequential across implementations, not a simultaneous-load benchmark. Platform, thermal load, GC, and sample count affect results.

Other refactored-only suites remain available through `pnpm bench`, `pnpm bench:text`, `pnpm bench:documents`, `pnpm bench:image`, and `pnpm bench:report`. For simultaneous batches and CPU/OCR contention, run:

```sh
node --expose-gc --import @oxc-node/core/register benchmark/bench-contention.ts
```

## Other Node.js packages

```sh
# Release build + realistic public corpus + README-ready results
pnpm bench:packages --output benchmark/results/real-documents

# Short verification run (not suitable for publishing performance claims)
pnpm bench:packages --duration 100 --resource-duration 500 --rounds 1

# Longer sustained measurements, or one format
pnpm bench:packages --duration 3000 --resource-duration 10000 --rounds 5
pnpm bench:packages --only pdf

# Bring your own real documents
pnpm bench:packages --corpus /absolute/path/to/manifest.json
```

Tinybench performs time-based async latency sampling, with a 300 ms warmup and at least ten measured calls. Defaults are 1,000 ms of latency measurement, a separate 2,000 ms sustained resource phase, and three fresh processes per package/workload. `--duration`, `--resource-duration`, `--rounds`, `--concurrency` (default 4), `--only`, and `--output` configure the run. The earlier `--iterations` and `--warmups` flags have been replaced by duration-based sampling. The active-release `bench:compare` command keeps its original flags.

The default [pinned corpus](corpus-manifest.json) contains eight genuine government documents: consultation and risk-assessment DOCX files, public-spending and mortality XLSX datasets, education and procurement PPTX decks, and multi-page planning PDF reports. Source URLs, publisher terms, content anchors and SHA-256 hashes are recorded. Binaries download once into ignored `benchmark/corpus-cache/`; they are not generated toy fixtures or committed downloads. Each file is tested individually, each format gets a batch of its distinct documents, and a mixed inbox tests all eight files together. Downloads and disk reads happen before timing.

Comparators are pinned `officeparser@8.1.0`, `mammoth@1.13.0` for DOCX and `pdf-parse@2.4.5` for PDF. Their isolated installation does not change root dependencies or the lockfile. Officeparser AST-to-text conversion is included. PDF parser creation, its input copy, text extraction and awaited `destroy()` are included. undms extracts text without statistics or OCR. Competitor batches use an ordered JavaScript adapter with at most four in-flight calls; undms uses its native batch API. No worker-thread offloading is added to competitors. Inputs must retain their original hashes, and successful extraction must contain every configured content anchor; first and final outputs in each phase must remain stable. Output hashes expose differences without claiming ground-truth accuracy.

The terminal prints a compact table without quoted cells, row indices or raw Markdown. Every run creates:

- `README.md`: a copy-ready comparison section with a compact per-document table and a batch latency chart.
- `latency.svg` and `cpu.svg`: standalone GitHub-compatible charts.
- `report.md`: detailed CPU, memory, throughput, cold starts, per-file timings and corpus provenance.
- `results.json`: environment, versions, configuration, raw latency samples, CPU timeline and failures.
- `extracted-text/`: outputs for inspecting content differences.

To use the report in a README, copy its Markdown and the linked charts/report artifacts together, or adjust the relative links to their published locations. Generated artifacts remain ignored until you deliberately choose what to retain.

CPU is measured from [Node's OS process user/system counters](https://nodejs.org/api/process.html#processcpuusagepreviousvalue), covering JavaScript and native threads during sustained processing. **100% means one fully occupied core**; an eight-core process can exceed 100%. Host-capacity utilization divides by logical CPU count and describes this process, not the total usage of all applications. CPU time per document and completed documents/second help distinguish useful parallel work from wasted CPU. Aggregate CPU excludes module load, cold extraction and latency sampling, and includes adapter/cleanup, monitoring and one event-loop yield per completed call. The sampled timeline can be delayed by synchronous blocking, while aggregate counters still cover that work.

Peak RSS is the OS process high-water mark across the whole child, including Node, the loader, Tinybench, fixtures and parsers. GC snapshots retain inputs and first/last results. A short idle CPU checkpoint checks background activity after processing; it does not prove leak freedom. Failed comparisons are marked incomplete and cannot win. The corpus is more realistic than the old smoke fixtures but is still small, English-focused and not an accuracy, metadata, OCR or malformed/encrypted-file benchmark. Repeated in-memory calls measure a warm working set, not file-system or network ingestion.

### Custom corpus

Use a manifest with a `documents` array. Local `path` entries resolve relative to the manifest. Remote `url` entries are downloaded to the cache and must match the supplied SHA-256. Every document needs a unique safe `id`, a format, provenance and at least one expected content anchor:

```json
{
  "documents": [
    {
      "id": "annual-report",
      "title": "Annual report",
      "format": "pdf",
      "path": "documents/annual-report.pdf",
      "sha256": "REPLACE_WITH_THE_FILES_64_CHARACTER_SHA256",
      "sourceUrl": "https://example.com/reports/annual-report",
      "license": "Your publisher or internal-use terms",
      "expectedText": ["Annual report", "Financial statements"]
    }
  ]
}
```

For default public corpus provenance, consult the source links in the manifest. Adapter APIs follow [officeparser](https://github.com/harshankur/officeParser), [Mammoth](https://github.com/mwilliamson/mammoth.js), and [pdf-parse](https://github.com/mehmet-kozan/pdf-parse); timing uses [Tinybench](https://github.com/tinylibs/tinybench).

The [earlier smoke-fixture snapshot](package-results.md) is historical and does not represent this real-document suite.

## Image OCR comparison

```sh
# Three real receipt images, individually and as a batch
pnpm bench:ocr --output benchmark/results/images

# Include images alongside the document suite
pnpm bench:packages --images

# Compare a different native OCR policy
pnpm bench:ocr --ocr-mode accurate
```

The [image corpus](image-corpus-manifest.json) pins three scanned SROIE receipts and their reference transcriptions from the research team's corrected annotations. Image and annotation URLs and hashes are recorded in the manifest. Images stay in the ignored cache; this repository does not redistribute them. The default document suite stays separate because OCR has different processing and accuracy costs. Mixed Office/PDF batches exclude images; image batches contain the three distinct receipts.

The OCR comparator is `tesseract.js@7.0.0`. It uses reusable English LSTM workers (OEM 1), bounded by the configured concurrency and image count. Its [best_int language model](ocr-model.json) is downloaded and SHA-256 checked before measurements. Workers initialize on the cold call and are reused across warm and resource phases, then explicitly terminated. undms uses embedded ocrs models, its dedicated serial OCR lane, and `balanced` mode by default (`--ocr-mode fast|balanced|accurate`). Engine settings and worker counts differ and are reported; this is a comparison of these configurations, not equal algorithms or equal recognition passes. See the [Tesseract worker lifecycle documentation](https://github.com/naptha/tesseract.js/blob/master/docs/workers_vs_schedulers.md).

The report includes per-image character and word error rates against the reference transcription, in addition to latency, process CPU, throughput, memory and cold startup. Scoring happens outside timed processing. Text is NFKC normalized, lowercased and whitespace collapsed; Levenshtein edits are divided by reference length. Punctuation remains significant, insertions can exceed 100%, and annotation reading order affects the score. Reference imperfections and the small receipt corpus limit accuracy conclusions. Inspect extracted text before choosing an engine.

Retained memory is sampled while OCR workers/models are still available for reuse. Tesseract termination and post-termination RSS are reported separately; the idle CPU check runs after termination. Native models remain cached until process exit. This short observation does not prove memory leak freedom. CPU counters include Node worker threads and native OCR threads; 100% still means one logical core.

For custom images, use `format: "image"`, a nonempty `referenceText`, `expectedText: []`, and the usual pinned URL/path, SHA-256 and source fields. JPEG and PNG signatures are checked. The default transcriptions follow CSV annotation order without sorting, avoiding an engine-specific text ordering adjustment.
