# Phase 21: Add bounded browser single and batch processing

Status: cancelled by user instruction. Historical plan only; browser support is out of scope.
Back to [[plans/01-async-extraction-refactor/overview]]. Depends on phase 20's validated binding choice.

## Goal

Expose shared extraction semantics through a responsive browser worker adapter.

## Changes

- `browser/client.ts`
- `browser/worker.ts`
- `browser/protocol.ts`

Implement explicit initialization if required, Uint8Array normalization and safe ownership, shared options/outcomes, ordered batch correlation, finite admission and worker lifecycle. Separate runtime-generated workers from any facade coordinator to avoid oversubscription. Add contract tests in a separate focused follow-up using the browser test infrastructure selected with the user.

## Data structures

Tagged worker request/completion messages, request IDs and browser runtime configuration. Reuse extraction outcomes; do not create competing format metadata definitions.

## Verification

- Static: Type-check message narrowing and shared contract; generated browser assets resolve; native tests continue passing.
- Runtime: Prove UI heartbeat, input preservation, mixed-batch order/error isolation, overload/termination behavior and metadata-only versus cold/warm OCR.

## Execution

Use execute/testing and ts-best-practices. Browser checks use available product-native preview tools where applicable; automated cross-browser CI is a separate delivery gate.
