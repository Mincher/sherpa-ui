import { test, expect, type Page } from './harness';

/**
 * LOGIC in the editor: a Condition's Operation select picks its type, one test each (plan 783 D4). And takes two
 * tests' True on its header and draws True and False; a comparison tests what comes in on its header and draws
 * Value B. A Field's column into a Condition switched to And stays joined: And reads null and warns, no fault
 * (TODO 770); back to Equals it reads it again; an operator its field's type does not take warns. Real selects.
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
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'f', kind: 'field', x: 280, y: 0, values: { field: 'status' } },
      { id: 'c', kind: 'condition', x: 560, y: 0, heading: 'Check', values: { type: 'eq', b: 'active' } },
      { id: 'v1', kind: 'value', x: 0, y: 320, values: { value: 'active' } },
      { id: 'v2', kind: 'value', x: 0, y: 520, values: { type: 'integer', value: '120' } },
      { id: 'e1', kind: 'condition', x: 280, y: 320, heading: 'Is active', values: { type: 'eq', b: 'active' } },
      { id: 'e2', kind: 'condition', x: 280, y: 520, heading: 'Is big', values: { type: 'gt', b: '100' } },
      { id: 'both', kind: 'condition', x: 600, y: 400, heading: 'Both', values: { type: 'and' } },
      { id: 'end', kind: 'output', x: 880, y: 400 },
    ], routes: [
      { from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'v1/value', to: 'e1' }, { from: 'v2/value', to: 'e2' },
      { from: 'e1', to: 'both' }, { from: 'e2', to: 'both' }, { from: 'both', to: 'end' },
    ] };
    const w = window as unknown as { editor: unknown; saved: unknown[]; __settled(): Promise<void> };
    w.editor = bindWorkflow(document.querySelector('#root sherpa-layout-canvas') as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'],
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
const saved = (page: Page) => page.evaluate(`(() => { window.editor.save(); return window.saved.at(-1); })()`) as Promise<Flow>;
const line = (page: Page, from: string, to: string) => page.locator(`#root svg.graph-routes path[data-from="${from}"][data-to="${to}"]`);

test('the Operation select picks a Logic type: And takes two booleans and draws True and False; a comparison tests its header against Value B', async ({ page }) => {
  const both = page.locator(NODE('Both'));
  expect(await rows(page, 'Both')).toEqual(['type', '']);
  expect(await both.evaluate((el) => [el.getAttribute('data-input-socket'), el.hasAttribute('data-input-many'), el.hasAttribute('data-branches'), el.hasAttribute('data-output-routed')])).toEqual(['boolean', true, true, true]);
  await expect(line(page, 'e1', 'both')).toHaveCount(1);
  await expect(line(page, 'e2', 'both')).toHaveCount(1);
  // A comparison: what comes in on its header is tested against Value B; it sends True, and its Rows.
  expect(await rows(page, 'Is active')).toEqual(['type', '', 'b']);
  expect(await page.locator(NODE('Is active')).evaluate((el) => [el.getAttribute('data-input-socket'), el.hasAttribute('data-branches')])).toEqual(['any', true]);
  expect(await page.locator(`${NODE('Is big')} sherpa-input-text[name="b"]`).getAttribute('data-label')).toBe('Value B');
  // The select names each type by the one operator list, And and Or first.
  const options = await page.locator(`${NODE('Both')} sherpa-input-text[name="type"] option`).allTextContents();
  expect(options.slice(0, 8)).toEqual(['And', 'Or', 'Greater than', 'At least', 'Less than', 'At most', 'Equals', 'Does not equal']);
  expect(options).toContain('Is empty');
  expect(await page.locator(`${NODE('Both')} sherpa-input-text[name="type"]`).getAttribute('data-description')).toBe('True when every value that comes in is true');
  // Is one of: Value B becomes a tag list of Values.
  await pick(page, 'Is active', 'in');
  expect(await rows(page, 'Is active')).toEqual(['type', '', 'b']);
  expect(await page.locator(`${NODE('Is active')} sherpa-input-text[name="b"]`).evaluate((el) => [el.getAttribute('data-type'), el.getAttribute('data-label'), (el as HTMLElement & { tags: string[] }).tags])).toEqual(['tags', 'Values', ['active']]);
});

test('a Field\'s column into a Condition switched to And stays joined and warns; back to Equals it reads it; Save keeps what is drawn (770)', async ({ page }) => {
  const reports: string[] = [];
  page.on('console', (m) => { if (/workflow|fault/i.test(m.text())) reports.push(m.text()); });
  const warning = () => page.locator(NODE('Check')).evaluate((el) => el.getAttribute('data-warning'));
  await expect(line(page, 'f/field', 'c')).toHaveCount(1);
  expect(await rows(page, 'Check')).toEqual(['type', '', 'b']);
  expect(await warning()).toBeNull();
  // And: its header takes a boolean. The column stays joined, the line drawn; And reads null, and says why.
  await pick(page, 'Check', 'and');
  expect(await rows(page, 'Check')).toEqual(['type', '']);
  await expect(line(page, 'f/field', 'c')).toHaveCount(1);
  expect(await warning()).toBe('Check takes a boolean; it was given the Status column');
  // Back to Equals: no warning, and its Value B kept in the draft.
  await pick(page, 'Check', 'eq');
  expect(await warning()).toBeNull();
  expect(await rows(page, 'Check')).toEqual(['type', '', 'b']);
  expect(await page.locator(`${NODE('Check')} sherpa-input-text[name="b"]`).evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe('active');
  // Greater than on a text field: the line stays, and the node says why it reads nothing there.
  await pick(page, 'Check', 'gt');
  await expect(line(page, 'f/field', 'c')).toHaveCount(1);
  expect(await warning()).toBe('Greater than takes a number or date field; it was given the Status column');
  // And again, then Save: a warning is no block, and the final graph keeps the route it draws, not Value B.
  await pick(page, 'Check', 'and');
  const out = await saved(page);
  expect(out.routes).toContainEqual({ from: 'f/field', to: 'c' });
  expect(out.nodes.find((n) => n.id === 'c')!.values).toEqual({ type: 'and' });
  expect(reports).toEqual([]);
});
