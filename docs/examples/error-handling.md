# Error Handling

Handle errors gracefully when extracting documents and computing similarity.

## Basic Error Handling

Check for errors in extraction results:

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

const doc = result[0]?.documents[0];

if (doc?.error) {
  console.error('Extraction failed:', doc.error);
} else {
  console.log('Extracted content:', doc?.content);
}
```

## Handling Multiple Document Errors

Process results and collect errors:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const files = ['./valid.pdf', './corrupted.pdf', './valid.docx', './empty.txt'];

const documents = files.map((path) => {
  const buffer = fs.readFileSync(path);
  const stats = fs.statSync(path);
  return {
    name: path,
    size: stats.size,
    type: guessMimeType(path),
    lastModified: stats.mtimeMs,
    webkitRelativePath: '',
    buffer,
  };
});

const results = extract(documents);

const errors: { file: string; error: string }[] = [];
const successes: { file: string; wordCount: number }[] = [];

for (const group of results) {
  for (const doc of group.documents) {
    if (doc.error) {
      errors.push({ file: doc.name, error: doc.error });
    } else {
      successes.push({
        file: doc.name,
        wordCount: doc.metadata?.text?.wordCount || 0,
      });
    }
  }
}

console.log(`Processed: ${successes.length} successful, ${errors.length} failed`);

if (errors.length > 0) {
  console.log('\nErrors:');
  errors.forEach(({ file, error }) => console.log(`  ${file}: ${error}`));
}
```

## Retry Logic

Implement retry logic for failed extractions:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface RetryOptions {
  maxRetries: number;
  initialDelay: number;
  backoffMultiplier: number;
}

async function extractWithRetry(
  filePath: string,
  mimeType: string,
  options: RetryOptions = { maxRetries: 3, initialDelay: 1000, backoffMultiplier: 2 },
) {
  let lastError: Error | null = null;
  let delay = options.initialDelay;

  for (let attempt = 1; attempt <= options.maxRetries; attempt++) {
    try {
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

      if (doc?.error) {
        throw new Error(doc.error);
      }

      return doc;
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e));
      console.warn(`Attempt ${attempt}/${options.maxRetries} failed: ${lastError.message}`);

      if (attempt < options.maxRetries) {
        await new Promise((r) => setTimeout(r, delay));
        delay *= options.backoffMultiplier;
      }
    }
  }

  throw new Error(`Failed after ${options.maxRetries} attempts: ${lastError?.message}`);
}
```

## Graceful Degradation

Continue processing even when some documents fail:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ProcessingResult {
  filename: string;
  success: boolean;
  content?: string;
  metadata?: any;
  error?: string;
  fallback?: string;
}

function processDocuments(files: string[]): ProcessingResult[] {
  return files.map((filePath) => {
    try {
      const buffer = fs.readFileSync(filePath);
      const stats = fs.statSync(filePath);
      const mimeType = guessMimeType(filePath);

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

      if (doc?.error) {
        return {
          filename: filePath,
          success: false,
          error: doc.error,
          fallback: 'Could not extract content',
        };
      }

      return {
        filename: filePath,
        success: true,
        content: doc?.content,
        metadata: doc?.metadata,
      };
    } catch (e) {
      return {
        filename: filePath,
        success: false,
        error: e instanceof Error ? e.message : 'Unknown error',
        fallback: 'File could not be read',
      };
    }
  });
}

// Process and collect results
const results = processDocuments(['./doc1.pdf', './doc2.pdf', './doc3.docx']);

// Use successful results, handle failures
const successful = results.filter((r) => r.success);
const failed = results.filter((r) => !r.success);

console.log(`Success: ${successful.length}, Failed: ${failed.length}`);
```

## Error Recovery Strategies

Different strategies for handling errors:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

enum RecoveryStrategy {
  Skip = 'skip',
  Fallback = 'fallback',
  Retry = 'retry',
  Default = 'default',
}

interface DocumentResult {
  name: string;
  content: string;
  strategy: RecoveryStrategy;
  error?: string;
}

function processWithRecovery(
  files: { path: string; type: string; required: boolean }[],
  strategy: RecoveryStrategy,
): DocumentResult[] {
  return files.map(({ path, type, required }) => {
    try {
      const buffer = fs.readFileSync(path);
      const stats = fs.statSync(path);

      const result = extract([
        {
          name: path,
          size: stats.size,
          type,
          lastModified: stats.mtimeMs,
          webkitRelativePath: '',
          buffer,
        },
      ]);

      const doc = result[0]?.documents[0];

      if (doc?.error) {
        return handleError(path, doc.error, required, strategy);
      }

      return {
        name: path,
        content: doc?.content || '',
        strategy: RecoveryStrategy.Skip,
      };
    } catch (e) {
      return handleError(
        path,
        e instanceof Error ? e.message : 'Unknown error',
        required,
        strategy,
      );
    }
  });
}

function handleError(
  path: string,
  error: string,
  required: boolean,
  strategy: RecoveryStrategy,
): DocumentResult {
  switch (strategy) {
    case RecoveryStrategy.Skip:
      return { name: path, content: '', strategy, error };

    case RecoveryStrategy.Fallback:
      return {
        name: path,
        content: '[Content extraction failed - using placeholder]',
        strategy,
        error,
      };

    case RecoveryStrategy.Retry:
      // Retry logic would go here
      return { name: path, content: '', strategy, error };

    case RecoveryStrategy.Default:
      if (required) {
        throw new Error(`Required file ${path} failed: ${error}`);
      }
      return { name: path, content: '', strategy, error };

    default:
      return { name: path, content: '', strategy, error };
  }
}
```

## Logging Errors

Implement proper error logging:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ErrorLog {
  timestamp: Date;
  filename: string;
  mimeType: string;
  error: string;
  size: number;
}

const errorLogs: ErrorLog[] = [];

function extractWithLogging(files: { path: string; type: string }[]) {
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

  for (const group of results) {
    for (const doc of group.documents) {
      if (doc.error) {
        errorLogs.push({
          timestamp: new Date(),
          filename: doc.name,
          mimeType: group.mimeType,
          error: doc.error,
          size: doc.size,
        });

        console.error(`[ERROR] ${doc.name}: ${doc.error}`);
      }
    }
  }

  return results;
}

// Log summary at the end
process.on('exit', () => {
  if (errorLogs.length > 0) {
    console.log('\n--- Error Summary ---');
    console.log(`Total errors: ${errorLogs.length}`);
    console.log('Errors by type:');

    const byType = errorLogs.reduce(
      (acc, log) => {
        acc[log.mimeType] = (acc[log.mimeType] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>,
    );

    console.log(byType);
  }
});
```

## Validation Before Extraction

Validate files before processing:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ValidationResult {
  valid: boolean;
  error?: string;
}

function validateFile(filePath: string, mimeType: string): ValidationResult {
  try {
    const stats = fs.statSync(filePath);

    if (!stats.isFile()) {
      return { valid: false, error: 'Not a file' };
    }

    if (stats.size === 0) {
      return { valid: false, error: 'File is empty' };
    }

    if (stats.size > 100 * 1024 * 1024) {
      return { valid: false, error: 'File exceeds 100MB limit' };
    }

    const supportedTypes = [
      'text/plain',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'image/jpeg',
      'image/png',
    ];

    if (!supportedTypes.includes(mimeType)) {
      return { valid: false, error: `Unsupported MIME type: ${mimeType}` };
    }

    return { valid: true };
  } catch (e) {
    return {
      valid: false,
      error: e instanceof Error ? e.message : 'Unknown error',
    };
  }
}

function extractWithValidation(files: { path: string; type: string }[]) {
  const validFiles: typeof files = [];
  const invalidFiles: { path: string; error: string }[] = [];

  for (const file of files) {
    const validation = validateFile(file.path, file.type);

    if (validation.valid) {
      validFiles.push(file);
    } else {
      invalidFiles.push({ path: file.path, error: validation.error! });
    }
  }

  if (invalidFiles.length > 0) {
    console.warn('Skipped invalid files:');
    invalidFiles.forEach((f) => console.warn(`  ${f.path}: ${f.error}`));
  }

  if (validFiles.length === 0) {
    return [];
  }

  const documents = validFiles.map((f) => {
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

## Custom Error Types

Create custom error types for better error handling:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

class ExtractionError extends Error {
  constructor(
    message: string,
    public filename: string,
    public mimeType: string,
    public code?: string,
  ) {
    super(message);
    this.name = 'ExtractionError';
  }
}

class UnsupportedFormatError extends ExtractionError {
  constructor(filename: string, mimeType: string) {
    super(`Unsupported format: ${mimeType}`, filename, mimeType, 'UNSUPPORTED_FORMAT');
    this.name = 'UnsupportedFormatError';
  }
}

class CorruptedFileError extends ExtractionError {
  constructor(filename: string, originalError: string) {
    super(`File corrupted: ${originalError}`, filename, '', 'CORRUPTED_FILE');
    this.name = 'CorruptedFileError';
  }
}

function extractStrict(files: { path: string; type: string }[]) {
  return files.map((file) => {
    const buffer = fs.readFileSync(file.path);
    const stats = fs.statSync(file.path);

    if (!isSupported(file.type)) {
      throw new UnsupportedFormatError(file.path, file.type);
    }

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

    if (doc?.error) {
      throw new CorruptedFileError(file.path, doc.error);
    }

    return doc;
  });
}
```

## Global Error Handler

Set up global error handling for uncaught exceptions:

```ts
import { extract } from 'undms';

process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error.message);
  console.error(error.stack);
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

function safeExtract(documents: any[]) {
  try {
    return extract(documents);
  } catch (e) {
    console.error('Extraction failed:', e);
    return [];
  }
}
```
