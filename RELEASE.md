# Release v1.5.0

This release note documents the changes included in `undms` v1.5.0.

## Highlights

### Format support

- Added native `.pptx` extraction support via a dedicated handler
- Extract visible slide text only for PowerPoint presentations; speaker notes are not included
- Added PPTX metadata extraction for title, author, subject, and slide count
- Added fixture-backed PPTX coverage for extraction, grouping, and similarity tests

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
- Linux x64 (glibc)
- Linux x64 (musl)
- Linux ARM64 (glibc)

## Requirements

- Node.js 20+ or Bun

## Release Process

1. Update the version as needed.
2. Create a release commit such as `chore(release): bump 1.5.0`.
3. Push the commit to `main`.
4. GitHub Actions publishes all generated platform packages, then publishes the root `undms` package.

## Changelog

- Compare changes: https://github.com/xcvzmoon/undms/compare/v1.4.0...v1.5.0

## License

MIT
