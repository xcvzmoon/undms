# Phase 01: Establish extraction correctness and release performance baselines

Status: Baseline captured in results/baseline.json. Coverage/measurement limitations are tracked in verification and phase 19; the complete planned performance matrix is not claimed.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Establish extraction correctness and release performance baselines. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `benchmark/bench-documents.ts`
- `benchmark/common.ts`
- `__test__/index.spec.ts`

Record release measurements with prepared inputs; preserve comparison suites untouched until removal. Add only extraction regression scaffolding, not tooling migration.

## Data structures

BaselineSample and fixture expectations; distinguish known bugs from behavior to preserve.

## Verification

- Static: Current extraction tests and benchmark TypeScript compile.
- Runtime: Run existing formats, cold/warm OCR, single and concurrent batches; save raw latency/RSS/event-loop observations alongside the plan.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
