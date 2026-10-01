/**
 * grid-resize.ts — a layout grid read as bands and spans, its gutter handles, and its dragged layout.
 * TRAP T-a-wrapping-span-hides-its-own-row · TRAP T-a-dragged-layout-is-kept-per-column-count
 *
 * Map:
 * - GridModel — a resizable grid as measured: its tracks, its pitches and its bands
 * - GridHandle — one handle: where it sits, which line it moves, and its name
 * - GridLayout — a dragged layout: each child's counted spans, per column count
 * - readGrid — measure a grid; null where it cannot be resized
 * - gridHandles — the handles a measured grid draws in its gutters
 * - handleValues — what a handle says: its span, its range, in words
 * - moveHandle — move a handle's line by whole steps and write the spans; true if any moved
 * - readLayout — the layout a grid holds now
 * - writeLayout — put a layout back, or none, silently
 */
import { MAX_ROW_SPAN, MIN_COL_SPAN, moveLine, reach, type Segment } from './grid-lines.js';
import { rowsByTop } from './grouped-grid.js';

interface Band {
  kids: HTMLElement[];
  spans: number[];
  /** Each card's right edge, in the handles' space. */
  rights: number[];
  rows: number;
  top: number;
  bottom: number;
  /** Its cards sit edge to edge from the row's start: its columns can move. */
  cols: boolean;
  /** Its rows can move; a band that cannot is LOCKED, and a move passes through it. */
  floor: number;
  ceil: number;
  filler: boolean;
}

/** A resizable grid as measured. */
export interface GridModel {
  grid: HTMLElement;
  /** Its column count now. */
  count: number;
  pitchX: number;
  pitchY: number;
  colGap: number;
  rowGap: number;
  /** The content box, in the handles' own space (the grid's padding box, scrolled). */
  left: number;
  width: number;
  bands: Band[];
  fit: boolean;
  /** Children with no id: a grid with any draws no handles. */
  missing: HTMLElement[];
}

/** One handle. */
export interface GridHandle {
  key: string;
  orientation: 'vertical' | 'horizontal';
  label: string;
  x: number;
  y: number;
  w: number;
  h: number;
  axis: 'x' | 'y';
  /** The band whose cards a column handle moves; -1 for a row handle. */
  band: number;
  line: number;
  segs: Segment[];
}

/** A dragged layout: per column count, each child's counted spans. */
export interface GridLayout {
  byCount: Record<string, Record<string, { cols?: number; rows?: number }>>;
  /** A fit grid's row count, as dragged. */
  rowCount?: number;
}

const COUNTED = /^data-(col|row)-span-(\d+)$/;
const near = (a: number, b: number): boolean => Math.abs(a - b) <= 1;

/** A child's highest-rows floor, or null where it states none. */
const minRows = (kid: HTMLElement): number | null => {
  const n = Number(kid.dataset['minRowSpan']);
  return Number.isInteger(n) && n >= 1 && n <= MAX_ROW_SPAN ? n : null;
};

/** The children a grid lays out. */
const kidsOf = (grid: HTMLElement): HTMLElement[] =>
  [...grid.children].filter((c): c is HTMLElement => c instanceof HTMLElement && c.getClientRects().length > 0);

/**
 * Measure a grid: null where it cannot be resized — not `data-resizable`,
 * grouped, a set column count, right to left, or under six columns.
 */
export function readGrid(grid: HTMLElement): GridModel | null {
  if (!grid.hasAttribute('data-resizable') || grid.hasAttribute('data-grouped')
    || grid.hasAttribute('data-col-count')) return null;
  const cs = getComputedStyle(grid);
  if (cs.direction !== 'ltr') return null;
  const tracks = cs.gridTemplateColumns.split(' ').filter(Boolean);
  const count = tracks.length;
  if (count < 2 * MIN_COL_SPAN) return null;
  const colGap = parseFloat(cs.columnGap) || 0;
  const rowGap = parseFloat(cs.rowGap) || 0;
  const pitchX = parseFloat(tracks[0]!) + colGap;
  const rowH = parseFloat(cs.getPropertyValue('--sherpa-layout-grid-row-height')) || 88;
  const pitchY = rowH + rowGap;
  const box = grid.getBoundingClientRect();
  // The handles' space: the padding box, scrolled with a fit grid's content.
  const ox = box.left + (parseFloat(cs.borderLeftWidth) || 0) - grid.scrollLeft;
  const oy = box.top + (parseFloat(cs.borderTopWidth) || 0) - grid.scrollTop;
  const left = parseFloat(cs.paddingLeft) || 0;
  const width = grid.clientWidth - left - (parseFloat(cs.paddingRight) || 0);
  const fit = cs.getPropertyValue('--_grid-fit').trim() === '1';
  const kids = kidsOf(grid);
  const filler = fit ? (kids.find((k) => k.hasAttribute('data-grow')) ?? kids.at(-1) ?? null) : null;

  let deepest = -Infinity;
  const bands = rowsByTop(kids).map((row): Band => {
    const rects = row.map((k) => k.getBoundingClientRect());
    const top = rects[0]!.top - oy;
    const bottom = Math.max(...rects.map((r) => r.bottom)) - oy;
    const spans = rects.map((r) => Math.max(1, Math.round((r.width + colGap) / pitchX)));
    const rows = Math.max(1, Math.round((bottom - top + rowGap) / pitchY));
    const cols = near(rects[0]!.left - ox, left)
      && rects.every((r, i) => i === 0 || near(r.left, rects[i - 1]!.right + colGap))
      && spans.reduce((t, s) => t + s, 0) <= count;
    const mins = row.map(minRows);
    const free = mins.every((m) => m != null)
      && rects.every((r) => near(r.bottom - oy, bottom))
      && deepest <= top + 1;
    deepest = Math.max(deepest, bottom);
    const floor = free ? Math.min(rows, Math.max(...(mins as number[]))) : rows;
    return {
      kids: row, spans, rights: rects.map((r) => r.right - ox), rows, top, bottom, cols, floor,
      ceil: free ? MAX_ROW_SPAN : rows, filler: !!filler && row.includes(filler),
    };
  });
  return {
    grid, count, pitchX, pitchY, colGap, rowGap, left, width, bands, fit,
    missing: kids.filter((k) => !k.id),
  };
}

/** A child's name, for its handle: its own label or heading, a heading inside it, or its id. */
const nameOf = (kid: HTMLElement): string => kid.dataset['label'] ?? kid.dataset['heading']
  ?? kid.querySelector<HTMLElement>('[data-heading]')?.dataset['heading'] ?? kid.id;

/** A band's cards as segments, then the free columns at the row's end. */
const colSegs = (m: GridModel, b: number): Segment[] => {
  const band = m.bands[b]!;
  const used = band.spans.reduce((t, s) => t + s, 0);
  const next = m.bands[b + 1]?.spans[0];
  return [
    ...band.spans.map((span) => ({ span, floor: Math.min(MIN_COL_SPAN, span), ceil: m.count })),
    // Never so much room that the next row's first card jumps up.
    { span: m.count - used, floor: 0, ceil: next != null ? next - 1 : m.count },
  ];
};

/** The grid's bands as segments, then the page, or a fit grid's filler. */
const rowSegs = (m: GridModel): Segment[] | null => {
  const bands = m.bands.filter((b) => !b.filler);
  const filler = m.bands.find((b) => b.filler);
  // A filler that is not the last band: no rows move.
  if (filler && m.bands.at(-1) !== filler) return null;
  const segs = bands.map((b) => ({ span: b.rows, floor: b.floor, ceil: b.ceil }));
  if (filler) {
    const floor = Math.max(2, ...filler.kids.map((k) => minRows(k) ?? 0));
    segs.push({ span: Math.floor((filler.bottom - filler.top + m.rowGap) / m.pitchY), floor, ceil: Infinity });
  } else segs.push({ span: Infinity, floor: 0, ceil: Infinity });
  return segs;
};

/** The handles a measured grid draws: none if any child has no id. */
export function gridHandles(m: GridModel): GridHandle[] {
  if (m.missing.length) return [];
  const out: GridHandle[] = [];
  for (const [b, band] of m.bands.entries()) {
    if (!band.cols || band.filler) continue;
    const segs = colSegs(m, b);
    const h = band.bottom - band.top;
    for (const [i, kid] of band.kids.entries()) {
      const last = i === band.kids.length - 1;
      if (last && segs.at(-1)!.span <= 0) continue;
      const right = band.rights[i]!;
      out.push({
        key: last ? `c:end:${kid.id}` : `c:${kid.id}`, orientation: 'vertical', label: `Width of ${nameOf(kid)}`,
        x: right, y: band.top, w: m.colGap, h, axis: 'x', band: b, line: i, segs,
      });
    }
  }
  const segs = rowSegs(m);
  if (segs) {
    const rows = m.bands.filter((b) => !b.filler);
    for (const [b, band] of rows.entries()) {
      const below = segs[b + 1]!;
      const locked = (s: Segment): boolean => s.floor === s.ceil;
      // A band and the page: only a band that can move has a handle under it.
      if (below.span === Infinity ? locked(segs[b]!) : locked(segs[b]!) && locked(below)) continue;
      out.push({
        key: below.span === Infinity ? 'r:end' : `r:${band.kids[0]!.id}`, orientation: 'horizontal',
        label: `Height of row ${b + 1}`, x: m.left, y: band.bottom, w: m.width, h: m.rowGap,
        axis: 'y', band: -1, line: b, segs,
      });
    }
  }
  return out;
}

/** The values a handle says: its near span, and how far it can go. */
export function handleValues(h: GridHandle, count: number): { now: number; min: number; max: number; text: string } {
  const now = h.segs[h.line]!.span;
  const { min, max } = reach(h.segs, h.line);
  const text = h.axis === 'x' ? `${now} of ${count} columns` : `${now} ${now === 1 ? 'row' : 'rows'}`;
  return { now, min: now - min, max: now + max, text };
}

/** Write one counted attribute, only where it moved. */
const put = (kid: HTMLElement, name: string, value: number): boolean => {
  if (kid.getAttribute(name) === String(value)) return false;
  kid.setAttribute(name, String(value));
  return true;
};

/**
 * Move a handle's line by whole steps, from a model taken when the gesture
 * began, and write the spans that result. True if any attribute moved.
 */
export function moveHandle(m: GridModel, h: GridHandle, steps: number): boolean {
  const spans = moveLine(h.segs, h.line, steps);
  let moved = false;
  if (h.axis === 'x') {
    const name = `data-col-span-${m.count}`;
    // The first width at a count freezes every child, so no name reflows around it.
    const frozen = m.bands.flatMap((b) => b.kids).every((k) => k.hasAttribute(name));
    if (!frozen) for (const b of m.bands) b.kids.forEach((k, i) => { moved = put(k, name, b.spans[i]!) || moved; });
    m.bands[h.band]!.kids.forEach((k, i) => { moved = put(k, name, spans[i]!) || moved; });
    return moved;
  }
  const name = `data-row-span-${m.count}`;
  const rows = m.bands.filter((b) => !b.filler);
  for (const [b, band] of rows.entries()) {
    if (spans[b] === band.rows && !band.kids.some((k) => k.hasAttribute(name))) continue;
    for (const kid of band.kids) moved = put(kid, name, spans[b]!) || moved;
  }
  if (m.fit) {
    const total = String(rows.reduce((t, _, b) => t + spans[b]!, 0) + 1);
    if (m.grid.style.getPropertyValue('--_row-count') !== total) {
      m.grid.style.setProperty('--_row-count', total);
      moved = true;
    }
  }
  return moved;
}

/** The layout a grid holds now: every counted attribute, and a fit grid's row count. */
export function readLayout(grid: HTMLElement): GridLayout {
  const byCount: GridLayout['byCount'] = {};
  for (const kid of grid.children) {
    if (!(kid instanceof HTMLElement) || !kid.id) continue;
    for (const { name, value } of kid.attributes) {
      const m = COUNTED.exec(name);
      if (!m) continue;
      const at = (byCount[m[2]!] ??= {});
      (at[kid.id] ??= {})[m[1] === 'col' ? 'cols' : 'rows'] = Number(value);
    }
  }
  const rowCount = Number(grid.style.getPropertyValue('--_row-count'));
  return { byCount, ...(rowCount ? { rowCount } : {}) };
}

/**
 * Put a layout back — or none, which is the authored layout — silently. A
 * count's widths apply only if every child has one; a bad value is dropped.
 * TRAP T-apply-degrades-never-throws
 */
export function writeLayout(grid: HTMLElement, layout: GridLayout | null): void {
  const kids = [...grid.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  for (const kid of kids) {
    for (const name of [...kid.getAttributeNames()]) if (COUNTED.test(name)) kid.removeAttribute(name);
  }
  grid.style.removeProperty('--_row-count');
  if (!layout || typeof layout !== 'object') return;
  for (const [count, ids] of Object.entries(layout.byCount ?? {})) {
    const c = Number(count);
    if (!Number.isInteger(c) || c < 1 || !ids || typeof ids !== 'object') continue;
    const whole = (n: unknown, top: number): n is number => Number.isInteger(n) && (n as number) >= 1 && (n as number) <= top;
    const widths = kids.every((k) => whole(ids[k.id]?.cols, c));
    for (const kid of kids) {
      const at = ids[kid.id];
      if (widths) kid.setAttribute(`data-col-span-${c}`, String(at!.cols));
      if (whole(at?.rows, MAX_ROW_SPAN)) kid.setAttribute(`data-row-span-${c}`, String(at!.rows));
    }
  }
  const n = layout.rowCount;
  if (grid.dataset['rows'] === 'fit' && Number.isInteger(n) && n! >= 2) grid.style.setProperty('--_row-count', String(n));
}
