import { test, expect } from '@playwright/test';

/**
 * The GROUPING collection — renamed from Border, then reshaped twice on
 * 2026-09-14/15. Structure owns sizing and spacing; everything an edge-JOIN
 * affects lives here: the four `border/*` widths and the four `rounding/*` corners.
 *
 * FIVE collections cover all sixteen positions, with ONE pin per node:
 *
 *   Grouping        modes solo · start · mid · end   — the parent IS a ROW
 *   vertical        same modes, read as top/mid/bottom — a COLUMN
 *   grid-top        fixes the TOP row;    the mode picks the column
 *   grid-mid        fixes the MIDDLE row;  "
 *   grid-bottom     fixes the BOTTOM row;  "
 *
 * A Figma extension inherits its parent's modes and cannot add its own, so the
 * two axes need different mechanisms: one is the MODE, the other the COLLECTION.
 * Position went in the modes (4 values) and the row in the collections (3), which
 * is why this is 5 collections rather than 16.
 *
 * HALVED SHARED EDGES (Will, 2026-09-15): an edge shared with a neighbour is
 * aliased one step DOWN the width ramp — `sm` 0.5 → `xs` 0.25. Both neighbours
 * halve, so the two halves meet as one full-weight stroke at zero spacing. No edge
 * is dropped and no negative overlap is needed.
 *
 * A corner is round only when BOTH of its edges are outer.
 */

const EDGES = ['top', 'bottom', 'left', 'right'] as const;

/** collection → how its mode name maps onto the two axes. */
const AXES: Record<string, (mode: string) => { h: string; v: string }> = {
  '': (m) => ({ h: { solo: 'solo', start: 'left', mid: 'mid', end: 'right' }[m]!, v: 'solo' }),
  'vertical': (m) => ({ h: 'solo', v: { solo: 'solo', start: 'top', mid: 'mid', end: 'bottom' }[m]! }),
  'grid-top': (m) => ({ h: { solo: 'solo', start: 'left', mid: 'mid', end: 'right' }[m]!, v: 'top' }),
  'grid-mid': (m) => ({ h: { solo: 'solo', start: 'left', mid: 'mid', end: 'right' }[m]!, v: 'mid' }),
  'grid-bottom': (m) => ({ h: { solo: 'solo', start: 'left', mid: 'mid', end: 'right' }[m]!, v: 'bottom' }),
};

test('grouping: :root carries the full outer width', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady: boolean }).__reforgedReady === true);

  const r = await page.evaluate(() => {
    const read = (n: string) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
    return {
      top: read('--sherpa-border-top'), bottom: read('--sherpa-border-bottom'),
      left: read('--sherpa-border-left'), right: read('--sherpa-border-right'),
      rounding: read('--sherpa-border-rounding-top-left'),
    };
  });
  for (const edge of EDGES) expect(r[edge]).toBe('0.5px');
  expect(r.rounding).toBe('4px');
});

test('grouping: every position halves exactly the edges it shares', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady: boolean }).__reforgedReady === true);

  const VALUES: string[] = [];
  for (const mode of ['solo', 'start', 'mid', 'end']) VALUES.push(mode);
  for (const col of ['vertical', 'grid-top', 'grid-mid', 'grid-bottom'])
    for (const mode of ['solo', 'start', 'mid', 'end']) VALUES.push(`${col}-${mode}`);

  const r = await page.evaluate((values: string[]) => {
    const root = document.getElementById('root')!;
    const read = (el: Element, n: string) => getComputedStyle(el).getPropertyValue(n).trim();
    const out: Record<string, Record<string, string>> = {};
    for (const v of values) {
      const el = document.createElement('div');
      el.setAttribute('data-group', v);
      root.appendChild(el);
      out[v] = {
        top: read(el, '--sherpa-border-top'), bottom: read(el, '--sherpa-border-bottom'),
        left: read(el, '--sherpa-border-left'), right: read(el, '--sherpa-border-right'),
        tl: read(el, '--sherpa-border-rounding-top-left'),
        tr: read(el, '--sherpa-border-rounding-top-right'),
        bl: read(el, '--sherpa-border-rounding-bottom-left'),
        br: read(el, '--sherpa-border-rounding-bottom-right'),
      };
    }
    return out;
  }, VALUES);

  // Derive the expectation from the RULE, not a restated table — so this fails if
  // the projector and the rule ever drift apart.
  for (const value of VALUES) {
    const dash = value.lastIndexOf('-');
    const [col, mode] = value.includes('-') ? [value.slice(0, dash), value.slice(dash + 1)] : ['', value];
    const { h, v } = AXES[col]!(mode);

    const sharedL = h === 'mid' || h === 'right';
    const sharedR = h === 'left' || h === 'mid';
    const sharedT = v === 'mid' || v === 'bottom';
    const sharedB = v === 'top' || v === 'mid';

    const got = r[value]!;
    // A shared edge is HALVED (one step down the ramp), never dropped.
    expect(got['left'], `${value} left`).toBe(sharedL ? '0.25px' : '0.5px');
    expect(got['right'], `${value} right`).toBe(sharedR ? '0.25px' : '0.5px');
    expect(got['top'], `${value} top`).toBe(sharedT ? '0.25px' : '0.5px');
    expect(got['bottom'], `${value} bottom`).toBe(sharedB ? '0.25px' : '0.5px');

    // A corner is round only when BOTH of its edges are outer.
    expect(got['tl'], `${value} tl`).toBe(!sharedT && !sharedL ? '4px' : '0px');
    expect(got['tr'], `${value} tr`).toBe(!sharedT && !sharedR ? '4px' : '0px');
    expect(got['bl'], `${value} bl`).toBe(!sharedB && !sharedL ? '4px' : '0px');
    expect(got['br'], `${value} br`).toBe(!sharedB && !sharedR ? '4px' : '0px');
  }
});

test('grouping: two halves of a shared edge sum to one full stroke', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady: boolean }).__reforgedReady === true);

  const r = await page.evaluate(() => {
    const root = document.getElementById('root')!;
    const read = (el: Element, n: string) => getComputedStyle(el).getPropertyValue(n).trim();
    return ['start', 'mid', 'end'].map((mode) => {
      const el = document.createElement('div');
      el.setAttribute('data-group', mode);
      root.appendChild(el);
      return { mode, left: read(el, '--sherpa-border-left'), right: read(el, '--sherpa-border-right') };
    });
  });

  // start|mid share one edge, mid|end share another. Each contributes 0.25, so the
  // joint reads 0.5 — the same weight as the group's outer border.
  const px = (s: string) => parseFloat(s);
  expect(px(r[0]!.right) + px(r[1]!.left)).toBeCloseTo(0.5);
  expect(px(r[1]!.right) + px(r[2]!.left)).toBeCloseTo(0.5);
  // …and the two OUTER edges stay full weight.
  expect(r[0]!.left).toBe('0.5px');
  expect(r[2]!.right).toBe('0.5px');
});
