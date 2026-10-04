# Phase 06: Build and choose the bounded CPU scheduler and Promise bridge

Status: Implemented: napi future bridge to a bounded Rayon CPU pool and a dedicated non-reentrant OCR thread/channel. Queued cancellation retains its reservation until discarded by a worker; cold concurrent OCR has a fresh-process regression. Strict fairness and the full environment-teardown matrix remain outside claimed guarantees.

Back to [[plans/01-async-extraction-refactor/overview]].

## Goal

Build and choose the bounded CPU scheduler and Promise bridge. Follow the contract and architecture companion notes; earlier gates are prerequisites.

## Changes

- `src/engine/scheduler.rs`
- `src/api/async_bridge.rs`
- `Cargo.toml`

Prototype AsyncTask against dedicated Rayon pool plus supported napi Promise bridge. Select dedicated pool if contention/overhead/lifecycle evidence supports it. Bound jobs/bytes, release permits on every path, avoid blocking pool coordinators and nested execution. Cargo lock and native generation are artifacts.

## Data structures

Scheduler, AdmissionPermit, owned job/completion channel and immutable worker configuration.

## Verification

- Static: Rust scheduler tests, Clippy and actual napi feature/build compatibility.
- Runtime: Deterministic tests prove caps, admission release, fair refill, dropped completion/shutdown and no deadlock; Node probe compares fs/timer interference and CPU overhead.

Keep at most five logical checks in this checkpoint; split implementation follow-ups if more files or independent changes emerge. Do not freeze known incorrect output or mirror implementation internals in tests.

## Execution

Use the current workspace/branch and the current Codex session. No model/provider switch is required. Use execute and testing; apply ts-best-practices for TypeScript changes. Generated bindings are rebuilt outputs, never manual edits.
