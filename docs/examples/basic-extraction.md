# Basic Extraction

Learn the fundamentals of extracting text from various document formats.

## Simple Text Extraction

The most basic usage of undms is extracting text from plain text files:

```ts
import { extract } from 'undms';

const result = extract([
  {
    name: 'hello.txt',
    size: 13,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Hello, World!'),
  },
]);

console.log(result[0].documents[0].content);
// "Hello, World!"
```

## Reading Files from Disk

A common pattern is reading files from the filesystem:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

function extractFile(filePath: string): string {
  const buffer = fs.readFileSync(filePath);
  const mimeType = getMimeType(filePath);

  const result = extract([
    {
      name: filePath,
      size: buffer.length,
      type: mimeType,
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  return result[0].documents[0].content;
}

function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const types: Record<string, string> = {
    txt: 'text/plain',
    md: 'text/plain',
    json: 'application/json',
    xml: 'application/xml',
    html: 'text/html',
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
  };
  return types[ext || ''] || 'application/octet-stream';
}

const content = extractFile('./document.txt');
console.log(content);
```

## Extracting from Multiple Files

Process multiple files at once:

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

function extractDirectory(dirPath: string) {
  const files = fs.readdirSync(dirPath);
  const documents = files.map((file) => {
    const filePath = path.join(dirPath, file);
    const buffer = fs.readFileSync(filePath);
    const stats = fs.statSync(filePath);

    return {
      name: file,
      size: stats.size,
      type: getMimeType(file),
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    };
  });

  return extract(documents);
}

const results = extractDirectory('./documents');

results.forEach((group) => {
  console.log(`\n=== ${group.mimeType} ===`);
  group.documents.forEach((doc) => {
    console.log(`File: ${doc.name}`);
    console.log(`Content: ${doc.content.substring(0, 50)}...`);
    console.log(`Time: ${doc.processingTime.toFixed(2)}ms`);
  });
});
```

## Extracting PDF Content

Extract text from PDF files:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

function extractPdf(pdfPath: string) {
  const buffer = fs.readFileSync(pdfPath);

  const result = extract([
    {
      name: pdfPath,
      size: buffer.length,
      type: 'application/pdf',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];

  return {
    content: doc.content,
    metadata: doc.metadata?.pdf,
    processingTime: doc.processingTime,
  };
}

const pdf = extractPdf('./report.pdf');

console.log('PDF Content:');
console.log(pdf.content);

console.log('\nPDF Metadata:');
console.log(`  Pages: ${pdf.metadata?.pageCount}`);
console.log(`  Title: ${pdf.metadata?.title}`);
console.log(`  Author: ${pdf.metadata?.author}`);
```

## Extracting DOCX Content

Extract text from Microsoft Word documents:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

function extractDocx(docxPath: string) {
  const buffer = fs.readFileSync(docxPath);

  const result = extract([
    {
      name: docxPath,
      size: buffer.length,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];

  return {
    content: doc.content,
    metadata: doc.metadata?.docx,
  };
}

const docx = extractDocx('./document.docx');

console.log('DOCX Content:');
console.log(docx.content);

console.log('\nDOCX Statistics:');
console.log(`  Paragraphs: ${docx.metadata?.paragraphCount}`);
console.log(`  Tables: ${docx.metadata?.tableCount}`);
console.log(`  Images: ${docx.metadata?.imageCount}`);
console.log(`  Hyperlinks: ${docx.metadata?.hyperlinkCount}`);
```

## Extracting XLSX Content

Extract text from Excel spreadsheets:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

function extractXlsx(xlsxPath: string) {
  const buffer = fs.readFileSync(xlsxPath);

  const result = extract([
    {
      name: xlsxPath,
      size: buffer.length,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];

  return {
    content: doc.content,
    metadata: doc.metadata?.xlsx,
  };
}

const xlsx = extractXlsx('./spreadsheet.xlsx');

console.log('XLSX Content:');
console.log(xlsx.content);

console.log('\nXLSX Statistics:');
console.log(`  Sheets: ${xlsx.metadata?.sheetCount}`);
console.log(`  Sheet Names: ${xlsx.metadata?.sheetNames.join(', ')}`);
console.log(`  Total Rows: ${xlsx.metadata?.rowCount}`);
console.log(`  Total Cells: ${xlsx.metadata?.cellCount}`);
```

## Web File Upload

Handle file uploads in web applications:

```ts
import { extract } from 'undms';

async function handleUpload(file: File) {
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

// HTML: <input type="file" id="fileInput" />
const fileInput = document.getElementById('fileInput') as HTMLInputElement;

fileInput.addEventListener('change', async () => {
  const file = fileInput.files?.[0];
  if (!file) return;

  const doc = await handleUpload(file);

  document.getElementById('result')!.innerHTML = `
    <h3>Extracted Content</h3>
    <pre>${doc.content}</pre>
    <p>Processing time: ${doc.processingTime.toFixed(2)}ms</p>
  `;
});
```

## Processing Drag and Drop

Handle drag and drop file uploads:

```ts
import { extract } from 'undms';

const dropZone = document.getElementById('dropZone')!;

dropZone.addEventListener('dragover', (e) => {
  e.preventDefault();
  dropZone.classList.add('drag-over');
});

dropZone.addEventListener('dragleave', () => {
  dropZone.classList.remove('drag-over');
});

dropZone.addEventListener('drop', async (e) => {
  e.preventDefault();
  dropZone.classList.remove('drag-over');

  const files = e.dataTransfer?.files;
  if (!files) return;

  const documents = Array.from(files).map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    webkitRelativePath: '',
    buffer: Buffer.from(await file.arrayBuffer()),
  }));

  const results = extract(documents);

  displayResults(results);
});

function displayResults(results: any[]) {
  const container = document.getElementById('results')!;
  container.innerHTML = '';

  results.forEach((group) => {
    const groupDiv = document.createElement('div');
    groupDiv.innerHTML = `<h3>${group.mimeType}</h3>`;

    group.documents.forEach((doc: any) => {
      const docDiv = document.createElement('div');
      docDiv.innerHTML = `
        <p><strong>${doc.name}</strong></p>
        <pre>${doc.content.substring(0, 200)}...</pre>
      `;
      groupDiv.appendChild(docDiv);
    });

    container.appendChild(groupDiv);
  });
}
```

## CLI Tool Example

Create a simple command-line extraction tool:

```ts
#!/usr/bin/env ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

const args = process.argv.slice(2);

if (args.length === 0) {
  console.log('Usage: extract <file1> [file2] ...');
  process.exit(1);
}

const documents = args.map((filePath) => {
  const buffer = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);

  return {
    name: path.basename(filePath),
    size: stats.size,
    type: getMimeType(filePath),
    lastModified: stats.mtimeMs,
    webkitRelativePath: '',
    buffer,
  };
});

const results = extract(documents);

results.forEach((group) => {
  console.log(`\n${'='.repeat(50)}`);
  console.log(`MIME Type: ${group.mimeType}`);
  console.log('='.repeat(50));

  group.documents.forEach((doc) => {
    console.log(`\n--- ${doc.name} ---`);
    console.log(doc.content);
  });
});

function getMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  const types: Record<string, string> = {
    '.txt': 'text/plain',
    '.md': 'text/plain',
    '.json': 'application/json',
    '.pdf': 'application/pdf',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
  };
  return types[ext] || 'application/octet-stream';
}
```
