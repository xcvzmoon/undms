# Phase 11: Recover body text faithfully through recursive DOCX extraction

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Recover body text faithfully through recursive DOCX extraction. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/docx.rs`
- `__test__/docx.spec.ts`
- `__test__/documents/docx-structure.docx`

Compare recursive docx-rs traversal with selective streaming helper. Include table cells, nested tables, hyperlink runs and breaks/tabs in one traversal; counts reflect documented scope. Record header/footer/notes/tracked-change exclusions.

## Data structures

WordDocumentMetadata and common properties; body extraction scope.

## Verification

- Static: Rust checks and generated metadata types.
- Runtime: Exact-output fixtures prove tables/hyperlinks, paragraph/break order, text-only/metadata-only, counts and malformed archive outcomes.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
