/* oxlint-disable no-console */
import { execFile } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const execute = promisify(execFile);
const root = fileURLToPath(new URL('..', import.meta.url));
const script = fileURLToPath(import.meta.url);
type Implementation = 'release' | 'workspace';
interface Input {
  name: string;
  mimeType: string;
  data: Buffer;
  expected?: string;
}
interface Workload {
  id: string;
  format: string;
  count: number;
  single: boolean;
}
interface Sample {
  implementation: Implementation;
  workload: string;
  documents: number;
  inputBytes: number;
  inputSha256: string;
  bindingLoadMs: number;
  coldMs: number;
  timesMs: number[];
  timerLatencyMs: number[];
  maxRssBytes: number;
  textSha256: string;
  normalizedTextSha256: string;
  textUtf16CodeUnits: number;
}
interface LegacyInput {
  name: string;
  size: number;
  type: string;
  lastModified: number;
  webkitRelativePath: string;
  buffer: Buffer;
}
interface LegacyApi {
  extract(inputs: LegacyInput[]): unknown;
}
interface WorkspaceApi {
  extract(input: Input): unknown;
  extractBatch(inputs: Input[]): unknown;
}
function record(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
function array(value: unknown): value is unknown[] {
  return Array.isArray(value);
}
function legacyApi(value: unknown): value is LegacyApi {
  return record(value) && typeof value.extract === 'function';
}
function workspaceApi(value: unknown): value is WorkspaceApi {
  return (
    record(value) && typeof value.extract === 'function' && typeof value.extractBatch === 'function'
  );
}
function numericArray(value: unknown): value is number[] {
  return (
    array(value) &&
    value.every((number) => typeof number === 'number' && Number.isFinite(number) && number >= 0)
  );
}
function sample(value: unknown): value is Sample {
  if (!record(value)) return false;
  return (
    (value.implementation === 'release' || value.implementation === 'workspace') &&
    ['workload', 'inputSha256', 'textSha256', 'normalizedTextSha256'].every(
      (key) => typeof value[key] === 'string',
    ) &&
    [
      'documents',
      'inputBytes',
      'bindingLoadMs',
      'coldMs',
      'maxRssBytes',
      'textUtf16CodeUnits',
    ].every((key) => typeof value[key] === 'number' && Number.isFinite(value[key])) &&
    numericArray(value.timesMs) &&
    value.timesMs.length > 0 &&
    numericArray(value.timerLatencyMs) &&
    value.timerLatencyMs.length === value.timesMs.length
  );
}
const workloads: Workload[] = [
  { id: 'text-small-single', format: 'text-small', count: 1, single: true },
  { id: 'text-large-single', format: 'text-large', count: 1, single: true },
  { id: 'text-unicode-single', format: 'text-unicode', count: 1, single: true },
  { id: 'text-large-batch-10', format: 'text-large', count: 10, single: false },
  ...['csv', 'docx', 'xlsx', 'pptx', 'pdf'].flatMap((format) => [
    { id: `${format}-single`, format, count: 1, single: true },
    { id: `${format}-batch-10`, format, count: 10, single: false },
  ]),
  { id: 'mixed-batch-20', format: 'mixed', count: 20, single: false },
  { id: 'ocr-single', format: 'ocr', count: 1, single: true },
  { id: 'ocr-batch-2', format: 'ocr', count: 2, single: false },
];
async function document(format: string): Promise<Input> {
  if (format.startsWith('text-')) {
    const text =
      format === 'text-unicode'
        ? 'résumé façade 中文 عربى 😀\n'.repeat(20000)
        : 'alpha beta gamma\n'.repeat(format === 'text-large' ? 200000 : 100);
    return {
      name: format,
      data: Buffer.from(text),
      mimeType: 'text/plain',
      expected: format === 'text-unicode' ? 'résumé' : 'alpha beta gamma',
    };
  }
  const mimeTypes: Record<string, string> = {
    csv: 'text/csv',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    pdf: 'application/pdf',
    ocr: 'image/jpeg',
  };
  const mimeType = mimeTypes[format];
  if (!mimeType) throw new Error(`Unknown format ${format}`);
  const filename = format === 'ocr' ? 'image-ocr.jpg' : `${format}.${format}`;
  const data = await readFile(join(root, '__test__', 'documents', filename));
  return { name: format, data, mimeType };
}
async function inputs(workload: Workload): Promise<Input[]> {
  const base =
    workload.format === 'mixed'
      ? await Promise.all(['docx', 'xlsx', 'pptx', 'pdf', 'text-small'].map(document))
      : [await document(workload.format)];
  return Array.from({ length: workload.count }, (_, index) => ({
    ...base[index % base.length],
    name: `document-${index}`,
  }));
}
function normalize(value: unknown, implementation: Implementation, documents: Input[]): string[] {
  const byName = new Map<string, string>();
  if (implementation === 'release') {
    if (!array(value)) throw new Error('Release returned an invalid grouped result');
    for (const group of value) {
      if (!record(group) || !array(group.documents)) throw new Error('Invalid release group');
      for (const item of group.documents) {
        if (
          !record(item) ||
          typeof item.name !== 'string' ||
          typeof item.content !== 'string' ||
          !record(item.metadata)
        ) {
          throw new Error('Invalid release document/text/metadata');
        }
        if (typeof item.error === 'string' && item.error) throw new Error(item.error);
        if (byName.has(item.name)) throw new Error('Duplicate release output');
        byName.set(item.name, item.content);
      }
    }
  } else {
    const outcomes =
      record(value) && array(value.items)
        ? value.items.map((item) => {
            if (!record(item)) throw new Error('Invalid batch item');
            return item.outcome;
          })
        : [value];
    for (const outcome of outcomes) {
      if (!record(outcome) || outcome.status !== 'success')
        throw new Error(`Workspace extraction did not succeed: ${JSON.stringify(outcome)}`);
      const result = outcome.result;
      if (
        !record(result) ||
        typeof result.text !== 'string' ||
        !record(result.source) ||
        typeof result.source.name !== 'string' ||
        !record(result.metadata)
      ) {
        throw new Error('Invalid workspace document/text/metadata');
      }
      if (byName.has(result.source.name)) throw new Error('Duplicate workspace output');
      byName.set(result.source.name, result.text);
    }
  }
  if (byName.size !== documents.length) throw new Error('Extraction dropped or added documents');
  return documents.map((input) => {
    const text = byName.get(input.name);
    if (!text?.trim() || (input.expected && !text.includes(input.expected)))
      throw new Error(`Missing extracted content for ${input.name}`);
    return text;
  });
}
function digest(texts: string[]): string {
  const hash = createHash('sha256');
  for (const text of texts)
    hash
      .update(String(Buffer.byteLength(text)))
      .update(':')
      .update(text);
  return hash.digest('hex');
}
async function worker() {
  const [, , , implementation, entry, id, iterationsString, warmupsString] = process.argv;
  if (implementation !== 'release' && implementation !== 'workspace')
    throw new Error('Invalid implementation');
  const workload = workloads.find((value) => value.id === id);
  if (!workload || !entry) throw new Error('Invalid worker workload/entry');
  const iterations = Number(iterationsString);
  const warmups = Number(warmupsString);
  const documents = await inputs(workload);
  const legacyInputs = documents.map((input) => ({
    name: input.name,
    size: input.data.length,
    type: input.mimeType,
    lastModified: 0,
    webkitRelativePath: '',
    buffer: input.data,
  }));
  const loadStart = performance.now();
  const api: unknown = createRequire(import.meta.url)(entry);
  const bindingLoadMs = performance.now() - loadStart;
  let invoke: () => unknown;
  if (implementation === 'release' && legacyApi(api)) invoke = () => api.extract(legacyInputs);
  else if (implementation === 'workspace' && workspaceApi(api))
    invoke = () => (workload.single ? api.extract(documents[0]) : api.extractBatch(documents));
  else throw new Error('Binding does not expose the expected extraction API');
  const coldStart = performance.now();
  const first = await invoke();
  const coldMs = performance.now() - coldStart;
  const texts = normalize(first, implementation, documents);
  for (let index = 0; index < warmups; index += 1)
    normalize(await invoke(), implementation, documents);
  const timesMs: number[] = [];
  const timerLatencyMs: number[] = [];
  for (let index = 0; index < iterations; index += 1) {
    const timerStart = performance.now();
    const timer = new Promise<number>((finish) =>
      setTimeout(() => {
        finish(performance.now() - timerStart);
      }, 1),
    );
    const start = performance.now();
    const result = await invoke();
    timesMs.push(performance.now() - start);
    // Let the pending timer run before validation so output hashing/checks aren't measured as stalls.
    timerLatencyMs.push(await timer);
    normalize(result, implementation, documents);
  }
  const inputHash = createHash('sha256');
  for (const input of documents)
    inputHash
      .update(input.name)
      .update(input.mimeType)
      .update(String(input.data.length))
      .update(input.data);
  const result: Sample = {
    implementation,
    workload: workload.id,
    documents: documents.length,
    inputBytes: documents.reduce((sum, input) => sum + input.data.length, 0),
    inputSha256: inputHash.digest('hex'),
    bindingLoadMs,
    coldMs,
    timesMs,
    timerLatencyMs,
    maxRssBytes: process.resourceUsage().maxRSS * 1024,
    textSha256: digest(texts),
    normalizedTextSha256: digest(texts.map((text) => text.trim().replace(/\s+/gu, ' '))),
    textUtf16CodeUnits: texts.reduce((sum, text) => sum + text.length, 0),
  };
  console.log(JSON.stringify(result));
}
function option(name: string, fallback: string): string {
  const index = process.argv.indexOf(`--${name}`);
  if (index < 0) return fallback;
  const value = process.argv[index + 1];
  if (!value || value.startsWith('--')) throw new Error(`--${name} requires a value`);
  return value;
}
function integer(name: string, fallback: number, minimum: number, maximum: number): number {
  const number = Number(option(name, String(fallback)));
  if (!Number.isInteger(number) || number < minimum || number > maximum)
    throw new Error(`--${name} must be an integer ${minimum}–${maximum}`);
  return number;
}
async function pnpm(args: string[], cwd: string) {
  const executable = process.env.npm_execpath;
  if (!executable) throw new Error('Run via pnpm bench:compare, or supply --release-path');
  const command = /\.[cm]?js$/.test(executable) ? process.execPath : executable;
  const commandArgs = command === process.execPath ? [executable, ...args] : args;
  return execute(command, commandArgs, { cwd, timeout: 180000, maxBuffer: 8 * 1024 * 1024 });
}
function percentile(values: number[], fraction: number): number {
  const sorted = values.toSorted((a, b) => a - b);
  const value = sorted[Math.max(0, Math.ceil(sorted.length * fraction) - 1)];
  if (value === undefined) throw new Error('No timing samples');
  return value;
}
async function main() {
  if (process.argv.includes('--help')) {
    console.log(
      'pnpm bench:compare [--release-version latest|VERSION] [--release-path DIRECTORY] [--iterations 20] [--warmups 3] [--rounds 3] [--ocr] [--only WORKLOAD] [--output DIRECTORY]',
    );
    console.log(`Workloads: ${workloads.map((workload) => workload.id).join(', ')}`);
    return;
  }
  const iterations = integer('iterations', 20, 1, 1000);
  const warmups = integer('warmups', 3, 0, 100);
  const rounds = integer('rounds', 3, 1, 20);
  const only = option('only', '');
  const selected = workloads.filter((workload) =>
    only ? workload.id === only : process.argv.includes('--ocr') || workload.format !== 'ocr',
  );
  if (!selected.length) throw new Error(`Unknown workload ${only}`);
  const suppliedPath = option('release-path', '');
  let releaseDirectory: string;
  if (suppliedPath) releaseDirectory = resolve(suppliedPath);
  else {
    const requested = option('release-version', 'latest');
    if (!/^(latest|\d+\.\d+\.\d+(?:-[\w.-]+)?)$/.test(requested))
      throw new Error('Invalid release version');
    const { stdout } = await pnpm(['view', `undms@${requested}`, 'version', '--json'], root);
    const version: unknown = JSON.parse(stdout);
    if (typeof version !== 'string' || !/^\d+\.\d+\.\d+(?:-[\w.-]+)?$/.test(version))
      throw new Error('Registry returned an invalid release version');
    const cache = join(root, 'node_modules', '.cache', 'undms-comparison', 'releases', version);
    releaseDirectory = join(cache, 'node_modules', 'undms');
    try {
      await readFile(join(releaseDirectory, 'package.json'));
    } catch {
      console.log(`Installing isolated undms@${version} (root manifest/lockfile unchanged)…`);
      await mkdir(cache, { recursive: true });
      await writeFile(
        join(cache, 'package.json'),
        `${JSON.stringify({ private: true, dependencies: { undms: version } }, null, 2)}\n`,
      );
      const installed = await pnpm(['install', '--ignore-scripts', '--lockfile=false'], cache);
      process.stderr.write(installed.stderr);
    }
  }
  const manifest: unknown = JSON.parse(
    await readFile(join(releaseDirectory, 'package.json'), 'utf8'),
  );
  if (!record(manifest) || typeof manifest.version !== 'string')
    throw new Error('Invalid release package manifest');
  const releaseEntry = createRequire(join(releaseDirectory, 'package.json')).resolve(
    releaseDirectory,
  );
  const [commit, branch, status] = await Promise.all([
    execute('git', ['rev-parse', 'HEAD'], { cwd: root }),
    execute('git', ['branch', '--show-current'], { cwd: root }),
    execute('git', ['status', '--porcelain'], { cwd: root }),
  ]);
  const workspaceGit = {
    commit: commit.stdout.trim(),
    branch: branch.stdout.trim(),
    dirty: status.stdout.length > 0,
  };
  const samples: Sample[] = [];
  console.log(
    `Comparing published/reference undms@${manifest.version} with this workspace (${process.platform}-${process.arch}, ${process.version})`,
  );
  for (const workload of selected) {
    console.log(`  ${workload.id}: ${rounds} process rounds × ${iterations} warm samples`);
    for (let round = 0; round < rounds; round += 1) {
      const order: Implementation[] =
        round % 2 === 0 ? ['release', 'workspace'] : ['workspace', 'release'];
      for (const implementation of order) {
        const entry = implementation === 'release' ? releaseEntry : join(root, 'index.js');
        const { stdout } = await execute(
          process.execPath,
          [
            ...process.execArgv,
            script,
            '--worker',
            implementation,
            entry,
            workload.id,
            String(iterations),
            String(warmups),
          ],
          {
            cwd: root,
            timeout: 300000,
            maxBuffer: 8 * 1024 * 1024,
          },
        );
        const value: unknown = JSON.parse(stdout);
        if (
          !sample(value) ||
          value.workload !== workload.id ||
          value.implementation !== implementation
        )
          throw new Error('Invalid worker report');
        samples.push(value);
      }
    }
  }
  const rows = selected.map((workload) => {
    const release = samples.filter(
      (value) => value.workload === workload.id && value.implementation === 'release',
    );
    const workspace = samples.filter(
      (value) => value.workload === workload.id && value.implementation === 'workspace',
    );
    if (new Set([...release, ...workspace].map((value) => value.inputSha256)).size !== 1)
      throw new Error(`Input bytes changed for ${workload.id}`);
    const summary = (values: Sample[]) => {
      const times = values.flatMap((value) => value.timesMs);
      return {
        p50Ms: percentile(times, 0.5),
        p95Ms: percentile(times, 0.95),
        documentsPerSecond:
          (times.length * workload.count * 1000) / times.reduce((sum, value) => sum + value, 0),
        timerLatencyP95Ms: percentile(
          values.flatMap((value) => value.timerLatencyMs),
          0.95,
        ),
        coldP50Ms: percentile(
          values.map((value) => value.coldMs),
          0.5,
        ),
        peakRssMiB: Math.max(...values.map((value) => value.maxRssBytes)) / 1048576,
      };
    };
    const before = summary(release);
    const after = summary(workspace);
    return {
      workload: workload.id,
      documents: workload.count,
      inputBytes: release[0].inputBytes,
      release: before,
      workspace: after,
      latencyChangePercent: (after.p50Ms / before.p50Ms - 1) * 100,
      exactTextMatch:
        new Set([...release, ...workspace].map((value) => value.textSha256)).size === 1,
      normalizedTextMatch:
        new Set([...release, ...workspace].map((value) => value.normalizedTextSha256)).size === 1,
    };
  });
  const timestamp = new Date().toISOString();
  const report = {
    timestamp,
    releaseVersion: manifest.version,
    workspaceGit,
    releaseEntry,
    workspaceEntry: join(root, 'index.js'),
    node: process.version,
    platform: `${process.platform}-${process.arch}`,
    iterations,
    warmups,
    rounds,
    rows,
    samples,
  };
  const directory = resolve(
    option('output', join(root, 'benchmark', 'results', timestamp.replace(/[:.]/g, '-'))),
  );
  await mkdir(directory, { recursive: true });
  await writeFile(join(directory, 'comparison.json'), `${JSON.stringify(report, null, 2)}\n`);
  const table = rows
    .map(
      (row) =>
        `| ${row.workload} | ${row.release.p50Ms.toFixed(3)} | ${row.workspace.p50Ms.toFixed(3)} | ${row.latencyChangePercent.toFixed(1)}% | ${row.release.p95Ms.toFixed(3)} / ${row.workspace.p95Ms.toFixed(3)} | ${row.exactTextMatch ? 'exact' : row.normalizedTextMatch ? 'whitespace differs' : 'differs'} |`,
    )
    .join('\n');
  const details = rows
    .map(
      (row) =>
        `| ${row.workload} | ${row.release.documentsPerSecond.toFixed(0)} / ${row.workspace.documentsPerSecond.toFixed(0)} | ${row.release.timerLatencyP95Ms.toFixed(2)} / ${row.workspace.timerLatencyP95Ms.toFixed(2)} | ${row.release.coldP50Ms.toFixed(2)} / ${row.workspace.coldP50Ms.toFixed(2)} | ${row.release.peakRssMiB.toFixed(1)} / ${row.workspace.peakRssMiB.toFixed(1)} |`,
    )
    .join('\n');
  const markdown = `# Active release vs refactored workspace\n\n${timestamp}; ${report.platform}; ${report.node}; release undms@${manifest.version}.\n\n${rounds} fresh process rounds per implementation/workload, ${warmups} extra warmups after the first cold call, ${iterations} measured warm calls per round. Alternating process order reduces order bias. Inputs are prepared before timing and their SHA-256 hashes must match. Extraction is awaited through completion; shape/content/metadata validation and output hashing are outside timing. Single workspace workloads use extract; the old release uses its one-item array API. Default text and metadata extraction is measured on both versions.\n\n| Workload | Release p50 ms | Refactor p50 ms | Latency change | p95 release / refactor ms | Extracted text |\n| --- | ---: | ---: | ---: | ---: | --- |\n${table}\n\nNegative latency change means faster refactored extraction. Text signatures come from the first completed call in each child process; warm calls validate document identity/count, metadata presence and content. Text differences are reported rather than silently treated as equivalent. Whitespace normalization does not validate metadata parity or full format/OCR fidelity.\n\nAll pairs below are release / refactor:\n\n| Workload | Completed documents/s | Timer latency p95 ms | Cold first call ms | Process peak RSS MiB |\n| --- | ---: | ---: | ---: | ---: |\n${details}\n\nA 1 ms timer is scheduled immediately before each extraction; its observed latency includes call-time blocking/copies, and timers run before output validation. Throughput uses completed documents divided by extraction time, excluding timer waits/validation. Cold calls exclude binding load (recorded separately in JSON). Peak RSS includes fixtures, Node/TypeScript loader, parser scratch, results, validation and retained allocators; it is not a native allocation limit. Each version runs separately, and no concurrent throughput/fairness claim is made. OCR (when enabled) uses each version's default policy, so timings do not imply equal OCR passes or accuracy.\n\nRaw per-process samples and input/output hashes: [comparison.json](comparison.json).\n`;
  await writeFile(join(directory, 'comparison.md'), markdown);
  console.table(
    rows.map((row) => ({
      workload: row.workload,
      releaseMs: row.release.p50Ms.toFixed(3),
      refactorMs: row.workspace.p50Ms.toFixed(3),
      latencyChange: `${row.latencyChangePercent.toFixed(1)}%`,
      text: row.exactTextMatch ? 'exact' : row.normalizedTextMatch ? 'whitespace' : 'differs',
    })),
  );
  console.log(`Reports: ${join(directory, 'comparison.md')} and comparison.json`);
}

try {
  if (process.argv[2] === '--worker') await worker();
  else await main();
} catch (error: unknown) {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
