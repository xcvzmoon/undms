# Frequently asked questions

## Is extraction asynchronous?

Yes. `extract` returns a Promise for one outcome; `extractBatch` returns a Promise for ordered batch results. Native parsing runs off the JavaScript event loop, while initial input copying is synchronous.

## How do I inspect metadata without OCR?

Set `selection: ExtractionSelection.Metadata`. Leave statistics disabled to avoid text work. Image dimensions and available EXIF/GPS metadata do not require OCR models.

## Does it OCR scanned PDFs?

No. PDF processing extracts embedded text. OCR applies to supported image inputs through ocrs/rten.

## Are browser builds available?

No. This release supports the native Node.js API; browser/WASM support is outside its scope.

## Why did my request reject instead of returning an error outcome?

Invalid options, overload, whole-batch budget failures, and infrastructure failures throw or reject. Document failures resolve with `status: 'error'`. Handle both paths.

## Are input buffers retained while workers run?

Ordinary Buffer bytes are copied before worker processing. Caller mutations after the call cannot change the input. Shared-backed Buffers are rejected.

## Are limits a hard memory sandbox?

No. Third-party document parsers allocate internally. See [performance and limits](/advanced/performance) when processing untrusted inputs.

## What runtime is supported?

The native package requires Node.js 20 or later. CJS and ESM package-root imports are supported. Other runtimes require their own validation.
