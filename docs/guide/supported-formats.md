# Supported Formats

undms supports extracting text and metadata from a wide variety of document formats. This guide provides a complete overview of all supported formats and their capabilities.

## Overview

| Format     | MIME Type                                                                 | Text | Metadata                               | OCR |
| ---------- | ------------------------------------------------------------------------- | ---- | -------------------------------------- | --- |
| Plain Text | `text/*`                                                                  | ✅   | Lines, words, characters               | -   |
| JSON       | `application/json`                                                        | ✅   | Lines, words, characters               | -   |
| XML        | `application/xml`                                                         | ✅   | Lines, words, characters               | -   |
| DOCX       | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | ✅   | Paragraphs, tables, images, hyperlinks | -   |
| XLSX       | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | ✅   | Sheets, rows, columns, cells           | -   |
| PDF        | `application/pdf`                                                         | ✅   | Title, author, subject, pages          | -   |
| Images     | `image/*`                                                                 | OCR  | EXIF, GPS, dimensions                  | ✅  |

## Text Files

Text-based formats including plain text, JSON, and XML.

### Supported MIME Types

- `text/plain`
- `text/*`
- `application/json`
- `application/xml`
- `application/javascript`

### Extracted Metadata

```ts
interface TextMetadata {
  lineCount: number; // Number of lines in the document
  wordCount: number; // Total word count
  characterCount: number; // Total characters including whitespace
  nonWhitespaceCharacterCount: number; // Characters without whitespace
}
```

### Example

```ts
const result = extract([
  {
    name: 'sample.txt',
    size: 1024,
    type: 'text/plain',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from('Line 1\nLine 2\nLine 3'),
  },
]);

console.log(result[0].documents[0].metadata?.text);
// {
//   lineCount: 3,
//   wordCount: 3,
//   characterCount: 22,
//   nonWhitespaceCharacterCount: 15
// }
```

## DOCX (Microsoft Word)

Extracts content and structure from Microsoft Word documents.

### Supported MIME Type

`application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### Extracted Metadata

```ts
interface DocxMetadata {
  paragraphCount: number; // Total paragraphs in the document
  tableCount: number; // Number of tables
  imageCount: number; // Embedded images
  hyperlinkCount: number; // Hyperlinks in the document
}
```

### Example

```ts
const result = extract([
  {
    name: 'document.docx',
    size: 5000,
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(docxBuffer),
  },
]);

console.log(result[0].documents[0].metadata?.docx);
// {
//   paragraphCount: 15,
//   tableCount: 2,
//   imageCount: 3,
//   hyperlinkCount: 5
// }
```

### Features

- Extracts paragraph text
- Handles nested tables
- Processes inline images
- Extracts hyperlinks

## XLSX (Microsoft Excel)

Extracts content and structure from Microsoft Excel spreadsheets.

### Supported MIME Type

`application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`

### Extracted Metadata

```ts
interface XlsxMetadata {
  sheetCount: number; // Number of worksheets
  sheetNames: string[]; // Names of all sheets
  rowCount: number; // Total rows across all sheets
  columnCount: number; // Maximum columns in any sheet
  cellCount: number; // Total cells with content
}
```

### Example

```ts
const result = extract([
  {
    name: 'spreadsheet.xlsx',
    size: 8000,
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(xlsxBuffer),
  },
]);

console.log(result[0].documents[0].metadata?.xlsx);
// {
//   sheetCount: 3,
//   sheetNames: ['Sales', 'Expenses', 'Summary'],
//   rowCount: 150,
//   columnCount: 10,
//   cellCount: 1200
// }
```

## PDF (Portable Document Format)

Extracts text content and document properties from PDF files.

### Supported MIME Type

`application/pdf`

### Extracted Metadata

```ts
interface PdfMetadata {
  title?: string; // Document title
  author?: string; // Document author
  subject?: string; // Document subject
  producer?: string; // PDF producer application
  pageSize?: PdfPageSize; // First page dimensions
  pageCount: number; // Total number of pages
}

interface PdfPageSize {
  width: number; // Page width in points
  height: number; // Page height in points
}
```

### Example

```ts
const result = extract([
  {
    name: 'document.pdf',
    size: 15000,
    type: 'application/pdf',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(pdfBuffer),
  },
]);

console.log(result[0].documents[0].metadata?.pdf);
// {
//   title: 'Annual Report 2024',
//   author: 'John Doe',
//   subject: 'Financial Summary',
//   producer: 'Microsoft Word',
//   pageSize: { width: 612, height: 792 },
//   pageCount: 24
// }
```

### Limitations

- Image-only PDFs (scanned documents) will return empty text content
- OCR is not currently applied to PDFs

## Images

Extracts text from images using OCR and retrieves EXIF metadata.

### Supported MIME Types

- `image/jpeg`
- `image/png`
- `image/gif`
- `image/bmp`
- `image/tiff`
- `image/webp`

### Extracted Metadata

```ts
interface ImageMetadata {
  width: number; // Image width in pixels
  height: number; // Image height in pixels
  format?: string; // Image format (JPEG, PNG, etc.)
  cameraMake?: string; // Camera manufacturer
  cameraModel?: string; // Camera model
  datetimeOriginal?: string; // Date/time when photo was taken
  location: ImageLocation; // GPS coordinates
}

interface ImageLocation {
  latitude?: number; // GPS latitude
  longitude?: number; // GPS longitude
}
```

### OCR Text Extraction

When text is detected in an image, it's included in the extracted content:

```ts
const result = extract([
  {
    name: 'photo.jpg',
    size: 200000,
    type: 'image/jpeg',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(imageBuffer),
  },
]);

console.log(result[0].documents[0].content);
// Extracted text from OCR

console.log(result[0].documents[0].metadata?.image);
// {
//   width: 1920,
//   height: 1080,
//   format: 'JPEG',
//   cameraMake: 'Apple',
//   cameraModel: 'iPhone 14 Pro',
//   datetimeOriginal: '2024:01:15 10:30:00',
//   location: { latitude: 40.7128, longitude: -74.0060 }
// }
```

### Example: Photo with Location

```ts
const result = extract([
  {
    name: 'vacation_photo.jpg',
    size: 350000,
    type: 'image/jpeg',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer: Buffer.from(jpegBuffer),
  },
]);

const imageMeta = result[0].documents[0].metadata?.image;

if (imageMeta?.location?.latitude && imageMeta?.location?.longitude) {
  console.log(`Photo location: ${imageMeta.location.latitude}, ${imageMeta.location.longitude}`);
}

if (imageMeta?.cameraMake && imageMeta?.cameraModel) {
  console.log(`Taken with: ${imageMeta.cameraMake} ${imageMeta.cameraModel}`);
}
```

## MIME Type Detection

undms uses the `type` field you provide to determine which handler to use. Make sure to provide the correct MIME type for each document.

### Common MIME Types

| File Extension | MIME Type                                                                 |
| -------------- | ------------------------------------------------------------------------- |
| .txt           | `text/plain`                                                              |
| .json          | `application/json`                                                        |
| .xml           | `application/xml`                                                         |
| .docx          | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` |
| .xlsx          | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       |
| .pdf           | `application/pdf`                                                         |
| .jpg / .jpeg   | `image/jpeg`                                                              |
| .png           | `image/png`                                                               |
| .gif           | `image/gif`                                                               |
| .bmp           | `image/bmp`                                                               |
| .tiff          | `image/tiff`                                                              |
| .webp          | `image/webp`                                                              |

::: tip
For web applications, you can use the File object's `type` property which automatically provides the correct MIME type.
:::
