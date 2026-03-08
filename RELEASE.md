# Release v1.1.2

This release improves OCR reliability, adds ESM package support, and expands the project documentation.

## Highlights

### OCR reliability improvements

- Embedded OCR models directly in the package
- Added retry logic with preprocessing for image extraction failures
- Improved extraction resilience for image-based inputs

### ESM package support

- Added ESM-compatible package exports
- Generated both CommonJS and ESM loaders during the release build
- Preserved existing CommonJS support for `require('undms')`

### Documentation updates

- Added comprehensive API documentation
- Added VitePress-based project documentation
- Added GitHub Actions workflow for docs deployment
- Fixed GitHub Pages base path and documentation asset rendering

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

- Compare changes: https://github.com/xcvzmoon/undms/compare/v1.1.1...v1.1.2

## License

MIT
