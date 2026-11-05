import { test, expect, type Page } from './harness';

/**
 * A FAMILY node: one node, its FIRST row picks the type, and its rows follow it; a kind of one type
 * has no such select. A row the new type lacks keeps its value, and a route into it stays: drawn
 * greyed, with its fault named in the inspector, until it is cut. Real selects, pixels for the line.
 * Plan 749 P1.
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

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

const BIND = `async (routed) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { NODE_KINDS } = await import('/dist/data.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const a = { name: 'a', label: 'Value A', control: 'number', input: 'value' };
  const b = { name: 'b', label: 'Value B', control: 'number', input: 'value' };
  const places = { name: 'places', label: 'Places', control: 'number', input: 'value' };
  const kinds = { ...NODE_KINDS,
    math: { heading: 'Math', icon: 'function', typeLabel: 'Operation', defaultType: 'add', output: 'value', rows: [], model: 'x', graphs: ['workflow'], category: 'Math',
      types: { add: { label: 'Add', help: 'Add Value B to Value A', rows: [a, b] }, round: { label: 'Round', rows: [places, a, b] } } },
    lone: { heading: 'Lone', icon: 'flag', rows: [a], model: 'x', graphs: ['workflow'], types: { only: { label: 'Only' } } } };
  const flow = { v: 2, id: 'g', nodes: [
    { id: 'v', kind: 'value', x: 0, y: 0, values: { value: '2', type: 'number' } },
    { id: 'm', kind: 'math', x: 360, y: 0, values: { type: 'round', places: 2 } },
    { id: 'l', kind: 'lone', x: 360, y: 300 },
  ], routes: routed ? [{ from: 'v/value', to: 'm/places' }] : [] };
  window.editor = bindWorkflow(canvas, flow, { session: new SessionStore(), inspector: document.getElementById('inspector'), kinds });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const rows = (page: Page, heading: string) => page.evaluate((h) => [...document.querySelectorAll(`#root sherpa-node[data-heading="${h}"] sherpa-node-row`)].map((r) => r.querySelector('[name]')?.getAttribute('name') ?? ''), heading);
const draft = (page: Page) => page.evaluate(`(() => { window.editor.save(); return window.saved.at(-1); })()`) as Promise<{ nodes: { id: string; values?: Record<string, unknown> }[]; routes: { from: string; to: string }[] }>;

test('a family node\'s FIRST row picks its type, its rows follow it, and a kind of one type has no select', async ({ page }) => {
  await page.evaluate(`(${BIND})(false)`);
  expect(await rows(page, 'Math')).toEqual(['type', 'places', 'a', 'b']);
  expect(await rows(page, 'Value')).toEqual(['type', 'value']);
  expect(await rows(page, 'Lone')).toEqual(['a']);
  const label = await page.locator('#root sherpa-node[data-heading="Math"] sherpa-node-row:has([name="type"]) sherpa-input-text').first().getAttribute('data-label');
  expect(label).toBe('Operation');
  expect(await page.locator('#root sherpa-node[data-heading="Math"] [name="type"] option').allTextContents()).toEqual(['Add', 'Round']);
  await page.locator('#root sherpa-node[data-heading="Math"] [name="type"] select, #root sherpa-node[data-heading="Math"] sherpa-input-text[name="type"] select').first().selectOption('add');
  await settle(page);
  expect(await rows(page, 'Math')).toEqual(['type', 'a', 'b']);
  // The kept value waits in the draft; the type is saved as a value.
  expect((await draft(page)).nodes.find((n) => n.id === 'm')!.values).toEqual({ type: 'add', places: 2 });
});

test('a route into a row the new type lacks is KEPT, drawn greyed, and named in the inspector until it is cut', async ({ page }) => {
  await page.evaluate(`(${BIND})(true)`);
  const line = '#root svg.graph-routes path[data-to="m/places"]';
  expect(await page.locator(line).count()).toBe(1);
  expect(await page.locator(`${line}[data-stale]`).count()).toBe(0);
  await page.locator('#root sherpa-node[data-heading="Math"] sherpa-input-text[name="type"] select').selectOption('add');
  await settle(page);
  // Still drawn, to the node's edge, and greyed (the border ink, dashed), not the socket's value blue.
  const seen = await page.evaluate((sel) => {
    const p = document.querySelector<SVGPathElement>(sel)!;
    const css = getComputedStyle(p);
    const box = p.getBoundingClientRect();
    return { stale: p.hasAttribute('data-stale'), dash: css.strokeDasharray, wide: box.width > 20, title: p.parentElement!.querySelector('title')?.textContent };
  }, line);
  expect(seen.stale).toBe(true);
  expect(seen.dash).not.toBe('none');
  expect(seen.wide).toBe(true);
  expect(seen.title).toContain('the Add type, which has no "Places" row');
  // It is a fault, so the draft will not save while it stands.
  expect(await page.evaluate(() => (window as unknown as { editor: { save(): boolean } }).editor.save())).toBe(false);
  // The inspector names it, and cuts it.
  await page.locator('#root sherpa-node[data-heading="Math"]').click({ position: { x: 40, y: 12 } });
  const panel = page.locator('#inspector');
  await expect(panel).toContainText('is kept, greyed');
  await panel.getByRole('button', { name: /Cut route from Value/ }).click();
  await settle(page);
  expect((await draft(page)).routes).toEqual([]);
  expect(await page.locator(line).count()).toBe(0);
});
