import { test, expect, type Page } from './harness';

/**
 * AND and OR take any boolean (Will, TODO 780: "0/1 or True or False is data"; plan 783 D4): a Value's 1 is a
 * constant part, read as true (TODO 781), no warning, and it folds in the Outgoing JSON's tree; the Source's True
 * joins by a drag, no refusal; the Source's rows join too, read null and warn. Real pointer.
 * TRAP T-a-condition-is-a-tree-of-nodes
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.id = 'cv';
    el.style.cssText = 'inline-size: 1100px; block-size: 640px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = {
      v: 2, id: 'group',
      nodes: [
        { id: 'one', kind: 'value', x: 20, y: 360, heading: 'One', values: { type: 'integer', value: '1' } },
        { id: 's', kind: 'source', x: 20, y: 20, values: { store: 'users' } },
        { id: 'f', kind: 'field', x: 300, y: 20, values: { field: 'status' } },
        { id: 'c', kind: 'condition', x: 560, y: 20, heading: 'Active', values: { type: 'eq', b: 'active' } },
        { id: 'or', kind: 'condition', x: 820, y: 220, heading: 'Either', values: { type: 'or' } },
      ],
      routes: [{ from: 's/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'c', to: 'or' }, { from: 'one/value', to: 'or' }],
    };
    const w = window as unknown as Record<string, unknown>;
    w['ed'] = bindWorkflow(el as never, flow as never, { session: new SessionStore(), inspector: panel as never, stores: ['users'], fieldsOf: { users: { status: { label: 'Status' } } } });
    (el as unknown as { zoomTo(z: number): void; panTo(x: number, y: number): void }).zoomTo(1);
    (el as unknown as { panTo(x: number, y: number): void }).panTo(0, 0);
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const OR = '#cv > sherpa-node[data-heading="Either"]';
const socketAt = (page: Page, sel: string, side: string) => page.evaluate(([s, d]) => {
  const r = (document.querySelector(s!) as HTMLElement & { socketRect(side: string): DOMRect }).socketRect(d!);
  return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
}, [sel, side]);
const drag = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move(...to, { steps: 8 });
  await page.mouse.up();
  await settle(page);
};
/** The Or's tree, as its Outgoing JSON reads it. */
const where = (page: Page) => page.evaluate(async () => {
  const { nodeFlow, workflowGraph } = await import('/dist/data.js');
  const ed = (window as unknown as { ed: { workflow(): unknown } }).ed;
  return (nodeFlow(workflowGraph(ed.workflow() as never, { fieldsOf: { users: { status: { label: 'Status' } } } }), 'or') as { definition?: { where?: unknown } }).definition?.where;
});

test('a Value\'s 1 into Or is a constant part: no warning, and Status or 1 always holds; switched to And, it drops out', async ({ page }) => {
  expect(await page.locator(OR).getAttribute('data-warning')).toBeNull();
  expect(await where(page)).toBe(true);
  await page.locator(`${OR} sherpa-input-text[name="type"] select`).selectOption('and');
  await settle(page);
  expect(await where(page)).toEqual({ field: 'status', op: 'eq', value: 'active' });
});

test('the Source\'s True dropped on Or\'s header joins, no refusal; its rows join too, read null, and Or warns', async ({ page }) => {
  const heard: string[] = [];
  page.on('console', (m) => { if (/bindWorkflow/.test(m.text())) heard.push(m.text()); });
  await drag(page, await socketAt(page, '#cv > sherpa-node[data-heading="Source"]', 'output'), await socketAt(page, OR, 'input'));
  expect(await page.evaluate(() => [...document.querySelectorAll('#cv svg.graph-routes path[data-to="or"]')].map((p) => (p as SVGElement).dataset['from']).sort())).toEqual(['c', 'one/value', 's']);
  expect(await page.locator(OR).getAttribute('data-warning')).toBeNull();
  const rows = await page.evaluate(() => {
    const row = [...document.querySelectorAll('#cv > sherpa-node[data-heading="Source"] sherpa-node-row')].find((r) => r.getAttribute('data-label') === 'Rows') as HTMLElement & { socketRect(side: string): DOMRect };
    const r = row.socketRect('output');
    return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
  });
  await drag(page, rows, await socketAt(page, OR, 'input'));
  expect(await page.locator(OR).getAttribute('data-warning')).toBe('Either takes a boolean; it was given rows');
  expect(heard, 'no refusal').toEqual([]);
});
