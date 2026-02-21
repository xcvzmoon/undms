function createBmp(width: number, height: number, color: [number, number, number]): Buffer {
  const headerSize = 14;
  const dibSize = 40;
  const rowSize = Math.ceil((width * 3) / 4) * 4;
  const pixelArraySize = rowSize * height;
  const fileSize = headerSize + dibSize + pixelArraySize;
  const buffer = Buffer.alloc(fileSize, 0);

  buffer.write('BM', 0, 2, 'ascii');
  buffer.writeUInt32LE(fileSize, 2);
  buffer.writeUInt32LE(0, 6);
  buffer.writeUInt32LE(headerSize + dibSize, 10);

  buffer.writeUInt32LE(dibSize, 14);
  buffer.writeInt32LE(width, 18);
  buffer.writeInt32LE(height, 22);
  buffer.writeUInt16LE(1, 26);
  buffer.writeUInt16LE(24, 28);
  buffer.writeUInt32LE(0, 30);
  buffer.writeUInt32LE(pixelArraySize, 34);
  buffer.writeInt32LE(2835, 38);
  buffer.writeInt32LE(2835, 42);
  buffer.writeUInt32LE(0, 46);
  buffer.writeUInt32LE(0, 50);

  const [r, g, b] = color;
  let offset = headerSize + dibSize;
  const padding = rowSize - width * 3;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      buffer[offset] = b;
      buffer[offset + 1] = g;
      buffer[offset + 2] = r;
      offset += 3;
    }
    offset += padding;
  }

  return buffer;
}

import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const ocrImagePath = join(__dirname, '..', 'documents', 'image-ocr.jpg');
const metadataImagePath = join(__dirname, '..', 'documents', 'image-metadata.jpeg');
let ocrImageBuffer: Buffer | null = null;
let metadataImageBuffer: Buffer | null = null;

try {
  ocrImageBuffer = readFileSync(ocrImagePath);
} catch {
  ocrImageBuffer = null;
}

try {
  metadataImageBuffer = readFileSync(metadataImagePath);
} catch {
  metadataImageBuffer = null;
}

export function createOcrImage(): Buffer {
  if (!ocrImageBuffer) {
    throw new Error('image-ocr.jpg not found. Please ensure it exists in __test__/documents/');
  }

  return ocrImageBuffer;
}

export function createMetadataImage(): Buffer {
  if (!metadataImageBuffer) {
    throw new Error(
      'image-metadata.jpeg not found. Please ensure it exists in __test__/documents/',
    );
  }

  return metadataImageBuffer;
}

export function createSimpleImage(): Buffer {
  if (metadataImageBuffer) {
    return metadataImageBuffer;
  }

  if (ocrImageBuffer) {
    return ocrImageBuffer;
  }

  return createBmp(32, 32, [220, 220, 220]);
}

export function createImageWithSize(width: number, height: number): Buffer {
  return createBmp(width, height, [200, 200, 200]);
}

export function createCorruptedImage(): Buffer {
  return Buffer.from('not-an-image');
}
