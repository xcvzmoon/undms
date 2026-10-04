# Phase 12: Preserve spreadsheet coordinates and expose partial sheet failures

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Preserve spreadsheet coordinates and expose partial sheet failures. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/xlsx.rs`
- `__test__/xlsx.spec.ts`
- `__test__/documents/xlsx-sparse.xlsx`

Keep Calamine; preserve empty positions and deterministic sheet/row separators. Fix sheet count/name consistency. Reject legacy XLS explicitly unless separately implemented. Avoid duplicate workbook traversal when requesting both outputs.

## Data structures

SpreadsheetMetadata and SheetMetadata with explicit occupied counts/used extents.

## Verification

- Static: Rust checks and metadata narrowing type checks.
- Runtime: Prove sparse dimensions/delimiters, empty/ordered sheets, corrupt-sheet partial output, declared XLS rejection and selection behavior.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
