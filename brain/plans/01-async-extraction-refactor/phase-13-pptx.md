# Phase 13: Extract slides in presentation order with faithful XML text

Status: Implementation present; final rebuilt regression and platform acceptance are tracked in status. The original verification checklist below is a target, not a claim that every listed probe ran.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Extract slides in presentation order with faithful XML text. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/handlers/pptx.rs`
- `__test__/pptx.spec.ts`
- `__test__/documents/pptx-reordered.pptx`

Use presentation relationship order, not filename sorting. Respect spaces/entities and expected namespaces; apply shared archive budgets and clarify malformed optional-property behavior.

## Data structures

PresentationMetadata, common properties and indexed slide warnings.

## Verification

- Static: Rust XML integration and public metadata type checks.
- Runtime: Prove reordered slides including two-digit filenames, run whitespace/entities, missing/malformed relationships, properties and partial warnings.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
