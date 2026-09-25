/**
 * format-tick.ts — the arithmetic the charts share: tick labels, gridline
 * placement, radial tips, ring-segment paths, series colours.
 *
 * Map:
 * - formatTick — One axis tick, compacted — "1.5K", not "1500".
 * - formatValue — ONE value, in full — what a tooltip shows.
 * - ChartScale — A value axis: what it spans, where a value sits, and how it divides.
 * - chartScale — The axis a set of values needs.
 * - tickPercent — Where the i-th of `steps` divisions sits, as a percentage UP from the bottom.
 * - radialArea — The `position-area` on the OUTWARD side of a radial mark.
 * - RingSegmentOptions — the radii, angles and corner rounding of one donut slice
 * - ringSegmentPath — The `d` for a CLOSED ring segment — a donut slice — with four rounded corners.
 * - seriesVar — The custom property a mark paints with.
 * - seriesBorderVar — the property a mark's OUTLINE paints with — the series' identity
 */

/**
 * One axis tick, compacted — "1.5K", not "1500".
 *
 * TRAP T-one-function-places-label-and-gridline
 */
export function formatTick(value: number): string {
  if (!Number.isFinite(value)) return '';
  const abs = Math.abs(value);

  /* SMALLEST unit first: rounding can push a value out of the tier it just
     tested into, and largest-first skips the bigger tier before the smaller
     one discovers it. 999,999 is under a million, yet reads "1M".
     TRAP T-a-tooltip-is-not-an-axis */
  for (let i = 0; i < UNITS.length; i++) {
    const [size, suffix] = UNITS[i]!;
    if (abs < size) break;
    const scaled = trim(value / size);
    if (Math.abs(Number(scaled)) < 1_000 || i === UNITS.length - 1) {
      return `${scaled}${suffix}`;
    }
    const [bigger, bigSuffix] = UNITS[i + 1]!;
    return `${trim(value / bigger)}${bigSuffix}`;
  }

  // Below 10, a 0–1 ratio axis without the decimal is just "0" and "1".
  const whole = trim(value, abs < 10 ? 1 : 0);
  // The same crossing at the bottom: 999.5 is "1K", not "1000".
  return Math.abs(Number(whole)) >= 1_000 ? `${trim(value / 1_000)}K` : whole;
}

const UNITS = [[1_000, 'K'], [1_000_000, 'M']] as const;

/**
 * ONE value, in full — what a tooltip shows.
 *
 * Grouped, and decimals kept as they arrive — `reduceRows` returns a mean
 * unrounded on purpose, and rounding is the caller's decision.
 * TRAP T-a-tooltip-is-not-an-axis
 */
export function formatValue(value: number): string {
  if (!Number.isFinite(value)) return '';
  return value.toLocaleString(undefined, { maximumFractionDigits: 2 });
}

/** Round to `places` and drop trailing zeros, so 1.0 reads as "1". */
function trim(value: number, places = 1): string {
  return String(Number(value.toFixed(places)));
}

/* ── Scale ────────────────────────────────────────────────────────────── */

/** A value axis: what it spans, where a value sits, and how it divides. */
export interface ChartScale {
  min: number;
  max: number;
  /** `max - min`, never zero — a flat series still needs somewhere to draw. */
  span: number;
  /** Where a value sits, 0..100 from the bottom. Clamped. */
  percent: (value: number) => number;
  /** How many gridline BANDS divide it, so every line is a round number. */
  bands: number;
  /** What one band is worth. `max === min + step * bands`. */
  step: number;
}

/**
 * The axis a set of values needs.
 *
 * Three charts worked this out three different ways, so a bar and a sparkline
 * over the same data drew different heights. The FLOOR is the difference that
 * matters: a bar measured from zero is the only honest bar, while a sparkline
 * shows a shape and fits its own range.
 *
 * `min`/`max` override either end. `zero: false` fits the data instead.
 * TRAP T-one-scale-for-every-chart
 */
export function chartScale(
  values: readonly number[],
  options: { min?: number; max?: number; zero?: boolean; nice?: boolean; bands?: number } = {},
): ChartScale {
  const real = values.filter((v) => Number.isFinite(v));
  const zero = options.zero ?? true;

  const lo = Number.isFinite(options.min as number)
    ? (options.min as number)
    : zero ? Math.min(0, ...real) : Math.min(...real);
  const hi = Number.isFinite(options.max as number)
    ? (options.max as number)
    : zero ? Math.max(1, ...real) : Math.max(...real);

  // An empty set, or every value the same, still needs a span to divide by.
  const min = Number.isFinite(lo) ? lo : 0;
  const raw = Number.isFinite(hi) && hi > min ? hi : min + 1;
  /* A NICE TOP, always UP: 403 reads 500 and 59 reads 60, so the axis names a
     number a reader recognises and no bar touches the ceiling. The bands then
     divide the range equally. An explicit max is the caller's own.
     TRAP T-the-top-gridline-rounds-to-its-magnitude */
  const want = options.bands ?? 4;
  const axis = options.nice !== false && !Number.isFinite(options.max as number)
    ? niceAxis(min, raw, want)
    : { max: raw, bands: want, step: (raw - min) / want };
  const span = axis.max - min;

  return {
    min,
    max: axis.max,
    span,
    bands: axis.bands,
    step: axis.step,
    percent: (value) =>
      Math.max(0, Math.min(100, ((value - min) / span) * 100)),
  };
}

/** The round step sizes an axis is allowed to use, per power of ten. */
const NICE_STEPS = [1, 2, 2.5, 5, 10] as const;

/** How many gridline bands an axis will consider. Four is the usual answer. */
const BAND_RANGE = [3, 4, 5, 6] as const;

/**
 * An axis where EVERY gridline is a round number.
 *
 * Rounding only the top is not enough: 403 rounds to 500, and four equal bands
 * of that are 125, 250, 375 — nobody reads an axis in 125s. The STEP is what
 * gets rounded, to 1, 2, 2½ or 5 times a power of ten, and the BAND COUNT
 * moves with it: 403 becomes five bands of 100, not four of 125.
 *
 * Always UP, so no bar reaches the ceiling, and the tightest fit wins so the
 * plot is not half empty.
 * TRAP T-the-top-gridline-rounds-to-its-magnitude
 */
function niceAxis(min: number, hi: number, want: number): { max: number; bands: number; step: number } {
  const span = hi - min;
  const plain = { max: hi, bands: want, step: span / want };
  if (!Number.isFinite(span) || span <= 0 || want <= 0) return plain;

  const unit = 10 ** Math.floor(Math.log10(span / want));
  const steps = [unit / 10, unit, unit * 10].flatMap((u) => NICE_STEPS.map((m) => m * u));

  const fits = steps
    .flatMap((step) => BAND_RANGE.map((bands) => ({ step, bands, max: min + step * bands })))
    .filter((c) => c.max >= hi && Number.isFinite(c.max));

  if (!fits.length) return plain;
  /* The TIGHTEST top wins; ties go to the band count the caller asked for, so
     an axis that fits either way looks like every other one. */
  fits.sort((a, b) =>
    (a.max - b.max) || (Math.abs(a.bands - want) - Math.abs(b.bands - want)));
  const best = fits[0]!;
  return { max: Number(best.max.toPrecision(12)), bands: best.bands, step: best.step };
}

/**
 * Where the i-th of `steps` divisions sits, as a percentage UP from the bottom.
 *
 * TRAP T-one-function-places-label-and-gridline
 */
export function tickPercent(index: number, steps: number): number {
  if (steps <= 0) return 0;
  return (index / steps) * 100;
}

/**
 * The `position-area` on the OUTWARD side of a radial mark.
 *
 * TRAP T-radial-tip-pushes-outward
 *
 * @param angleDeg CLOCKWISE from 12 o'clock, as the donut and gauge place marks.
 */
export function radialArea(angleDeg: number): string {
  // The half-octant offset puts 0deg squarely in `block-start`, not on a
  // boundary. TRAP T-radial-tip-pushes-outward
  const deg = ((angleDeg % 360) + 360) % 360;
  const octant = Math.floor(((deg + 22.5) % 360) / 45);
  return RADIAL_AREAS[octant] ?? 'block-start';
}

/** Octant 0 is up, going clockwise. Indexed by radialArea(). */
const RADIAL_AREAS = [
  'block-start',                // 12 o'clock — straight up
  'block-start inline-end',     // 1–2
  'inline-end',                 // 3
  'block-end inline-end',       // 4–5
  'block-end',                  // 6 — straight down
  'block-end inline-start',     // 7–8
  'inline-start',               // 9
  'block-start inline-start',   // 10–11
] as const;

/* ── Ring segments ────────────────────────────────────────────────────── */

/** One point on a circle. Angles run CLOCKWISE from 12 o'clock. */
function polar(cx: number, cy: number, r: number, deg: number): [number, number] {
  const rad = ((deg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(rad), cy + r * Math.sin(rad)];
}

export interface RingSegmentOptions {
  /** Centre of the ring, in viewBox units. */
  cx: number;
  cy: number;
  /** Inner radius. 0 draws a solid wedge — a pie slice. */
  inner: number;
  /** Outer radius. */
  outer: number;
  /** Start, CLOCKWISE degrees from 12 o'clock. */
  startDeg: number;
  /** End. Must be greater than startDeg. */
  endDeg: number;
  /** Corner rounding, viewBox units. Clamped to what the segment can hold. */
  radius?: number;
}

/**
 * The `d` for a CLOSED ring segment — a donut slice — with four rounded corners.
 *
 * TRAP T-ring-segment-needs-two-radius-clamps
 */
export function ringSegmentPath(options: RingSegmentOptions): string {
  const { cx, cy, inner, outer, startDeg, endDeg } = options;
  const span = endDeg - startDeg;
  if (span <= 0 || outer <= 0) return '';

  // A whole circle — TRAP T-ring-segment-needs-two-radius-clamps.
  if (span >= 359.999) {
    const ring = (r: number, sweep: number): string => {
      const [x, y] = polar(cx, cy, r, 0);
      const [bx, by] = polar(cx, cy, r, 180);
      return `M ${x} ${y} A ${r} ${r} 0 0 ${sweep} ${bx} ${by} A ${r} ${r} 0 0 ${sweep} ${x} ${y} Z`;
    };
    return inner > 0 ? `${ring(outer, 1)} ${ring(inner, 0)}` : ring(outer, 1);
  }

  const band = outer - inner;
  // Degrees of arc that `r` units span at radius `rad`.
  const degFor = (r: number, rad: number): number =>
    rad <= 0 ? 0 : (r / rad) * (180 / Math.PI);

  // Both clamps — TRAP T-ring-segment-needs-two-radius-clamps.
  const asked = options.radius ?? 0;
  const byBand = band / 4;
  const arcAt = (inner > 0 ? inner : outer) * ((span * Math.PI) / 180);
  const r = Math.max(0, Math.min(asked, byBand, arcAt / 4));

  const outerInset = degFor(r, outer);
  const innerInset = degFor(r, inner);
  // A pie's inner "arc" is one point, so its corners collapse.
  const pie = inner <= 0;

  const oStart = startDeg + outerInset;
  const oEnd = endDeg - outerInset;
  const iStart = startDeg + innerInset;
  const iEnd = endDeg - innerInset;

  // SVG needs the long-arc flag once the sweep passes a half circle.
  const longOuter = oEnd - oStart > 180 ? 1 : 0;
  const longInner = iEnd - iStart > 180 ? 1 : 0;

  const p = (rad: number, deg: number): string =>
    polar(cx, cy, rad, deg).map((n) => n.toFixed(4)).join(' ');
  const parts: string[] = [];

  // Leading edge, corner, outer arc, corner, trailing edge.
  parts.push(`M ${p(inner + r, startDeg)}`);
  parts.push(`L ${p(outer - r, startDeg)}`);
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer, oStart)}`);
  parts.push(`A ${outer} ${outer} 0 ${longOuter} 1 ${p(outer, oEnd)}`);
  parts.push(`A ${r} ${r} 0 0 1 ${p(outer - r, endDeg)}`);
  parts.push(`L ${p(inner + r, endDeg)}`);
  if (!pie) {
    // Corner, inner arc BACKWARDS, corner.
    parts.push(`A ${r} ${r} 0 0 1 ${p(inner, iEnd)}`);
    parts.push(`A ${inner} ${inner} 0 ${longInner} 0 ${p(inner, iStart)}`);
    parts.push(`A ${r} ${r} 0 0 1 ${p(inner + r, startDeg)}`);
  }
  parts.push('Z');
  return parts.join(' ');
}

/* ── Series colours ───────────────────────────────────────────────────── */

/** How many data-viz series the token layer defines. */
const SERIES_COUNT = 10;

/** The custom property a mark paints with. `index` is 0-based; an explicit
 *  `colorIndex` from the data is 1-based. Wraps — see `seriesSlot`. */
export function seriesVar(index: number, colorIndex?: number): string {
  return `var(--sherpa-data-viz-series-${seriesSlot(index, colorIndex)})`;
}

/** The mark's OUTLINE for the same series — the fill moves along its ramp, the
 *  border is the series' identity and stays put. */
export function seriesBorderVar(index: number, colorIndex?: number): string {
  const n = seriesSlot(index, colorIndex);
  return `var(--sherpa-data-viz-series-border-${n}, var(--sherpa-data-viz-series-${n}))`;
}

/**
 * Which of the ten slots a mark paints with — always 1..10, whatever arrives.
 *
 * The sequence is a RING: 0 is slot 10 as 11 is slot 1. An unwrapped 0 asked
 * for `--sherpa-data-viz-series-0`, which does not exist, so the mark painted
 * nothing. TRAP T-series-count-is-ten-not-eleven
 */
function seriesSlot(index: number, colorIndex?: number): number {
  const asked = colorIndex ?? index + 1;
  if (!Number.isFinite(asked)) return 1;
  const n = Math.trunc(asked);
  return ((n - 1) % SERIES_COUNT + SERIES_COUNT) % SERIES_COUNT + 1;
}
