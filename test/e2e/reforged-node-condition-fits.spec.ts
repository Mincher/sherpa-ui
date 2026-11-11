import { test, expect } from './harness';

/**
 * A CONDITION LISTS WHAT FITS, drawn (Will, TODO 940): a number and rows into a Greater than — its select lists the number's
 * operations and And, Or, Is empty; the rows are IGNORED: their line dashed, its tip saying why, and the node warns nothing
 * (D2 A). A text value alone into it: the pick stays, and the node warns (D1 A).
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

const bind = (page: import('@playwright/test').Page, connections: { from: string; to: string }[]) => page.evaluate(async (connections) => {
  const el = document.createElement('sherpa-layout-canvas') as Canvas;
  el.style.cssText = 'inline-size: 1200px; block-size: 700px';
  document.getElementById('root')!.appendChild(el);
  await el.rendered;
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const flow = { v: 3, id: 'fits', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'n', kind: 'value', x: 0, y: 320, values: { type: 'integer', value: '5' } },
    { id: 't', kind: 'value', x: 0, y: 520, values: { type: 'text', value: 'Pro' } },
    { id: 'c', kind: 'condition', x: 400, y: 160, heading: 'Check', values: { type: 'gt', b: '1' } },
  ], connections };
  bindWorkflow(el as never, flow as never, { session: new SessionStore(), stores: ['customers'] } as never);
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}, connections);
const NODE = '#root sherpa-node[data-heading="Check"]';
const line = (page: import('@playwright/test').Page, from: string) => page.locator(`#root svg.graph-connectors path[data-from="${from}"][data-to="c"]`);

test('a number and rows into Greater than: the number\'s operations listed; the rows dashed, the tip says why, no warning', async ({ page }) => {
  await bind(page, [{ from: 'n/value', to: 'c' }, { from: 'start/rows', to: 'c' }]);
  const options = await page.locator(`${NODE} sherpa-input-text[name="type"] option`).evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value));
  expect(options).toEqual(['and', 'or', 'gt', 'gte', 'lt', 'lte', 'eq', 'ne', 'not', 'empty', 'in', 'notin', 'between', 'notbetween']);
  await expect(line(page, 'start/rows')).toHaveAttribute('data-ignored', '');
  await expect(line(page, 'n/value')).not.toHaveAttribute('data-ignored', '');
  expect(await line(page, 'start/rows').evaluate((p) => getComputedStyle(p).strokeDasharray)).not.toBe('none');
  const tip = page.locator('#root svg.graph-connectors polyline.graph-hit[data-from="start/rows"][data-to="c"] title');
  await expect(tip).toHaveText('Ignored: Greater than takes a number or a date');
  expect(await page.locator(NODE).getAttribute('data-warning')).toBeNull();
});

test('a text value alone into Greater than: the pick stays listed, and the node warns', async ({ page }) => {
  await bind(page, [{ from: 't/value', to: 'c' }]);
  const options = await page.locator(`${NODE} sherpa-input-text[name="type"] option`).evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value));
  expect(options).toContain('gt');
  expect(options).not.toContain('lt');
  expect(await page.locator(NODE).getAttribute('data-warning')).toBe('Greater than takes a number or a date; it was given text');
  await expect(line(page, 't/value')).not.toHaveAttribute('data-ignored', '');
});
