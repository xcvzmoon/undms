# Metadata Extraction

Learn how to extract rich metadata from various document formats.

## Understanding Metadata

Each document type has specific metadata that can be extracted:

- **Text files**: Line count, word count, character count
- **DOCX**: Paragraphs, tables, images, hyperlinks
- **XLSX**: Sheets, rows, columns, cells
- **PDF**: Title, author, pages, page size
- **Images**: Dimensions, EXIF data, GPS location

## Text File Metadata

Extract statistics from plain text:

```ts
import { extract } from 'undms';

const result = extract([
  {
    name: 'document.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(`Line one
Line two
Line three

Line five`),
  },
]);

const metadata = result[0].documents[0].metadata?.text;

console.log('Text Statistics:');
console.log(`  Lines: ${metadata?.lineCount}`);
console.log(`  Words: ${metadata?.wordCount}`);
console.log(`  Characters: ${metadata?.characterCount}`);
console.log(`  Non-whitespace: ${metadata?.nonWhitespaceCharacterCount}`);
```

## DOCX Metadata

Extract detailed information from Word documents:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./report.docx');

const result = extract([
  {
    name: 'report.docx',
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

const docx = result[0].documents[0].metadata?.docx;

console.log('DOCX Document Statistics:');
console.log(`  Paragraphs: ${docx?.paragraphCount}`);
console.log(`  Tables: ${docx?.tableCount}`);
console.log(`  Images: ${docx?.imageCount}`);
console.log(`  Hyperlinks: ${docx?.hyperlinkCount}`);
```

### Real-World Example: Document Analysis

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface DocumentAnalysis {
  filename: string;
  type: string;
  paragraphs: number;
  tables: number;
  images: number;
  hyperlinks: number;
  wordCount: number;
  processingTime: number;
}

function analyzeDocx(filePath: string): DocumentAnalysis {
  const buffer = fs.readFileSync(filePath);

  const result = extract([
    {
      name: filePath,
      size: buffer.length,
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];
  const docx = doc.metadata?.docx;
  const text = doc.metadata?.text;

  return {
    filename: filePath,
    type: 'DOCX',
    paragraphs: docx?.paragraphCount || 0,
    tables: docx?.tableCount || 0,
    images: docx?.imageCount || 0,
    hyperlinks: docx?.hyperlinkCount || 0,
    wordCount: text?.wordCount || 0,
    processingTime: doc.processingTime,
  };
}

const analysis = analyzeDocx('./document.docx');
console.log(analysis);
```

## XLSX Metadata

Extract spreadsheet structure:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./spreadsheet.xlsx');

const result = extract([
  {
    name: 'spreadsheet.xlsx',
    size: buffer.length,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

const xlsx = result[0].documents[0].metadata?.xlsx;

console.log('Spreadsheet Statistics:');
console.log(`  Sheet Count: ${xlsx?.sheetCount}`);
console.log(`  Sheet Names: ${xlsx?.sheetNames.join(', ')}`);
console.log(`  Total Rows: ${xlsx?.rowCount}`);
console.log(`  Max Columns: ${xlsx?.columnCount}`);
console.log(`  Total Cells: ${xlsx?.cellCount}`);
```

### Real-World Example: Excel Inventory Report

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ExcelReport {
  filename: string;
  sheets: string[];
  totalDataPoints: number;
  structure: {
    rows: number;
    columns: number;
    cells: number;
  };
  processingTime: number;
}

function analyzeExcel(filePath: string): ExcelReport {
  const buffer = fs.readFileSync(filePath);

  const result = extract([
    {
      name: filePath,
      size: buffer.length,
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      lastModified: Date.now(),
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];
  const xlsx = doc.metadata?.xlsx;

  return {
    filename: filePath,
    sheets: xlsx?.sheetNames || [],
    totalDataPoints: xlsx?.cellCount || 0,
    structure: {
      rows: xlsx?.rowCount || 0,
      columns: xlsx?.columnCount || 0,
      cells: xlsx?.cellCount || 0,
    },
    processingTime: doc.processingTime,
  };
}

const report = analyzeExcel('./inventory.xlsx');
console.log(`
File: ${report.filename}
Sheets: ${report.sheets.length}
Data Points: ${report.totalDataPoints}
Structure: ${report.structure.rows} rows × ${report.structure.columns} columns
Processing Time: ${report.processingTime.toFixed(2)}ms
`);
```

## PDF Metadata

Extract document properties from PDFs:

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

const pdf = result[0].documents[0].metadata?.pdf;

console.log('PDF Document Info:');
console.log(`  Title: ${pdf?.title || 'N/A'}`);
console.log(`  Author: ${pdf?.author || 'N/A'}`);
console.log(`  Subject: ${pdf?.subject || 'N/A'}`);
console.log(`  Producer: ${pdf?.producer || 'N/A'}`);
console.log(`  Page Count: ${pdf?.pageCount}`);
console.log(`  Page Size: ${pdf?.pageSize?.width}" × ${pdf?.pageSize?.height}"`);
```

### Real-World Example: Academic Paper Metadata

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface PaperMetadata {
  title: string;
  author: string;
  pages: number;
  content: string;
}

function extractPaperMetadata(pdfPath: string): PaperMetadata {
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
  const pdf = doc.metadata?.pdf;

  return {
    title: pdf?.title || 'Untitled',
    author: pdf?.author || 'Unknown',
    pages: pdf?.pageCount || 0,
    content: doc.content,
  };
}

const paper = extractPaperMetadata('./paper.pdf');

console.log(`
╔══════════════════════════════════════╗
║  ${paper.title}
║  ${paper.author}
║  Pages: ${paper.pages}
╚══════════════════════════════════════╝

Preview:
${paper.content.substring(0, 300)}...
`);
```

## Combined Metadata Extraction

Extract all available metadata from multiple documents:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface FullMetadata {
  filename: string;
  mimeType: string;
  size: number;
  processingTime: number;
  text?: {
    lines: number;
    words: number;
    characters: number;
  };
  docx?: {
    paragraphs: number;
    tables: number;
    images: number;
  };
  xlsx?: {
    sheets: number;
    rows: number;
    cells: number;
  };
  pdf?: {
    title?: string;
    author?: string;
    pages: number;
  };
  image?: {
    width: number;
    height: number;
    format?: string;
    camera?: string;
    location?: { lat: number; lng: number };
  };
}

function extractAllMetadata(filePath: string, mimeType: string): FullMetadata {
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

  const doc = result[0].documents[0];
  const meta = doc.metadata;

  return {
    filename: filePath,
    mimeType,
    size: stats.size,
    processingTime: doc.processingTime,
    text: meta?.text && {
      lines: meta.text.lineCount,
      words: meta.text.wordCount,
      characters: meta.text.characterCount,
    },
    docx: meta?.docx && {
      paragraphs: meta.docx.paragraphCount,
      tables: meta.docx.tableCount,
      images: meta.docx.imageCount,
    },
    xlsx: meta?.xlsx && {
      sheets: meta.xlsx.sheetCount,
      rows: meta.xlsx.rowCount,
      cells: meta.xlsx.cellCount,
    },
    pdf: meta?.pdf && {
      title: meta.pdf.title,
      author: meta.pdf.author,
      pages: meta.pdf.pageCount,
    },
    image: meta?.image && {
      width: meta.image.width,
      height: meta.image.height,
      format: meta.image.format,
      camera: meta.image.cameraMake
        ? `${meta.image.cameraMake} ${meta.image.cameraModel}`
        : undefined,
      location:
        meta.image.location.latitude && meta.image.location.longitude
          ? {
              lat: meta.image.location.latitude,
              lng: meta.image.location.longitude,
            }
          : undefined,
    },
  };
}

// Example usage
const docs = [
  { path: './file.txt', type: 'text/plain' },
  {
    path: './doc.docx',
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  },
  {
    path: './sheet.xlsx',
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  },
  { path: './doc.pdf', type: 'application/pdf' },
  { path: './photo.jpg', type: 'image/jpeg' },
];

for (const doc of docs) {
  try {
    const metadata = extractAllMetadata(doc.path, doc.type);
    console.log(metadata);
  } catch (e) {
    console.error(`Error processing ${doc.path}:`, e);
  }
}
```

## Metadata-Driven Processing

Use metadata to make decisions about how to process documents:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ProcessingConfig {
  maxSize: number;
  extractImages: boolean;
  extractMetadata: boolean;
}

function processWithConfig(filePath: string, mimeType: string, config: ProcessingConfig) {
  const buffer = fs.readFileSync(filePath);

  // Check size limit
  if (buffer.length > config.maxSize) {
    console.warn(`File ${filePath} exceeds max size, skipping`);
    return null;
  }

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

  const doc = result[0].documents[0];

  // Use metadata to decide next steps
  const metadata = doc.metadata;

  // For short documents, do additional analysis
  if (metadata?.text && metadata.text.wordCount < 100) {
    console.log('Short document - may need manual review');
  }

  // For documents with images, extract them
  if (config.extractImages && metadata?.docx && metadata.docx.imageCount > 0) {
    console.log(`Contains ${metadata.docx.imageCount} images to extract`);
  }

  return doc;
}

const config: ProcessingConfig = {
  maxSize: 10 * 1024 * 1024, // 10MB
  extractImages: true,
  extractMetadata: true,
};

processWithConfig(
  './document.docx',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  config,
);
```
