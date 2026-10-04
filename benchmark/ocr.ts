import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
export async function prepareTesseractModel(
  cache: string,
): Promise<{ sha256: string; languagePath: string }> {
  const manifest: unknown = JSON.parse(
    await readFile(fileURLToPath(new URL('./ocr-model.json', import.meta.url)), 'utf8'),
  );
  if (
    !record(manifest) ||
    typeof manifest.url !== 'string' ||
    typeof manifest.sha256 !== 'string' ||
    !/^[a-f0-9]{64}$/.test(manifest.sha256)
  )
    throw new Error('Invalid OCR model manifest');
  const languagePath = join(cache, 'tessdata');
  const path = join(languagePath, 'eng.traineddata.gz');
  let data: Buffer | undefined;
  try {
    data = await readFile(path);
  } catch (error) {
    if (!record(error) || error.code !== 'ENOENT') throw error;
  }
  if (data === undefined) {
    const response = await fetch(manifest.url, { signal: AbortSignal.timeout(60000) });
    if (!response.ok || !response.body)
      throw new Error(`OCR model download failed: ${response.status}`);
    const chunks: Uint8Array[] = [];
    let bytes = 0;
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > 16 * 1024 * 1024) throw new Error('OCR model exceeds 16 MiB');
      chunks.push(chunk);
    }
    data = Buffer.concat(chunks, bytes);
    if (createHash('sha256').update(data).digest('hex') !== manifest.sha256)
      throw new Error('OCR model hash mismatch');
    await mkdir(languagePath, { recursive: true });
    await writeFile(path, data);
  }
  if (createHash('sha256').update(data).digest('hex') !== manifest.sha256)
    throw new Error('Cached OCR model hash mismatch');
  return { sha256: manifest.sha256, languagePath };
}
interface Worker {
  recognize(image: Buffer): Promise<unknown>;
  terminate(): Promise<unknown>;
}
interface TesseractApi {
  createWorker(
    language: string,
    oem: number,
    options: { langPath: string; gzip: boolean; cacheMethod: string },
  ): Promise<unknown>;
}
function api(value: unknown): value is TesseractApi {
  return record(value) && typeof value.createWorker === 'function';
}
function worker(value: unknown): value is Worker {
  return (
    record(value) && typeof value.recognize === 'function' && typeof value.terminate === 'function'
  );
}
export function tesseractAdapter(
  value: unknown,
  images: Buffer[],
  concurrency: number,
  languagePath: string,
): { invoke(): Promise<string[]>; terminate(): Promise<void> } {
  if (!api(value)) throw new Error('Invalid Tesseract.js API');
  const tesseract = value;
  let pool: Promise<Worker[]> | undefined;
  let terminated = false;
  async function createPool(): Promise<Worker[]> {
    const results = await Promise.allSettled(
      Array.from({ length: Math.min(images.length, concurrency) }, async () => {
        const created = await tesseract.createWorker('eng', 1, {
          langPath: languagePath,
          gzip: true,
          cacheMethod: 'readOnly',
        });
        if (!worker(created)) throw new Error('Invalid Tesseract.js worker');
        return created;
      }),
    );
    const workers = results.flatMap((result) =>
      result.status === 'fulfilled' ? [result.value] : [],
    );
    const failed = results.find((result) => result.status === 'rejected');
    if (failed?.status === 'rejected') {
      await Promise.all(
        workers.map(async (item) => {
          await item.terminate();
        }),
      );
      throw new Error(`Tesseract.js worker initialization failed: ${String(failed.reason)}`);
    }
    return workers;
  }
  return {
    async invoke() {
      if (terminated) throw new Error('OCR worker pool was terminated');
      pool ??= createPool();
      const workers = await pool;
      const outputs = Array.from({ length: images.length }, () => '');
      let next = 0;
      await Promise.all(
        workers.map(async (item) => {
          while (next < images.length) {
            const index = next++;
            const image = images[index];
            if (!image) throw new Error('Missing OCR input');
            const result = await item.recognize(image);
            if (!record(result) || !record(result.data) || typeof result.data.text !== 'string')
              throw new Error('Missing Tesseract.js text');
            outputs[index] = result.data.text;
          }
        }),
      );
      return outputs;
    },
    async terminate() {
      if (terminated) return;
      terminated = true;
      if (pool) {
        const workers = await pool.catch(() => []);
        await Promise.all(
          workers.map(async (item) => {
            await item.terminate();
          }),
        );
      }
    },
  };
}
function normalize(text: string): string {
  return text.normalize('NFKC').toLowerCase().replace(/\s+/gu, ' ').trim();
}
function distance(reference: string[], hypothesis: string[]): number {
  let previous = Array.from({ length: hypothesis.length + 1 }, (_, index) => index);
  for (let row = 1; row <= reference.length; row++) {
    const current = Array.from({ length: hypothesis.length + 1 }, () => 0);
    current[0] = row;
    for (let column = 1; column <= hypothesis.length; column++)
      current[column] = Math.min(
        (previous[column] ?? 0) + 1,
        (current[column - 1] ?? 0) + 1,
        (previous[column - 1] ?? 0) + (reference[row - 1] === hypothesis[column - 1] ? 0 : 1),
      );
    previous = current;
  }
  return previous[hypothesis.length] ?? 0;
}
export function ocrQuality(
  reference: string,
  text: string,
): {
  characterEdits: number;
  referenceCharacters: number;
  wordEdits: number;
  referenceWords: number;
} {
  const expected = normalize(reference),
    actual = normalize(text);
  if (!expected) throw new Error('Empty OCR reference');
  const expectedCharacters = Array.from(expected),
    expectedWords = expected.split(' ');
  return {
    characterEdits: distance(expectedCharacters, Array.from(actual)),
    referenceCharacters: expectedCharacters.length,
    wordEdits: distance(expectedWords, actual ? actual.split(' ') : []),
    referenceWords: expectedWords.length,
  };
}
