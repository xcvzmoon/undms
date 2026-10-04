# Phase 05: Create the common synchronous extraction primitive

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Create the common synchronous extraction primitive. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/engine/extract.rs`
- `src/engine/format.rs`
- `src/core/handler.rs`

Resolve MIME/signatures once, normalize hints and return unsupported/mismatch errors. Centralize statistics/warnings and selection. Legacy adapter is temporary; converted handlers must lose napi dependencies.

## Data structures

DocumentFormat, ExtractionContext and domain handler output; temporary legacy adapter.

## Verification

- Static: Rust format-dispatch and outcome tests; module exports remain private until API swap.
- Runtime: Fake handlers prove text/metadata selection, recoverable partial output, unsupported formats and identical options across requests.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
