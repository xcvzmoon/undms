# Native refactor status

Back to [[plans/01-async-extraction-refactor/overview]]. Updated 2026-10-04.

## Implemented scope

- Native-only async extract/extractBatch with fresh domain/public types and generated narrowing unions.
- Shared extraction pipeline; bounded CPU/image workers, request/byte admission, ordered batch outcomes, snapshots and selection.
- Refactored text/Office/PDF/image handlers, retained ocrs/rten, comparison removal, async consumers and docs.
- Browser/WASM cancelled by user; phases20–22 are archived historical notes, not pending commitments.

## Verified evidence and release limitations

- Final `pnpm test` rebuild passed all 28 AVA tests, including fresh-process cold OCR concurrency, byte-array accounting, forced GC, detached/shared backing, actual XLSX inflation, event-loop progress and admission recovery.
- All 33 Rust tests and Clippy with warnings denied pass. Queued future cancellation retains admission until the worker discards the cancelled job. Incremental encoding boundaries/expansion and ASCII/Unicode statistics are covered.
- TypeScript checks pass for generated declaration consumers and benchmarks. Ordinary scoped oxlint and formatting pass; docs production build passes.
- Installed `pnpm lint` still crashes on unknown rule no-useless-default-assignment (oxlint1.86.0/tsgolint0.12.2). Isolated compatible oxlint1.49.0/tsgolint0.12.2 type-aware checks pass changed consumers/bindings/docs config. A whole-repo compatible run finds unrelated existing skill-script errors. User's tooling migration owns those; they are not waived clean checks.
- Native performance assessment complete: [[plans/01-async-extraction-refactor/performance-results]]. Includes baseline/final fixture latency, mixed concurrency, simultaneous batches, event-loop/RSS/heap/GC observations and cold/warm OCR. Speed improvements are workload-specific; regressions are explicit.
- Cross-platform CI matrix has not run in this uncommitted workspace. Broader real-document/OCR accuracy, strict fairness and comprehensive environment teardown are not claimed verified.

## Required limitations

- Inputs are copied synchronously before dispatch; async parsing does not eliminate call-time copy cost.
- Native admission is conservative accounting, not a process RSS ceiling. Calamine/lopdf parser allocations are not fully bounded by output budgets.
- XLSX audits actual inflated archive bytes, then calamine decompresses required entries again. Safety cost is intentional and must be included in performance reporting.
- XLSX text cell maps conservatively charge node overhead, so output limits can fail before rendered text alone reaches that limit.
- DOCX/PPTX budgets cover consumed ZIP parts; unrequested parts are not inflated. Optional-property warnings may remain successful outcomes.
- Only one dedicated OCR thread (avoids reentrant Rayon cold initialization); strict fairness across requests, timeouts, cancellation, and streaming binary input are not public guarantees.
- PDF extracts embedded text without OCR; custom EXIF reader targets supported JPEG TIFF fields, not universal EXIF across every image container.
