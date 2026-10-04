# Browser WASM stage

Status: cancelled by user instruction. Historical plan only; browser support is out of scope.
Back to [[plans/01-async-extraction-refactor/overview]]. The user initially requested lower-priority browser support, then cancelled it. The proposal below is historical context only; it does not schedule future implementation.

## Target design

- Reuse the pure Rust synchronous extraction engine, domain types and ocrs/rten OCR. Browser workers own scheduling; native CPU-pool assumptions stay in the native adapter.
- Prefer napi-rs's supported `wasm32-wasip1-threads` build and generated browser loader/runtime first. Audit all parser/OCR dependencies and Promise/scheduler compatibility before committing to this route.
- If that route cannot support the engine reliably, evaluate a separate wasm-bindgen worker adapter over the same core. Do not fork format logic or replace ocrs merely to work around bindings.
- Main-thread browser facade exposes async single/batch processing, shared options and ordered outcomes. Accept Uint8Array without requiring Node globals. Define explicit runtime initialization if necessary.
- Move module/model initialization and extraction into a worker where practical; measure startup and UI responsiveness as well as steady-state parsing.
- Bound request count, input/output bytes, worker count and OCR jobs. Account for generated runtime threads to avoid stacking two independent pools. Worker termination must settle pending calls and release resources.
- Default preserves caller-owned inputs. Do not detach a caller's ArrayBuffer implicitly. Internal copied buffers may be transferred to reduce redundant copying; shared runtime memory remains an internal implementation detail.
- Keep lazy OCR initialization; metadata-only should avoid model initialization. Measure embedded model download/module size before deciding whether browser models need separate assets. Retain ocrs in either packaging approach.

## Deployment and compatibility

- The napi-rs threaded browser route requires cross-origin isolation and SharedArrayBuffer. Document COOP/COEP, worker URLs and asset hosting; detect missing capabilities with actionable errors.
- Non-isolated browser support is not automatically provided by the generated route. Evaluate a single-worker non-threaded adapter only if the compatibility gate shows it is needed; report its supported concurrency honestly.
- Keep generated WASM/loaders/worker files together with correct URLs and package exports. Coordinate package/CI/Vite configuration with the user's tooling work.
- Test Chromium, Firefox and WebKit against supported fixtures before claiming support. No existing browser support is assumed: browser.js was absent and CI had no WASM target when inspected.

## Acceptance

- Native tests/performance remain passing and native delivery does not wait on this stage.
- All retained formats and image OCR have browser fixture tests, including metadata-only, corrupt input, ordered mixed batches and concurrent calls.
- Main-thread heartbeat/interaction continues during large extraction; admission, worker teardown and input ownership have direct tests.
- Compare native/browser normalized fixture outputs; omit timing from comparisons and document any genuine format differences rather than claiming automatic parity.
- Report WASM/model/worker asset sizes, cold/warm initialization, memory and batch throughput. Verify package contents and a real bundled consumer.
- Replace inaccurate browser docs only when implementation is validated; show actual async initialization, headers and deployment setup.

Sources: [napi-rs WASM/WASI](https://napi.rs/docs/concepts/webassembly) describes its threaded target, generated runtime assets and hosting requirements. [ocrs](https://github.com/robertknight/ocrs) documents WebAssembly capability; the entire undms dependency graph still needs validation.
