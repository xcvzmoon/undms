# Phase 16: Bound OCR inference and lazy candidate allocation

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Bound OCR inference and lazy candidate allocation. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/image.rs`
- `src/engine/ocr.rs`
- `__test__/ocr.spec.ts`

Retain lazy shared models. Use dimension-only resize tests, lazy sequential candidates and reusable upscaled data. Inspect inference-library threads; coordinate permits without starving cheap jobs. Choose fast/balanced/accurate defaults from fixed-corpus quality/performance.

## Data structures

OcrPolicy, model cache and bounded OCR work permit.

## Verification

- Static: Rust candidate/model tests and inference thread-safety compatibility.
- Runtime: Prove concurrent initialization, disabled OCR, candidate/pixel caps, cold/warm inference and stable corpus text quality.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
