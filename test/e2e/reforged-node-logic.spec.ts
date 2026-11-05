import { test, expect, type Page } from './harness';

/**
 * LOGIC in the editor: a Condition's Operation select picks its type. And takes two comparisons' True on its
 * header and draws True and False; a comparison draws Value A and Value B, and no header input. Store's rows
 * into a Condition switched to And stay joined: And reads null and warns, no fault (TODO 770); switched to a
 * comparison, which has no header input, they wait in the DRAFT, and Save leaves them out. Real selects.
 * Plan 749 P5. TRAP T-a-logic-type-is-an-operator
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 1200px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
  });
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 2, id: 'logic', nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'c', kind: 'condition', x: 320, y: 0, heading: 'Check', values: { field: 'status', op: 'eq', value: 'active' } },
      { id: 'e1', kind: 'condition', x: 0, y: 320, heading: 'Is active', values: { type: 'eq', a: 'active', b: 'active' } },
      { id: 'e2', kind: 'condition', x: 0, y: 520, heading: 'Is big', values: { type: 'gt', a: '120', b: '100' } },
      { id: 'both', kind: 'condition', x: 360, y: 400, heading: 'Both', values: { type: 'and' } },
      { id: 'end', kind: 'output', x: 720, y: 400 },
    ], routes: [{ from: 'start/rows', to: 'c' }, { from: 'e1', to: 'both' }, { from: 'e2', to: 'both' }, { from: 'both', to: 'end' }] };
    const w = window as unknown as { editor: unknown; saved: unknown[]; __settled(): Promise<void> };
    w.editor = bindWorkflow(document.querySelector('#root sherpa-layout-canvas') as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, fields: { status: { label: 'Status' } }, stores: ['customers'],
    } as never);
    w.saved = [];
    document.addEventListener('definition-save', (e) => w.saved.push((e as CustomEvent<{ definition: unknown }>).detail.definition));
    await w.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const NODE = (heading: string) => `#root sherpa-node[data-heading="${heading}"]`;
// Each row's field by name; the Rows row, which only sends, has none: ''.
const rows = (page: Page, heading: string) => page.locator(`${NODE(heading)} sherpa-node-row`).evaluateAll((els) => els.map((r) => r.querySelector('[name]')?.getAttribute('name') ?? ''));
const pick = async (page: Page, heading: string, type: string) => {
  await page.locator(`${NODE(heading)} sherpa-input-text[name="type"] select`).selectOption(type);
  await settle(page);
};
type Flow = { nodes: { id: string; values?: Record<string, unknown> }[]; routes: { from: string; to: string }[] };
const draft = (page: Page) => page.evaluate(`window.editor.workflow()`) as Promise<Flow>;
const saved = (page: Page) => page.evaluate(`(() => { window.editor.save(); return window.saved.at(-1); })()`) as Promise<Flow>;
const line = (page: Page, from: string, to: string) => page.locator(`#root svg.graph-routes path[data-from="${from}"][data-to="${to}"]`);

test('the Operation select picks a Logic type: And takes two booleans and draws True and False; a comparison draws Value A and B', async ({ page }) => {
  const both = page.locator(NODE('Both'));
  expect(await rows(page, 'Both')).toEqual(['type']);
  expect(await both.evaluate((el) => [el.getAttribute('data-input-socket'), el.hasAttribute('data-input-many'), el.hasAttribute('data-branches'), el.hasAttribute('data-output-routed')])).toEqual(['boolean', true, true, true]);
  await expect(line(page, 'e1', 'both')).toHaveCount(1);
  await expect(line(page, 'e2', 'both')).toHaveCount(1);
  // A comparison: its two values are its rows; its header takes nothing in, and sends True.
  expect(await rows(page, 'Is active')).toEqual(['type', 'a', 'b']);
  expect(await page.locator(NODE('Is active')).evaluate((el) => [el.getAttribute('data-input-socket'), el.hasAttribute('data-branches')])).toEqual([null, true]);
  expect(await page.locator(`${NODE('Is big')} sherpa-input-text[name="a"]`).getAttribute('data-label')).toBe('Value A');
  // The select names each type by the one operator list, the tree first.
  const options = await page.locator(`${NODE('Both')} sherpa-input-text[name="type"] option`).allTextContents();
  expect(options.slice(0, 9)).toEqual(['Rows that hold', 'And', 'Or', 'Greater than', 'At least', 'Less than', 'At most', 'Equals', 'Does not equal']);
  expect(options).toContain('Is empty');
  expect(await page.locator(`${NODE('Both')} sherpa-input-text[name="type"]`).getAttribute('data-description')).toBe('True when every value that comes in is true');
  // Is one of: Value B becomes a tag list of Values.
  await pick(page, 'Is active', 'in');
  expect(await rows(page, 'Is active')).toEqual(['type', 'a', 'b']);
  expect(await page.locator(`${NODE('Is active')} sherpa-input-text[name="b"]`).evaluate((el) => [el.getAttribute('data-type'), el.getAttribute('data-label'), (el as HTMLElement & { tags: string[] }).tags])).toEqual(['tags', 'Values', ['active']]);
});

test('Store\'s rows into a Condition switched to And stay joined and warn; switched to a comparison they wait in the draft; Save keeps what is drawn (770)', async ({ page }) => {
  const reports: string[] = [];
  page.on('console', (m) => { if (/workflow|fault/i.test(m.text())) reports.push(m.text()); });
  const warning = () => page.locator(NODE('Check')).evaluate((el) => el.getAttribute('data-warning'));
  await expect(line(page, 'start/rows', 'c')).toHaveCount(1);
  expect(await rows(page, 'Check')).toEqual(['type', '', 'field', 'op', 'value']);
  expect(await warning()).toBeNull();
  // And: its header takes a boolean. The rows stay joined, the line drawn; And reads null, and says why.
  await pick(page, 'Check', 'and');
  expect(await rows(page, 'Check')).toEqual(['type']);
  await expect(line(page, 'start/rows', 'c')).toHaveCount(1);
  expect(await warning()).toBe('Check takes a boolean; it was given rows');
  // Back to the tree: no warning, and its Field, Operator and Value.
  await pick(page, 'Check', 'rows');
  await expect(line(page, 'start/rows', 'c')).toHaveCount(1);
  expect(await warning()).toBeNull();
  expect(await rows(page, 'Check')).toEqual(['type', '', 'field', 'op', 'value']);
  expect(await page.locator(`${NODE('Check')} sherpa-input-text[name="field"]`).evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe('status');
  // Greater than takes nothing on its header: the route waits in the draft, drawn nowhere; the tree joins it again.
  await pick(page, 'Check', 'gt');
  await expect(line(page, 'start/rows', 'c')).toHaveCount(0);
  expect((await draft(page)).routes).toContainEqual({ from: 'start/rows', to: 'c' });
  await pick(page, 'Check', 'rows');
  await expect(line(page, 'start/rows', 'c')).toHaveCount(1);
  // And again, then Save: a warning is no block, and the final graph keeps the route it draws, not the tree's values.
  await pick(page, 'Check', 'and');
  const out = await saved(page);
  expect(out.routes).toContainEqual({ from: 'start/rows', to: 'c' });
  expect(out.nodes.find((n) => n.id === 'c')!.values).toEqual({ type: 'and' });
  expect(reports).toEqual([]);
});
