# Phase 18: Migrate extraction consumers and remove comparison documentation

Status: Implemented: native integration consumers, awaited benchmarks, README/docs/navigation and generated declarations migrated. Documentation production build passes; final rebuild/test/lint status is tracked separately.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Migrate extraction consumers and remove comparison documentation. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `__test__/index.spec.ts`
- `benchmark/bench-documents.ts`
- `README.md`

This phase is a sequence of small edits: first migrate these three files; then individual remaining benchmark files; then docs/API/example pages and navigation in groups of at most three. Delete obsolete comparison suites/pages. Coordinate package scripts/description/keywords with user; never overwrite their tooling changes. No arbitrary binary chunk-streaming examples.

## Data structures

New consumer-facing extraction contract and awaited benchmark samples.

## Verification

- Static: Full TS checks, lint and regenerated native exports/types; comparison rg inventory reviewed.
- Runtime: Run full extraction suites through CJS/ESM; await every benchmark callback; exercise documented single/batch/error examples and build docs.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
