# Phase 03: Prove reusable generated public types before parser migration

Status: Implemented: generated tagged unions, Promise declarations, and exhaustive TypeScript narrowing are present. Final rebuilt native verification is tracked in status.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Prove reusable generated public types before parser migration. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/api/types.rs`
- `src/api/convert.rs`
- `__test__/types.spec.ts`

Prototype actual napi v3 conversion and generation. Require narrowing without casts, predictable optional fields and Promise type support. Generated artifacts are build outputs beyond this source-file budget.

## Data structures

Napi input/outcome DTOs and generated tagged unions matching the domain contract.

## Verification

- Static: Build generated declarations; TS positive and negative type checks including mismatched metadata variants.
- Runtime: Round-trip each outcome/metadata variant in Node; verify optional versus empty values and safe-number overflow behavior.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
