# Changelog


## v1.4.0

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.2.0...v1.4.0)

### 🚀 Enhancements

- **ci:** Expand native target coverage and align Node support ([832514e](https://github.com/xcvzmoon/undms/commit/832514e))
- **ci:** Expand native target coverage and add publish workflow ([e242104](https://github.com/xcvzmoon/undms/commit/e242104))

### 🔥 Performance

- **core:** Remove DashMap aggregation and precompute similarity reference metadata ([d680904](https://github.com/xcvzmoon/undms/commit/d680904))
- **similarity:** Reduce ngram normalization allocations and fix Unicode length handling ([2f82d4d](https://github.com/xcvzmoon/undms/commit/2f82d4d))
- **metadata:** Compute text metadata in a single pass and clone image metadata structs ([4080668](https://github.com/xcvzmoon/undms/commit/4080668))
- **text:** Add UTF-8 fast path before charset detection ([79690ec](https://github.com/xcvzmoon/undms/commit/79690ec))
- **pdf:** Reuse parsed document for text and metadata extraction ([1a6227c](https://github.com/xcvzmoon/undms/commit/1a6227c))
- **xlsx:** Build row text directly without temporary join allocations ([2b91e11](https://github.com/xcvzmoon/undms/commit/2b91e11))
- **image:** Make OCR variants lazy, add early exit, and preserve metadata on OCR failure ([8001fcc](https://github.com/xcvzmoon/undms/commit/8001fcc))

### 🩹 Fixes

- **ci:** Trigger publishing from chore(release) bump commits ([40e1fa5](https://github.com/xcvzmoon/undms/commit/40e1fa5))
- **ci:** Allow docs workflow to install with split package deps ([6a1737f](https://github.com/xcvzmoon/undms/commit/6a1737f))
- **ci:** Disable frozen lockfile for split package installs ([5779261](https://github.com/xcvzmoon/undms/commit/5779261))
- Remove double DOCX parse ([9394f79](https://github.com/xcvzmoon/undms/commit/9394f79))
- Use character counts for levenshtein/hybrid normalization ([d1fe4d1](https://github.com/xcvzmoon/undms/commit/d1fe4d1))

### 🏡 Chore

- **release:** Bump 1.3.0 ([980e78f](https://github.com/xcvzmoon/undms/commit/980e78f))
- **release:** Bump 1.3.0 ([0ad6091](https://github.com/xcvzmoon/undms/commit/0ad6091))
- **bench:** Replace monolithic benchmark entrypoint with split benchmark guidance ([e770f14](https://github.com/xcvzmoon/undms/commit/e770f14))
- **bench:** Add shared benchmark helpers and fixture builders ([46e15ea](https://github.com/xcvzmoon/undms/commit/46e15ea))
- **bench:** Add focused text extraction benchmark ([9debaa7](https://github.com/xcvzmoon/undms/commit/9debaa7))
- **bench:** Add focused similarity benchmark ([df78315](https://github.com/xcvzmoon/undms/commit/df78315))
- **bench:** Add focused image extraction benchmark ([3f6fc72](https://github.com/xcvzmoon/undms/commit/3f6fc72))
- **bench:** Add focused document extraction benchmarks ([3982e61](https://github.com/xcvzmoon/undms/commit/3982e61))
- **scripts:** Add split benchmark commands for targeted perf runs ([0bcb2c5](https://github.com/xcvzmoon/undms/commit/0bcb2c5))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.3.0

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.2.0...v1.3.0)

### 🚀 Enhancements

- **ci:** Expand native target coverage and align Node support ([832514e](https://github.com/xcvzmoon/undms/commit/832514e))
- **ci:** Expand native target coverage and add publish workflow ([e242104](https://github.com/xcvzmoon/undms/commit/e242104))

### 🩹 Fixes

- **ci:** Trigger publishing from chore(release) bump commits ([40e1fa5](https://github.com/xcvzmoon/undms/commit/40e1fa5))
- **ci:** Allow docs workflow to install with split package deps ([6a1737f](https://github.com/xcvzmoon/undms/commit/6a1737f))
- **ci:** Disable frozen lockfile for split package installs ([5779261](https://github.com/xcvzmoon/undms/commit/5779261))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.2.0

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.1.2...v1.2.0)

### 🩹 Fixes

- **image:** Avoid aborting process on OCR model load failure ([bc83392](https://github.com/xcvzmoon/undms/commit/bc83392))

### 🏡 Chore

- Add release for v1.1.2 ([2397d7d](https://github.com/xcvzmoon/undms/commit/2397d7d))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.1.2

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.1.1...v1.1.2)

### 🩹 Fixes

- **image:** Embed OCR models and retry extraction with preprocessing ([ad916da](https://github.com/xcvzmoon/undms/commit/ad916da))

### 📖 Documentation

- Update ci link ([69022fc](https://github.com/xcvzmoon/undms/commit/69022fc))
- Add comprehensive API documentation ([135e0b0](https://github.com/xcvzmoon/undms/commit/135e0b0))
- Add VitePress documentation ([99789c2](https://github.com/xcvzmoon/undms/commit/99789c2))
- Add GitHub Actions workflow for VitePress deployment ([6d80ccc](https://github.com/xcvzmoon/undms/commit/6d80ccc))
- Fix base path for GitHub Pages deployment ([6f021ef](https://github.com/xcvzmoon/undms/commit/6f021ef))
- Fix VitePress hero image path and features rendering ([cde5a00](https://github.com/xcvzmoon/undms/commit/cde5a00))

### 🏡 Chore

- Ignore vitepress output ([3768900](https://github.com/xcvzmoon/undms/commit/3768900))
- Support esm build ([3cc7fdc](https://github.com/xcvzmoon/undms/commit/3cc7fdc))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.1.1

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.0.0...v1.1.1)

### 🏡 Chore

- Add artifacts dir ([d4bbf45](https://github.com/xcvzmoon/undms/commit/d4bbf45))
- **ci:** Update build and tests ([49f5915](https://github.com/xcvzmoon/undms/commit/49f5915))
- Update package config ([e550740](https://github.com/xcvzmoon/undms/commit/e550740))
- **release:** Bump 1.1.0 ([51cc3fb](https://github.com/xcvzmoon/undms/commit/51cc3fb))
- Bump optional deps ([22cfe5d](https://github.com/xcvzmoon/undms/commit/22cfe5d))
- Remove optional dependencies ([4592694](https://github.com/xcvzmoon/undms/commit/4592694))

### 🤖 CI

- Remove publish ([d011c1a](https://github.com/xcvzmoon/undms/commit/d011c1a))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.1.0

[compare changes](https://github.com/xcvzmoon/undms/compare/v1.0.0...v1.1.0)

### 🏡 Chore

- Add artifacts dir ([d4bbf45](https://github.com/xcvzmoon/undms/commit/d4bbf45))
- **ci:** Update build and tests ([49f5915](https://github.com/xcvzmoon/undms/commit/49f5915))
- Update package config ([e550740](https://github.com/xcvzmoon/undms/commit/e550740))

### 🤖 CI

- Remove publish ([d011c1a](https://github.com/xcvzmoon/undms/commit/d011c1a))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>

## v1.0.0


### 🚀 Enhancements

- Initialize repository ([9639403](https://github.com/xcvzmoon/undms/commit/9639403))
- Add agents ([65a23a6](https://github.com/xcvzmoon/undms/commit/65a23a6))
- Add core modules ([1c3951e](https://github.com/xcvzmoon/undms/commit/1c3951e))
- Add handlers modules ([6abd9e8](https://github.com/xcvzmoon/undms/commit/6abd9e8))
- Add models modules ([9e62a55](https://github.com/xcvzmoon/undms/commit/9e62a55))
- Add ml model for image detection and recognition ([5595a85](https://github.com/xcvzmoon/undms/commit/5595a85))
- Add tests ([9537209](https://github.com/xcvzmoon/undms/commit/9537209))

### 🩹 Fixes

- **ci:** Setup pnpm action ([2e344ba](https://github.com/xcvzmoon/undms/commit/2e344ba))
- **ci:** Update pnpm supported architectures configuration ([398203a](https://github.com/xcvzmoon/undms/commit/398203a))
- **ci:** Simplify dependency installation in CI workflow ([ed87f71](https://github.com/xcvzmoon/undms/commit/ed87f71))
- **ci:** Enable corepack and update pnpm before running tests ([80c5996](https://github.com/xcvzmoon/undms/commit/80c5996))
- Replace pdf-extract with lopdf text extraction for Windows support ([6b8364e](https://github.com/xcvzmoon/undms/commit/6b8364e))
- Upgrade lopdf to 0.39.0 for Windows PDF extraction ([2ce66a7](https://github.com/xcvzmoon/undms/commit/2ce66a7))

### 📖 Documentation

- Update documentation ([caeef6d](https://github.com/xcvzmoon/undms/commit/caeef6d))

### 🏡 Chore

- **oxfmt:** Ignore index augment file ([a2229cc](https://github.com/xcvzmoon/undms/commit/a2229cc))
- Update readme ([807f138](https://github.com/xcvzmoon/undms/commit/807f138))
- Implement usage ([fe357de](https://github.com/xcvzmoon/undms/commit/fe357de))
- Update benchmarks ([f39c6ce](https://github.com/xcvzmoon/undms/commit/f39c6ce))
- Update license info ([f97ab98](https://github.com/xcvzmoon/undms/commit/f97ab98))
- Update package contents ([ef56d84](https://github.com/xcvzmoon/undms/commit/ef56d84))
- Rebuild to the latest version ([aef3e45](https://github.com/xcvzmoon/undms/commit/aef3e45))
- Update oxfmt config ([f6f8057](https://github.com/xcvzmoon/undms/commit/f6f8057))
- Mark binary files for prevent le corruption ([dc4f213](https://github.com/xcvzmoon/undms/commit/dc4f213))

### ❤️ Contributors

- Mon Albert Gamil <mrgamilmonalbert@gmail.com>
