# Performance Optimization

Optimize undms for maximum performance in your applications.

## Performance Characteristics

Understanding the performance profile of each operation:

| Operation        | Typical Time | Factors                 |
| ---------------- | ------------ | ----------------------- |
| Text extraction  | ~0.5ms/file  | File size               |
| DOCX extraction  | ~3ms/file    | Paragraph count, tables |
| XLSX extraction  | ~4ms/file    | Sheets, rows, cells     |
| PDF extraction   | ~5ms/file    | Pages, content density  |
| Image (no OCR)   | ~2ms/file    | File size               |
| Image (with OCR) | ~50ms/file   | Resolution, text amount |
| Similarity check | ~0.1ms/pair  | Text length             |

## Batch Processing

Process multiple documents together for better throughput:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

// Good: Batch process
const files = ['./doc1.txt', './doc2.txt', './doc3.txt'];
const documents = files.map((path) => ({
  name: path,
  size: 100,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: fs.readFileSync(path),
}));

const results = extract(documents); // Single call
```

## Parallel Processing

undms automatically processes documents in parallel using Rayon:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

// Creates 100 test documents
const documents = Array.from({ length: 100 }, (_, i) => ({
  name: `doc_${i}.txt`,
  size: 1000,
  type: 'text/plain',
  lastModified: Date.now(),
  webkitRelativePath: '',
  buffer: Buffer.from(`Content for document ${i}`),
}));

const start = performance.now();
const results = extract(documents);
const elapsed = performance.now() - start;

console.log(`Processed 100 documents in ${elapsed.toFixed(2)}ms`);
```

## Memory Management

Handle large files efficiently:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

function processLargeDirectory(dirPath: string, maxMemoryMB = 512) {
  const maxBytes = maxMemoryMB * 1024 * 1024;
  let currentMemory = 0;
  const batch: any[] = [];
  const allResults = [];

  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (currentMemory + stats.size > maxBytes && batch.length > 0) {
      const results = extract(batch);
      allResults.push(...results);
      batch.length = 0;
      currentMemory = 0;
    }

    batch.push({
      name: file,
      size: stats.size,
      type: guessMimeType(file),
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer: fs.readFileSync(filePath),
    });

    currentMemory += stats.size;
  }

  if (batch.length > 0) {
    allResults.push(...extract(batch));
  }

  return allResults;
}
```

## Caching Results

Cache extraction results for repeated access:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as crypto from 'crypto';

interface CacheEntry {
  content: string;
  metadata: any;
  timestamp: number;
}

class ExtractionCache {
  private cache = new Map<string, CacheEntry>();
  private maxAge: number;

  constructor(maxAgeMinutes = 60) {
    this.maxAge = maxAgeMinutes * 60 * 1000;
  }

  private getKey(filePath: string, mimeType: string): string {
    const stats = fs.statSync(filePath);
    return crypto
      .createHash('md5')
      .update(`${filePath}:${stats.mtimeMs}:${stats.size}:${mimeType}`)
      .digest('hex');
  }

  get(filePath: string, mimeType: string) {
    const key = this.getKey(filePath, mimeType);
    const entry = this.cache.get(key);

    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.maxAge) {
      this.cache.delete(key);
      return null;
    }

    return entry;
  }

  set(filePath: string, mimeType: string, content: string, metadata: any) {
    const key = this.getKey(filePath, mimeType);
    this.cache.set(key, {
      content,
      metadata,
      timestamp: Date.now(),
    });
  }
}

const cache = new ExtractionCache();

function extractCached(filePath: string, mimeType: string) {
  const cached = cache.get(filePath, mimeType);

  if (cached) {
    return {
      name: filePath,
      content: cached.content,
      metadata: cached.metadata,
      cached: true,
    };
  }

  const buffer = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);

  const result = extract([
    {
      name: filePath,
      size: stats.size,
      type: mimeType,
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0]?.documents[0];

  if (doc) {
    cache.set(filePath, mimeType, doc.content, doc.metadata);
  }

  return { ...doc, cached: false };
}
```

## Streaming Large Files

Process large files without loading entirely into memory:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as stream from 'stream';
import { pipeline } from 'stream/promises';

async function processLargeFile(filePath: string, chunkSize = 1024 * 1024) {
  const stats = fs.statSync(filePath);
  const mimeType = guessMimeType(filePath);
  const results = [];

  for (let offset = 0; offset < stats.size; offset += chunkSize) {
    const fd = fs.openSync(filePath, 'r');
    const buffer = Buffer.alloc(chunkSize);
    fs.readSync(fd, buffer, 0, chunkSize, offset);
    fs.closeSync(fd);

    const result = extract([
      {
        name: filePath,
        size: chunkSize,
        type: mimeType,
        lastModified: stats.mtimeMs,
        webkitRelativePath: '',
        buffer,
      },
    ]);

    results.push(result[0]?.documents[0]?.content || '');
  }

  return results.join('');
}
```

## Optimizing Similarity Calculations

Make similarity checks faster:

```ts
import { computeTextSimilarity } from 'undms';

// Preprocess text for faster repeated comparisons
function preprocessForSimilarity(texts: string[]): string[] {
  return texts.map((text) =>
    text
      .toLowerCase()
      .replace(/[^\w\s]/g, '')
      .trim(),
  );
}

// Use the right method for your use case
function getOptimalMethod(textLength: number): string {
  if (textLength < 100) return 'levenshtein';
  if (textLength < 1000) return 'jaccard';
  return 'hybrid';
}

// Batch similarity checks
function findSimilarDocuments(target: string, corpus: string[], threshold: number) {
  const method = getOptimalMethod(target.length);
  const matches = computeTextSimilarity(target, corpus, threshold, method);
  return matches.map((m) => ({ index: m.referenceIndex, score: m.similarityPercentage }));
}
```

## Performance Monitoring

Monitor extraction performance:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface PerformanceMetrics {
  totalFiles: number;
  totalTime: number;
  avgTime: number;
  minTime: number;
  maxTime: number;
  byType: Record<string, { count: number; totalTime: number; avgTime: number }>;
}

function measurePerformance(files: { path: string; type: string }[]): PerformanceMetrics {
  const documents = files.map((f) => {
    const buffer = fs.readFileSync(f.path);
    const stats = fs.statSync(f.path);
    return {
      name: f.path,
      size: stats.size,
      type: f.type,
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    };
  });

  const results = extract(documents);

  const times: number[] = [];
  const byType: Record<string, number[]> = {};

  for (const group of results) {
    for (const doc of group.documents) {
      times.push(doc.processingTime);

      if (!byType[group.mimeType]) {
        byType[group.mimeType] = [];
      }
      byType[group.mimeType].push(doc.processingTime);
    }
  }

  const avg = (arr: number[]) => arr.reduce((a, b) => a + b, 0) / arr.length;

  return {
    totalFiles: times.length,
    totalTime: times.reduce((a, b) => a + b, 0),
    avgTime: avg(times),
    minTime: Math.min(...times),
    maxTime: Math.max(...times),
    byType: Object.fromEntries(
      Object.entries(byType).map(([type, typeTimes]) => ({
        count: typeTimes.length,
        totalTime: typeTimes.reduce((a, b) => a + b, 0),
        avgTime: avg(typeTimes),
      })),
    ),
  };
}
```

## Best Practices

1. **Batch documents** - Process multiple files in a single call
2. **Use appropriate MIME types** - Avoid handler lookup overhead
3. **Preprocess text** - Normalize for similarity comparisons
4. **Cache results** - Avoid reprocessing unchanged files
5. **Monitor memory** - Process large batches in chunks
6. **Choose right similarity method** - Jaccard for speed, hybrid for accuracy

## Benchmarking

Run your own benchmarks:

```ts
import { extract, computeTextSimilarity } from 'undms';

function benchmark(fn: () => void, iterations = 100) {
  const times: number[] = [];

  for (let i = 0; i < iterations; i++) {
    const start = performance.now();
    fn();
    times.push(performance.now() - start);
  }

  const avg = times.reduce((a, b) => a + b, 0) / times.length;
  const sorted = times.sort((a, b) => a - b);
  const p50 = sorted[Math.floor(sorted.length * 0.5)];
  const p95 = sorted[Math.floor(sorted.length * 0.95)];

  console.log({ avg: avg.toFixed(2), p50: p50.toFixed(2), p95: p95.toFixed(2) });
}

benchmark(() =>
  extract([
    {
      name: 'test.txt',
      size: 100,
      type: 'text/plain',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer: Buffer.from('test'),
    },
  ]),
);
```
