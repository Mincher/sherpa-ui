import { test, expect, type Page } from './harness';

/**
 * A FAMILY node: one node, its FIRST row picks the type, and its rows follow it; a kind of one type
 * has no such select. A row the new type lacks keeps its value and its route in the DRAFT: drawn
 * nowhere, no fault, and picking the type back joins them again; Save writes only the final graph.
 * Real selects. Plan 749 P1; the kept route, Will 2026-11-05.
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
type Flow = { nodes: { id: string; values?: Record<string, unknown> }[]; routes: { from: string; to: string }[] };
/** What Save hands over: the final graph. */
const saved = (page: Page) => page.evaluate(`(() => { window.editor.save(); return window.saved.at(-1); })()`) as Promise<Flow>;
/** What the draft holds now, unsaved. */
const draft = (page: Page) => page.evaluate(`window.editor.workflow()`) as Promise<Flow>;
const pick = async (page: Page, type: string) => {
  await page.locator('#root sherpa-node[data-heading="Math"] sherpa-input-text[name="type"] select').selectOption(type);
  await settle(page);
};

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
  // The kept value waits in the draft; Save writes the type, and not it.
  expect((await draft(page)).nodes.find((n) => n.id === 'm')!.values).toEqual({ type: 'add', places: 2 });
  expect((await saved(page)).nodes.find((n) => n.id === 'm')!.values).toEqual({ type: 'add' });
});

test('a route into a row the new type lacks is KEPT in the draft: drawn nowhere, no fault, and back with Round', async ({ page }) => {
  const reports: string[] = [];
  page.on('console', (m) => { if (/workflow|fault/i.test(m.text())) reports.push(m.text()); });
  await page.evaluate(`(${BIND})(true)`);
  const line = '#root svg.graph-routes path[data-to="m/places"]';
  expect(await page.locator(line).count()).toBe(1);
  await pick(page, 'add');
  // Gone from the canvas and the inspector; still in the draft.
  expect(await page.locator(line).count()).toBe(0);
  expect((await draft(page)).routes).toEqual([{ from: 'v/value', to: 'm/places' }]);
  // Undo steps the type back to Round, and the line with it; Redo takes both away again.
  const step = (key: string) => page.evaluate(`window.editor.${key}()`).then(() => settle(page));
  await step('undo');
  expect(await page.locator(line).count()).toBe(1);
  await step('redo');
  expect(await page.locator(line).count()).toBe(0);
  await page.locator('#root sherpa-node[data-heading="Math"]').click({ position: { x: 40, y: 12 } });
  await expect(page.locator('#inspector')).toContainText('Value A');
  await expect(page.locator('#inspector')).not.toContainText('Places');
  // Round again, by the select: the line is back, and Places with its value.
  await pick(page, 'round');
  expect(await page.locator(line).count()).toBe(1);
  expect((await draft(page)).nodes.find((n) => n.id === 'm')!.values).toEqual({ type: 'round', places: 2 });
  expect(await rows(page, 'Math')).toEqual(['type', 'places', 'a', 'b']);
  expect(reports).toEqual([]);
});

test('Save after Round → Add writes no route to Places and no Places value, and is never refused', async ({ page }) => {
  const reports: string[] = [];
  page.on('console', (m) => { if (/workflow|fault/i.test(m.text())) reports.push(m.text()); });
  await page.evaluate(`(${BIND})(true)`);
  await pick(page, 'add');
  const out = await saved(page);
  expect(out.routes).toEqual([]);
  expect(out.nodes.find((n) => n.id === 'm')!.values).toEqual({ type: 'add' });
  expect(reports).toEqual([]);
  // Saved, the draft is the final graph: Round has no route to come back to.
  await pick(page, 'round');
  expect(await page.locator('#root svg.graph-routes path[data-to="m/places"]').count()).toBe(0);
});

test('an old graph (a Sort, a Group, a Count, a Number) draws as the old registry drew it: the same nodes, places, sockets, rows and routes', async ({ page }) => {
  const drawn = await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { NODE_KINDS, ROWS } = await import('/dist/data.js');
    const field = { name: 'field', label: 'Field', control: 'field', input: 'value' };
    const OLD = { ...NODE_KINDS,
      value: { ...NODE_KINDS.value, types: { text: { label: 'Text' }, number: { label: 'Number' }, date: { label: 'Date' }, boolean: { label: 'True/false' } }, rows: [{ name: 'value', label: 'Value', control: 'text', output: 'value' }] },
      sort: { heading: 'Sort', icon: 'sort-ascending', input: 'any', branches: true, rows: [ROWS, field, { name: 'direction', label: 'Direction', control: 'direction', input: 'value' }], model: 'sortRows', graphs: ['workflow'], category: 'Collections' },
      group: { heading: 'Group', icon: 'group', input: 'any', branches: true, rows: [ROWS, field], model: 'groupRows', graphs: ['workflow'], category: 'Collections' },
      count: { heading: 'Count', icon: 'insights', input: 'any', branches: true, rows: [{ name: 'count', label: 'Count', output: 'value' }], model: 'reduceRows', graphs: ['workflow'], category: 'Collections' } };
    const old = { v: 2, id: 'old', nodes: [
      { id: 'start', kind: 'store', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'sort', kind: 'sort', x: 320, y: 0, values: { field: 'status', direction: 'desc' } },
      { id: 'group', kind: 'group', x: 640, y: 0, values: { field: 'status' } },
      { id: 'count', kind: 'count', x: 960, y: 0 },
      { id: 'seven', kind: 'value', x: 0, y: 300, values: { value: '7', type: 'number' } },
    ], routes: [{ from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'group' }, { from: 'group/rows', to: 'count' }] };
    const facts = { session: new SessionStore(), fields: { status: { label: 'Status' } }, stores: ['customers'], values: { status: ['active', 'trial'] } };
    const read = async (kinds: unknown) => {
      const canvas = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
      canvas.style.cssText = 'inline-size: 1400px; block-size: 500px';
      document.getElementById('root')!.appendChild(canvas);
      await canvas.rendered;
      const editor = bindWorkflow(canvas as never, structuredClone(old) as never, { ...facts, ...(kinds ? { kinds } : {}) } as never);
      await (window as unknown as { __settled(): Promise<void> }).__settled();
      await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
      const nodes = [...canvas.querySelectorAll(':scope > sherpa-node')].map((el) => ({
        heading: el.getAttribute('data-heading'),
        at: ['data-x', 'data-y', 'data-input-socket', 'data-output-socket', 'data-branches', 'data-category'].map((a) => el.getAttribute(a)),
        rows: [...el.querySelectorAll('sherpa-node-row')].map((r) => {
          const f = r.querySelector<HTMLElement & { value?: unknown }>('[name], sherpa-switch, sherpa-quick-filter');
          return [f?.getAttribute('name') ?? r.textContent?.trim(), f?.getAttribute('data-label'), f ? String(f.value ?? '') : ''];
        }).filter(([name]) => name !== 'type'),
        type: el.querySelector<HTMLElement & { value?: string }>('sherpa-input-text[name="type"]')?.value,
      }));
      const lines = [...canvas.querySelectorAll('svg.graph-routes path[data-from]')].map((p) => `${p.getAttribute('data-from')} → ${p.getAttribute('data-to')} ${p.getAttribute('data-type')}`);
      editor.stop();
      canvas.remove();
      return { nodes, lines };
    };
    return { before: await read(OLD), after: await read(undefined) };
  });
  const plain = (d: typeof drawn.before) => ({ lines: d.lines, nodes: d.nodes.map(({ at, rows }) => ({ at, rows })) });
  expect(plain(drawn.after)).toEqual(plain(drawn.before));
  expect(drawn.after.lines).toHaveLength(3);
  // Only the family's own words are new: its heading, and its Type row naming the old kind.
  expect(drawn.after.nodes.map((n) => [n.heading, n.type])).toEqual([['Store', undefined], ['Collection', 'sort'], ['Collection', 'group'], ['Collection', 'count'], ['Value', 'decimal']]);
  expect(drawn.before.nodes.map((n) => n.heading)).toEqual(['Store', 'Sort', 'Group', 'Count', 'Value']);
});
