# Phase 19: Tune proven hot paths and finish correctness/performance review

Status: Incomplete: final native correctness and measured performance acceptance are still in progress. Do not infer acceptance from implementation presence or earlier samples.

Status: local native assessment complete. See [[plans/01-async-extraction-refactor/performance-results]]. Cross-platform CI, broader corpus coverage and existing tooling failures are documented limitations, not claimed passes.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Tune proven hot paths and finish correctness/performance review. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `benchmark/bench-optimization.ts`
- `benchmark/common.ts`
- `brain/plans/01-async-extraction-refactor/performance-results.md`

Measure before optimizing. Tune only observed allocations/repeated parsing/scheduling costs in separate small format-specific follow-ups. Remove transitional adapters/old models in focused cleanup groups and reconcile final architecture docs. Do not mix speculative library replacements into final tuning.

## Data structures

Baseline comparison report and measured worker/limit defaults.

## Verification

- Static: Full Rust formatting/Clippy/tests, native builds, TS checks and repository checks using current migrated tools.
- Runtime: Run full matrix from verification.md; demonstrate responsiveness, finite admission, output accuracy, no material unexplained regressions and representative platform smoke tests.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
