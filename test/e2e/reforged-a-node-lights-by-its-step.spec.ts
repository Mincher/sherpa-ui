import { test, expect } from './harness';

/**
 * A node lights by its step — plan 695 N2, Will's TODO 671. The Query graph WATCHES
 * the one trace stream: as a page's source loads, the Source lights by its load and
 * by its store's reads — the page's request and the worker's answer and hold,
 * joined by one trace — and each condition by what the walk counted. A workflow
 * graph lights from the steps a run says. The lit state is CSS: `data-step` pins
 * the node's look, and `data-caption` says its time and rows.
 * TRAP T-a-step-names-its-node
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 1200px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
  });
});

/** Each drawn node's heading, step and caption. */
const LIT = `(() => Object.fromEntries([...document.querySelectorAll('#root sherpa-node')].map((n) => [n.dataset.heading, [n.dataset.step ?? null, n.dataset.caption ?? null]])))()`;
type Lit = Record<string, [string | null, string | null]>;

/** A page source over a request store, answered by a handler that says its spans as the worker would. */
const BIND = `async () => {
  const { bindQueryEditor } = await import('/dist/app.js');
  const { ArrayStore, DataSource, HeldStore, createDataHandler, defineStores, fakeRemote, onTrace, openRequestStore } = await import('/dist/data.js');
  const rows = [{ id: 1, region: 'EMEA' }, { id: 2, region: 'APAC' }, { id: 3, region: 'EMEA' }];
  const worker = createDataHandler({ stores: defineStores(() => ({ customers: new HeldStore(fakeRemote(new ArrayStore(rows, { key: 'id' }), { delay: 300 })) })), host: 'worker' });
  const store = await openRequestStore({ name: 'customers', send: (request) => worker(request) });
  const source = new DataSource({ store });
  await source.query.ask([{ scope: 'view', hold: ['region'] }, { scope: 'view', field: 'region', reading: { picked: ['EMEA'] } }]);
  await source.load();
  const definition = { v: 1, id: 'records', source: { store: 'customers', fields: { region: { label: 'Region' } } } };
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  window.editor = bindQueryEditor(canvas, source, { definition });
  window.source = source;
  window.spans = [];
  window.stopSpans = onTrace((span) => window.spans.push(span));
  await window.__settled();
}`;

/** A reader's filter change, applied: the source loads, and every node's step and caption are kept as they move. */
const LOAD = `async () => {
  window.steps = [];
  window.captions = [];
  new MutationObserver((changes) => {
    for (const c of changes) {
      if (c.attributeName === 'data-step') window.steps.push([c.target.dataset.heading, c.target.dataset.step ?? null]);
      else window.captions.push([c.target.dataset.heading, c.target.dataset.caption ?? null]);
    }
  }).observe(document.querySelector('#root sherpa-layout-canvas'), { subtree: true, attributeFilter: ['data-step', 'data-caption'] });
  await window.source.query.ask({ scope: 'view', field: 'region', reading: { picked: ['APAC'] } });
  await window.source.query.ask({ commit: true });
}`;
/** The walk lit: the last node a load lights. */
const WALKED = () => document.querySelector<HTMLElement>('#root sherpa-node[data-heading="Region"][data-category="logic"]')?.dataset['step'] === 'done';

test('the Query graph lights as its source loads: the Source by the load and by its reads, in the page and the worker, each condition by the walk', async ({ page }) => {
  await page.evaluate(`(${BIND})()`);
  const before = await page.evaluate(LIT) as Lit;
  await page.evaluate(`(${LOAD})()`);
  await page.waitForFunction(WALKED);
  const lit = await page.evaluate(LIT) as Lit;
  const r = await page.evaluate(async () => {
    type Said = { step: string; host: string; trace: string; ms?: number; detail?: Record<string, unknown> };
    const w = window as unknown as { editor: { stop(): void }; stopSpans(): void; spans: Said[]; steps: [string, string | null][]; captions: [string, string | null][] };
    const ended = (step: string): Said => w.spans.find((s) => s.step === step && s.ms !== undefined)!;
    const [request, answer, hold, load] = ['request', 'answer', 'hold', 'load'].map(ended) as [Said, Said, Said, Said];
    const region = w.spans.find((s) => s.detail?.['node'] === 'when-view-region')!;
    // Each node's steps in turn, a repeat dropped.
    const seen = (heading: string) => w.steps.filter(([h]) => h === heading).map(([, s]) => s).filter((s, i, all) => s !== all[i - 1]);
    w.stopSpans();
    w.editor.stop();
    const { tracing } = await import('/dist/data.js');
    return {
      worker: [answer.host, answer.trace === request.trace, hold.host, hold.trace === request.trace],
      walk: [region.trace === load.trace, region.detail?.['rows']],
      seen: seen('Source'),
      said: w.captions.flatMap(([h, c]) => (h === 'Source' && c ? [c] : [])),
      listens: tracing(),
    };
  });
  expect(Object.values(before).every(([step]) => step === null), 'nothing lit before a load').toBe(true);
  // One node, the Source (TODO 808): its store's reads — the page's request, and the worker's answer and hold, the
  // held set's 3 rows — while its load runs; then the load, which ends last, with the page's 1 row, and where it ran.
  expect([r.seen[0], r.seen.at(-1)]).toEqual(['running', 'done']);
  expect(r.said.some((c) => /^Running · 3 rows · worker$/.test(c)), r.said.join('; ')).toBe(true);
  expect(lit['Source']![0]).toBe('done');
  expect(lit['Source']![1]).toMatch(/^[\d.,]+ ms · 1 row · worker$/);
  expect(lit['customers'], 'no Store node').toBeUndefined();
  expect(lit['Region']).toEqual(['done', '1 row']);
  // The View's step lights its bar, View Filters (plan 960 U4.8).
  expect(lit['View Filters']).toEqual(['done', null]);
  expect(r).toMatchObject({ worker: ['worker', true, 'worker', true], walk: [true, 1], listens: false });
});

test('a worker\'s span from another context lights the same node, joined by its trace; one from a trace not the graph\'s lights nothing', async ({ page }) => {
  await page.evaluate(`(${BIND})()`);
  await page.evaluate(`(${LOAD})()`);
  await page.waitForFunction(WALKED);
  const said = await page.evaluate(async () => {
    const w = window as unknown as { spans: { step: string; trace: string; id: string; ms?: number }[] };
    const request = w.spans.findLast((s) => s.step === 'request' && s.ms !== undefined)!;
    // Another context — the Service Worker — on the one channel: no store named, only the trace.
    const worker = new BroadcastChannel('sherpa-trace');
    const span = (trace: string, rows: number) => ({ span: { host: 'worker', step: 'hold', trace, id: crypto.randomUUID().slice(0, 16), parent: request.id, t: Date.now(), ms: 41, detail: { rows } } });
    worker.postMessage(span(request.trace, 99));
    worker.postMessage(span('f'.repeat(32), 7));
    await new Promise((done) => setTimeout(done, 100));
    worker.close();
    return document.querySelector<HTMLElement>('#root sherpa-node[data-heading="Source"]')!.dataset['caption'];
  });
  expect(said).toBe('41 ms · 99 rows · worker');
});

/** The test workflow, drawn by bindWorkflow. */
const FLOW = `async () => {
  const { bindWorkflow } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 3, id: 'active-customers', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'field', kind: 'field', x: 300, y: 0, values: { field: 'status' } },
    { id: 'filter', kind: 'condition', x: 600, y: 0, values: { type: 'eq', b: 'active' } },
    { id: 'end', kind: 'result', x: 900, y: 0 },
  ], connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'filter/pass', to: 'end' }] };
  window.editor = bindWorkflow(canvas, flow, { fieldsOf: { customers: { status: { label: 'Status' } } }, stores: ['customers'] });
  await window.__settled();
}`;

test('a workflow graph lights from the steps a run says: each node by its id, its state CSS, a new run clearing the last', async ({ page }) => {
  await page.evaluate(`(${FLOW})()`);
  const r = await page.evaluate(async (lit) => {
    const { traceStep } = await import('/dist/data.js');
    const read = () => eval(lit) as Record<string, [string | null, string | null]>;
    // A node paints on its .root part (695 P7: a style query re-maps a part, not :host).
    const border = (heading: string) => getComputedStyle(document.querySelector(`#root sherpa-node[data-heading="${heading}"]`)!.shadowRoot!.querySelector('.root')!).borderTopColor;
    const idle = border('Condition');
    // As N4's runner will: one run, each step under it, naming its node.
    const run = traceStep('start', { graph: 'active-customers', rows: 3 })!;
    const filter = traceStep('filter', { parent: run })!;
    const during = read();
    const running = border('Condition');
    filter.end('done', { rows: 2 });
    run.end('done', { rows: 3 });
    traceStep('end', { parent: run, state: 'skipped' });
    // Another graph's step lights nothing here.
    traceStep('filter', { graph: 'another-flow', state: 'failed' });
    const after = read();
    // The next run: the last one's lights go; a failed step is drawn so.
    const next = traceStep('filter', { graph: 'active-customers' })!;
    next.end('failed', { error: 'no store' });
    const again = read();
    const failed = border('Condition');
    (window as unknown as { editor: { stop(): void } }).editor.stop();
    return { during, after, again, looks: new Set([idle, running, failed]).size };
  }, LIT);
  expect(r.during).toEqual({ Source: ['running', 'Running · 3 rows'], Field: [null, null], Condition: ['running', 'Running'], 'Run result': [null, null], Start: [null, null] });
  expect(r.after['Source']![0]).toBe('done');
  expect(r.after['Condition']![0]).toBe('done');
  expect(r.after['Condition']![1]).toMatch(/2 rows$/);
  expect(r.after['Run result']).toEqual(['skipped', 'Skipped']);
  expect(r.again).toEqual({ Source: [null, null], Field: [null, null], Condition: ['failed', expect.stringMatching(/^Failed/)], 'Run result': [null, null], Start: [null, null] });
  expect(r.looks, 'idle, running and failed each look their own').toBe(3);
});
