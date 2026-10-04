# Native performance and verification results

Measured 2026-10-04 on macOS arm64, Node v24.21.0, release Rust builds with LTO. Browser/WASM is out of scope. This is local acceptance evidence, not a cross-platform release certification.

## Completed correctness checks

- `pnpm test`: rebuilt CJS/ESM bindings and passed all 28 AVA tests.
- `cargo test --lib`: all 33 tests passed, including bounded decoding and queued cancellation retaining admission capacity.
- `cargo clippy --lib --tests -- -D warnings` and `cargo fmt --check`: passed.
- Generated declarations/test consumers and benchmark sources pass TypeScript checks.
- Ordinary scoped oxlint, formatting, TOML formatting and docs production build pass.
- Existing `pnpm lint` crashes: installed oxlint 1.86.0 and oxlint-tsgolint 0.12.2 disagree on rule `no-useless-default-assignment`. An isolated oxlint 1.49.0/tsgolint 0.12.2 run passes the changed test/docs/binding files with zero warnings/errors. No manifest/tooling migration was made to repair this. A whole-repository compatible-version run also reports unrelated errors in the existing `.agents/skills/optimise-github-actions/scripts/measure.mjs`; those skill scripts are outside this refactor.

Final review corrected canonical byte-array validation, actual XLSX inflation accounting, inherited PDF page boxes, partial Office/PDF handling, bounded decoded/property/cell-map growth and OCR cold-initialization reentrancy. The OCR lane now uses a dedicated thread/channel: a one-thread Rayon pool can run another queued OCR job while RTen initialization waits on its own pool, deadlocking the OCR OnceLock. A fresh-process concurrent regression proves the correction. CPU parsing remains on the bounded Rayon pool.

## Before/after end-to-end latency

Eight completed calls per workload with identical prepared input bytes; table uses the median of the seven warm calls. Raw files retain the first cold call. The old API was synchronous and borrowed caller Buffers; the new calls snapshot bytes, dispatch asynchronously, return ordered outcomes and enforce budgets. These costs are included. Text rows use batch sizes 1 and 10, matching the old extraction entry point.

| Workload          | Before ms | After ms | Change in latency |
| ----------------- | --------: | -------: | ----------------: |
| DOCX, 25 KB       |     1.647 |    0.605 |            -63.2% |
| XLSX, 19 KB       |     0.141 |    0.304 |           +116.3% |
| PPTX, 45 KB       |     0.021 |    0.093 |           +338.7% |
| PDF, 585 B        |     0.050 |    0.090 |            +79.3% |
| Text, 3.4 MB × 1  |     4.704 |    3.548 |            -24.6% |
| Text, 3.4 MB × 10 |    17.033 |   18.184 |             +6.8% |

Raw measurements: [before](results/baseline.json), [final native](results/native-final.json). Reproduce after measurements with `node --import @oxc-node/core/register benchmark/bench-baseline.ts`.

DOCX replaces a full object-model traversal with bounded ZIP/XML extraction. The recorded content is identical except two final newline characters. XLSX has intentional extra decompression: audit actual inflated bytes into an 8 KB discard buffer before Calamine reads the needed parts again. It also tracks sparse cell coordinates and conservative map storage. Its text representation changed to ordered TSV; it is not a byte-for-byte rendering benchmark. Tiny PPTX/PDF have unchanged fixture text, but async dispatch, ownership, properties/relationship validation and result accounting dominate these sub-millisecond comparisons. PPTX still validates relationship/presentation XML before attribute traversal; this is a documented remaining repeated pass.

The text handler reuses UTF-8 validation and uses an ASCII statistics path with the same whitespace/newline semantics as the Unicode path. Single large text improved. The ten-document text batch remains modestly slower: it snapshots 34 MB and uses at most four CPU workers, while the old pipeline borrowed inputs and used its general Rayon pool. This is an explicit throughput tradeoff for ownership and bounded scheduling; no uniform speed improvement is claimed. Seven warm samples are insufficient for a universal regression threshold or statistical speed guarantee.

## Mixed document batches

100 awaited batches of 24 documents, 1,138,552 input bytes each: paragraph/table DOCX, PDF, XLSX, PPTX and text. Inputs are created before timing and every outcome is checked. Measurements include optional per-document metrics. RSS includes Node, loaded binding and benchmark tooling.

| Concurrency | Documents/s | Batch p50 ms | Batch p95 ms | Event-loop p95 ms | Lifetime peak RSS MiB |
| ----------: | ----------: | -----------: | -----------: | ----------------: | --------------------: |
|           1 |        3364 |         7.04 |         7.67 |             11.11 |                 118.0 |
|           2 |        5503 |         4.04 |         4.58 |             11.06 |                 118.6 |
|           4 |        9469 |         2.50 |         2.77 |             10.48 |                 120.7 |

Raw: [one worker](results/mixed-concurrency-1.json), [two](results/mixed-concurrency-2.json), [four](results/mixed-concurrency-4.json). Reproduce with `BENCH_ITERATIONS=100 BENCH_CONCURRENCY=4 pnpm bench:report`. Event-loop histogram resolution is 10 ms, so values near 10 ms reflect the sampling interval as well as scheduling delay. The AVA substantial-spreadsheet heartbeat test independently proves timers advance during parsing. Snapshot copies and JS result conversion remain synchronous work on the Node thread.

## Contention and memory

[Contention raw results](results/contention-final.json) measure ten rounds of three simultaneous eight-document batches plus one single request; each text document is 1.02 MB. Reproduce with `node --expose-gc --import @oxc-node/core/register benchmark/bench-contention.ts`.

The script also submits a four-image OCR batch alongside 20 CPU documents and records whether CPU work finishes before OCR. This observation checks separation of lanes, not a fairness/deadline guarantee. CPU work completed first in this run.

RSS and heap are recorded before work, after text contention, after optional forced GC and after OCR, with process-lifetime peak RSS. The text workload creates 255 MB of returned text across ten rounds, including single requests. Returned JS values/GC and allocator retention can outlive native admission. OCR model and inference memory add further resident storage. The 512 MiB reservation ceiling is accounting for admitted copies/output allowances, not a process RSS cap. ZIP central-directory parsing, Calamine/lopdf and RTen scratch are not wholly governed by output budgets. No before/after memory improvement is claimed because the old baseline did not record comparable RSS.

## OCR

[OCR measurements](results/ocr-final.txt), eight completed warm samples each, with a separate cold child process. Cold first fast extraction was 487 ms; warm medians were about 398 ms fast, 404 ms balanced, 402 ms accurate, 0.101 ms metadata-only and 1.703 seconds for four fast images. Candidate policies are maximum pass counts; this fixture reaches the early-exit score, so similar times do not measure full multi-pass costs. The fixture checks retained recognized text and consistent single/batch output; it is not a broad OCR accuracy evaluation.

The model stays lazy and shared. Metadata-only work skips OCR. Concurrent cold single/batch requests now complete, and only one image enters inference at once. RTen owns its inference pool independently of the document CPU workers.

## Delivery limits

Native implementation and local correctness/performance assessment are complete. Existing CI provides the six native build targets and Node 20/22 binding matrix; it has not been run in this uncommitted workspace. Cross-platform results, a broader real-document/OCR corpus, strict fairness and comprehensive environment teardown remain release validation/follow-up work, not claimed passes. No publication, version bump, pnpm/Vite Plus/changelog migration or commit was performed.

## Reusable published-release comparison

The original before/after table above compares the pre-refactor workspace build. For the actual published active package, `pnpm bench:compare` installs a pinned registry release in an isolated cache and compares it with a fresh workspace build in separate processes. See [benchmark instructions](../../../benchmark/README.md). Inputs/hashes, completed single/batch timing, cold calls, timer latency, peak RSS and output differences are recorded. The verified active release on this date was undms@1.5.1; the default 15-workload comparison completed three rounds of 20 warm samples per implementation/workload, and OCR/local-reference smoke checks passed. Generated reports live under ignored benchmark/results/.
