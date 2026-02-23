# Extending undms

Customize and extend undms for specialized use cases.

## Architecture Overview

undms uses a handler-based architecture that allows easy extension:

```
Document → Handler Registry → [TextHandler, DocxHandler, XlsxHandler, PdfHandler, ImageHandler]
                    ↓
            ExtractionResult
```

## Handler Interface

Each handler implements the `DocumentHandler` trait:

```rust
pub trait DocumentHandler: Send + Sync {
    fn is_supported(&self, mime_type: &str) -> bool;
    fn extract(&self, buffer: &[u8]) -> ExtractionResult;
}
```

## Adding Custom Handlers (Rust)

To add support for a new format in the Rust core:

### 1. Create Handler Module

```rust
// src/handlers/epub.rs

use crate::core::handler::{DocumentHandler, ExtractionResult};
use crate::models::metadata::{MetadataPayload, TextMetadata};

pub struct EpubHandler;

impl EpubHandler {
    pub fn new() -> Self {
        Self
    }
}

impl DocumentHandler for EpubHandler {
    fn is_supported(&self, mime_type: &str) -> bool {
        mime_type == "application/epub+zip"
    }

    fn extract(&self, buffer: &[u8]) -> ExtractionResult {
        // Custom extraction logic
        let content = extract_epub_content(buffer);
        let metadata = build_epub_metadata(buffer);

        ExtractionResult {
            content: Some(content),
            encoding: Some("application/epub+zip".to_string()),
            metadata: Some(metadata),
            error: None,
        }
    }
}
```

### 2. Register Handler

```rust
// src/lib.rs

mod handlers;

use handlers::epub::EpubHandler;

fn create_handler_registry() -> HandlerRegistry {
    Arc::new(vec![
        Arc::new(TextHandler::new()),
        Arc::new(DocxHandler::new()),
        Arc::new(XlsxHandler::new()),
        Arc::new(PdfHandler::new()),
        Arc::new(ImageHandler::new()),
        Arc::new(EpubHandler::new()), // Add new handler
    ])
}
```

## Custom Metadata Types

Extend metadata with custom fields:

```rust
// Define custom metadata
pub struct EpubMetadata {
    pub title: Option<String>,
    pub author: Option<String>,
    pub chapter_count: usize,
    pub language: Option<String>,
}

// Add to MetadataPayload
pub struct MetadataPayload {
    pub text: Option<TextMetadata>,
    pub docx: Option<DocxMetadata>,
    pub xlsx: Option<XlsxMetadata>,
    pub pdf: Option<PdfMetadata>,
    pub image: Option<ImageMetadata>,
    pub epub: Option<EpubMetadata>, // Add custom metadata
}
```

## Preprocessing Pipeline

Add preprocessing before extraction:

```ts
import { extract } from 'undms';

interface Preprocessor {
  (buffer: Buffer, mimeType: string): Buffer;
}

const preprocessors: Preprocessor[] = [
  // Remove BOM
  (buffer, _) => {
    if (buffer[0] === 0xef && buffer[1] === 0xbb && buffer[2] === 0xbf) {
      return buffer.slice(3);
    }
    return buffer;
  },
  // Normalize line endings
  (buffer, type) => {
    if (type.startsWith('text/')) {
      return Buffer.from(buffer.toString().replace(/\r\n/g, '\n'));
    }
    return buffer;
  },
];

function extractWithPreprocessing(documents: any[]) {
  return documents.map((doc) => {
    let buffer = doc.buffer;

    for (const preprocess of preprocessors) {
      buffer = preprocess(buffer, doc.type);
    }

    return { ...doc, buffer };
  });
}

const results = extractWithPreprocessing(documents);
const extractionResults = extract(results);
```

## Post-Processing Pipeline

Add processing after extraction:

```ts
import { extract } from 'undms';

interface Postprocessor {
  (result: any): any;
}

const postprocessors: Postprocessor[] = [
  // Clean extracted text
  (result) => {
    if (result.metadata?.text) {
      return {
        ...result,
        content: result.content.replace(/\s+/g, ' ').trim(),
      };
    }
    return result;
  },
  // Add word frequency analysis
  (result) => {
    if (result.content) {
      const words = result.content.toLowerCase().split(/\s+/);
      const frequency: Record<string, number> = {};
      for (const word of words) {
        frequency[word] = (frequency[word] || 0) + 1;
      }
      return { ...result, wordFrequency: frequency };
    }
    return result;
  },
];

function extractWithPostprocessing(documents: any[]) {
  const results = extract(documents);

  return results.map((group) => ({
    ...group,
    documents: group.documents.map((doc) => {
      let processed = doc;
      for (const postprocess of postprocessors) {
        processed = postprocess(processed);
      }
      return processed;
    }),
  }));
}
```

## Custom Similarity Algorithms

Implement custom similarity methods:

```ts
import { computeTextSimilarity } from 'undms';

// Extend similarity with custom algorithm
function cosineSimilarity(source: string, references: string[], threshold = 30) {
  const sourceWords = tokenize(source);
  const sourceVector = buildVector(sourceWords);

  return references
    .map((ref, index) => {
      const refWords = tokenize(ref);
      const refVector = buildVector(refWords);

      const similarity = cosineSimilarityScore(sourceVector, refVector);
      const percentage = Math.round(similarity * 100);

      if (percentage >= threshold) {
        return { referenceIndex: index, similarityPercentage: percentage };
      }
      return null;
    })
    .filter(Boolean);
}

function tokenize(text: string): string[] {
  return text.toLowerCase().match(/\w+/g) || [];
}

function buildVector(words: string[]): Record<string, number> {
  const vector: Record<string, number> = {};
  for (const word of words) {
    vector[word] = (vector[word] || 0) + 1;
  }
  return vector;
}

function cosineSimilarityScore(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dotProduct = 0;
  let magnitudeA = 0;
  let magnitudeB = 0;

  for (const key of keys) {
    const valA = a[key] || 0;
    const valB = b[key] || 0;
    dotProduct += valA * valB;
    magnitudeA += valA * valA;
    magnitudeB += valB * valB;
  }

  return dotProduct / (Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB));
}
```

## Custom Result Types

Extend result types with custom data:

```ts
import { extract } from 'undms';

interface CustomDocumentMetadata {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: any;
  error?: string;
  // Custom fields
  wordCount?: number;
  characterCount?: number;
  summary?: string;
}

function extractWithAnalysis(documents: any[]): CustomDocumentMetadata[] {
  const results = extract(documents);

  return results.flatMap((group) =>
    group.documents.map((doc) => ({
      ...doc,
      wordCount: doc.content.split(/\s+/).length,
      characterCount: doc.content.length,
      summary: doc.content.substring(0, 100),
    })),
  );
}
```

## Plugin System

Create a plugin system for extensibility:

```ts
interface UndmsPlugin {
  name: string;
  version: string;
  preprocess?: (documents: any[]) => any[];
  postprocess?: (results: any[]) => any[];
  onError?: (error: Error, document: any) => void;
}

class PluginManager {
  private plugins: UndmsPlugin[] = [];

  register(plugin: UndmsPlugin) {
    this.plugins.push(plugin);
    console.log(`Plugin registered: ${plugin.name}`);
  }

  unregister(name: string) {
    this.plugins = this.plugins.filter((p) => p.name !== name);
  }

  applyPreprocess(documents: any[]) {
    let result = documents;
    for (const plugin of this.plugins) {
      if (plugin.preprocess) {
        result = plugin.preprocess(result);
      }
    }
    return result;
  }

  applyPostprocess(results: any[]) {
    let result = results;
    for (const plugin of this.plugins) {
      if (plugin.postprocess) {
        result = plugin.postprocess(result);
      }
    }
    return result;
  }
}

// Usage
const manager = new PluginManager();

manager.register({
  name: 'text-cleaner',
  version: '1.0.0',
  postprocess: (results) =>
    results.map((doc) => ({
      ...doc,
      content: doc.content.replace(/\s+/g, ' ').trim(),
    })),
});

const processedDocs = manager.applyPreprocess(documents);
const results = extract(processedDocs);
const finalResults = manager.applyPostprocess(results);
```

## Integration Examples

### With Express.js

```ts
import express from 'express';
import { extract } from 'undms';
import multer from 'multer';

const app = express();
const upload = multer({ dest: 'uploads/' });

app.post('/extract', upload.array('files'), (req, res) => {
  const documents = (req.files as any[]).map((file) => ({
    name: file.originalname,
    size: file.size,
    type: file.mimetype,
    lastModified: file.lastModifiedDate?.getTime() || Date.now(),
    webkitRelativePath: '',
    buffer: fs.readFileSync(file.path),
  }));

  const results = extract(documents);
  res.json(results);
});
```

### With Next.js API Routes

```ts
import type { NextRequest } from 'next/server';
import { extract } from 'undms';

export async function POST(request: NextRequest) {
  const formData = await request.formData();
  const files = formData.getAll('files') as File[];

  const documents = await Promise.all(
    files.map(async (file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: '',
      buffer: Buffer.from(await file.arrayBuffer()),
    })),
  );

  const results = extract(documents);
  return Response.json(results);
}
```

## Best Practices

1. **Handler isolation** - Keep handlers independent
2. **Error handling** - Always return valid ExtractionResult
3. **Metadata consistency** - Follow existing patterns
4. **Performance** - Consider memory and CPU usage
5. **Testing** - Test handlers thoroughly
6. **Documentation** - Document custom handlers
