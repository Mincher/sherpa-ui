import { test, expect, type Page } from './harness';

/**
 * A MERGE JOINS TWO SETS OF ROWS — plan 992 O3 A (Will, 2026-11-14: one Merge, no Compare): on the canvas, a Field of the
 * A rows joins its header and one of the B rows its B row, by the real pointer; Compare picks columns, and Matched, Only in
 * A, Only in B and Changed are its properties, each an output of rows.
 * TRAP T-a-merge-joins-by-a-field-of-each
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1200px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 3, byHand: true as const, id: 'merge',
      nodes: [
        { id: 'sa', kind: 'source', x: 20, y: 20, values: { store: 'devices' } }, { id: 'fa', kind: 'field', x: 380, y: 20, values: { field: 'customer' } },
        { id: 'sb', kind: 'source', x: 20, y: 380, values: { store: 'customers' } }, { id: 'fb', kind: 'field', x: 380, y: 380, values: { field: 'id' } },
        { id: 'm', kind: 'merge', x: 760, y: 20 },
      ],
      connections: [{ from: 'sa/rows', to: 'fa' }, { from: 'sb/rows', to: 'fb' }, { from: 'fa/field', to: 'm' }],
    };
    (window as unknown as Record<string, unknown>)['ed'] = bindWorkflow(el as never, flow as never, {
      session: new SessionStore(), stores: ['devices', 'customers'],
      fieldsOf: { devices: { customer: { label: 'Customer' }, os: { label: 'OS' } }, customers: { id: { label: 'Id' }, region: { label: 'Region' } } },
    } as never);
    await window.__settled();
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const card = (page: Page, heading: string, nth = 0) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).nth(nth);
type Box = { x: number; y: number; w: number; h: number };
const socket = (page: Page, heading: string, side: string, row: string, nth = 0): Promise<Box> => card(page, heading, nth).evaluate((el, [s, r]) => {
  const b = (el.querySelector(`sherpa-node-row${r}`) as HTMLElement & { socketRect(side: string): DOMRect }).socketRect(s!);
  return { x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.width), h: Math.round(b.height) };
}, [side, row] as const);
const middle = (b: Box): [number, number] => [b.x + b.w / 2, b.y + b.h / 2];
const connections = (page: Page) => page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-connectors path[data-from]')].map((p) => `${p.getAttribute('data-from')} → ${p.getAttribute('data-to')}`).sort());
const rowsOf = (page: Page) => card(page, 'Merge').locator('sherpa-node-row').evaluateAll((els) => els.filter((e) => e.checkVisibility()).map((e) => [
  e.getAttribute('data-socket-name') ?? e.getAttribute('data-label'), e.getAttribute('data-input-socket'), e.getAttribute('data-output-socket'), e.hasAttribute('data-property'),
]));

test('a Merge draws B, Compare, then Matched, Only in A, Only in B and Changed, each a property sending rows', async ({ page }) => {
  expect((await rowsOf(page)).filter(([label]) => label !== 'Parameters' && label !== 'Properties')).toEqual([
    ['B', 'any', null, false], ['Compare (Optional)', null, null, false],
    ['Matched', null, 'object', true], ['Only in A', null, 'object', true], ['Only in B', null, 'object', true], ['Changed', null, 'object', true],
  ]);
  expect(await card(page, 'Merge').getAttribute('data-input-socket')).toBe('any');
});

test('the B rows\' Field joins B by the real pointer; then nothing warns', async ({ page }) => {
  const from = middle(await socket(page, 'Field', 'output', ':has([name="field"])', 1));
  const to = middle(await socket(page, 'Merge', 'input', '[data-socket-name="B"]'));
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  expect(await connections(page)).toEqual(['fa/field → m', 'fb/field → m/b', 'sa/rows → fa', 'sb/rows → fb']);
  expect(await card(page, 'Merge').getAttribute('data-warning')).toBeNull();
});
