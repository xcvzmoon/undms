# Async extraction refactor

Requested 2026-10-04. Status: native implementation and local correctness/performance acceptance complete. Cross-platform CI and tooling migration remain separate release work.

## Objective and scope

Rebuild the Rust extraction architecture for asynchronous single and batch document/text and metadata extraction. Remove comparison completely. Design public types from the new requirements rather than adapting the existing browser-file input and grouped return types.

- Work in the current branch and workspace. Do not create a worktree or change branches.
- Preserve the currently working text, DOCX, XLSX, PPTX, PDF and image extraction capabilities, including image OCR and available EXIF metadata; correct documented fidelity problems.
- Confirmed by user: retain ocrs with rten for OCR; no Tesseract migration.
- Include Rust architecture, napi integration, extraction tests, async benchmarks, generated bindings and consumer-facing migration documentation.
- User owns pnpm, Vite Plus, changelog tooling and adjacent infrastructure migrations. Coordinate shared package scripts/configuration instead of overwriting them.
- This is a breaking API release. No comparison compatibility layer or synchronous legacy extraction alias.
- User removed browser/WASM support from scope. Only native phases 01–19 apply.
- New formats, scanned-PDF OCR, filesystem inputs, streaming binary parsers and external OCR models remain separate work.

## Evidence and constraints

See [[plans/01-async-extraction-refactor/current-state]], [[plans/01-async-extraction-refactor/api-contract]], [[plans/01-async-extraction-refactor/rust-design]] and [[plans/01-async-extraction-refactor/verification]] and [[plans/01-async-extraction-refactor/status]].

The manifest is already on napi v3. The local ignored Cargo.lock and crates.io both resolve napi **3.14.0**, napi-derive **3.6.10**, napi-build **2.6.0** on the planning date. Recheck stable versions at implementation; align manifest minimums and required features with the actual APIs used. Versions of these crates need not match numerically. CLI coordination belongs at the shared tooling boundary. [Registry](https://crates.io/crates/napi), [derive](https://crates.io/crates/napi-derive), [build](https://crates.io/crates/napi-build).

Actual Cargo edition is 2024; supplied repository guidelines say 2021. Do not change edition as part of this refactor; reconcile that documentation with the user. The configured package targets are six native targets, not every platform listed in AGENTS.md. Preserve the existing configured target set and validate it; do not silently add targets.

No brain vault or principle index existed when inspected. This plan uses the user's explicit constraints: reusable types, extraction-only scope, bounded processing, correctness and measured speed. It does not claim pre-existing principle notes.

## Main architectural decisions

- Synchronous Rust parsers, asynchronous Node API. CPU parsing should run on a bounded worker pool; adding `async` to CPU code does not make it nonblocking.
- One pure Rust engine and one extraction primitive shared by single and batch. Napi types and JavaScript conversion stay in the API layer.
- Fresh composable types: source identity, extraction selection, parser policies, limits, document properties, text statistics, tagged format metadata, structured errors/warnings and optional metrics.
- Flat batch output in input order, with index and optional caller ID. Per-document failure remains local; invocation and infrastructure failure reject the Promise.
- Default snapshot ownership of input bytes before dispatch. Account for copies and output memory; never assume Buffer lifetime protection makes concurrent mutation safe.
- Bounded process-wide CPU work and OCR admission, plus per-call batch concurrency. No independent unlimited pools or nested parallel OCR candidates.

## Alternatives considered

| Choice                                                    | Benefit                                                       | Cost / decision                                                                                     |
| --------------------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- |
| AsyncTask on libuv, serial parsing                        | Simple Promise bridge; no new async runtime                   | Shares Node's blocking pool with unrelated work; retain as prototype baseline                       |
| AsyncTask coordinating Rayon batches                      | Easy transition from current code                             | Waiting coordinators occupy libuv; nested work and concurrent calls require extra admission control |
| napi async Promise bridge to a dedicated bounded CPU pool | Isolates extraction, controls CPU scheduling across all calls | More lifecycle and queue code; recommended after prototype verifies overhead and teardown           |

For Office parsing, retain current parser libraries initially where suitable, versus replace all with a custom parser, versus introduce selective shared ZIP/XML helpers. Choose selective helpers for DOCX/PPTX fidelity and budgets if a measured docx-rs traversal cannot meet them; keep Calamine for spreadsheets. Avoid rewriting mature binary formats speculatively.

## Phases

Each phase is a small checkpoint; some introduce one cohesive type family rather than one literal struct. Contract and scheduler decisions are gates before broad migration. Execute in order; keep transitional modules private and compile between checkpoints.

1. [[plans/01-async-extraction-refactor/phase-01-baseline]]
2. [[plans/01-async-extraction-refactor/phase-02-domain-contract]]
3. [[plans/01-async-extraction-refactor/phase-03-binding-contract]]
4. [[plans/01-async-extraction-refactor/phase-04-options-limits]]
5. [[plans/01-async-extraction-refactor/phase-05-extraction-engine]]
6. [[plans/01-async-extraction-refactor/phase-06-async-scheduler]]
7. [[plans/01-async-extraction-refactor/phase-07-single-api]]
8. [[plans/01-async-extraction-refactor/phase-08-batch-api]]
9. [[plans/01-async-extraction-refactor/phase-09-text-decoding]]
10. [[plans/01-async-extraction-refactor/phase-10-archive-reader]]
11. [[plans/01-async-extraction-refactor/phase-11-docx]]
12. [[plans/01-async-extraction-refactor/phase-12-xlsx]]
13. [[plans/01-async-extraction-refactor/phase-13-pptx]]
14. [[plans/01-async-extraction-refactor/phase-14-pdf]]
15. [[plans/01-async-extraction-refactor/phase-15-image-metadata]]
16. [[plans/01-async-extraction-refactor/phase-16-ocr]]
17. [[plans/01-async-extraction-refactor/phase-17-remove-comparison]]
18. [[plans/01-async-extraction-refactor/phase-18-consumer-migration]]
19. [[plans/01-async-extraction-refactor/phase-19-performance-acceptance]]

Browser phases 20–22 are cancelled by user instruction. Their notes remain as historical planning material, not pending work.

## Current progress

- Phases 01–17: implemented and locally verified, including reusable types, async single/batch APIs, refactored handlers, comparison removal and retained ocrs.
- Phase 18: consumer documentation, benchmarks and generated declarations updated; API/documentation consistency review complete, final rebuilt verification tracked in status.
- Phase 19: local verification and performance assessment complete. See [[plans/01-async-extraction-refactor/performance-results]] for raw measurements, explained regressions, successful checks and remaining release limitations.

## Verification and completion

Rust formatting, Clippy with warnings denied, domain tests, rebuilt native CJS/ESM integration tests and declaration type checks must pass. Tests must prove timer progress, snapshot ownership, batch ordering, failure isolation and bounded admission. Benchmark awaited end-to-end calls, not scheduling speed. Run representative platform smoke tests through the existing build matrix.

Local implementation acceptance is complete with the checks and measurements in the performance report. Cross-platform smoke tests remain an existing CI/release gate and are not claimed executed locally. Browser verification is no longer required.

No speed percentage is promised before baseline data exists. Finish with a per-format before/after report for latency, throughput, event-loop delay and peak RSS, including cold/warm OCR and simultaneous batches. Known correctness fixes may change output and cost; explain those differences separately.

Applicable skills during execution: execute, testing, ts-best-practices for TS tests/consumer checks, debugging for failures, and quality/review at the final gate. Planning used plan, brain and find-skills, plus a temporary inspection of napi-rs-package guidance; no one-off skill installation remains.
