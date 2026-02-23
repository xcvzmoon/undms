# Type Definitions

Complete reference for all TypeScript interfaces and types exported by undms.

## Input Types

### Document

Input document interface for extraction.

```ts
interface Document {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: Buffer;
}
```

#### Properties

| Property             | Type     | Description                                       |
| -------------------- | -------- | ------------------------------------------------- |
| `name`               | `string` | File name                                         |
| `size`               | `number` | File size in bytes                                |
| `type`               | `string` | MIME type (e.g., `text/plain`, `application/pdf`) |
| `lastModified`       | `number` | Last modified timestamp (Unix epoch ms)           |
| `webkitRelativePath` | `string` | File path for web compatibility                   |
| `buffer`             | `Buffer` | File content as a Buffer                          |

#### Example

```ts
const document: Document = {
  name: 'report.pdf',
  size: 1024,
  type: 'application/pdf',
  lastModified: Date.now(),
  webkitRelativePath: '/documents/report.pdf',
  buffer: Buffer.from(pdfData),
};
```

---

## Output Types

### DocumentMetadata

Metadata result for extracted documents.

```ts
interface DocumentMetadata {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: MetadataPayload;
  error?: string;
}
```

#### Properties

| Property         | Type              | Description                                   |
| ---------------- | ----------------- | --------------------------------------------- |
| `name`           | `string`          | Original file name                            |
| `size`           | `number`          | File size in bytes                            |
| `processingTime` | `number`          | Extraction time in milliseconds               |
| `encoding`       | `string`          | Detected encoding or MIME type                |
| `content`        | `string`          | Extracted text content                        |
| `metadata`       | `MetadataPayload` | Format-specific metadata (optional)           |
| `error`          | `string`          | Error message if extraction failed (optional) |

---

### DocumentMetadataWithSimilarity

Document metadata with similarity results.

```ts
interface DocumentMetadataWithSimilarity {
  name: string;
  size: number;
  processingTime: number;
  encoding: string;
  content: string;
  metadata?: MetadataPayload;
  error?: string;
  similarityMatches: SimilarityMatch[];
}
```

Extends `DocumentMetadata` with `similarityMatches`.

---

### GroupedDocuments

Documents grouped by MIME type.

```ts
interface GroupedDocuments {
  mimeType: string;
  documents: DocumentMetadata[];
}
```

---

### GroupedDocumentsWithSimilarity

Grouped documents with similarity data.

```ts
interface GroupedDocumentsWithSimilarity {
  mimeType: string;
  documents: DocumentMetadataWithSimilarity[];
}
```

---

### SimilarityMatch

Similarity comparison result.

```ts
interface SimilarityMatch {
  referenceIndex: number;
  similarityPercentage: number;
}
```

#### Properties

| Property               | Type     | Description                          |
| ---------------------- | -------- | ------------------------------------ |
| `referenceIndex`       | `number` | Index into the reference texts array |
| `similarityPercentage` | `number` | Similarity score (0-100)             |

---

## Metadata Types

### MetadataPayload

Complete metadata payload with format-specific fields.

```ts
interface MetadataPayload {
  text?: TextMetadata;
  docx?: DocxMetadata;
  xlsx?: XlsxMetadata;
  pdf?: PdfMetadata;
  image?: ImageMetadata;
}
```

Contains one or more format-specific metadata objects depending on the document type.

---

### TextMetadata

Text content statistics.

```ts
interface TextMetadata {
  lineCount: number;
  wordCount: number;
  characterCount: number;
  nonWhitespaceCharacterCount: number;
}
```

#### Properties

| Property                      | Type     | Description                           |
| ----------------------------- | -------- | ------------------------------------- |
| `lineCount`                   | `number` | Number of lines                       |
| `wordCount`                   | `number` | Total word count                      |
| `characterCount`              | `number` | Total characters including whitespace |
| `nonWhitespaceCharacterCount` | `number` | Characters without whitespace         |

---

### DocxMetadata

DOCX-specific metadata.

```ts
interface DocxMetadata {
  paragraphCount: number;
  tableCount: number;
  imageCount: number;
  hyperlinkCount: number;
}
```

#### Properties

| Property         | Type     | Description                |
| ---------------- | -------- | -------------------------- |
| `paragraphCount` | `number` | Total paragraphs           |
| `tableCount`     | `number` | Number of tables           |
| `imageCount`     | `number` | Embedded images            |
| `hyperlinkCount` | `number` | Hyperlinks in the document |

---

### XlsxMetadata

XLSX-specific metadata.

```ts
interface XlsxMetadata {
  sheetCount: number;
  sheetNames: string[];
  rowCount: number;
  columnCount: number;
  cellCount: number;
}
```

#### Properties

| Property      | Type       | Description                  |
| ------------- | ---------- | ---------------------------- |
| `sheetCount`  | `number`   | Number of worksheets         |
| `sheetNames`  | `string[]` | Names of all sheets          |
| `rowCount`    | `number`   | Total rows across all sheets |
| `columnCount` | `number`   | Maximum columns in any sheet |
| `cellCount`   | `number`   | Total cells with content     |

---

### PdfMetadata

PDF-specific metadata.

```ts
interface PdfMetadata {
  title?: string;
  author?: string;
  subject?: string;
  producer?: string;
  pageSize?: PdfPageSize;
  pageCount: number;
}
```

#### Properties

| Property    | Type          | Description                 |
| ----------- | ------------- | --------------------------- |
| `title`     | `string`      | Document title (optional)   |
| `author`    | `string`      | Document author (optional)  |
| `subject`   | `string`      | Document subject (optional) |
| `producer`  | `string`      | PDF producer application    |
| `pageSize`  | `PdfPageSize` | First page dimensions       |
| `pageCount` | `number`      | Total number of pages       |

---

### PdfPageSize

PDF page dimensions.

```ts
interface PdfPageSize {
  width: number;
  height: number;
}
```

---

### ImageMetadata

Image-specific metadata.

```ts
interface ImageMetadata {
  width: number;
  height: number;
  format?: string;
  cameraMake?: string;
  cameraModel?: string;
  datetimeOriginal?: string;
  location: ImageLocation;
}
```

#### Properties

| Property           | Type            | Description                    |
| ------------------ | --------------- | ------------------------------ |
| `width`            | `number`        | Image width in pixels          |
| `height`           | `number`        | Image height in pixels         |
| `format`           | `string`        | Image format (JPEG, PNG, etc.) |
| `cameraMake`       | `string`        | Camera manufacturer            |
| `cameraModel`      | `string`        | Camera model                   |
| `datetimeOriginal` | `string`        | Date/time when photo was taken |
| `location`         | `ImageLocation` | GPS coordinates                |

---

### ImageLocation

GPS coordinates from EXIF data.

```ts
interface ImageLocation {
  latitude?: number;
  longitude?: number;
}
```

---

## Type Aliases

### SimilarityMethod

Valid similarity algorithms.

```ts
type SimilarityMethod = 'jaccard' | 'ngram' | 'levenshtein' | 'hybrid';
```

---

## Complete Usage Example

```ts
import { extract, computeDocumentSimilarity, computeTextSimilarity } from 'undms';

const documents: Document[] = [
  {
    name: 'report.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Sample content'),
  },
];

// Extract
const extractResults = extract(documents);
const extractedDoc: DocumentMetadata = extractResults[0].documents[0];

// Access metadata
if (extractedDoc.metadata?.text) {
  const textMeta: TextMetadata = extractedDoc.metadata.text;
  console.log(textMeta.wordCount);
}

// Compute document similarity
const similarityResults = computeDocumentSimilarity(documents, ['reference text'], 50, 'hybrid');
const docWithSimilarity: DocumentMetadataWithSimilarity = similarityResults[0].documents[0];

docWithSimilarity.similarityMatches.forEach((match: SimilarityMatch) => {
  console.log(match.referenceIndex, match.similarityPercentage);
});

// Compute text similarity
const textMatches = computeTextSimilarity('source text', ['reference'], 30, 'hybrid');
```
