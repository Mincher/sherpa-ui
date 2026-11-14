import { test, expect, type Page } from './harness';

/**
 * EACH STAGE HOLDS ITS NODES — Will, TODO 976: "Unfurling nodes, especially in sub-graphs, results in the stage bounds no
 * longer encapsulating the correct nodes." A graph is drawn laid out as an edit leaves it, from the first draw: each stage's
 * band holds the nodes it names, as opened and after Unfurl, in the top graph and inside a Custom Node opened through a use,
 * a preset's too. Its stages and nodes here are as a writer left them: overlapping, past each other. Read from the drawn
 * bands and nodes.
 */
const N = (id: string, kind: string, x: number, y: number, stage: string, values?: Record<string, unknown>) => ({ id, kind, x, y, heading: id, stage, ...(values ? { values } : {}) });
const STAGES = [{ id: 'read', label: 'Read', x: -40 }, { id: 'test', label: 'Test', x: 700 }, { id: 'send', label: 'Send', x: 1400 }];
const NODES = [N('pick', 'field', 0, 0, 'read', { field: 'role' }), N('pick2', 'field', 300, 300, 'read', { field: 'status' }),
  N('is', 'condition', 760, 0, 'test', { type: 'eq' }), N('val', 'value', 760, 300, 'test', { type: 'text', value: 'admin' }), N('sort', 'organise', 1460, 0, 'send')];
const INNER = {
  v: 1, label: 'Staged', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  stages: STAGES, nodes: NODES,
  connections: [{ from: '#in/users', to: 'pick' }, { from: '#in/users', to: 'pick2' }, { from: 'pick/field', to: 'is' }, { from: 'val/value', to: 'is/b' },
    { from: 'is/pass', to: 'sort' }, { from: 'sort/rows', to: '#out/allowed' }],
};

/** A top graph holding a use of the Custom Node and one of a preset copy of it; or, `top`, the stages and nodes themselves. */
async function bind(page: Page, top = false): Promise<void> {
  await page.evaluate(async ([inner, top]) => {
    document.getElementById('root')!.innerHTML = `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 700px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`;
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const library = { v: 1, nodes: { staged: structuredClone(inner), shipped: { ...structuredClone(inner), label: 'Shipped', preset: true } } };
    const flow = top
      ? { v: 3, id: 'top', stages: inner.stages, nodes: [{ id: 'src', kind: 'source', x: 0, y: 600, heading: 'src', stage: 'read', values: { store: 'users' } }, ...inner.nodes],
        connections: [{ from: 'src/rows', to: 'pick' }, { from: 'src/rows', to: 'pick2' }, ...inner.connections.filter((c) => !c.from.startsWith('#') && !c.to.startsWith('#'))] }
      : { v: 3, id: 'g', nodes: [{ id: 'src', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, useOf(library as never, 'staged', { id: 'use', x: 400, y: 0 }),
        useOf(library as never, 'shipped', { id: 'preset', x: 400, y: 300 })], connections: [{ from: 'src/rows', to: 'use/users' }] };
    const canvas = document.getElementById('cv')!;
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar') as never, library: library as never, stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status' }, role: { label: 'Role' } } },
    });
    await window.__settled();
  }, [INNER, top] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => setTimeout(done, 400))));
const open = async (page: Page, id: string) => { await page.evaluate((id) => (window as never as { ed: { open(id: string): void } }).ed.open(id), id); await settle(page); };
const unfurl = async (page: Page) => {
  await page.locator('sherpa-node-toolbar sherpa-button.unfurl').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
/** Each node drawn outside the band of the stage it names, with where each stands: none, when all is well. */
const outside = (page: Page) => page.evaluate((ids) => {
  const bands = Object.fromEntries([...document.querySelectorAll('#cv > sherpa-node-stage')].map((el) =>
    [el.getAttribute('data-stage'), { left: Number(el.getAttribute('data-x')), right: Number(el.getAttribute('data-x')) + Number(el.getAttribute('data-w')) }]));
  return ids.flatMap(([id, stage]) => {
    const el = document.querySelector<HTMLElement>(`#cv > sherpa-node[data-heading="${id}"]`)!;
    const [left, right] = [Number(el.getAttribute('data-x')), Number(el.getAttribute('data-x')) + el.offsetWidth];
    const band = bands[stage!];
    return band && left >= band.left && right <= band.right ? [] : [`${id} ${left}–${right} outside ${stage} ${band?.left}–${band?.right}`];
  });
}, NODES.map((n) => [n.id, n.stage]));

test('inside a Custom Node opened through its use, each stage holds its nodes: as opened, and after Unfurl', async ({ page }) => {
  await bind(page);
  await open(page, 'use');
  expect(await outside(page)).toEqual([]);
  await unfurl(page);
  expect(await outside(page)).toEqual([]);
  // Back, and in again: the definition kept as drawn.
  await page.evaluate(() => (window as never as { ed: { back(): void } }).ed.back());
  await settle(page);
  await open(page, 'use');
  expect(await outside(page)).toEqual([]);
});

test('a preset\'s inside, read only, is drawn with each stage round its nodes too', async ({ page }) => {
  await bind(page);
  await open(page, 'preset');
  expect(await outside(page)).toEqual([]);
});

test('the top graph, opened: each stage holds its nodes, and the graph as kept is the graph as drawn', async ({ page }) => {
  await bind(page, true);
  expect(await outside(page)).toEqual([]);
  const drift = await page.evaluate(() => (window as never as { ed: { workflow(): { nodes: { id: string; x: number }[] } } }).ed.workflow().nodes.flatMap((n) => {
    const el = document.querySelector(`#cv > sherpa-node[data-heading="${n.id}"]`);
    return el && Number(el.getAttribute('data-x')) !== n.x ? [n.id] : [];
  }));
  expect(drift).toEqual([]);
  await unfurl(page);
  expect(await outside(page)).toEqual([]);
});
