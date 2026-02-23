# Batch Processing

Process multiple documents efficiently with batch operations.

## Processing Multiple Files

Process multiple documents in parallel:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

function extractAllFiles(dirPath: string) {
  const files = fs.readdirSync(dirPath);
  const documents = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) continue;

    const buffer = fs.readFileSync(filePath);
    const ext = path.extname(file).toLowerCase();

    documents.push({
      name: file,
      size: stats.size,
      type: getMimeType(ext),
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    });
  }

  return extract(documents);
}

function getMimeType(ext: string): string {
  const types: Record<string, string> = {
    '.txt': 'text/plain',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  };
  return types[ext] || 'application/octet-stream';
}

const results = extractAllFiles('./documents');
console.log(`Processed ${results.reduce((sum, g) => sum + g.documents.length, 0)} files`);
```

## Batch Processing with Progress

Process large batches with progress tracking:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface Progress {
  total: number;
  processed: number;
  succeeded: number;
  failed: number;
}

async function processWithProgress(
  files: { path: string; type: string }[],
  onProgress?: (progress: Progress) => void,
): Promise<{ path: string; content: string; error?: string }[]> {
  const results: { path: string; content: string; error?: string }[] = [];
  const progress: Progress = {
    total: files.length,
    processed: 0,
    succeeded: 0,
    failed: 0,
  };

  const batchSize = 10;

  for (let i = 0; i < files.length; i += batchSize) {
    const batch = files.slice(i, i + batchSize);
    const documents = batch.map((f) => {
      const buffer = fs.readFileSync(f.path);
      return {
        name: f.path,
        size: buffer.length,
        type: f.type,
        lastModified: Date.now(),
        webkitRelativePath: '',
        buffer,
      };
    });

    const batchResults = extract(documents);

    for (let j = 0; j < batch.length; j++) {
      const doc = batchResults[0]?.documents[j];
      progress.processed++;

      if (doc?.error) {
        progress.failed++;
        results.push({ path: batch[j].path, content: '', error: doc.error });
      } else {
        progress.succeeded++;
        results.push({ path: batch[j].path, content: doc?.content || '' });
      }

      onProgress?.(progress);
    }
  }

  return results;
}

// Usage with progress bar
const files = [
  { path: './doc1.pdf', type: 'application/pdf' },
  {
    path: './doc2.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  // ... more files
];

await processWithProgress(files, (p) => {
  const percent = ((p.processed / p.total) * 100).toFixed(1);
  console.log(`Progress: ${percent}% (${p.processed}/${p.total})`);
});
```

## Processing by Type

Group and process documents by MIME type:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface DocumentsByType {
  [mimeType: string]: {
    name: string;
    size: number;
    type: string;
    lastModified: number;
    webkitRelativePath: string;
    buffer: Buffer;
  }[];
}

function groupByType(files: { path: string; type: string }[]): DocumentsByType {
  const groups: DocumentsByType = {};

  for (const file of files) {
    const buffer = fs.readFileSync(file.path);
    const stats = fs.statSync(file.path);

    if (!groups[file.type]) {
      groups[file.type] = [];
    }

    groups[file.type].push({
      name: file.path,
      size: stats.size,
      type: file.type,
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    });
  }

  return groups;
}

function processByType(files: { path: string; type: string }[]) {
  const groups = groupByType(files);
  const results: { type: string; content: string }[] = [];

  for (const [mimeType, documents] of Object.entries(groups)) {
    console.log(`Processing ${documents.length} ${mimeType} files...`);
    const result = extract(documents);

    for (const group of result) {
      for (const doc of group.documents) {
        results.push({
          type: doc.name,
          content: doc.content,
        });
      }
    }
  }

  return results;
}
```

## Parallel Processing with Worker Threads

For CPU-intensive operations:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';
import { Worker } from 'worker_threads';

interface WorkerResult {
  filename: string;
  content: string;
  success: boolean;
  error?: string;
}

function processInWorker(filePath: string, type: string): Promise<WorkerResult> {
  return new Promise((resolve) => {
    const worker = new Worker(
      `
      const { parentPort } = require('worker_threads');
      const fs = require('fs');
      
      parentPort.on('message', (data) => {
        const buffer = fs.readFileSync(data.path);
        const result = extract([{
          name: data.path,
          size: buffer.length,
          type: data.type,
          lastModified: Date.now(),
          webkitRelativePath: '',
          buffer,
        }]);
        
        parentPort.postMessage({
          filename: data.path,
          content: result[0]?.documents[0]?.content || '',
          success: !result[0]?.documents[0]?.error,
          error: result[0]?.documents[0]?.error,
        });
      });
      `,
      { eval: true },
    );

    worker.postMessage({ path: filePath, type });

    worker.on('message', (result: WorkerResult) => {
      resolve(result);
      worker.terminate();
    });

    worker.on('error', (error) => {
      resolve({ filename: filePath, content: '', success: false, error: error.message });
      worker.terminate();
    });
  });
}

async function processFilesParallel(files: { path: string; type: string }[], concurrency = 4) {
  const results: WorkerResult[] = [];

  for (let i = 0; i < files.length; i += concurrency) {
    const batch = files.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map((f) => processInWorker(f.path, f.type)));
    results.push(...batchResults);
  }

  return results;
}
```

## Memory-Efficient Streaming

Process large numbers of files without loading all into memory:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

async function* streamFiles(dirPath: string): AsyncGenerator<{ path: string; type: string }> {
  const files = fs.readdirSync(dirPath);

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) continue;

    const ext = path.extname(file).toLowerCase();
    yield {
      path: filePath,
      type: getMimeType(ext),
    };
  }
}

async function processStream(dirPath: string, batchSize = 50) {
  const stream = streamFiles(dirPath);
  let batch: { path: string; type: string }[] = [];
  let totalProcessed = 0;

  for await (const file of stream) {
    batch.push(file);

    if (batch.length >= batchSize) {
      const results = processBatch(batch);
      totalProcessed += results.length;
      console.log(`Processed ${totalProcessed} files...`);
      batch = [];
    }
  }

  if (batch.length > 0) {
    const results = processBatch(batch);
    totalProcessed += results.length;
  }

  return totalProcessed;
}

function processBatch(files: { path: string; type: string }[]) {
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

  return extract(documents);
}
```

## Error-Tolerant Batch Processing

Continue processing even when some files fail:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface BatchResult {
  filename: string;
  success: boolean;
  content?: string;
  error?: string;
  processingTime?: number;
}

function processWithErrors(files: { path: string; type: string }[]): BatchResult[] {
  const results: BatchResult[] = [];

  for (const file of files) {
    try {
      const buffer = fs.readFileSync(file.path);
      const stats = fs.statSync(file.path);

      const result = extract([
        {
          name: file.path,
          size: stats.size,
          type: file.type,
          lastModified: stats.mtimeMs,
          webkitRelativePath: '',
          buffer,
        },
      ]);

      const doc = result[0]?.documents[0];

      results.push({
        filename: file.path,
        success: !doc?.error,
        content: doc?.content,
        error: doc?.error,
        processingTime: doc?.processingTime,
      });
    } catch (e) {
      results.push({
        filename: file.path,
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
      });
    }
  }

  return results;
}

// Generate report
const results = processWithErrors(files);

const succeeded = results.filter((r) => r.success).length;
const failed = results.filter((r) => !r.success).length;

console.log(`Batch Complete: ${succeeded} succeeded, ${failed} failed`);

if (failed > 0) {
  console.log('\nFailed files:');
  results.filter((r) => !r.success).forEach((r) => console.log(`  - ${r.filename}: ${r.error}`));
}
```

## Rate Limiting

Throttle processing for resource-constrained environments:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

async function processWithRateLimit(files: { path: string; type: string }[], maxPerSecond: number) {
  const delay = 1000 / maxPerSecond;
  let lastRun = Date.now();
  const results = [];

  for (const file of files) {
    const now = Date.now();
    const elapsed = now - lastRun;

    if (elapsed < delay) {
      await new Promise((r) => setTimeout(r, delay - elapsed));
    }

    const buffer = fs.readFileSync(file.path);
    const stats = fs.statSync(file.path);

    const result = extract([
      {
        name: file.path,
        size: stats.size,
        type: file.type,
        lastModified: stats.mtimeMs,
        webkitRelativePath: '',
        buffer,
      },
    ]);

    results.push(result[0]?.documents[0]);
    lastRun = Date.now();
  }

  return results;
}

// Process max 10 files per second
await processWithRateLimit(files, 10);
```
