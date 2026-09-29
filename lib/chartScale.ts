// Pure layout maths for the small hand-drawn SVG charts (react-native-svg, no chart
// library): clean axis ticks, and where one block ends and the next begins. Kept
// out of the components so it can be checked without rendering anything.

// A "nice" step for a range: 1, 2, 2.5 or 5 times a power of ten.
function niceStep(range: number, intervals: number): number {
  const raw = range / Math.max(1, intervals);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const f = raw / mag;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * mag;
}

export type Scale = { min: number; max: number; ticks: number[] };

// Axis bounds and ticks around [lo, hi], rounded out to clean numbers. `zero`
// anchors the scale at 0 — bars must grow from a true zero baseline; a line can
// zoom to its own range. A flat series (lo === hi) still gets a visible range,
// centred on its value. Never goes negative for non-negative data.
export function niceScale(lo: number, hi: number, { zero = false, intervals = 2 } = {}): Scale {
  if (zero) lo = Math.min(0, lo);
  if (hi === lo) {
    const d = Math.abs(hi) * 0.1 || 1;
    hi += d;
    if (!zero) lo -= d;
  }
  const step = niceStep(hi - lo, intervals);
  const floorAtZero = lo >= 0;
  let min = Math.floor(lo / step) * step;
  if (floorAtZero) min = Math.max(0, min);
  const max = Math.ceil(hi / step) * step;
  const ticks: number[] = [];
  for (let v = min; v <= max + step / 2; v += step) ticks.push(Math.round(v * 1e6) / 1e6);
  return { min, max, ticks };
}

// "40", "42.5", "1.2k", "12k" — short enough for a narrow axis gutter.
export function formatTick(v: number): string {
  if (Math.abs(v) >= 1000) {
    const k = v / 1000;
    return `${Math.round(k * 10) / 10}k`.replace(/\.0k$/, "k");
  }
  return String(Math.round(v * 10) / 10);
}

// Consecutive runs of the same block, as index ranges into the series — one per
// block the movement was logged in. Block changes are where the markers go.
export type BlockRun = { block: number; start: number; end: number };
export function blockRuns(points: { block: number }[]): BlockRun[] {
  const runs: BlockRun[] = [];
  points.forEach((p, i) => {
    const last = runs[runs.length - 1];
    if (last && last.block === p.block) last.end = i;
    else runs.push({ block: p.block, start: i, end: i });
  });
  return runs;
}
