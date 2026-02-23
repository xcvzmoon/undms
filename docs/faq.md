# Frequently Asked Questions

Common questions about undms and their answers.

## General

### What is undms?

undms is a high-performance library for extracting text and metadata from various document formats. It supports PDF, DOCX, XLSX, plain text, and images with built-in similarity comparison features.

### Why use undms?

- **Performance** - Built with Rust using napi-rs for native Node.js speed
- **Multi-format** - Supports all major document types in a single API
- **Similarity** - Built-in algorithms for comparing documents
- **TypeScript** - Full type definitions included
- **Cross-platform** - Works on Windows, macOS, and Linux

### What versions of Node.js are supported?

undms supports:

- Node.js 12.22+ (excluding 13.x)
- Node.js 14.17+
- Node.js 15.12+
- Node.js 16+
- Bun

### Is undms free to use?

Yes, undms is released under the MIT License.

## Installation

### How do I install undms?

```bash
pnpm add undms
# or
npm install undms
# or
bun add undms
```

### Why am I getting installation errors?

1. **Missing build tools** - Ensure you have the required build tools:
   - Windows: Visual C++ Build Tools
   - macOS: Xcode Command Line Tools
   - Linux: build-essential, pkg-config

2. **Node.js version** - Make sure you're using a supported Node.js version

3. **Architecture** - Some platforms may not have pre-built binaries

### Can I use undms in the browser?

Yes! Use the browser-specific build:

```html
<script src="https://unpkg.com/undms/browser.js"></script>
```

See [Browser Usage](/advanced/browser-usage) for details.

## Usage

### How do I extract text from a PDF?

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./document.pdf');
const result = extract([
  {
    name: 'document.pdf',
    size: buffer.length,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

console.log(result[0].documents[0].content);
```

### How do I know what MIME type to use?

The MIME type should match the file format:

| Format | MIME Type                                                                 |
| ------ | ------------------------------------------------------------------------- |
| PDF    | `application/pdf`                                                         |
| DOCX   | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| XLSX   | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       |
| Text   | `text/plain`                                                              |
| JPEG   | `image/jpeg`                                                              |
| PNG    | `image/png`                                                               |

For web applications, you can use the `File.type` property.

### Why is my extraction returning empty content?

Possible reasons:

1. **Wrong MIME type** - Verify you're using the correct type
2. **Unsupported format** - Check if the format is supported
3. **Corrupted file** - The file may be damaged
4. **Password-protected** - undms cannot extract from encrypted files

### How do I extract metadata?

Metadata is included in the extraction results:

```ts
const result = extract([...]);
const metadata = result[0].documents[0].metadata;

// Access format-specific metadata
console.log(metadata?.text);     // For text files
console.log(metadata?.pdf);       // For PDFs
console.log(metadata?.docx);      // For DOCX
console.log(metadata?.xlsx);     // For XLSX
console.log(metadata?.image);    // For images
```

## Similarity

### Which similarity method should I use?

| Method        | Best For                         |
| ------------- | -------------------------------- |
| `jaccard`     | Fast comparison, large documents |
| `ngram`       | Fuzzy matching, typo tolerance   |
| `levenshtein` | Short strings, precise matching  |
| `hybrid`      | General purpose, best accuracy   |

The `hybrid` method is recommended for most use cases.

### What threshold should I use?

- **80-100%** - Near-exact matches
- **60-80%** - Close variations
- **40-60%** - Related content
- **20-40%** - Loose similarity

Adjust based on your use case. Higher thresholds reduce false positives.

### Why are similarity scores lower than expected?

Similarity scores depend on:

- Text length (shorter text = more variable scores)
- Algorithm choice (try different methods)
- Preprocessing (text normalization helps)

## Performance

### How fast is undms?

Performance varies by file type and size:

| Operation   | Typical Time |
| ----------- | ------------ |
| Text file   | ~0.5ms       |
| DOCX        | ~3ms         |
| XLSX        | ~4ms         |
| PDF         | ~5ms         |
| Image (OCR) | ~50ms        |

### How can I improve performance?

1. **Batch processing** - Process multiple files together
2. **Use correct MIME types** - Avoids handler lookup
3. **Preprocess text** - Normalize before comparison
4. **Cache results** - Avoid reprocessing unchanged files

See [Performance Optimization](/advanced/performance) for details.

### Why does OCR take so long?

OCR is computationally intensive because it analyzes image pixel data. To speed up:

- Resize large images before processing
- Use smaller resolution for text-only images
- Process images in parallel batches

## Errors

### Error: "Unsupported MIME type"

The file format isn't supported or the MIME type is incorrect. Check:

- File format is supported
- MIME type is correct
- File isn't corrupted

### Error: "File is corrupted"

The file may be:

- Incomplete or truncated
- Password protected
- Not actually that file type

### How do I handle errors gracefully?

```ts
const result = extract([...]);
const doc = result[0].documents[0];

if (doc.error) {
  console.error('Extraction failed:', doc.error);
} else {
  console.log('Content:', doc.content);
}
```

See [Error Handling](/examples/error-handling) for more patterns.

## Images

### Does undms support OCR?

Yes! undms can extract text from images using Tesseract OCR. Supported formats:

- JPEG
- PNG
- GIF
- BMP
- TIFF
- WebP

### Why is GPS location undefined?

Not all images contain GPS data. This is typically only available on:

- Photos from smartphones
- Images with EXIF location tags

### Can I extract images from DOCX files?

Currently, undms counts images in DOCX but doesn't extract the actual image files.

## Similarity

### Can I add custom similarity algorithms?

Yes! You can implement custom similarity functions in JavaScript/TypeScript:

```ts
function customSimilarity(source: string, references: string[]) {
  // Your implementation
  return references.map((ref, i) => ({
    referenceIndex: i,
    similarityPercentage: calculateScore(source, ref),
  }));
}
```

See [Extensibility](/advanced/extensibility) for more details.

### Does similarity work with Unicode?

Yes! All similarity methods fully support Unicode text including:

- Japanese
- Chinese
- Korean
- Arabic
- Emoji

## Contributing

### How can I contribute?

1. Fork the repository
2. Make your changes
3. Run tests: `pnpm test`
4. Run linting: `pnpm lint`
5. Submit a pull request

### How do I add support for a new format?

1. Create a new handler in `src/handlers/`
2. Implement the `DocumentHandler` trait
3. Register the handler in `src/lib.rs`
4. Add tests
5. Update documentation

See [Extensibility](/advanced/extensibility) for detailed instructions.

## Troubleshooting

### Native module not loading

If you see errors about native modules:

1. Rebuild the package:

   ```bash
   pnpm build
   ```

2. Clear node_modules and reinstall:
   ```bash
   rm -rf node_modules
   pnpm install
   ```

### Memory issues with large files

Process large files in batches:

```ts
// Process in chunks of 100 files
for (let i = 0; i < files.length; i += 100) {
  const batch = files.slice(i, i + 100);
  extract(batch);
}
```

### TypeScript errors

Make sure you have TypeScript installed and your tsconfig includes the types:

```json
{
  "compilerOptions": {
    "types": ["node"]
  }
}
```

## Getting Help

- **GitHub Issues**: Report bugs and request features
- **GitHub Discussions**: Ask questions and share solutions
- **NPM Package**: https://www.npmjs.com/package/undms
