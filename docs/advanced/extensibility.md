# Extending the Rust engine

Format handlers implement the portable Rust `DocumentHandler` trait and return `ExtractionResult<HandlerOutput>`. The shared domain types contain options, metadata, structured errors, and warnings without napi-rs dependencies.

A handler should respect text/metadata/statistics selection, enforce output limits while constructing text, and distinguish document errors from recoverable partial-content warnings. New handlers also require format detection, tagged metadata conversion, generated TypeScript declarations, and tests for selection and malformed documents.

The published JavaScript API does not expose a runtime handler-registration hook. Extend the Rust source and rebuild bindings when adding formats. Keep common properties and statistics reusable rather than adding another optional format bag.
