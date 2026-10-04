interface ConclusionRow {
  format: string;
  count: number;
  package: string;
  completedRounds: number;
  p50Ms: number;
  cpuMsPerCall: number;
  peakRssMiB: number;
  timerP95Ms: number;
  textMatch: string;
}
function lowest(rows: ConclusionRow[], metric: (row: ConclusionRow) => number): string {
  const minimum = Math.min(...rows.map(metric));
  return rows
    .filter((row) => metric(row) === minimum)
    .map((row) => row.package)
    .join(' / ');
}
export function packageConclusion(
  rows: ConclusionRow[],
  formats: string[],
  rounds: number,
  failures: number,
): string {
  const wins = new Map<string, number>();
  let completeWorkloads = 0;
  const comparisons = formats.flatMap((format) =>
    [1, 10].map((count) => {
      const values = rows.filter((row) => row.format === format && row.count === count);
      const expected = [
        'undms',
        'officeparser',
        ...(format === 'docx' ? ['mammoth'] : format === 'pdf' ? ['pdf-parse'] : []),
      ];
      if (
        !expected.every((name) =>
          values.some((row) => row.package === name && row.completedRounds === rounds),
        )
      ) {
        return `| ${format.toUpperCase()} × ${count} | Incomplete comparison | — | — | — | — |`;
      }
      completeWorkloads++;
      const ranked = values.toSorted((a, b) => a.p50Ms - b.p50Ms);
      const fastest = lowest(values, (row) => row.p50Ms);
      const winner = ranked[0];
      const second = ranked[1];
      if (!winner || !second) throw new Error('Missing comparison candidates');
      if (winner.p50Ms !== second.p50Ms)
        wins.set(winner.package, (wins.get(winner.package) ?? 0) + 1);
      const ratio = winner.p50Ms > 0 ? `${(second.p50Ms / winner.p50Ms).toFixed(2)}×` : '—';
      return `| ${format.toUpperCase()} × ${count} | ${fastest} | ${ratio} | ${lowest(values, (row) => row.cpuMsPerCall)} | ${lowest(values, (row) => row.peakRssMiB)} | ${lowest(values, (row) => row.timerP95Ms)} |`;
    }),
  );
  const leaders = [...wins].toSorted((a, b) => b[1] - a[1]);
  const summary = leaders.length
    ? `Warm median latency wins: ${leaders.map(([name, count]) => `${name} ${count}/${completeWorkloads}`).join(', ')} fully measured workloads. Ties are not counted as wins.`
    : 'No unique latency winner could be established from complete comparisons.';
  const different = rows.filter(
    (row) =>
      row.package !== 'undms' &&
      row.textMatch !== 'exact' &&
      row.textMatch !== 'whitespace differs',
  );
  const whitespace = rows.filter(
    (row) => row.package !== 'undms' && row.textMatch === 'whitespace differs',
  );
  return `## Conclusions from this run\n\n${summary}\n\n| Workload | Fastest warm p50 | Runner-up / fastest time | Lowest CPU/call | Lowest peak RSS | Lowest timer p95 |\n| --- | --- | ---: | --- | --- | --- |\n${comparisons.join('\n')}\n\nThe ratio compares the second-fastest package with the fastest on the same workload; 2× means the runner-up took twice as long. Winners use unrounded measurements. Small differences are not evidence of statistical significance. Batch winners describe amortized processing cost, not individual document latency. CPU, RSS and timer winners are independent observations, not a combined score.\n\n${failures ? `${failures} failed process runs were recorded. Incomplete comparisons have no declared winner.` : 'No process runs failed.'} Text differs beyond whitespace in ${different.length} competitor/workload rows; another ${whitespace.length} differs only in whitespace. Output similarity is relative to undms, not ground-truth correctness. Review extracted-text/ before treating different outputs as equivalent.\n\nPackage roles in this benchmark: **undms** provides native single/batch text extraction; **officeparser** provides multi-format parsing through an AST and text conversion; **Mammoth** is the DOCX-only raw-text comparator; **pdf-parse** is the PDF-only comparator with parser cleanup included. The specialist packages were not tested on unsupported formats.\n\nUse these results to choose for this fixture workload. This run does not establish a universal best package, accuracy winner, large-document ranking, or leak-free implementation.\n`;
}
