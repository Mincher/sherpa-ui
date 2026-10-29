import { test, expect } from './harness';

/**
 * The Node Editor's drawing — Will, TODO 555 Q2. drawGraph puts each node of a
 * graph on a canvas by its id, its rows read only, and a line for each route; a
 * redraw keeps a node where the reader moved it. bindQueryEditor keeps a page's
 * Query drawn as it changes, and its undo stops it.
 * TRAP T-the-node-editor-asks-the-query
 */
type Canvas = HTMLElement & { rendered: Promise<void> };
/** What drawGraph draws on: a sherpa-layout-canvas. */
type Drawable = Parameters<typeof import('/dist/app.js')['drawGraph']>[0];
type Graph = Parameters<typeof import('/dist/app.js')['drawGraph']>[1];

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
  });
});

/** Two frames: the nodes render, then their lines are drawn. */
const FRAMES = '() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))';

test('each node by its id, its rows read only, a line for each route; a redraw keeps a moved node and drops a gone one', async ({ page }) => {
  const r = await page.evaluate(async (frames) => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const graph = (op: string, withB = true): Graph => ({
      nodes: [
        { id: 'a', kind: 'store', heading: 'customers', icon: 'storage', output: 'object', rows: [], x: 0, y: 0 },
        ...(withB ? [{ id: 'b', kind: 'condition', heading: 'Status', icon: 'function', input: 'object', x: 360, y: 0, rows: [
          { name: 'op', label: 'Condition', field: 'condition', value: op },
          { name: 'matches', label: 'Matches', output: 'value', value: 3 },
        ] } as Graph['nodes'][number]] : []),
      ],
      routes: withB ? [{ from: 'a', to: 'b' }] : [],
    });
    const settle = async (): Promise<void> => { await window.__settled(); await eval(frames)(); };
    const read = () => {
      const nodes = [...canvas.querySelectorAll<HTMLElement>('sherpa-node')];
      const field = canvas.querySelector<HTMLElement & { value: string }>('sherpa-node-row sherpa-input-text');
      return {
        nodes: nodes.map((n) => [n.dataset['heading'], n.dataset['x']]),
        field: field ? [field.value, field.hasAttribute('readonly')] : null,
        label: canvas.querySelector('sherpa-node-row:not(:has(sherpa-input-text))')?.getAttribute('data-label') ?? null,
        lines: [...canvas.querySelectorAll('svg.graph-routes path')].map((p) => (p.getAttribute('d') ?? '').startsWith('M ')),
      };
    };
    drawGraph(canvas, graph('eq'));
    await settle();
    const first = read();
    // The reader moves A; the Query moves B's operator.
    canvas.querySelector('sherpa-node')!.setAttribute('data-x', '100');
    drawGraph(canvas, graph('in'));
    await settle();
    const again = read();
    drawGraph(canvas, graph('in', false));
    await settle();
    return { first, again, gone: read() };
  }, FRAMES);
  expect(r.first).toEqual({ nodes: [['customers', '0'], ['Status', '360']], field: ['Equals', true], label: 'Matches: 3', lines: [true] });
  expect(r.again).toEqual({ nodes: [['customers', '100'], ['Status', '360']], field: ['Is one of', true], label: 'Matches: 3', lines: [true] });
  expect(r.gone).toEqual({ nodes: [['customers', '100']], field: null, label: null, lines: [] });
});

test('bindQueryEditor follows the Query as it changes, and its undo lets it go', async ({ page }) => {
  const r = await page.evaluate(async (frames) => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const draft = (picks: string[]) => ({ v: 1, scopes: { view: { holds: ['region'], readings: readingsOf({ region: { in: picks } }) } } });
    const query = Object.assign(new EventTarget(), { draft: draft(['EMEA', 'APAC']) });
    const definition = { v: 1 as const, id: 'records', source: { store: 'customers' } };
    const value = () => canvas.querySelector<HTMLElement & { value: string }>('sherpa-node-row sherpa-input-text[name="value"]')?.value;
    const change = async (picks: string[]): Promise<void> => {
      query.draft = draft(picks);
      query.dispatchEvent(new CustomEvent('query-change'));
      await window.__settled();
      await eval(frames)();
    };
    const undo = bindQueryEditor(canvas, { query } as never, { definition });
    await window.__settled();
    const drawn = [...canvas.querySelectorAll<HTMLElement>('sherpa-node')].map((n) => n.dataset['heading']);
    const before = value();
    await change(['EMEA']);
    const followed = value();
    undo();
    await change(['AMER']);
    return { drawn, before, followed, after: value() };
  }, FRAMES);
  expect(r).toEqual({ drawn: ['customers', 'Source', 'View', 'region'], before: 'EMEA, APAC', followed: 'EMEA', after: 'EMEA' });
});

test('a filter toolbar\'s ⋮ menu offers Node Editor (beta) only where the host does, and a pick asks the host to open it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const rowsOf = async (attrs: Record<string, string>): Promise<{ rows: string[]; heard: string[] }> => {
      const el = await window.__mount<HTMLElement & { populate(f: unknown[]): void }>('sherpa-quick-filter-toolbar', undefined, { 'data-type': 'view', ...attrs });
      el.populate([{ id: 'region', label: 'Region', options: [{ value: 'a', label: 'A' }] }]);
      await window.__settled();
      const sr = el.shadowRoot!;
      const more = sr.querySelector('[data-act="overflow"]') as HTMLElement & { shadowRoot: ShadowRoot };
      more.shadowRoot.querySelector<HTMLElement>('button')!.click();
      await window.__settled();
      const menu = sr.querySelector('.more-menu') as HTMLElement;
      const rows = [...menu.querySelectorAll('button')].map((b) => (b.textContent ?? '').trim());
      const heard: string[] = [];
      el.addEventListener('node-editor-open', () => heard.push('node-editor-open'));
      [...menu.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Node Editor (beta)')?.click();
      await window.__settled();
      el.remove();
      return { rows, heard };
    };
    return { off: await rowsOf({}), on: await rowsOf({ 'data-node-editor': '' }) };
  });
  expect(r.off.rows).not.toContain('Node Editor (beta)');
  expect(r.off.heard).toEqual([]);
  expect(r.on.rows.at(-1)).toBe('Node Editor (beta)');
  expect(r.on.heard).toEqual(['node-editor-open']);
});

test('drawGraph tells its host each edit — a select picked, a switch flipped — and writes nothing itself', async ({ page }) => {
  await page.evaluate(async () => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const heard: unknown[] = [];
    (window as unknown as { heard: unknown[] }).heard = heard;
    drawGraph(canvas, { routes: [], nodes: [{
      id: 'c', kind: 'condition', heading: 'Status', icon: 'function', x: 0, y: 0, ref: { scope: 'view', field: 'status' },
      rows: [
        { name: 'op', label: 'Condition', field: 'condition', value: 'eq', editable: true,
          choices: [{ value: 'eq', label: 'Equals' }, { value: 'ne', label: 'Does not equal' }] },
        { name: 'on', label: 'Filters', field: 'switch', value: true, editable: true },
        { name: 'fixed', label: 'Fixed', field: 'text', value: 'x' },
      ],
    }] }, { onEdit: ({ node, row, value }) => heard.push([node.id, row.name, value]) });
    await window.__settled();
  });
  await page.locator('#root sherpa-node-row select').selectOption('ne');
  // On its TRACK: the switch spans the row, and its middle is bare.
  await page.locator('#root sherpa-node-row sherpa-switch .track').click();
  const r = await page.evaluate(() => ({
    heard: (window as unknown as { heard: unknown[] }).heard,
    fixed: document.querySelector<HTMLElement & { value: string }>('#root sherpa-input-text[name="fixed"]')!.hasAttribute('readonly'),
  }));
  expect(r).toEqual({ heard: [['c', 'op', 'ne'], ['c', 'on', false]], fixed: true });
});

test('bindQueryEditor ASKS the Query through a chip\'s doors: a reading, the Switch, Group', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const asked: unknown[] = [];
    (window as unknown as { asked: unknown[] }).asked = asked;
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: {
        view: { holds: ['region'], readings: readingsOf({ region: { in: ['EMEA', 'APAC'] } }) },
        data: { holds: ['status'], readings: {}, sort: [{ field: 'name', direction: 'asc' }] },
      } },
      setReading: (scope: string, field: string, reading: unknown) => asked.push(['setReading', scope, field, reading]),
      suspend: (scope: string, field: string | null, on: boolean) => asked.push(['suspend', scope, field, on]),
      setGroup: (field: string | null, scope: string) => asked.push(['setGroup', field, scope]),
      setSort: (field: string | null, direction: string, scope: string) => asked.push(['setSort', field, direction, scope]),
    });
    const definition = { v: 1 as const, id: 'records', source: { store: 'customers', fields: { name: { label: 'Name' }, plan: { label: 'Plan' } } } };
    bindQueryEditor(canvas, { query } as never, { definition });
    await window.__settled();
  });
  await page.locator('#root sherpa-node-row:has(sherpa-input-text[name="op"]) select').selectOption('notin');
  await page.locator('#root sherpa-node-row:has(sherpa-input-text[name="group"]) select').selectOption('plan');
  await page.locator('#root sherpa-node-row sherpa-switch .track').first().click();
  const r = await page.evaluate(async () => {
    const { whereOf } = await import('/dist/data.js');
    const asked = (window as unknown as { asked: unknown[][] }).asked;
    // A reading reads back as the plain condition it says.
    return asked.map((a) => (a[0] === 'setReading' ? [a[0], a[1], a[2], whereOf({ [a[2] as string]: a[3] as never })[a[2] as string]] : a));
  });
  expect(r).toEqual([
    ['setReading', 'view', 'region', { notin: ['EMEA', 'APAC'] }],
    ['setGroup', 'plan', 'data'],
    ['suspend', 'view', null, true],
  ]);
});

test('a row a route drives MIRRORS what comes in, read only; one with no route stays editable', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const row = { label: 'Value', field: 'text' as const, input: 'value' as const, editable: true };
    drawGraph(canvas, { routes: [{ from: 'a', to: 'b/fed' }], nodes: [
      { id: 'a', kind: 'value', heading: 'A', icon: 'function', output: 'value', x: 0, y: 0, rows: [] },
      { id: 'b', kind: 'filter', heading: 'B', icon: 'filter', x: 360, y: 0, rows: [{ ...row, name: 'fed', value: '1' }, { ...row, name: 'free', value: '2' }] },
    ] });
    await window.__settled();
    const ro = (name: string) => document.querySelector(`#root sherpa-input-text[name="${name}"]`)!.hasAttribute('readonly');
    return { fed: ro('fed'), free: ro('free') };
  });
  expect(r).toEqual({ fed: true, free: false });
});

test('a picked node opens its inspector: its rows again, their routes, and an edit there reaches the host', async ({ page }) => {
  await page.evaluate(async () => {
    const { drawGraph, inspectNode } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const panel = document.createElement('sherpa-overlay-panel') as HTMLElement & { show(): void };
    document.getElementById('root')!.append(panel);
    const heard: unknown[] = [];
    (window as unknown as { heard: unknown[] }).heard = heard;
    const graph = { routes: [{ from: 'a', to: 'b/value' }], nodes: [
      { id: 'a', kind: 'value', heading: 'A', icon: 'function', output: 'value' as const, x: 0, y: 0, rows: [] },
      { id: 'b', kind: 'condition', heading: 'Status', icon: 'function', x: 360, y: 0, rows: [
        { name: 'op', label: 'Condition', field: 'condition' as const, value: 'eq', editable: true, choices: [{ value: 'eq', label: 'Equals' }, { value: 'ne', label: 'Does not equal' }] },
        { name: 'value', label: 'Value', field: 'text' as const, input: 'value' as const, value: 'x', editable: true },
      ] },
    ] };
    const onEdit = ({ row, value }: { row: { name: string }; value: unknown }) => heard.push([row.name, value]);
    drawGraph(canvas, graph, { onEdit, onSelect: (node) => { inspectNode(panel, node, graph, { onEdit }); panel.show(); } });
    await window.__settled();
  });
  await page.locator('#root sherpa-node[data-heading="Status"]').click({ position: { x: 40, y: 12 } });
  await page.locator('#root sherpa-overlay-panel sherpa-input-text[name="op"] select').selectOption('ne');
  const r = await page.evaluate(() => {
    const panel = document.querySelector('#root sherpa-overlay-panel') as HTMLElement & { open: boolean };
    const value = panel.querySelector('sherpa-input-text[name="value"]')!;
    return {
      open: panel.open, heading: panel.dataset['heading'],
      current: [...document.querySelectorAll('#root sherpa-node[data-current]')].map((n) => n.getAttribute('data-heading')),
      value: [value.hasAttribute('readonly'), value.getAttribute('data-description')],
      heard: (window as unknown as { heard: unknown[] }).heard,
    };
  });
  expect(r).toEqual({ open: true, heading: 'Status', current: ['Status'], value: [true, 'From A'], heard: [['op', 'ne']] });
});
