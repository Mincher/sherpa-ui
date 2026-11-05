import { test, expect, type Page } from './harness';

/**
 * A STATUS CELL'S FILTER CHIP KEEPS ITS OWN LOOK — Will, TODO 805. A status cell
 * re-points Style to its status for what it holds, and its filter chip took it: a
 * red, amber or green border and funnel. The chip wears the look it has in the
 * plain cell beside it, at rest, hovered and pressed, light and dark; the cell
 * keeps its status; held by the View or ON, it reads as a plain cell's does.
 * Read in PIXELS.
 */

type Rgb = [number, number, number];
type Look = { fill: Rgb; edge: Rgb; ink: Rgb; reddest: Rgb };

/** Each row's Health, in row order. */
const STATUSES = ['critical', 'warning', 'success'] as const;

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 900, height: 500 });
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & { rendered?: Promise<void>; populate(d: unknown): void };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name', width: 200 }, { field: 'health', header: 'Health', width: 200 }],
      rows: [{ name: 'Ada', health: 'down' }, { name: 'Bob', health: 'late' }, { name: 'Cy', health: 'ok' }],
      filters: { health: { id: 'health', label: 'Health', options: [
        { value: 'down', label: 'Down', swatch: 'critical' },
        { value: 'late', label: 'Late', swatch: 'warning' },
        { value: 'ok', label: 'OK', swatch: 'success' }] } },
    });
    await window.__settled();
  });
});

const cell = (page: Page, row: number, field: string) =>
  page.locator(`sherpa-data-grid .row >> nth=${row}`).locator(`td.cell[data-field="${field}"]`);
const caretBox = (page: Page) => page.locator('sherpa-data-grid .cell-filter').evaluate((c) => {
  const r = c.shadowRoot!.querySelector('.caret')!.getBoundingClientRect();
  return { x: r.x, y: r.y, width: r.width, height: r.height };
});
/** The chip's fill transition began, is over, and a frame has painted it. */
const still = async (page: Page) => {
  const frames = () => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done))));
  await frames();
  await page.waitForFunction(() => document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelector('.cell-filter')!
    .shadowRoot!.querySelector('.caret')!.getAnimations().length === 0);
  await frames();
};

/** What a reader sees of a box: its fill, its bottom border, the ink furthest from
 *  the fill, and its reddest pixel. */
async function look(page: Page, box: { x: number; y: number; width: number; height: number }): Promise<Look> {
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const at = (x: number, y: number) => [...c.getImageData(x, y, 1, 1).data].slice(0, 3) as Rgb;
    const fill = at(Math.floor(img.width * 0.2), Math.floor(img.height / 2));
    const distance = (p: Rgb) => Math.abs(p[0] - fill[0]) + Math.abs(p[1] - fill[1]) + Math.abs(p[2] - fill[2]);
    const furthest = (xs: number[], ys: number[]) => {
      let best = fill;
      for (const y of ys) for (const x of xs) if (distance(at(x, y)) > distance(best)) best = at(x, y);
      return best;
    };
    const span = (from: number, to: number) => Array.from({ length: Math.max(1, Math.floor(to - from)) }, (_, i) => Math.floor(from) + i);
    let reddest = fill;
    for (const y of span(0, img.height)) for (const x of span(0, img.width)) {
      const p = at(x, y);
      if (p[0] - p[1] > reddest[0] - reddest[1]) reddest = p;
    }
    return {
      fill,
      edge: furthest([Math.floor(img.width / 2)], span(img.height - 3, img.height)),
      ink: furthest(span(img.width / 4, (3 * img.width) / 4), span(img.height / 3, (2 * img.height) / 3)),
      reddest,
    };
  }, shot.toString('base64'));
}

/** The cell chip in one cell, at rest, hovered and pressed. */
async function chipIn(page: Page, row: number, field: string): Promise<{ rest: Look; hover: Look; down: Look }> {
  await page.mouse.move(-1, -1);
  await cell(page, row, field).hover({ position: { x: 8, y: 8 } });
  await expect(cell(page, row, field).locator('.cell-filter')).toBeVisible();
  await still(page);
  const box = await caretBox(page);
  const rest = await look(page, box);
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await still(page);
  const hover = await look(page, box);
  await page.mouse.down();
  await still(page);
  const down = await look(page, box);
  // Let go off the chip: no press, no filter.
  await page.mouse.move(-1, -1);
  await page.mouse.up();
  return { rest, hover, down };
}

const near = (a: Rgb, b: Rgb, tol = 3) => a.every((v, i) => Math.abs(v - b[i]!) <= tol);
// The funnel's ink is anti-aliased, so a few levels either way.
const sameLook = (a: Look, b: Look) => near(a.fill, b.fill) && near(a.edge, b.edge) && near(a.ink, b.ink, 12);

for (const mode of ['light', 'dark'] as const) {
  test(`${mode}: a status cell's chip wears the plain cell's look, at rest, hovered and pressed`, async ({ page }) => {
    if (mode === 'dark') await page.evaluate(() => { document.documentElement.dataset['mode'] = 'dark'; });
    for (const [row, status] of STATUSES.entries()) {
      await expect(cell(page, row, 'health')).toHaveAttribute('data-status', status);
      const plain = await chipIn(page, row, 'name');
      // Hover and a press each change the fill.
      expect(near(plain.hover.fill, plain.rest.fill, 0), 'hover changes the fill').toBe(false);
      expect(near(plain.down.fill, plain.hover.fill, 0), 'a press changes the fill').toBe(false);
      const got = await chipIn(page, row, 'health');
      for (const state of ['rest', 'hover', 'down'] as const) {
        expect(sameLook(got[state], plain[state]), `${status} ${state}: ${JSON.stringify(got[state])} vs plain ${JSON.stringify(plain[state])}`).toBe(true);
      }
    }
  });
}

test('the status cell keeps its status: its icon is drawn in it', async ({ page }) => {
  /** The reddest pixel of a cell's status icon, else of its words. */
  const red = async (field: string) => {
    const box = await cell(page, 0, field).evaluate((td) => {
      const range = document.createRange();
      range.selectNodeContents(td.querySelector('.status-icon') ?? td);
      const r = range.getBoundingClientRect();
      return { x: r.x, y: r.y, width: r.width, height: r.height };
    });
    const { reddest } = await look(page, box);
    return reddest[0] - reddest[1];
  };
  // The plain text is neutral; the critical icon is red…
  expect(await red('name')).toBeLessThan(25);
  expect(await red('health')).toBeGreaterThan(60);
  // …and still red with its chip beside it.
  await cell(page, 0, 'health').hover({ position: { x: 8, y: 8 } });
  await expect(cell(page, 0, 'health').locator('.cell-filter')).toBeVisible();
  expect(await red('health')).toBeGreaterThan(60);
});

test('held by the View, a status cell\'s chip is inactive, as a plain cell\'s is', async ({ page }) => {
  const free = await chipIn(page, 0, 'name');
  await page.evaluate(() => (document.querySelector('sherpa-data-grid') as HTMLElement & {
    supersede(r: Record<string, unknown>, at?: string): void }).supersede({ name: { picked: [] }, health: { picked: [] } }, 'App header'));
  for (const row of STATUSES.keys()) {
    const plain = await chipIn(page, row, 'name');
    await expect(page.locator('sherpa-data-grid .cell-filter')).toHaveAttribute('data-superseded', '');
    expect(near(plain.rest.fill, free.rest.fill), 'held reads inactive').toBe(false);
    const got = await chipIn(page, row, 'health');
    expect(sameLook(got.rest, plain.rest), `${STATUSES[row]}: ${JSON.stringify(got.rest)} vs plain ${JSON.stringify(plain.rest)}`).toBe(true);
  }
});

test('ON, a status cell\'s chip reads as Discard, as a plain cell\'s does (TODO 416)', async ({ page }) => {
  const on = async (field: string) => {
    await page.mouse.move(-1, -1);
    await cell(page, 0, field).hover({ position: { x: 8, y: 8 } });
    await page.locator('sherpa-data-grid .cell-filter').evaluate((c) => c.shadowRoot!.querySelector<HTMLElement>('.caret')!.click());
    await expect(cell(page, 0, field).locator('.cell-filter')).toHaveAttribute('data-current', '');
    await still(page);
    return look(page, await caretBox(page));
  };
  // Ada's name, then her Health: her row stays first under both.
  const plain = await on('name');
  const status = await on('health');
  expect(sameLook(status, plain), `${JSON.stringify(status)} vs ${JSON.stringify(plain)}`).toBe(true);
});
