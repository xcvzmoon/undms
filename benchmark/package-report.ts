import { mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

export interface CorpusDoc {
  id: string;
  title: string;
  format: string;
  path: string;
  sha256: string;
  bytes: number;
  sourceUrl: string;
  license: string;
  expectedText: string[];
  referenceText?: string;
}
export interface Workload {
  id: string;
  label: string;
  format: string;
  mode: 'single' | 'batch';
  documentIds: string[];
  packages: string[];
}
export interface ResourceSample {
  wallMs: number;
  userMs: number;
  systemMs: number;
  calls: number;
  documents: number;
  cpuPercent: number;
  machineCpuPercent: number;
  documentsPerSecond: number;
  peakRssMiB: number;
  rssAfterGcMiB: number;
  heapAfterGcMiB: number;
  idleCpuPercent: number;
  series: { elapsedMs: number; cpuPercent: number; rssMiB: number }[];
}
export interface Sample {
  package: string;
  workload: string;
  round: number;
  latencyMs: number[];
  coldMs: number;
  loadMs: number;
  textHash: string;
  normalizedHash: string;
  textLengths: number[];
  resource: ResourceSample;
  quality?: {
    documentId: string;
    characterEdits: number;
    referenceCharacters: number;
    wordEdits: number;
    referenceWords: number;
  }[];
  cleanup?: { durationMs: number; rssMiB: number; description: string };
}
export interface Report {
  timestamp: string;
  node: string;
  platform: string;
  hardware: { cpuModel: string; logicalCpus: number; memoryBytes: number };
  versions: Record<string, string>;
  workspace: { commit: string; dirty: boolean };
  config: {
    rounds: number;
    durationMs: number;
    resourceDurationMs: number;
    concurrency: number;
    ocrMode?: 'fast' | 'balanced' | 'accurate';
    tesseractModelSha256?: string;
  };
  corpus: CorpusDoc[];
  workloads: Workload[];
  samples: Sample[];
  failures: { package: string; workload: string; round: number; error: string }[];
}
interface Row {
  group: string;
  package: string;
  complete: boolean;
  latency: number;
  cpu: number;
  machineCpu: number;
  throughput: number;
  peakRss: number;
  retainedRss: number;
  retainedHeap: number;
  idleCpu: number;
}
function median(values: number[]): number {
  const sorted = values.toSorted((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length
    ? ((sorted[middle] ?? 0) + (sorted[Math.max(0, Math.ceil(sorted.length / 2) - 1)] ?? 0)) / 2
    : 0;
}
function mean(values: number[]): number {
  return values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;
}
function md(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('|', '&#124;')
    .replaceAll('\n', ' ');
}
function xml(value: string): string {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&apos;');
}
function number(value: number): string {
  return Number.isFinite(value) ? value.toFixed(2) : '—';
}
function rows(report: Report): Row[] {
  const groups = new Map<string, Workload[]>();
  for (const workload of report.workloads) {
    const key = `${workload.format.toUpperCase()} · ${workload.mode}`;
    const group = groups.get(key) ?? [];
    group.push(workload);
    groups.set(key, group);
  }
  return [...groups].flatMap(([group, workloads]) => {
    const packages = [...new Set(workloads.flatMap((workload) => workload.packages))];
    return packages.map((name) => {
      const relevant = workloads.filter((workload) => workload.packages.includes(name));
      const samples = report.samples.filter(
        (sample) =>
          sample.package === name && relevant.some((workload) => workload.id === sample.workload),
      );
      const complete =
        relevant.length === workloads.length &&
        relevant.every((workload) => {
          const selected = samples.filter((sample) => sample.workload === workload.id);
          return (
            new Set(selected.map((sample) => sample.round)).size === report.config.rounds &&
            selected.every((sample) => sample.latencyMs.length > 0 && sample.resource.wallMs > 0) &&
            !report.failures.some(
              (failure) => failure.package === name && failure.workload === workload.id,
            )
          );
        });
      const latencies = relevant.map(
        (workload) =>
          median(
            samples
              .filter((sample) => sample.workload === workload.id)
              .flatMap((sample) => sample.latencyMs),
          ) / Math.max(1, workload.documentIds.length),
      );
      const wall = samples.reduce((sum, sample) => sum + sample.resource.wallMs, 0);
      const weighted = (metric: (resource: ResourceSample) => number): number =>
        wall
          ? samples.reduce(
              (sum, sample) => sum + metric(sample.resource) * sample.resource.wallMs,
              0,
            ) / wall
          : 0;
      return {
        group,
        package: name,
        complete,
        latency: mean(latencies),
        cpu: weighted((resource) => resource.cpuPercent),
        machineCpu: weighted((resource) => resource.machineCpuPercent),
        throughput: wall
          ? (samples.reduce((sum, sample) => sum + sample.resource.documents, 0) * 1000) / wall
          : 0,
        peakRss: Math.max(0, ...samples.map((sample) => sample.resource.peakRssMiB)),
        retainedRss: mean(samples.map((sample) => sample.resource.rssAfterGcMiB)),
        retainedHeap: mean(samples.map((sample) => sample.resource.heapAfterGcMiB)),
        idleCpu: weighted((resource) => resource.idleCpuPercent),
      };
    });
  });
}
function latencyTable(values: Row[], packages: string[]): string {
  const groups = [...new Set(values.map((row) => row.group))];
  return [
    `| Format / mode | ${packages.map(md).join(' | ')} |`,
    `| --- | ${packages.map(() => '---:').join(' | ')} |`,
    ...groups.map(
      (group) =>
        `| ${md(group)} | ${packages
          .map((name) => {
            const row = values.find((value) => value.group === group && value.package === name);
            return row?.complete ? number(row.latency) : row ? 'incomplete' : '—';
          })
          .join(' | ')} |`,
    ),
  ].join('\n');
}
function chart(allValues: Row[], metric: 'latency' | 'cpu'): string {
  const batch = allValues.filter((row) => row.group.endsWith('batch'));
  const values = batch.length ? batch : allValues;
  const groups = [...new Set(values.map((row) => row.group))];
  const height = 100 + values.length * 34 + groups.length * 36;
  let y = 70;
  const bars: string[] = [];
  for (const group of groups) {
    const selected = values.filter((row) => row.group === group);
    const maximum = Math.max(1, ...selected.map((row) => row[metric]));
    bars.push(`<text x="24" y="${y}" font-weight="600">${xml(group)}</text>`);
    y += 26;
    for (const row of selected) {
      const scale = metric === 'cpu' ? Math.max(100, ...values.map((value) => value.cpu)) : maximum;
      const width = row.complete ? Math.max(2, (row[metric] / scale) * 390) : 0;
      bars.push(
        `<text x="24" y="${y + 15}">${xml(row.package)}</text><rect x="180" y="${y}" width="${width}" height="22" rx="3" fill="${row.package === 'undms' ? '#2563eb' : '#94a3b8'}"/><text x="${190 + width}" y="${y + 15}">${row.complete ? number(row[metric]) : 'incomplete'}</text>`,
      );
      y += 34;
    }
    y += 10;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" width="760" height="${height}" viewBox="0 0 760 ${height}" role="img" aria-label="${metric === 'latency' ? 'Warm median milliseconds per document' : 'Sustained process CPU percent'}"><rect width="760" height="${height}" fill="#ffffff"/><g font-family="Arial, Helvetica, sans-serif" font-size="13" fill="#172033"><text x="24" y="30" font-size="19" font-weight="600">${metric === 'latency' ? 'Warm latency · ms/document' : 'Sustained process CPU · % (100% = one core)'}</text><text x="24" y="49" fill="#475569">${metric === 'latency' ? 'Lower is faster. Each workload uses its own scale.' : 'Higher utilization can reflect parallel work; compare with throughput.'}${values.some((row) => !row.complete) ? ' † Incomplete.' : ''}</text>${bars.join('')}</g></svg>\n`;
}
function conclusions(report: Report, values: Row[]): string {
  const wins = new Map<string, number>();
  let completeGroups = 0;
  for (const group of new Set(values.map((row) => row.group))) {
    const selected = values
      .filter((row) => row.group === group)
      .toSorted((a, b) => a.latency - b.latency);
    const first = selected[0];
    const second = selected[1];
    if (!first || !second || selected.some((row) => !row.complete)) continue;
    completeGroups++;
    if (first.latency < second.latency) wins.set(first.package, (wins.get(first.package) ?? 0) + 1);
  }
  let exact = 0;
  let whitespace = 0;
  let different = 0;
  for (const sample of report.samples.filter((candidate) => candidate.package !== 'undms')) {
    const reference = report.samples.find(
      (value) =>
        value.package === 'undms' &&
        value.workload === sample.workload &&
        value.round === sample.round,
    );
    if (!reference) continue;
    if (sample.textHash === reference.textHash) exact++;
    else if (sample.normalizedHash === reference.normalizedHash) whitespace++;
    else different++;
  }
  return `${wins.size ? `Unique warm-latency group wins: ${[...wins].map(([name, count]) => `${md(name)} ${count}`).join(', ')} across ${completeGroups} complete comparisons.` : 'No unique latency winner established from complete comparisons.'} Ties are excluded; small differences do not establish statistical significance.\n\nCompared with undms, ${exact} measured competitor rounds have identical text, ${whitespace} differ only in whitespace, and ${different} differ beyond whitespace. These comparisons are not ground-truth accuracy scores. Review the saved extracted text. This small corpus does not establish general performance, extraction accuracy, or metadata equivalence.`;
}
function methodology(report: Report): string {
  return `Measured ${md(report.timestamp)} with Node ${md(report.node)} on ${md(report.platform)}; ${md(report.hardware.cpuModel)}, ${report.hardware.logicalCpus} logical CPUs, ${number(report.hardware.memoryBytes / 1024 ** 3)} GiB RAM. Commit ${md(report.workspace.commit)}${report.workspace.dirty ? ' (dirty workspace)' : ''}.\n\nVersions: ${Object.entries(
    report.versions,
  )
    .map(([name, version]) => `${md(name)} ${md(version)}`)
    .join(
      ', ',
    )}. ${report.config.rounds} rounds; Tinybench warm measurement ${report.config.durationMs} ms, sustained resource measurement ${report.config.resourceDurationMs} ms, batch concurrency ${report.config.concurrency}. Warm medians pool timing samples per workload across rounds; single-file workload medians are equally weighted within each format. Batch call time is divided by document count, so it is amortized ms/document. Cold extraction and module load are reported separately below.\n\nCPU uses OS process user + system counters during sustained extraction, wall-time weighted across runs: 100% is one logical core and values can exceed 100%. Host capacity is this process CPU divided by logical CPU count, not total system-wide utilization. Throughput is total completed documents divided by measured wall time. Peak RSS is the OS process high-water mark across module load, latency and resource phases; retained RSS/heap are means after GC while inputs and first/last results remain retained. The resource loop yields once per completed call and includes adapter/cleanup and monitoring overhead. The 100 ms CPU timeline may be delayed by synchronous blocking; aggregate CPU remains measured by OS counters. Idle CPU is measured over 300 ms after a 200 ms settling period. This is a short recovery check, not proof of leak freedom. Failed/incomplete measurements carry † and cannot win. Async adapters are awaited through completion.`;
}
export function compactTerminal(report: Report): string {
  const values = rows(report);
  const packages = [...new Set(report.workloads.flatMap((workload) => workload.packages))];
  const columns = ['Workload', ...packages];
  const cells = [...new Set(values.map((row) => row.group))].map((group) =>
    [group].concat(
      packages.map((name) => {
        const row = values.find((value) => value.group === group && value.package === name);
        return row?.complete
          ? `${number(row.latency)} ms / ${row.cpu.toFixed(0)}%`
          : row
            ? 'incomplete'
            : '—';
      }),
    ),
  );
  const widths = columns.map((label, index) =>
    Math.max(label.length, ...cells.map((cell) => (cell[index] ?? '').length)),
  );
  const line = (cell: string[]): string =>
    cell.map((value, index) => value.padEnd(widths[index] ?? 0)).join('   ');
  return [
    `\n${report.corpus.length} real documents · ${report.config.rounds} process rounds · ${report.failures.length} failed runs`,
    'Warm ms/document / sustained process CPU (100% = one core)\n',
    line(columns),
    ...cells.map(line),
    '\nMemory, CPU timelines, provenance and full measurements are in the report.',
  ].join('\n');
}
function imageQuality(report: Report): string {
  if (!report.corpus.some((document) => document.format === 'image')) return '';
  const scored = report.samples.filter(
    (sample) =>
      sample.round === 0 &&
      report.workloads.some((work) => work.id === sample.workload && work.mode === 'single'),
  );
  const lines = scored.flatMap((sample) =>
    (sample.quality ?? []).map(
      (score) =>
        `| ${md(score.documentId)} | ${md(sample.package)} | ${number((100 * score.characterEdits) / score.referenceCharacters)} | ${number((100 * score.wordEdits) / score.referenceWords)} |`,
    ),
  );
  return `\n\n### Image OCR accuracy\n\nundms uses ocrs in **${report.config.ocrMode ?? 'balanced'}** mode; Tesseract.js uses English LSTM (OEM 1), the pinned best_int model, and reused workers (up to ${report.config.concurrency}, bounded by image count). Native OCR uses its dedicated serial lane. Models are prepared before timing; first recognition includes engine initialization. Warm timing excludes worker creation and final termination.\n\n| Receipt | Engine | Character error % | Word error % |\n| --- | --- | ---: | ---: |\n${lines.join('\n')}\n\nLower error rates are better. Scores use the first single-image output from round 1, normalized with NFKC, lowercase and collapsed whitespace. Levenshtein edits are divided by reference characters or words; insertions can produce rates above 100%. Reference text follows SROIE annotation order, so layout order and annotation errors affect scores. Three receipts do not establish general OCR accuracy. [Pinned images and reference annotations](../../image-corpus-manifest.json).`;
}

export async function writePackageReport(report: Report, directory: string): Promise<void> {
  await mkdir(directory, { recursive: true });
  const values = rows(report);
  const packages = [...new Set(report.workloads.flatMap((workload) => workload.packages))];
  const summary = `## Package extraction benchmark\n\n${report.corpus.length} sourced documents across ${[...new Set(report.corpus.map((document) => document.format.toUpperCase()))].join(', ')}. ${report.config.rounds} isolated process rounds per package/workload on ${md(report.hardware.cpuModel)} (${report.hardware.logicalCpus} logical CPUs).\n\n**Warm time per document, milliseconds — lower is faster.** Each single-file median is weighted equally; batches contain distinct documents and report amortized cost. Unsupported formats are shown as —; incomplete measurements are not ranked.\n\n${latencyTable(values, packages)}\n\n![Batch extraction latency](latency.svg)\n\n${conclusions(report, values)}${imageQuality(report)}\n\n**CPU is measured separately under sustained load**, using OS process user + system counters, including native threads. 100% means one occupied core, not the whole machine. More CPU utilization can reflect useful parallel work; compare it with completed documents/s and CPU time/document.\n\n${report.failures.length} failed runs. [CPU, memory and methodology](report.md) · [Raw measurements](results.json)\n\n<details>\n<summary>Environment and measurement method</summary>\n\n${methodology(report)}\n\n</details>\n`;
  const resources = [
    '| Format / mode | Package | Process CPU % | Host capacity % | CPU ms/doc | docs/s | Peak RSS MiB | After-GC RSS MiB | After-GC heap MiB | Idle CPU % |',
    '| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...values.map(
      (row) =>
        `| ${md(row.group)} | ${md(row.package)}${row.complete ? '' : ' †'} | ${[row.cpu, row.machineCpu, row.throughput > 0 ? ((row.cpu / 100) * 1000) / row.throughput : 0, row.throughput, row.peakRss, row.retainedRss, row.retainedHeap, row.idleCpu].map(number).join(' | ')} |`,
    ),
  ].join('\n');
  const details = report.workloads
    .map((workload) => {
      const selected = report.samples.filter((sample) => sample.workload === workload.id);
      return [
        `### ${md(workload.label)}\n\n${md(workload.format)} / ${workload.mode}; ${workload.documentIds.length} documents: ${workload.documentIds.map(md).join(', ')}.`,
        '| Package | Round | Warm p50 ms/call | Cold ms | Load ms | Output UTF-16 units |',
        '| --- | ---: | ---: | ---: | ---: | --- |',
        ...selected.map(
          (sample) =>
            `| ${md(sample.package)} | ${sample.round} | ${number(median(sample.latencyMs))} | ${number(sample.coldMs)} | ${number(sample.loadMs)} | ${sample.textLengths.join(', ')} |`,
        ),
      ].join('\n');
    })
    .join('\n\n');
  const corpus = report.corpus
    .map(
      (document) =>
        `- **${md(document.title)}** (${md(document.id)}, ${md(document.format)}, ${document.bytes} bytes): [source](${encodeURI(document.sourceUrl).replaceAll(')', '%29').replaceAll('(', '%28')}), license ${md(document.license)}. Local path: ${md(document.path)}. SHA-256: ${md(document.sha256)}. Expected markers: ${document.expectedText.map(md).join('; ')}.`,
    )
    .join('\n');
  const failures = report.failures.length
    ? report.failures
        .map(
          (failure) =>
            `- ${md(failure.package)} / ${md(failure.workload)} / round ${failure.round}: ${md(failure.error)}`,
        )
        .join('\n')
    : 'No failed runs.';
  const cleanup = report.samples
    .filter((sample) => sample.cleanup)
    .map(
      (sample) =>
        `| ${md(sample.workload)} | ${md(sample.package)} | ${sample.round} | ${number(sample.cleanup?.durationMs ?? 0)} | ${number(sample.cleanup?.rssMiB ?? 0)} |`,
    )
    .join('\n');
  const lifecycle = cleanup
    ? `\n\n## OCR worker cleanup\n\nWarm resource measurements retain reusable workers and models. Tesseract workers are then terminated before the idle check; native models remain process cached. Post-termination RSS includes retained inputs/results and allocator pages and is not a leak verdict.\n\n| Workload | Package | Round | Termination + GC ms | RSS after termination MiB |\n| --- | --- | ---: | ---: | ---: |\n${cleanup}`
    : '';
  const full = `${summary}\n## Sustained CPU\n\n![Process CPU](cpu.svg)\n\n<details>\n<summary>Resource measurements by format and package</summary>\n\n${resources}\n\n</details>\n\n<details>\n<summary>Per-file and batch timings, cold starts and output lengths</summary>\n\n${details}\n\n</details>\n\n## Corpus and provenance\n\n${corpus}\n\n## Failures\n\n${failures}${lifecycle}\n`;
  await Promise.all([
    writeFile(join(directory, 'README.md'), summary),
    writeFile(join(directory, 'report.md'), full),
    writeFile(join(directory, 'results.json'), `${JSON.stringify(report, null, 2)}\n`),
    writeFile(join(directory, 'latency.svg'), chart(values, 'latency')),
    writeFile(join(directory, 'cpu.svg'), chart(values, 'cpu')),
  ]);
}
