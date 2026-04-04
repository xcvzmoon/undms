import { readFileSync } from 'fs';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const samplePptxPath = join(__dirname, '..', 'documents', 'pptx.pptx');
let samplePptxBuffer: Buffer | null = null;

try {
  samplePptxBuffer = readFileSync(samplePptxPath);
} catch {
  samplePptxBuffer = null;
}

export function createSimplePptx(): Buffer {
  if (!samplePptxBuffer) {
    throw new Error('pptx.pptx not found. Please ensure pptx.pptx exists in __test__/documents/');
  }

  return samplePptxBuffer;
}

export function createCorruptedPptx(): Buffer {
  return Buffer.from('This is not a valid PPTX file content');
}
