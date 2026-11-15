import { test, expect, type Page } from './harness';

/**
 * LOGIC in the editor: a Condition's Operation select picks its type, one test each (plan 783 D4). And takes two
 * tests' Pass on its header; none has a True, nor a True or False socket (plans 944, 971 §9); a comparison
 * tests what comes in on its header and draws Value B. A Field's column into a Condition switched to And stays joined,
 * and And takes it (TODO 939); no fault (TODO 770); back to Equals it reads it again; the select lists what its field's
 * type takes (TODO 940). Real selects. Plan 749 P5. TRAP T-a-logic-type-is-an-operator
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
    const flow = { v: 3, id: 'logic', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'f', kind: 'field', x: 280, y: 0, values: { field: 'status' } },
      { id: 'c', kind: 'condition', x: 560, y: 0, heading: 'Check', values: { type: 'eq', b: 'active' } },
      { id: 'v1', kind: 'value', x: 0, y: 320, values: { value: 'active' } },
      { id: 'v2', kind: 'value', x: 0, y: 520, values: { type: 'integer', value: 120 } },
      { id: 'e1', kind: 'condition', x: 280, y: 320, heading: 'Is active', values: { type: 'eq', b: 'active' } },
      { id: 'e2', kind: 'condition', x: 280, y: 520, heading: 'Is big', values: { type: 'gt', b: '100' } },
      { id: 'both', kind: 'condition', x: 600, y: 400, heading: 'Both', values: { type: 'and' } },
      { id: 'end', kind: 'result', x: 880, y: 400 },
    ], connections: [
      { from: 'start/rows', to: 'f' }, { from: 'f/field', to: 'c' }, { from: 'v1/value', to: 'e1' }, { from: 'v2/value', to: 'e2' },
      // Each test joins by its Pass (plan 971 §9).
      { from: 'e1/pass', to: 'both' }, { from: 'e2/pass', to: 'both' }, { from: 'both/pass', to: 'end' },
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
// Each row's field by name; a property, which only sends, by its label (plan 944).
const rows = (page: Page, heading: string) => page.locator(`${NODE(heading)} sherpa-node-row:not([data-label="Parameters"], [data-label="Properties"])`).evaluateAll((els) => els.map((r) => r.querySelector('[name]')?.getAttribute('name') ?? r.getAttribute('data-socket-name') ?? ''));
const pick = async (page: Page, heading: string, type: string) => {
  await page.locator(`${NODE(heading)} sherpa-input-text[name="type"] select`).selectOption(type);
  await settle(page);
};
type Flow = { nodes: { id: string; values?: Record<string, unknown> }[]; connections: { from: string; to: string }[] };
const saved = (page: Page) => page.evaluate(`(() => { window.editor.save(); return window.saved.at(-1); })()`) as Promise<Flow>;
const line = (page: Page, from: string, to: string) => page.locator(`#root svg.graph-connectors path[data-from="${from}"][data-to="${to}"]`);

test('the Operation select picks a Logic type: And takes many of anything, has no True and no True or False socket (plans 944, 971 §9); a comparison tests its header against Value B', async ({ page }) => {
  const both = page.locator(NODE('Both'));
  // Its Pass and Fail; no True (TODO 939; plans 971, 971 §9), and no Value A: what it joins comes in at its header (TODO 994).
  expect(await rows(page, 'Both')).toEqual(['type', 'Pass', 'Fail']);
  // No output on its header and no False footer: its Pass row sends (plan 971 §9).
  expect(await both.evaluate((el) => [
    el.getAttribute('data-input-socket'), el.hasAttribute('data-input-many'), el.getAttribute('data-output-socket'), !!el.shadowRoot!.querySelector('.footer'),
    el.querySelector('sherpa-node-row[data-socket-name="Pass"]')?.hasAttribute('data-output-connected'),
  ])).toEqual(['any', true, null, false, true]);
  await expect(line(page, 'e1/pass', 'both')).toHaveCount(1);
  await expect(line(page, 'e2/pass', 'both')).toHaveCount(1);
  // A comparison: what comes in on its header is tested against Value B; it has its Value A, Pass and Fail (plans 971, 971 §9; TODO 994).
  expect(await rows(page, 'Is active')).toEqual(['type', 'Value A (Optional)', 'b', 'Pass', 'Fail']);
  expect(await page.locator(NODE('Is active')).evaluate((el) => [el.getAttribute('data-input-socket'), el.getAttribute('data-output-socket')])).toEqual(['any', null]);
  expect(await page.locator(`${NODE('Is big')} sherpa-input-text[name="b"]`).getAttribute('data-label')).toBe('Value B');
  // The select names each type by the one operator list, And and Or first: two tests' Pass in, each the value it tests,
  // "active" first, so the types that fit text (TODO 940; plan 971 §9).
  const options = await page.locator(`${NODE('Both')} sherpa-input-text[name="type"] option`).allTextContents();
  expect(options).toEqual(['And', 'Or', 'Equals', 'Does not equal', 'Is empty', 'Contains', 'Does not contain', 'Starts with', 'Ends with', 'Is one of', 'Is not one of']);
  expect(await page.locator(`${NODE('Both')} sherpa-input-text[name="type"]`).getAttribute('data-description')).toBe('True when every input is true: above zero, true, or not empty');
  // Is one of: Value B becomes a tag list of Values.
  await pick(page, 'Is active', 'in');
  expect(await rows(page, 'Is active')).toEqual(['type', 'Value A (Optional)', 'b', 'Pass', 'Fail']);
  expect(await page.locator(`${NODE('Is active')} sherpa-input-text[name="b"]`).evaluate((el) => [el.getAttribute('data-type'), el.getAttribute('data-label'), (el as HTMLElement & { tags: string[] }).tags])).toEqual(['tags', 'Values', ['active']]);
  // Contains: its header is the data, so no Value A of 994; its one value row is titled Value A, text with no choices (TODO 1002).
  await pick(page, 'Is active', 'contains');
  expect(await rows(page, 'Is active')).toEqual(['type', 'b', 'Pass', 'Fail']);
  expect(await page.locator(`${NODE('Is active')} sherpa-input-text[name="b"]`).evaluate((el) => [el.getAttribute('data-type'), el.getAttribute('data-label')])).toEqual([null, 'Value A']);
});

test('a Field\'s column into a Condition switched to And stays joined, read as rows (939); back to Equals it reads it; a text field lists no Greater than (940); Save keeps what is drawn (770)', async ({ page }) => {
  const reports: string[] = [];
  page.on('console', (m) => { if (/workflow|fault/i.test(m.text())) reports.push(m.text()); });
  const warning = () => page.locator(NODE('Check')).evaluate((el) => el.getAttribute('data-warning'));
  await expect(line(page, 'f/field', 'c')).toHaveCount(1);
  expect(await rows(page, 'Check')).toEqual(['type', 'Value A (Optional)', 'b', 'Pass', 'Fail']);
  expect(await warning()).toBeNull();
  // And: its header takes anything (TODO 939). The column stays joined, the line drawn, and nothing warns.
  await pick(page, 'Check', 'and');
  expect(await rows(page, 'Check')).toEqual(['type', 'Pass', 'Fail']);
  await expect(line(page, 'f/field', 'c')).toHaveCount(1);
  expect(await warning()).toBeNull();
  // Back to Equals: no warning, and its Value B kept in the draft.
  await pick(page, 'Check', 'eq');
  expect(await warning()).toBeNull();
  expect(await rows(page, 'Check')).toEqual(['type', 'Value A (Optional)', 'b', 'Pass', 'Fail']);
  expect(await page.locator(`${NODE('Check')} sherpa-input-text[name="b"]`).evaluate((el) => (el as HTMLElement & { value: string }).value)).toBe('active');
  // A text field: its select lists no Greater than (TODO 940).
  const options = await page.locator(`${NODE('Check')} sherpa-input-text[name="type"] option`).evaluateAll((els) => els.map((o) => (o as HTMLOptionElement).value));
  expect(options).not.toContain('gt');
  expect(options).toContain('contains');
  // And again, then Save: a warning is no block, and the final graph keeps the connection it draws, not Value B.
  await pick(page, 'Check', 'and');
  const out = await saved(page);
  expect(out.connections).toContainEqual({ from: 'f/field', to: 'c' });
  expect(out.nodes.find((n) => n.id === 'c')!.values).toEqual({ type: 'and' });
  expect(reports).toEqual([]);
});
