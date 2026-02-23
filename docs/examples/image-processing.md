# Image Processing

Extract text from images using OCR and retrieve EXIF metadata including GPS coordinates.

## OCR Text Extraction

Extract text from images using Tesseract OCR:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./screenshot.png');

const result = extract([
  {
    name: 'screenshot.png',
    size: buffer.length,
    type: 'image/png',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

const doc = result[0].documents[0];

console.log('Extracted Text:');
console.log(doc.content);

console.log('\nImage Metadata:');
console.log(`  Dimensions: ${doc.metadata?.image?.width} × ${doc.metadata?.image?.height}`);
console.log(`  Format: ${doc.metadata?.image?.format}`);
```

## EXIF Data Extraction

Extract camera information from photos:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./photo.jpg');

const result = extract([
  {
    name: 'photo.jpg',
    size: buffer.length,
    type: 'image/jpeg',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

const image = result[0].documents[0].metadata?.image;

console.log('Camera Information:');
console.log(`  Make: ${image?.cameraMake}`);
console.log(`  Model: ${image?.cameraModel}`);
console.log(`  Date Taken: ${image?.datetimeOriginal}`);

console.log('\nImage Properties:');
console.log(`  Width: ${image?.width}px`);
console.log(`  Height: ${image?.height}px`);
console.log(`  Format: ${image?.format}`);
```

## GPS Location Extraction

Extract GPS coordinates from photos:

```ts
import { extract } from 'undms';
import * as fs from 'fs';

const buffer = fs.readFileSync('./vacation_photo.jpg');

const result = extract([
  {
    name: 'vacation_photo.jpg',
    size: buffer.length,
    type: 'image/jpeg',
    lastModified: Date.now(),
    webkitRelativePath: '',
    buffer,
  },
]);

const location = result[0].documents[0].metadata?.image?.location;

if (location?.latitude && location?.longitude) {
  console.log('GPS Coordinates:');
  console.log(`  Latitude: ${location.latitude}`);
  console.log(`  Longitude: ${location.longitude}`);
  console.log(
    `  Google Maps: https://maps.google.com/?q=${location.latitude},${location.longitude}`,
  );
} else {
  console.log('No GPS data found in this image');
}
```

## Real-World Examples

### Photo Organization Tool

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

interface PhotoInfo {
  filename: string;
  dateTaken?: string;
  camera?: string;
  location?: { lat: number; lng: number };
  dimensions: { width: number; height: number };
  text: string;
}

function analyzePhoto(filePath: string): PhotoInfo {
  const buffer = fs.readFileSync(filePath);
  const stats = fs.statSync(filePath);

  const result = extract([
    {
      name: path.basename(filePath),
      size: stats.size,
      type: 'image/jpeg',
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    },
  ]);

  const doc = result[0].documents[0];
  const image = doc.metadata?.image;

  return {
    filename: path.basename(filePath),
    dateTaken: image?.datetimeOriginal,
    camera:
      image?.cameraMake && image.cameraModel
        ? `${image.cameraMake} ${image.cameraModel}`
        : undefined,
    location:
      image?.location?.latitude && image?.location?.longitude
        ? { lat: image.location.latitude, lng: image.location.longitude }
        : undefined,
    dimensions: { width: image?.width || 0, height: image?.height || 0 },
    text: doc.content,
  };
}

function organizePhotos(photosDir: string, outputDir: string) {
  const files = fs.readdirSync(photosDir);

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) continue;

    try {
      const info = analyzePhoto(path.join(photosDir, file));

      // Organize by date
      let folder = 'unknown';
      if (info.dateTaken) {
        const date = new Date(info.dateTaken);
        folder = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }

      const destDir = path.join(outputDir, folder);
      if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
      }

      const destPath = path.join(destDir, file);
      fs.copyFileSync(path.join(photosDir, file), destPath);

      console.log(`Copied ${file} to ${folder}/`);
      console.log(`  Camera: ${info.camera || 'Unknown'}`);
      console.log(`  Date: ${info.dateTaken || 'Unknown'}`);
    } catch (e) {
      console.error(`Error processing ${file}:`, e);
    }
  }
}

// Usage
organizePhotos('./photos', './organized');
```

### Document Scanner App

```ts
import { extract } from 'undms';

interface ScannedDocument {
  filename: string;
  extractedText: string;
  confidence: number;
}

async function scanDocument(file: File): Promise<ScannedDocument> {
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

  const doc = result[0].documents[0];

  return {
    filename: file.name,
    extractedText: doc.content,
    confidence: doc.content.length > 50 ? 0.9 : 0.5,
  };
}

async function batchScan(files: File[]): Promise<ScannedDocument[]> {
  const documents = files.map((file) => ({
    name: file.name,
    size: file.size,
    type: file.type,
    lastModified: file.lastModified,
    webkitRelativePath: '',
    buffer: Buffer.from(await file.arrayBuffer()),
  }));

  const result = extract(documents);

  return result.flatMap((group) =>
    group.documents.map((doc) => ({
      filename: doc.name,
      extractedText: doc.content,
      confidence: doc.content.length > 50 ? 0.9 : 0.5,
    })),
  );
}

// UI handler
const fileInput = document.getElementById('scanner') as HTMLInputElement;
fileInput.addEventListener('change', async (e) => {
  const files = (e.target as HTMLInputElement).files;
  if (!files) return;

  const results = await batchScan(Array.from(files));

  console.log('Scanned Documents:');
  results.forEach((doc) => {
    console.log(`\n${doc.filename} (${(doc.confidence * 100).toFixed(0)}% confidence):`);
    console.log(doc.extractedText.substring(0, 200) + '...');
  });
});
```

### Image Deduplication with OCR

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface ImageWithText {
  filename: string;
  content: string;
  hash: string;
}

function extractImagesWithText(dir: string): ImageWithText[] {
  const files = fs.readdirSync(dir);
  const images: ImageWithText[] = [];

  for (const file of files) {
    const ext = file.toLowerCase().split('.').pop();
    if (!['jpg', 'jpeg', 'png', 'gif', 'bmp'].includes(ext || '')) continue;

    const buffer = fs.readFileSync(dir + '/' + file);

    const result = extract([
      {
        name: file,
        size: buffer.length,
        type: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
        lastModified: Date.now(),
        webkitRelativePath: '',
        buffer,
      },
    ]);

    const content = result[0].documents[0].content;

    if (content.trim()) {
      images.push({
        filename: file,
        content: content.toLowerCase(),
        hash: simpleHash(buffer.toString('base64').substring(0, 1000)),
      });
    }
  }

  return images;
}

function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function findDuplicates(images: ImageWithText[]): [string, string][] {
  const duplicates: [string, string][] = [];
  const contentIndex = new Map<string, string[]>();

  // Group by OCR content
  for (const img of images) {
    const key = img.content.substring(0, 50);
    if (!contentIndex.has(key)) {
      contentIndex.set(key, []);
    }
    contentIndex.get(key)!.push(img.filename);
  }

  // Find duplicates
  for (const [, files] of contentIndex) {
    if (files.length > 1) {
      for (let i = 0; i < files.length; i++) {
        for (let j = i + 1; j < files.length; j++) {
          duplicates.push([files[i], files[j]]);
        }
      }
    }
  }

  return duplicates;
}

const images = extractImagesWithText('./images');
const duplicates = findDuplicates(images);

console.log('Potential Duplicates:');
duplicates.forEach(([a, b]) => console.log(`  ${a} <-> ${b}`));
```

### Location-Based Photo Search

```ts
import { extract } from 'undms';
import * as fs from 'fs';

interface PhotoLocation {
  filename: string;
  lat: number;
  lng: number;
}

function findPhotosInArea(
  dir: string,
  bounds: { north: number; south: number; east: number; west: number },
): PhotoLocation[] {
  const files = fs.readdirSync(dir);
  const results: PhotoLocation[] = [];

  for (const file of files) {
    const buffer = fs.readFileSync(dir + '/' + file);

    const result = extract([
      {
        name: file,
        size: buffer.length,
        type: 'image/jpeg',
        lastModified: Date.now(),
        webkitRelativePath: '',
        buffer,
      },
    ]);

    const location = result[0].documents[0].metadata?.image?.location;

    if (location?.latitude && location?.longitude) {
      if (
        location.latitude >= bounds.south &&
        location.latitude <= bounds.north &&
        location.longitude >= bounds.west &&
        location.longitude <= bounds.east
      ) {
        results.push({
          filename: file,
          lat: location.latitude,
          lng: location.longitude,
        });
      }
    }
  }

  return results;
}

// Find photos in New York City area
const nycPhotos = findPhotosInArea('./photos', {
  north: 41.5,
  south: 40.0,
  east: -73.0,
  west: -74.5,
});

console.log(`Found ${nycPhotos.length} photos in NYC area:`);
nycPhotos.forEach((p) => {
  console.log(`  ${p.filename}: ${p.lat}, ${p.lng}`);
});
```

### Batch Image Text Extraction

```ts
import { extract } from 'undms';
import * as fs from 'fs';
import * as path from 'path';

interface ExtractionResult {
  filename: string;
  success: boolean;
  text: string;
  error?: string;
  processingTime: number;
}

function extractAllImages(dir: string): ExtractionResult[] {
  const files = fs.readdirSync(dir);
  const documents = [];

  for (const file of files) {
    const ext = path.extname(file).toLowerCase();
    if (!['.jpg', '.jpeg', '.png', '.gif', '.bmp'].includes(ext)) continue;

    const buffer = fs.readFileSync(path.join(dir, file));
    const stats = fs.statSync(path.join(dir, file));

    documents.push({
      name: file,
      size: stats.size,
      type: `image/${ext === '.jpg' ? 'jpeg' : ext.slice(1)}`,
      lastModified: stats.mtimeMs,
      webkitRelativePath: '',
      buffer,
    });
  }

  const results = extract(documents);
  const output: ExtractionResult[] = [];

  for (const group of results) {
    for (const doc of group.documents) {
      output.push({
        filename: doc.name,
        success: !doc.error && doc.content.length > 0,
        text: doc.content,
        error: doc.error,
        processingTime: doc.processingTime,
      });
    }
  }

  return output;
}

// Process all images in a directory
const results = extractAllImageTexts('./scanned_docs');

console.log(`Processed ${results.length} images:`);
console.log(`  Successful: ${results.filter((r) => r.success).length}`);
console.log(`  Failed: ${results.filter((r) => !r.success).length}`);
console.log(`  Total time: ${results.reduce((sum, r) => sum + r.processingTime, 0).toFixed(2)}ms`);

// Save extracted text to files
for (const result of results) {
  if (result.success) {
    const txtFile = path.join('./extracted', result.filename.replace(/\.[^.]+$/, '.txt'));
    fs.writeFileSync(txtFile, result.text);
  }
}
```

## Supported Image Formats

undms supports the following image formats for OCR and EXIF extraction:

| Format | MIME Type    | OCR | EXIF    | GPS |
| ------ | ------------ | --- | ------- | --- |
| JPEG   | `image/jpeg` | ✅  | ✅      | ✅  |
| PNG    | `image/png`  | ✅  | Limited | ❌  |
| GIF    | `image/gif`  | ✅  | Limited | ❌  |
| BMP    | `image/bmp`  | ✅  | ❌      | ❌  |
| TIFF   | `image/tiff` | ✅  | ✅      | ✅  |
| WebP   | `image/webp` | ✅  | Limited | ❌  |

::: tip
For best EXIF and GPS data extraction, use JPEG format images taken with digital cameras or smartphones.
:::
