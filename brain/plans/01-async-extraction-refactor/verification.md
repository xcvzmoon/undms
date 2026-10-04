# Verification and performance acceptance

Back to [[plans/01-async-extraction-refactor/overview]].

## Baseline before implementation

- Run existing extraction tests and record failures without repairing tooling owned by the user. Record Rust/Node versions, CPU, release profile and crate versions.
- Capture exact existing fixture outputs; distinguish compatibility behavior from known bugs rather than freezing incorrect output as desired behavior.
- Record end-to-end latency/throughput, event-loop blocking and RSS for small/large text, table-heavy DOCX, dense/sparse XLSX, reordered PPTX, multipage PDF and images.
- Separate OCR first-call model initialization from warm inference. Inputs are prepared outside timing; output conversion and input snapshots stay inside end-to-end timing.
- Keep hardware, input corpus and process concurrency fixed. Preserve raw samples and medians/p95 with repeated runs; no synthetic headline based only on best case.

## Static and integration gates

- `cargo fmt --check`, `cargo clippy --all-targets -- -D warnings`, `cargo test`. Pure domain tests must not depend on constructing napi Buffers outside a Node environment. Add rlib/test setup only if needed for domain tests.
- `pnpm build`, `pnpm test:bindings` (or the equivalent scripts after the user's migration), TS no-emit checks for test and benchmark projects, then repository lint/format checks scoped to touched files.
- Regenerate native loaders/declarations. Verify fresh CJS and ESM imports, Promise signatures, union narrowing without casts and no stale comparison exports.
- Representative native platform/Node load and extraction checks through the existing CI matrix. Local success is not evidence that every platform passes.

## Correctness suites

| Suite        | What it proves                                                                                                          |
| ------------ | ----------------------------------------------------------------------------------------------------------------------- |
| API contract | Promise return, invocation rejection versus document outcome, empty document/batch, shared single/batch semantics       |
| Scheduler    | Timer progress while parsing, process-wide/per-call caps, admission release, overload, later-call fairness and teardown |
| Ownership    | Ordinary Buffer mutation after call cannot change snapshots; forced GC safe; unsupported shared-backed inputs rejected  |
| Batch        | Input order under varied runtimes, duplicate identities, independent corrupt items, summary counts                      |
| Selection    | Unrequested work skipped via instrumented handlers; metadata-only images don't initialize OCR                           |
| Limits       | Input/count/byte limits before copies, archive entry/inflation/output limits, pixels, checked numeric conversions       |
| Formats      | Exact text order/spacing and faithful structural metadata for each format, plus malformed fixtures                      |
| OCR          | Cold/warm initialization, concurrent first use, disabled mode, finite candidate generation and fixed-corpus accuracy    |

Use deterministic Rust fake handlers/barriers for ordering, caps and selection. Node responsiveness tests run a substantial finite job and verify heartbeat progress before resolution; do not rely only on a brittle wall-clock threshold. Run slow/memory/concurrency diagnostics in isolated processes so other AVA workers do not distort results.

## Performance matrix

- Single latency: tiny, medium and large input per format, metadata/text/both selection.
- Batch throughput: sizes 1/10/100 where sensible, serial through worker cap, homogeneous and mixed formats, malformed items mixed with valid ones.
- Contention: simultaneous batches plus single requests, OCR mixed with cheap text; measure queue time and fairness as well as total throughput.
- Memory: peak RSS, admitted snapshot bytes, pending output bytes, image decode/candidate allocation, no unbounded growth under overload.
- Responsiveness: event-loop delay and unrelated Node fs/DNS work, to expose libuv contention in the AsyncTask prototype.
- Accuracy: exact Office/PDF regression outputs; OCR recognized content on a fixed corpus. Faster extraction with lost text is a failure.

## Acceptance

- All functional and declaration gates pass; comparison is absent from public/runtime/docs surfaces.
- Expensive parsing no longer blocks Node timers; scheduler and ownership invariants have direct tests.
- Finite resource defaults are selected and documented from measurements. Record parser-limit exceptions explicitly rather than claiming a hard total memory cap.
- Correct outputs and warnings agree across single and batch calls under the same options.
- Explain every material release-build latency/throughput/RSS regression; fixes that extract previously omitted text are reported separately. Use baseline variance to set format-specific regression budgets before optimization, not after seeing favorable results.
- Deliver a concise before/after report with raw-result links. No unsupported speed claims, no publication and no automatic commit as part of planning.

## Review findings and observed verification

- See [[plans/01-async-extraction-refactor/status]] for checkpoint evidence; checklist entries above are not all claimed as executed.
- Reentrant NAPI object getters can detach a Buffer after initial conversion. Canonical backing inspection/view reconstruction must precede all cached-view dereferences, including length. Tests isolate detachment cases in a child process.
- Shared backing cannot be identified through a spoofable JavaScript .buffer property. Use canonical typed-array backing; test input/options getters and shadowed properties.
- ZIP central-directory inflation claims can lie. Actual XLSX inflation is audited into a fixed buffer before calamine; consumed bytes are charged even when CRC parsing later fails.
- Admission reservations survive active workers when a whole batch rejects. Final review verified closure/coordinator ownership; a queued-future cancellation test proves reservations are retained until workers discard cancelled work.
- Output allowance includes estimated metadata/warning overhead and conservative spreadsheet map storage; it is not exact serialized size or a hard parser-memory ceiling.
- Generic timer/overload probes exist, but strict cross-request fairness, comprehensive dropped-completion teardown, and full platform matrix remain unproven. Documented APIs make no fairness/deadline guarantee.
- Existing type-aware lint tool mismatch is recorded in status. Final acceptance must distinguish successful checks from unavailable tooling.
- Browser/WASM is outside scope by user instruction. Local native correctness and performance assessment are complete; see [[plans/01-async-extraction-refactor/performance-results]] for evidence and release limitations.
