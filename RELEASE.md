# Release v1.2.0

This release fixes a native image OCR initialization failure that could abort the host process and improves runtime resilience for TypeScript consumers.

## Highlights

### OCR initialization reliability

- Deferred OCR engine initialization until image extraction is actually used
- Replaced panic-based model loading with normal extraction errors
- Prevented Node.js and Bun processes from aborting when OCR model loading fails

### Image extraction behavior

- Preserved existing OCR extraction behavior for valid image inputs
- Continued returning structured extraction errors through the API surface
- Kept embedded OCR models and preprocessing-based OCR retries from the previous release

## Installation

```bash
bun add undms
# or
npm install undms
# or
pnpm add undms
```

## Usage

### CommonJS

```js
const { extract } = require('undms');
```

### ESM

```js
import { extract } from 'undms';
```

## Platform Support

Pre-built binaries for:

- Windows x64
- macOS x64 (Intel)
- macOS ARM64 (Apple Silicon)
- Linux x64

## Requirements

- Node.js 12.22.0+ or Bun

## Changelog

- Compare changes: https://github.com/xcvzmoon/undms/compare/v1.1.2...v1.2.0

## License

MIT
