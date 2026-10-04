# Phase 10: Introduce reusable bounded Office archive access

Status: Implemented in src/engine/archive.rs and namespace/property helpers in src/handlers/docx.rs. XLSX audits actual inflation before independent parsing; full archive/XML regressions remain part of final verification.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Introduce reusable bounded Office archive access. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/archive/mod.rs`
- `src/archive/xml.rs`
- `src/archive/relationships.rs`

Read required entries with running decompressed limits and entry checks; do not trust advertised sizes alone. Share namespace/entity/relationship handling without inventing an entire Office parser. Missing optional entries differ from corrupt required entries.

## Data structures

ArchiveBudget, relationship target and bounded XML reader.

## Verification

- Static: Rust XML/archive tests, checked offsets and errors.
- Runtime: Prove decompression limits, XML whitespace/entities/namespaces, malformed relationships, missing parts and safe relative target resolution.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
