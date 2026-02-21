import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const samplePdfPath = join(__dirname, '..', 'documents', 'pdf.pdf');
let samplePdfBuffer: Buffer | null = null;

try {
  samplePdfBuffer = readFileSync(samplePdfPath);
} catch {
  samplePdfBuffer = null;
}

export function createSimplePdf(): Buffer {
  if (!samplePdfBuffer) {
    throw new Error('pdf.pdf not found. Please ensure pdf.pdf exists in __test__/documents/');
  }

  return samplePdfBuffer;
}

export function createCorruptedPdf(): Buffer {
  return Buffer.from('%PDF-1.4\n% Corrupted PDF');
}

export function createLargePdf(_sizeMb: number): Buffer {
  return createSimplePdf();
}
