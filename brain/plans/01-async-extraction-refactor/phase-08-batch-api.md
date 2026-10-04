# Phase 08: Expose ordered batch processing with bounded in-flight work

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Expose ordered batch processing with bounded in-flight work. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/api/batch.rs`
- `src/engine/batch.rs`
- `__test__/batch.spec.ts`

Admission validates total request count/bytes before copying. Coordinator schedules at most request/global caps, refills fairly and places output by input index. Release item input memory early; bound retained output.

## Data structures

BatchOptions, BatchItemResult, BatchSummary and BatchResult reusing single outcomes.

## Verification

- Static: Rust coordinator tests, generated declarations and TS checks.
- Runtime: Prove mixed-duration order/duplicate IDs, error isolation/counts, empty batch, simultaneous-call caps and overload/fairness.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
