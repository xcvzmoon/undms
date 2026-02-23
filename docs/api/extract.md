# extract

Extracts text and metadata from input documents, grouped by MIME type.

## Function Signature

```ts
function extract(documents: Document[]): GroupedDocuments[];
```

## Parameters

| Parameter   | Type         | Required | Description                          |
| ----------- | ------------ | -------- | ------------------------------------ |
| `documents` | `Document[]` | Yes      | Array of document objects to process |

## Returns

`GroupedDocuments[]` — An array of grouped documents, where each group contains documents of the same MIME type.

## Example

### Basic Usage

```ts
import { extract } from 'undms';

const result = extract([
  {
    name: 'note.txt',
    size: 12,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('hello world!'),
  },
]);

console.log(result[0].documents[0].content);
// 'hello world!'

console.log(result[0].documents[0].metadata?.text?.wordCount);
// 2
```

### Multiple Documents

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'report.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('First document content'),
  },
  {
    name: 'data.xlsx',
    size: 2048,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(xlsxBuffer),
  },
  {
    name: 'document.pdf',
    size: 4096,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfBuffer),
  },
];

const results = extract(documents);

// Results are grouped by MIME type
for (const group of results) {
  console.log(`MIME Type: ${group.mimeType}`);
  for (const doc of group.documents) {
    console.log(`  - ${doc.name}: ${doc.content.substring(0, 50)}...`);
  }
}
```

### Reading from Files

```ts
import { extract } from 'undms';
import * as fs from 'fs';

function extractFile(filePath: string, mimeType: string) {
  const buffer = fs.readFileSync(filePath);
  return extract([
    {
      name: filePath,
      size: buffer.length,
      type: mimeType,
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);
}

const pdfResult = extractFile('./document.pdf', 'application/pdf');
const docxResult = extractFile(
  './document.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
);
```

### Web File Upload

```ts
import { extract } from 'undms';

async function handleFileUpload(file: File) {
  const buffer = await file.arrayBuffer();

  const result = extract([
    {
      name: file.name,
      size: file.size,
      type: file.type,
      lastModified: file.lastModified,
      webkitRelativePath: '',
      buffer: Buffer.from(buffer),
    },
  ]);

  return result[0].documents[0];
}

const fileInput = document.querySelector('input[type="file"]');
fileInput.addEventListener('change', async (e) => {
  const file = e.target.files[0];
  const doc = await handleFileUpload(file);
  console.log(doc.content);
});
```

### Processing Large Batches

```ts
import { extract } from 'undms';

async function processDirectory(dirPath: string) {
  const fs = await import('fs/promises');
  const path = await import('path');

  const files = await fs.readdir(dirPath);
  const documents = [];

  for (const file of files) {
    const filePath = path.join(dirPath, file);
    const stats = await fs.stat(filePath);
    const buffer = await fs.readFile(filePath);

    documents.push({
      name: file,
      size: stats.size,
      type: getMimeType(file),
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    });
  }

  // Process in batches of 100
  const batchSize = 100;
  const results = [];

  for (let i = 0; i < documents.length; i += batchSize) {
    const batch = documents.slice(i, i + batchSize);
    const batchResults = extract(batch);
    results.push(...batchResults);
  }

  return results;
}

function getMimeType(filename: string): string {
  const ext = filename.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    txt: 'text/plain',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
```

## Error Handling

```ts
import { extract } from 'undms';

const documents = [
  {
    name: 'corrupted.pdf',
    size: 100,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('not a real PDF'),
  },
];

const results = extract(documents);
const doc = results[0].documents[0];

if (doc.error) {
  console.error(`Extraction failed: ${doc.error}`);
  console.log('Falling back to empty content');
} else {
  console.log(`Content: ${doc.content}`);
}
```

## Performance Notes

- Documents are processed in parallel for optimal performance
- Processing time is included in the result (`processingTime`)
- Large files may take longer to process, especially images with OCR
