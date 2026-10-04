# Agent Guidelines for undms Repository

This document provides guidelines for agentic coding agents working on the undms (Document Text and Metadata Extraction Library) codebase.

## Development Commands

### Build Commands

- pnpm build - Build native addon for current platform in release mode
- pnpm build:debug - Build native addon for current platform in debug mode
- pnpm artifacts - Generate build artifacts for distribution

### Test Commands

- pnpm test - Run all tests using AVA test runner
- pnpm test <test-file\> - Run a specific test file (e.g., pnpm test **test**/index.spec.ts)
- Tests are located in **test**/ directory and use TypeScript with .spec.ts extension

### Lint and Format Commands

- pnpm lint - Run oxlint with type-aware checking
- vp run fmt - Format all files (runs oxfmt, cargo fmt, and taplo format in parallel)
- vp run fmt:oxfmt - Format JavaScript/TypeScript/JSON files with oxfmt
- vp run fmt:rs - Format Rust code with cargo fmt
- vp run fmt:toml - Format TOML files with taplo format

### Other Commands

- pnpm bench - Run benchmarks
- pnpm changelog - Generate changelog
- pnpm prepare - Set up husky git hooks

## Project Structure

### Core Files

- src/lib.rs - Rust native library code using napi-rs
- index.js - Generated Node.js binding loader (auto-generated, do not edit)
- index.d.ts - TypeScript definitions (auto-generated, do not edit)
- **test**/index.spec.ts - Test files

### Configuration

- .oxfmtrc.jsonc - Formatter configuration for oxfmt
- .oxlintrc.json - Linter configuration for oxlint
- Cargo.toml - Rust project configuration
- package.json - Node.js project configuration using pnpm

## Code Style Guidelines

### JavaScript/TypeScript

- Package Manager: Use pnpm exclusively
- Imports: Use ES6 import/export syntax. Import sorting is handled by oxfmt with specific groups: types → side-effect → builtin → external → internal → parent → sibling → index
- Strings: Use single quotes consistently
- Indentation: 2 spaces (configured in .editorconfig)
- Line Endings: LF (Unix-style)
- Trailing Whitespace: Remove all trailing whitespace
- Files: End files with final newline

### Rust Code

- Clippy: All clippy lints are denied (#![deny(clippy::all)])
- Naming: Use snake_case for functions (e.g., plus_100)
- NAPI Functions: Use #[napi] derive macro for Node.js exports
- Edition: Rust 2021 edition

## TypeScript Definitions

- TypeScript definitions are auto-generated from Rust code
- Do not manually edit index.d.ts
- Function names follow Rust naming (snake_case) in definitions

## Testing Guidelines

- Use AVA test runner
- Test files should be in **test**/ directory with .spec.ts extension
- Tests use ES modules syntax
- Use test() function from AVA
- Follow pattern: descriptive test names with t.is() for assertions

## Error Handling

- Rust functions should handle errors appropriately before exposing to Node.js
- Use Result types in Rust for error handling
- TypeScript functions should have proper error type definitions

## Native Addon Development

- This project uses napi-rs for building native Node.js addons
- Cross-platform compilation is handled automatically
- Supported platforms: Windows (x64, arm64), macOS (x64, arm64, universal), Linux (x64, arm64)
- Build targets are configured in package.json under napi.targets

## Git Hooks

- Pre-commit hook runs lint-staged to ensure code quality
- Staged files are automatically formatted and linted before commit
- Do not bypass git hooks

## Performance Considerations

- Release builds use LTO (Link Time Optimization) and strip symbols
- Benchmarks should be placed in benchmark/ directory
- Use pnpm bench to run performance tests

## Package Publishing

- Use semantic versioning
- Version updates trigger automated builds via npm scripts
- Platform-specific packages are published as optional dependencies
- Do not manually run npm publish - use version scripts instead

## Development Workflow

1. Install dependencies: pnpm install
2. Make changes to Rust code in src/lib.rs
3. Build: pnpm build
4. Test: pnpm test
5. Format and lint: vp run fmt and vp run lint
6. Commit (hooks will run lint-staged automatically)

## File Naming Conventions

- Rust source: src/lib.rs
- Tests: **test**/\*.spec.ts
- Config: ._rc._ for configuration files
- Use kebab-case for file names where applicable

## Dependencies

- Node.js runtime dependencies are minimal (only what's needed for the native binding)
- Development dependencies include testing, linting, and build tools
- Rust dependencies are minimal: napi and napi-derive for Node.js bindings

<!--VITE PLUS START-->

# Using Vite+, the Unified Toolchain for the Web

This project is using Vite+, a unified toolchain built on top of Vite, Rolldown, Vitest, tsdown, Oxlint, Oxfmt, and Vite Task. Vite+ wraps runtime management, package management, and frontend tooling in a single global CLI called `vp`. Vite+ is distinct from Vite, and it invokes Vite through `vp dev` and `vp build`. Run `vp help` to print a list of commands and `vp <command> --help` for information about a specific command.

Docs are local at `node_modules/vite-plus/docs` or online at https://viteplus.dev/guide/.

## Built-in Commands vs Scripts

`vp <name>` runs a built-in command. `vp run <name>` runs a `package.json` script or a `vite.config.ts` task. Scripts cannot overwrite built-ins, so `vp dev` and `vp run dev` may do different things. Check `package.json` and `vite.config.ts` first, and run `vp run <name>` when the project defines a script or task with that name.

## Tool Versions

Run `vp toolchain` to show versions and relationships in the active Vite+
release. Add a tool name to select part of the graph. For example, run
`vp toolchain vite`. Use `--global` to ignore the local `vite-plus` package. Use
`vp why <package>` to show the package-manager dependency graph.

## Review Checklist

- [ ] Run `vp install` after pulling remote changes and before getting started.
- [ ] Run `vp check` and `vp test` to format, lint, type check and test changes.
- [ ] Check if there are `vite.config.ts` tasks or `package.json` scripts necessary for validation, run via `vp run <script>`.
- [ ] If setup, runtime, or package-manager behavior looks wrong, run `vp env doctor` and include its output when asking for help.

<!--VITE PLUS END-->
