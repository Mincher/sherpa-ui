import { test, expect, gotoHarness, type Page } from './harness';
import { parkThePointer } from './fixture';

/**
 * The Node Editor's drawing — Will, TODO 555 Q2. drawGraph puts each node of a
 * graph on a canvas by its id, its rows read only, and a line for each connection; a
 * redraw keeps a node where the reader moved it. bindQueryEditor keeps a page's
 * Query drawn as it changes, and its stop lets it go; bindWorkflow keeps a
 * workflow's draft. A moved node keeps its place for the tab, and Save hands the
 * app a checked definition (plan 695 N1, TODO 551).
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

test('each node by its id, its rows read only, a line for each connection; a redraw keeps a moved node and drops a gone one', async ({ page }) => {
  const r = await page.evaluate(async (frames) => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const graph = (op: string, withB = true): Graph => ({
      nodes: [
        { id: 'a', kind: 'source', heading: 'customers', icon: 'storage', output: 'object', rows: [], x: 0, y: 0 },
        ...(withB ? [{ id: 'b', kind: 'condition', heading: 'Status', icon: 'function', input: 'object', x: 360, y: 0, rows: [
          { name: 'type', label: 'Operation', control: 'type', value: op, choices: [{ value: 'eq', label: 'Equals' }, { value: 'in', label: 'Is one of' }] },
          { name: 'matches', label: 'Matches', output: 'value', value: 3 },
        ] } as Graph['nodes'][number]] : []),
      ],
      connections: withB ? [{ from: 'a', to: 'b' }] : [],
    });
    const settle = async (): Promise<void> => { await window.__settled(); await eval(frames)(); };
    const read = () => {
      const nodes = [...canvas.querySelectorAll<HTMLElement>('sherpa-node')];
      const field = canvas.querySelector<HTMLElement & { value: string }>('sherpa-node-row sherpa-input-text');
      return {
        nodes: nodes.map((n) => [n.dataset['heading'], n.dataset['x']]),
        field: field ? [field.value, field.hasAttribute('readonly')] : null,
        label: canvas.querySelector('sherpa-node-row[data-label^="Matches"]')?.getAttribute('data-label') ?? null,
        lines: [...canvas.querySelectorAll('svg.graph-connectors path')].map((p) => (p.getAttribute('d') ?? '').startsWith('M ')),
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
  expect(r.first).toEqual({ nodes: [['customers', '0'], ['Status', '360']], field: ['eq', true], label: 'Matches: 3', lines: [true] });
  expect(r.again).toEqual({ nodes: [['customers', '100'], ['Status', '360']], field: ['in', true], label: 'Matches: 3', lines: [true] });
  expect(r.gone).toEqual({ nodes: [['customers', '100']], field: null, label: null, lines: [] });
});

test('bindQueryEditor follows the Query as it changes, and its stop lets it go', async ({ page }) => {
  const r = await page.evaluate(async (frames) => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const draft = (picks: string[]) => ({ v: 1, scopes: { view: { holds: ['region'], readings: readingsOf({ region: { in: picks } }) } } });
    const query = Object.assign(new EventTarget(), { draft: draft(['EMEA', 'APAC']), presets: () => [] });
    const definition = { v: 1 as const, id: 'records', source: { store: 'customers' } };
    const value = () => canvas.querySelector<HTMLElement & { value: string }>('sherpa-node-row sherpa-input-text[name="b"]')?.value;
    const change = async (picks: string[]): Promise<void> => {
      query.draft = draft(picks);
      query.dispatchEvent(new CustomEvent('query-change'));
      await window.__settled();
      await eval(frames)();
    };
    const editor = bindQueryEditor(canvas, { query } as never, { definition });
    await window.__settled();
    const drawn = [...canvas.querySelectorAll<HTMLElement>('sherpa-node')].map((n) => n.dataset['heading']);
    const before = value();
    await change(['EMEA']);
    const followed = value();
    editor.stop();
    await change(['AMER']);
    return { drawn, before, followed, after: value() };
  }, FRAMES);
  // Is one of with no values to pick from is tags: its value, the comma string (plan 749 P4). The Field, then its test (plan 783 D6).
  expect(r).toEqual({ drawn: ['Source', 'View', 'region', 'region'], before: 'EMEA,APAC', followed: 'EMEA', after: 'EMEA' });
});

test('a filter toolbar\'s ⋮ menu offers Open in Node Editor only where the host does, and a pick asks for it (TODO 822)', async ({ page }) => {
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
      [...menu.querySelectorAll<HTMLButtonElement>('button')].find((b) => b.textContent?.trim() === 'Open in Node Editor')?.click();
      await window.__settled();
      el.remove();
      return { rows, heard };
    };
    return { off: await rowsOf({}), on: await rowsOf({ 'data-node-editor': '' }) };
  });
  expect(r.off.rows).not.toContain('Open in Node Editor');
  expect(r.off.heard).toEqual([]);
  expect(r.on.rows.at(-1)).toBe('Open in Node Editor');
  expect(r.on.heard).toEqual(['node-editor-open']);
});

test('drawGraph tells its host each edit — a select picked, a switch flipped — and writes nothing itself', async ({ page }) => {
  await page.evaluate(async () => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const heard: unknown[] = [];
    (window as unknown as { heard: unknown[] }).heard = heard;
    drawGraph(canvas, { connections: [], nodes: [{
      id: 'c', kind: 'condition', heading: 'Status', icon: 'function', x: 0, y: 0, ref: { scope: 'view', field: 'status' },
      rows: [
        { name: 'type', label: 'Operation', control: 'type', value: 'eq', editable: true,
          choices: [{ value: 'eq', label: 'Equals' }, { value: 'ne', label: 'Does not equal' }] },
        { name: 'on', label: 'Filters', control: 'switch', value: true, editable: true },
        { name: 'fixed', label: 'Fixed', control: 'text', value: 'x' },
      ],
    }] }, { onEdit: ({ node, row, value }) => heard.push([node.id, row.name, value]) });
    await window.__settled();
  });
  await page.locator('#root sherpa-node-row select').selectOption('ne');
  // On its TRACK: the switch spans the row, and its middle is bare.
  await page.locator('#root sherpa-node-row > sherpa-switch .track').click();
  const r = await page.evaluate(() => ({
    heard: (window as unknown as { heard: unknown[] }).heard,
    fixed: document.querySelector<HTMLElement & { value: string }>('#root sherpa-input-text[name="fixed"]')!.hasAttribute('readonly'),
  }));
  expect(r).toEqual({ heard: [['c', 'type', 'ne'], ['c', 'on', false]], fixed: true });
});

test('bindQueryEditor ASKS the Query through its one door, as a chip does: a reading, the Switch, Group', async ({ page }) => {
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
      ask: (request: unknown) => asked.push(request),
      presets: () => [],
    });
    const definition = { v: 1 as const, id: 'records', source: { store: 'customers', fields: { name: { label: 'Name' }, plan: { label: 'Plan' } } } };
    bindQueryEditor(canvas, { query } as never, { definition });
    await window.__settled();
  });
  await page.locator('#root sherpa-node-row:has(sherpa-input-text[name="type"]) select').selectOption('notin');
  await page.locator('#root sherpa-node-row:has(sherpa-input-text[name="group"]) select').selectOption('plan');
  await page.locator('#root sherpa-node-row > sherpa-switch .track').first().click();
  const r = await page.evaluate(async () => {
    const { whereOf } = await import('/dist/data.js');
    const asked = (window as unknown as { asked: Record<string, unknown>[] }).asked;
    // A reading reads back as the plain condition it says.
    return asked.map((a) => ('reading' in a ? { ...a, reading: whereOf({ [a['field'] as string]: a['reading'] as never })[a['field'] as string] } : a));
  });
  expect(r).toEqual([
    { scope: 'view', field: 'region', reading: { notin: ['EMEA', 'APAC'] } },
    { scope: 'data', group: 'plan' },
    { scope: 'view', suspended: true },
  ]);
});

// Bug 5 (plan 695 S2): the editor's Sort and Group skipped a slot's rerouting.
test('in a SLOT, the editor\'s Sort and Group are its chart\'s, as a chip\'s are: the rows keep their own', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const rows = [{ id: 1, plan: 'Pro', region: 'EMEA' }, { id: 2, plan: 'Free', region: 'APAC' }];
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    // A chart's summary in its card's scope: the card is its SLOT.
    bindSource(source, Object.assign(document.createElement('div'), { populate() {} }), { scope: 'card', rows: 'all', readonly: true });
    // Its rows came arranged, so its Arrange node is drawn.
    await source.query.setQuery({ v: 1, scopes: { card: { holds: [], sort: [{ field: 'region', direction: 'asc' }] } } });
    (window as unknown as { source: unknown }).source = source;
    const definition = { v: 1 as const, id: 'cards', source: { store: 'plans', fields: { plan: { label: 'Plan' }, region: { label: 'Region' } } } };
    bindQueryEditor(canvas, source, { definition });
    await window.__settled();
  });
  const arrange = page.locator('#root sherpa-node[data-heading="Arrange"]');
  await arrange.locator('sherpa-node-row:has(sherpa-input-text[name="group"]) select').selectOption('plan');
  await page.evaluate(() => window.__settled());
  await arrange.locator('sherpa-node-row:has(sherpa-input-text[name="direction"]) select').selectOption('desc');
  const r = await page.evaluate(async () => {
    await window.__settled();
    const { query } = (window as unknown as { source: { query: { presentation(s: string): unknown; applied: { scopes: Record<string, { sort?: unknown; group?: unknown }> } } } }).source;
    const card = query.applied.scopes['card'];
    return { presentation: query.presentation('card'), sort: card?.sort, group: card?.group ?? null };
  });
  expect(r).toEqual({ presentation: { group: 'plan', sort: 'desc' }, sort: [{ field: 'region', direction: 'asc' }], group: null });
});

test('a row a connection drives MIRRORS what comes in, read only; one with no connection stays editable', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const row = { label: 'Value', control: 'text' as const, input: 'value' as const, editable: true };
    drawGraph(canvas, { connections: [{ from: 'a', to: 'b/fed' }], nodes: [
      { id: 'a', kind: 'value', heading: 'A', icon: 'function', output: 'value', x: 0, y: 0, rows: [] },
      { id: 'b', kind: 'condition', heading: 'B', icon: 'filter', x: 360, y: 0, rows: [{ ...row, name: 'fed', value: '1' }, { ...row, name: 'free', value: '2' }] },
    ] });
    await window.__settled();
    const ro = (name: string) => document.querySelector(`#root sherpa-input-text[name="${name}"]`)!.hasAttribute('readonly');
    return { fed: ro('fed'), free: ro('free') };
  });
  expect(r).toEqual({ fed: true, free: false });
});

test('a picked node opens its inspector: its rows again, their connections, and an edit there reaches the host', async ({ page }) => {
  await page.evaluate(async () => {
    const { drawGraph, inspectNode } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const panel = document.createElement('sherpa-overlay-panel') as HTMLElement & { show(): void };
    document.getElementById('root')!.append(panel);
    const heard: unknown[] = [];
    (window as unknown as { heard: unknown[] }).heard = heard;
    const graph = { connections: [{ from: 'a', to: 'b/value' }], nodes: [
      { id: 'a', kind: 'value', heading: 'A', icon: 'function', output: 'value' as const, x: 0, y: 0, rows: [] },
      { id: 'b', kind: 'condition', heading: 'Status', icon: 'function', x: 360, y: 0, rows: [
        { name: 'type', label: 'Operation', control: 'type' as const, value: 'eq', editable: true, choices: [{ value: 'eq', label: 'Equals' }, { value: 'ne', label: 'Does not equal' }] },
        { name: 'value', label: 'Value', control: 'text' as const, input: 'value' as const, value: 'x', editable: true },
      ] },
    ] };
    const onEdit = ({ row, value }: { row: { name: string }; value: unknown }) => heard.push([row.name, value]);
    drawGraph(canvas, graph, { onEdit, onSelect: (node) => { inspectNode(panel, node, graph, { onEdit }); panel.show(); } });
    await window.__settled();
  });
  await page.locator('#root sherpa-node[data-heading="Status"]').click({ position: { x: 40, y: 12 } });
  await page.locator('#root sherpa-overlay-panel sherpa-input-text[name="type"] select').selectOption('ne');
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
  expect(r).toEqual({ open: true, heading: 'Status', current: ['Status'], value: [true, 'From A'], heard: [['type', 'ne']] });
});

/** The middle of a drawn node's or row's socket, on the screen. */
const SOCKET = `(el, side) => { const r = el.socketRect(side); return [r.left + r.width / 2, r.top + r.height / 2]; }`;

test('a drag from an OUTPUT socket draws a new connection: let go on an input socket, the host is asked; on bare canvas, nothing', async ({ page }) => {
  await page.evaluate(async () => {
    const { drawGraph } = await import('/dist/app.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const asked: unknown[] = [];
    (window as unknown as { asked: unknown[] }).asked = asked;
    drawGraph(canvas, { connections: [], nodes: [
      { id: 'a', kind: 'value', heading: 'A', icon: 'function', output: 'value', x: 0, y: 0, rows: [] },
      { id: 'b', kind: 'condition', heading: 'B', icon: 'filter', x: 360, y: 0, rows: [{ name: 'x', label: 'X', control: 'text', input: 'value', editable: true }] },
    ] }, { onConnect: (route) => asked.push(route) });
    await window.__settled();
  });
  const at = (selector: string, side: string) => page.evaluate(([sel, s, socket]) => eval(socket!)(document.querySelector(sel!), s), [selector, side, SOCKET]) as Promise<[number, number]>;
  const [ax, ay] = await at('#root sherpa-node[data-heading="A"]', 'output');
  const [bx, by] = await at('#root sherpa-node[data-heading="B"] sherpa-node-row[data-input-socket]', 'input');
  const before = await page.evaluate(() => [document.querySelector('#root sherpa-node[data-heading="A"]')!.getAttribute('data-x'),
    JSON.stringify((document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { view: unknown }).view)]);
  // Onto B's input: a connection is asked for.
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move((ax + bx) / 2, by + 40, { steps: 4 });
  const drafting = await page.evaluate(() => document.querySelectorAll('#root svg.graph-connectors path.graph-draft').length);
  await page.mouse.move(bx, by, { steps: 4 });
  await page.mouse.up();
  // Onto the bare canvas: nothing.
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(ax + 120, ay + 200, { steps: 4 });
  await page.mouse.up();
  const r = await page.evaluate(() => ({
    asked: (window as unknown as { asked: unknown[] }).asked,
    drafts: document.querySelectorAll('#root svg.graph-connectors path.graph-draft').length,
    after: [document.querySelector('#root sherpa-node[data-heading="A"]')!.getAttribute('data-x'),
      JSON.stringify((document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { view: unknown }).view)],
  }));
  expect(drafting).toBe(1);
  expect(r).toEqual({ asked: [{ from: 'a', to: 'b/x' }], drafts: 0, after: before });
});

test('a condition dragged into the same field of another scope MOVES there, as one change through the one door', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const asked: unknown[] = [];
    (window as unknown as { asked: unknown[] }).asked = asked;
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: {
        view: { holds: ['region'], readings: readingsOf({ region: { in: ['EMEA'] } }) },
        data: { holds: ['region'], readings: {} },
      } },
      ask: (request: { scope: string; field: string; reading: unknown }[]) => asked.push(request.map(({ scope, field, reading }) => [scope, field, reading === null ? null : 'reading'])),
      presets: () => [],
    });
    bindQueryEditor(canvas, { query } as never, { definition: { v: 1 as const, id: 'records', source: { store: 'customers' } } });
    await window.__settled();
  });
  const at = (selector: string, side: string) => page.evaluate(([sel, s, socket]) => eval(socket!)(document.querySelector(sel!), s), [selector, side, SOCKET]) as Promise<[number, number]>;
  // A condition's tree leaves by its True property (plan 944).
  const [ax, ay] = await at('#root sherpa-node[data-icon="function"] sherpa-node-row[data-socket-name="True"]', 'output');
  const [bx, by] = await at('#root sherpa-node[data-heading="data"] sherpa-node-row[data-label="region"]', 'input');
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual([[['view', 'region', null], ['data', 'region', 'reading']]]);
});

test('a condition dragged onto a field none of its values fit is REFUSED, and says why: nothing moves', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindQueryEditor } = await import('/dist/app.js');
    const { readingsOf, onReport } = await import('/dist/data.js');
    const canvas = document.getElementById('root')!.querySelector('sherpa-layout-canvas') as Drawable;
    const asked: unknown[] = [];
    (window as unknown as { asked: unknown[] }).asked = asked;
    onReport((r) => asked.push(r.code));
    const query = Object.assign(new EventTarget(), {
      draft: { v: 1, scopes: { view: { holds: ['status', 'plan'], readings: readingsOf({ status: { in: ['trial'] } }) } } },
      ask: (request: unknown) => asked.push(request),
      presets: () => [],
    });
    const values = (field: string) => (field === 'status' ? ['trial', 'active'] : ['Free', 'Pro']);
    bindQueryEditor(canvas, { query } as never, { definition: { v: 1 as const, id: 'records', source: { store: 'customers' } }, values });
    await window.__settled();
  });
  const at = (selector: string, side: string) => page.evaluate(([sel, s, socket]) => eval(socket!)(document.querySelector(sel!), s), [selector, side, SOCKET]) as Promise<[number, number]>;
  // A condition's tree leaves by its True property (plan 944).
  const [ax, ay] = await at('#root sherpa-node[data-icon="function"] sherpa-node-row[data-socket-name="True"]', 'output');
  const [bx, by] = await at('#root sherpa-node[data-heading="View"] sherpa-node-row[data-label="plan"]', 'input');
  await page.mouse.move(ax, ay);
  await page.mouse.down();
  await page.mouse.move(bx, by, { steps: 6 });
  await page.mouse.up();
  expect(await page.evaluate(() => (window as unknown as { asked: unknown[] }).asked)).toEqual(['query-connection']);
});

/** A canvas on the harness again, after a reload. */
async function freshCanvas(page: Page): Promise<void> {
  await gotoHarness(page);
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
  });
}

/** Bind a page's Query on the harness canvas, with a session that keeps places for the tab. */
const BIND_QUERY = `async () => {
  const { bindQueryEditor, SessionStore } = await import('/dist/app.js');
  const { ArrayStore, DataSource } = await import('/dist/data.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const source = new DataSource({ store: new ArrayStore([{ id: 1, region: 'EMEA' }, { id: 2, region: 'APAC' }], { key: 'id' }) });
  await source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['EMEA'] } });
  const definition = { v: 1, id: 'records', source: { store: 'customers', fields: { region: { label: 'Region' } } } };
  window.editor = bindQueryEditor(canvas, source, { definition, session: new SessionStore() });
  window.source = source;
  await window.__settled();
}`;
/** Each drawn node's heading and place. */
const PLACES = `(() => Object.fromEntries([...document.querySelectorAll('#root sherpa-node')].map((n) => [n.dataset.heading, [n.dataset.x, n.dataset.y]])))()`;

test('a moved node keeps its place across a reload, for the tab — and a new tab starts from the layout (TODO 551)', async ({ page, context }) => {
  await page.evaluate(`(${BIND_QUERY})()`);
  const laid = await page.evaluate(PLACES) as Record<string, string[]>;
  // The reader moves the Source node: the arrows on its header, as a drag would.
  await page.evaluate(() => {
    const header = document.querySelector('#root sherpa-node[data-heading="Source"]')!.shadowRoot!.querySelector<HTMLElement>('.header')!;
    for (const key of ['ArrowRight', 'ArrowRight', 'ArrowDown']) header.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true, composed: true, cancelable: true }));
  });
  const moved = await page.evaluate(PLACES) as Record<string, string[]>;
  await page.reload();
  await freshCanvas(page);
  await page.evaluate(`(${BIND_QUERY})()`);
  const reloaded = await page.evaluate(PLACES);
  // A new tab is a new session: the layout's places.
  const other = parkThePointer(await context.newPage());
  await freshCanvas(other);
  await other.evaluate(`(${BIND_QUERY})()`);
  const fresh = await other.evaluate(PLACES);
  await other.close();
  expect(moved['Source']).toEqual([String(Number(laid['Source']![0]) + 16), String(Number(laid['Source']![1]) + 8)]);
  expect(reloaded).toEqual(moved);
  expect(fresh).toEqual(laid);
});

test('Save hands the app a checked page definition, as definition-save, with the reader\'s edit in it', async ({ page }) => {
  await page.evaluate(`(${BIND_QUERY})()`);
  await page.locator('#root sherpa-node[data-heading="Region"] sherpa-node-row:has(sherpa-input-text[name="type"]) select').selectOption('notin');
  const r = await page.evaluate(async () => {
    await window.__settled();
    const heard: unknown[] = [];
    document.addEventListener('definition-save', (e) => heard.push((e as CustomEvent).detail.definition));
    const ok = (window as unknown as { editor: { save(): boolean } }).editor.save();
    return { ok, heard };
  });
  expect(r.ok).toBe(true);
  expect(r.heard).toEqual([{ v: 1, id: 'records', source: {
    store: 'customers', fields: { region: { label: 'Region' } }, scopes: { view: { where: { region: { notin: ['EMEA'] } } } },
  } }]);
});

/** Bind the test workflow on the harness canvas, with a session that keeps its draft for the tab. */
const BIND_FLOW = `async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 3, id: 'active-customers', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'field', kind: 'field', x: 300, y: 0, values: { field: 'status' } },
    { id: 'filter', kind: 'condition', x: 600, y: 0, values: { type: 'eq' } },
    { id: 'end', kind: 'result', x: 900, y: 0 },
  ], connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'filter/rows', to: 'end' }] };
  window.editor = bindWorkflow(canvas, flow, { session: new SessionStore(), fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'] });
  await window.__settled();
}`;

test('bindWorkflow draws a workflow by its kinds, keeps each edit in the tab\'s draft over a reload, and Save hands it over', async ({ page }) => {
  await page.evaluate(`(${BIND_FLOW})()`);
  const drawn = {
    nodes: await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#root sherpa-node')].map((n) => n.dataset['heading'])),
    ops: await page.locator('#root sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] option').allTextContents(),
  };
  await page.locator('#root sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
  await page.reload();
  await freshCanvas(page);
  await page.evaluate(`(${BIND_FLOW})()`);
  const r = await page.evaluate(() => {
    const heard: { nodes: { id: string; values?: unknown }[] }[] = [];
    document.addEventListener('definition-save', (e) => heard.push((e as CustomEvent).detail.definition));
    const op = document.querySelector<HTMLElement & { value: string }>('#root sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"]')!.value;
    const ok = (window as unknown as { editor: { save(): boolean } }).editor.save();
    return { op, ok, saved: heard.map((d) => d.nodes.find((n) => n.id === 'filter')?.values), draft: sessionStorage.getItem('sherpa:session:/workflows/active-customers') };
  });
  // Source › Field › Condition › Output (plan 783): the Operation lists Logic's types, And and Or first; those a text
  // column fits (TODO 940).
  expect(drawn.nodes).toEqual(['Source', 'Field', 'Condition', 'Run result']);
  expect(drawn.ops.slice(0, 3)).toEqual(['And', 'Or', 'Equals']);
  expect(r).toEqual({ op: 'ne', ok: true, saved: [{ type: 'ne' }], draft: null });
});

test('a use of a Custom Node draws closed: one node with a row per input and output, its own value shown', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { NODE_KINDS, kindsOf } = await import('/dist/data.js');
    const library = { v: 1 as const, nodes: { 'org-permissions': {
      v: 1 as const, label: 'Org permissions',
      inputs: [{ name: 'users', label: 'Users', type: 'object' as const }, { name: 'role', label: 'Role', type: 'value' as const, control: 'text' as const }],
      outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' as const }],
      nodes: [{ id: 'has-role', kind: 'condition', x: 0, y: 0 }], connections: [{ from: '#in/users', to: 'has-role' }, { from: 'has-role/rows', to: '#out/allowed' }],
    } } };
    const canvas = document.querySelector('#root sherpa-layout-canvas') as Parameters<typeof bindWorkflow>[0];
    const flow = { v: 3 as const, id: 'flow', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'perm', kind: 'org-permissions', x: 360, y: 0, values: { role: 'owner' } },
    ], connections: [{ from: 'start/rows', to: 'perm/users' }] };
    bindWorkflow(canvas, flow, { session: new SessionStore(), stores: ['customers'], kinds: { ...NODE_KINDS, ...kindsOf(library) } });
    await window.__settled();
    const node = document.querySelector('#root sherpa-node[data-heading="Org permissions"]')!;
    return {
      nodes: [...document.querySelectorAll<HTMLElement>('#root sherpa-node')].map((n) => n.dataset['heading']),
      rows: [...node.querySelectorAll('sherpa-node-row')].map((x) => x.getAttribute('name') ?? x.textContent?.trim().slice(0, 12)),
      role: node.querySelector<HTMLElement & { value: string }>('sherpa-input-text[name="role"]')?.value,
    };
  });
  expect(r.nodes).toEqual(['Source', 'Org permissions']);
  expect(r.role).toBe('owner');
  expect(r.rows.length).toBe(4); // Parameters, Users, Role + Allowed (the "Properties" label row only where a property exists)
});
