# `@xcvzmoon/undms`

![https://github.com/xcvzmoon/undms/actions](https://github.com/xcvzmoon/undms/workflows/CI/badge.svg)

> Text and Metadata Extraction Library for Document Files with Text Similarity Comparison built with napi-rs.

## Installation

```bash
pnpm add @xcvzmoon/undms
```

## Purpose

This library is designed to extract text and metadata from various document formats (PDF, Word, Excel, etc.) and provide text similarity comparison capabilities. Currently in early development phase with basic functionality.

## Development

### Build

After `pnpm build` command, you can see `undms.[darwin|win32|linux].node` file in project root. This is the native addon built from [lib.rs](./src/lib.rs).

### Test

With [ava](https://github.com/avajs/ava), run `pnpm test` to test the native addon. You can also switch to another testing framework if you want.

### CI

With GitHub Actions, each commit and pull request will be built and tested automatically in [`node@20`, `@node22`] x [`macOS`, `Linux`, `Windows`] matrix. You will never be afraid of the native addon broken in these platforms.

### Release

Release native package is very difficult in old days. Native packages may ask developers who use it to install `build toolchain` like `gcc/llvm`, `node-gyp` or something more.

With `GitHub actions`, we can easily prebuild a `binary` for major platforms. And with `N-API`, we should never be afraid of **ABI Compatible**.

The other problem is how to deliver prebuilt `binary` to users. Downloading it in `postinstall` script is a common way that most packages do it right now. The problem with this solution is it introduced many other packages to download binary that has not been used by `runtime codes`. The other problem is some users may not easily download the binary from `GitHub/CDN` if they are behind a private network (But in most cases, they have a private NPM mirror).

In this package, we choose a better way to solve this problem. We release different `npm packages` for different platforms. And add it to `optionalDependencies` before releasing the `Major` package to npm.

`NPM` will choose which native package should download from `registry` automatically. You can see [npm](./npm) dir for details. And you can also run `pnpm add @xcvzmoon/undms` to see how it works.

## Development requirements

- Install the latest `Rust`
- Install `Node.js@12+` which fully supports `Node-API`
- Install `pnpm`

## Test in local

- pnpm install
- pnpm build
- pnpm test

## Release package

Ensure you have set your **NPM_TOKEN** in the `GitHub` project setting.

In `Settings -> Secrets`, add **NPM_TOKEN** into it.

When you want to release the package:

```bash
npm version [<newversion> | major | minor | patch | premajor | preminor | prepatch | prerelease [--preid=<prerelease-id>] | from-git]

git push
```

GitHub actions will do the rest job for you.

> WARN: Don't run `npm publish` manually.
