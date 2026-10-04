# Phase 14: Make PDF page failures and metadata decoding explicit

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Make PDF page failures and metadata decoding explicit. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/pdf.rs`
- `__test__/pdf.spec.ts`
- `__test__/documents/pdf-edge-cases.pdf`

Enumerate once; benchmark all-page versus ordered per-page library extraction. Preserve errors and metadata on partial text failure. Handle indirect Info dictionaries, PDF string encodings and inherited boxes. Apply enforceable output/page-work budgets without promising scanned-PDF OCR.

## Data structures

PdfMetadata with page dimensions in points and indexed extraction warnings.

## Verification

- Static: Rust PDF tests and safe conversions.
- Runtime: Prove page order/partial failure, encoded properties, inherited boxes, empty/encrypted malformed cases and selection behavior.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
