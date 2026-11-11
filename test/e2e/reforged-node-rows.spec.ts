import { test, expect, type Page } from './harness';

/**
 * A node's rows: a MULTI-select row is one select — the quick-filter chip the panel draws,
 * a menu of ticks — never a list of checkboxes (TODO 731); a SWITCH row has a boolean input
 * socket, and a connected True drives it, a False clears it, cut restores (TODO 732). Pixels
 * for the socket; real clicks for the menu. Plan 713 D7, D17.
 */
type Canvas = HTMLElement & { rendered: Promise<void> };
type Rgb = [number, number, number];

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
  });
});

const BIND = `async (connections, OWN = false) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { NODE_KINDS } = await import('/dist/data.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const kinds = { ...NODE_KINDS,
    tags: { heading: 'Tags', icon: 'flag', rows: [{ name: 'set', label: 'Set', control: 'field', multiple: true, output: 'object' }], model: 'x', graphs: ['workflow'] },
    gate: { heading: 'Gate', icon: 'flag', rows: [{ name: 'on', label: 'On', control: 'switch', input: 'boolean' }], model: 'x', graphs: ['workflow'] } };
  const flow = { v: 3, id: 'g', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 300, values: { store: 'customers' } },
    { id: 'tags', kind: 'tags', x: 0, y: 0, values: { set: ['status'] } },
    { id: 'filter', kind: 'condition', x: 360, y: 0, values: { type: 'eq', b: 'trial' } },
    { id: 'gate', kind: 'gate', x: 720, y: 0, values: { on: OWN } },
    { id: 'status', kind: 'field', x: 0, y: 520, values: { field: 'status' } },
  ], connections: [{ from: 'start/rows', to: 'status' }, { from: 'status/field', to: 'filter' }, ...connections] };
  window.editor = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'), kinds,
    // The Tags kind takes no rows in: its field list is the customers' (rowsFrom), as no Source reaches it (TODO 817).
    fieldsOf: { customers: { status: { label: 'Status' }, plan: { label: 'Plan' }, name: { label: 'Name' } } }, stores: ['customers'], rowsFrom: 'customers',
  });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const bind = (page: Page, connections: { from: string; to: string }[] = [], own = false) => page.evaluate(`(${BIND})(${JSON.stringify(connections)}, ${own})`);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const draft = (page: Page) => page.evaluate(`(() => { window.editor.save(); const d = window.saved.at(-1); return Object.fromEntries(d.nodes.map((n) => [n.id, n.values ?? null])); })()`) as Promise<Record<string, Record<string, unknown> | null>>;

const TAGS = '#root sherpa-node[data-heading="Tags"]';
const GATE = '#root sherpa-node[data-heading="Gate"]';

test('a multi-select row is ONE select: a chip that opens a menu of ticks, never a list of checkboxes', async ({ page }) => {
  await bind(page);
  const seen = await page.evaluate((sel) => {
    const row = document.querySelector(`${sel} sherpa-node-row:has(sherpa-quick-filter)`)!;
    return {
      chips: row.querySelectorAll('sherpa-quick-filter').length,
      groups: row.querySelectorAll('sherpa-select-group, sherpa-select-checkbox').length,
      // The ticks are inside the menu, which is shut: none is on screen.
      shown: [...row.querySelectorAll('input[type=checkbox]')].filter((i) => (i as HTMLElement).checkVisibility?.() && i.getBoundingClientRect().height > 0).length,
      picks: (row.querySelector('sherpa-quick-filter') as HTMLElement & { values: string[] }).values,
    };
  }, TAGS);
  expect(seen).toEqual({ chips: 1, groups: 0, shown: 0, picks: ['status'] });
  // Open it by its caret, as a reader does, and tick another.
  await page.locator(`${TAGS} sherpa-quick-filter .caret`).click();
  await expect(page.locator(`${TAGS} sherpa-menu label`, { hasText: 'Plan' })).toBeVisible();
  await page.locator(`${TAGS} sherpa-menu label`, { hasText: 'Plan' }).click();
  await settle(page);
  expect((await draft(page))['tags']).toEqual({ set: ['status', 'plan'] });
  // And untick: ONE list, an object, whatever the picks.
  await page.locator(`${TAGS} sherpa-menu label`, { hasText: 'Status' }).click();
  await settle(page);
  expect((await draft(page))['tags']).toEqual({ set: ['plan'] });
});

type Sock = HTMLElement & { socketRect(side: string): DOMRect | null };
const ink = (page: Page): Promise<Rgb> => page.evaluate(() => {
  const el = Object.assign(document.createElement('div'), { style: 'background: var(--sherpa-style-success-indicator-accent); inline-size: 1px; block-size: 1px' });
  document.body.append(el);
  const [r, g, b] = getComputedStyle(el).backgroundColor.match(/[\d.]+/g)!.map(Number);
  el.remove();
  return [r, g, b] as Rgb;
});
const near = (a: Rgb, b: Rgb, within = 40): boolean => Math.max(...a.map((v, i) => Math.abs(v - b[i]!))) <= within;

/** The pixels at points (fractions) of the gate row's input socket, as a reader sees them. */
async function socketPaint(page: Page, at: [number, number][]): Promise<Rgb[]> {
  const rect = await page.evaluate((sel) => {
    const row = document.querySelector<Sock>(`${sel} sherpa-node-row:has(sherpa-switch)`)!;
    row.scrollIntoView({ block: 'center' });
    const r = row.socketRect('input')!;
    return { x: r.x, y: r.y, w: r.width, h: r.height };
  }, GATE);
  const shot = await page.screenshot({ clip: { x: rect.x, y: rect.y, width: rect.w, height: rect.h } });
  return page.evaluate(async ([b64, pts]) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return (pts as [number, number][]).map(([fx, fy]) => [...c.getImageData(Math.min(img.width - 1, Math.floor(fx * img.width)), Math.min(img.height - 1, Math.floor(fy * img.height)), 1, 1).data].slice(0, 3) as Rgb);
  }, [shot.toString('base64'), at] as const);
}

test('a switch row has a boolean input socket: hollow until a connection joins it', async ({ page }) => {
  await bind(page);
  const green = await ink(page);
  expect(await page.evaluate((sel) => document.querySelector(`${sel} sherpa-node-row:has(sherpa-switch)`)!.getAttribute('data-input-socket'), GATE)).toBe('boolean');
  // Hollow: the middle is the face, not the ink (the connected one, below, is ink there).
  const [centre] = await socketPaint(page, [[.5, .5]]);
  expect(near(centre!, green), 'hollow centre').toBe(false);
});

test('a connected socket is filled: the shape is ink in the middle, not at its far corners', async ({ page }) => {
  await bind(page, [{ from: 'filter', to: 'gate/on' }]);
  const green = await ink(page);
  // Three corners: the fourth, bottom right, is inked or not by the fraction of a pixel the fitted view puts the socket on.
  const mask = (await socketPaint(page, [[.5, .5], [.96, .04], [.04, .04], [.04, .96]])).map((p) => (near(p, green) ? 1 : 0));
  expect(mask).toEqual([1, 0, 0, 0]);
});

const sw = (page: Page) => page.evaluate((sel) => {
  const s = document.querySelector<HTMLElement & { checked: boolean }>(`${sel} sherpa-switch`)!;
  return { on: s.checked, locked: s.hasAttribute('readonly') && !s.hasAttribute('disabled'), note: s.getAttribute('data-description') };
}, GATE);

test('a connected True drives the switch on, read only and marked Custom; cut the connection and its own state is back', async ({ page }) => {
  await bind(page, [{ from: 'filter', to: 'gate/on' }]);
  expect(await sw(page)).toEqual({ on: true, locked: true, note: 'Custom, from Condition' });
  // Pick the connector, then Delete: the connection is cut.
  const [mx, my] = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#root svg.graph-connectors polyline[data-to="gate/on"]')!;
    const p = hit.points.getItem(8);
    const m = hit.getScreenCTM()!;
    return [m.a * p.x + m.e, m.d * p.y + m.f];
  });
  await page.mouse.click(mx!, my!);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await sw(page)).toEqual({ on: false, locked: false, note: null });
  // It takes a reader's edit again: one click on the switch's own control, in the draft.
  await page.locator(`${GATE} sherpa-switch .track`).click();
  await settle(page);
  expect((await draft(page))['gate']).toEqual({ on: true });
});

test('a connected False clears the switch: off, though its own state is on', async ({ page }) => {
  await bind(page, [{ from: 'filter/#false', to: 'gate/on' }], true);
  expect((await sw(page)).on).toBe(false);
  expect((await sw(page)).locked).toBe(true);
});
