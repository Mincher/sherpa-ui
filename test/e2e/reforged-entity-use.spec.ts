import { test, expect, type Page } from './harness';

/**
 * An entity USED as a node — Will, plan 746 E5 (D1, D8, D11). The canvas edits one Preset Filter; its
 * node panel offers what a Preset Filter takes (no Output) and every other entity's node, but not its
 * own nor one that holds it; inside a use opened, what THAT one may place. A saved entity that changed
 * shows "Update available" on its uses, its diff, and the split button; an update stays in the draft
 * until Save or discard; "Update all instances" never writes the entity open on the canvas. Each by
 * real pointer and key. TRAP T-an-entity-is-used-as-a-node
 */
const filter = (id: string, label: string, value: string) => ({
  v: 1, type: 'preset-filter', id, label, settings: { source: 'customers' },
  graph: {
    nodes: [{ id: 'status', kind: 'condition', x: 300, y: 0, values: { type: 'eq', b: value } }, { id: 'field', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
    routes: [{ from: 'field/field', to: 'status' }, { from: 'status', to: '#out/where' }],
  },
});

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (entities) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-app-header id="trail"><sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs></sherpa-app-header>
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-overlay-panel slot="panel" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>
      <sherpa-dialog id="confirm" data-status="critical" data-heading="Update">
        <p style="margin: 0"></p>
        <sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated">Update</sherpa-button></sherpa-container-footer>
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-list');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    (window as unknown as { ENTITIES: unknown }).ENTITIES = entities;
  }, { trials: filter('trials', 'Trials', 'trial'), active: { ...filter('active', 'Active', 'active'), origin: 'preset' } });
});

/** Bind the Preset Filter "Outer" — a use of Trials on it — with every entity as the library, "Top" holding Outer. */
const bind = (page: Page) => page.evaluate(async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { NODE_KINDS, graphWorkflow, kindsOf, libraryOf, useOf } = await import('/dist/data.js');
  const w = window as unknown as Record<string, unknown> & { ENTITIES: Record<string, Record<string, unknown>> };
  const { trials, active } = w.ENTITIES;
  const use = useOf(libraryOf([trials as never]), 'preset-filter:trials', { id: 'trials-1', x: 0, y: 0 });
  const outer = { v: 1, type: 'preset-filter', id: 'outer', label: 'Outer', origin: 'mine', graph: { nodes: [use], routes: [{ from: 'trials-1', to: '#out/where' }] } };
  const top = { v: 1, type: 'preset-filter', id: 'top', label: 'Top', origin: 'mine', graph: { nodes: [{ id: 'o', kind: 'preset-filter:outer', x: 0, y: 0 }], routes: [{ from: 'o', to: '#out/where' }] } };
  w['all'] = (more: unknown[] = []) => libraryOf([trials, active, outer, top, ...more] as never);
  const library = (w['all'] as () => never)();
  const { workflow, kinds } = graphWorkflow(outer as never, { ...NODE_KINDS, ...kindsOf(library) });
  w['saved'] = [];
  w['savedNodes'] = [];
  document.addEventListener('definition-save', (e) => (w['saved'] as unknown[]).push((e as CustomEvent).detail.definition));
  const canvas = document.getElementById('cv')!;
  w['ed'] = bindWorkflow(canvas as never, workflow, {
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
    header: document.getElementById('trail') as never, confirm: document.getElementById('confirm') as never, kinds, library, entity: outer,
    onSaveNode: (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]),
    fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial', 'lead'] } } }, stores: ['customers'],
  });
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const ed = <T>(page: Page, fn: string) => page.evaluate(`(() => { const ed = window.ed; return ${fn}; })()`) as Promise<T>;
/** What the panel lists: each item's kind, by its category. */
/** The Nodes panel's Custom Nodes tab, pressed as a reader does: what is saved, and its tags, sit there. TODO 837 */
const openCustom = (page: Page) => page.locator('sherpa-node-list sherpa-tabs .tab[data-id="custom"]').click();
const offered = (page: Page) => page.evaluate(() => Object.fromEntries([...document.querySelector('#cv sherpa-node-list')!.shadowRoot!.querySelectorAll('.categories > .category')]
  .map((a) => [a.querySelector('.category-heading')?.getAttribute('data-heading'), [...a.querySelectorAll<HTMLElement>('sherpa-list-item[data-kind]')].map((i) => i.dataset['kind'])])));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const caption = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).first().getAttribute('data-caption');
const press = (loc: import('@playwright/test').Locator) => loc.evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());

test('the panel offers what a Preset Filter takes, and every entity\'s node but its own and one that holds it; a click places an instance', async ({ page }) => {
  await bind(page);
  const lists = await offered(page);
  const all = Object.values(lists).flat();
  expect(all).toContain('condition');
  expect(all).not.toContain('output');
  expect(lists['Custom Nodes']).toEqual(['preset-filter:trials', 'preset-filter:active']);
  await openCustom(page);
  await page.locator('#cv sherpa-node-list sherpa-list-item[data-kind="preset-filter:active"]').click();
  await settle(page);
  const placed = await ed<{ kind: string; version?: string }>(page, "ed.workflow().nodes.find((n) => n.kind === 'preset-filter:active')");
  expect(placed.version).toBeTruthy();
  expect(await page.locator('#cv > sherpa-node[data-heading="Active"]').count()).toBe(1);
});

test('a use opens as a Custom Node does; inside, the panel offers what that one may place; a preset\'s inside is read only', async ({ page }) => {
  await bind(page);
  await header(page, 'Trials').focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['trials-1']);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#cv > sherpa-node')].map((n) => n.dataset['heading']).sort())).toEqual(['Condition', 'Field', 'Group Input', 'Group Output']);
  // Outer holds Trials, and Top holds Outer: neither is offered inside it, nor Trials itself.
  expect((await offered(page))['Custom Nodes']).toEqual(['preset-filter:active']);
  await page.keyboard.press('Escape');
  await settle(page);
  expect((await offered(page))['Custom Nodes']).toEqual(['preset-filter:trials', 'preset-filter:active']);
  // A preset placed and opened: locked, with "Copy to my nodes".
  await openCustom(page);
  await page.locator('#cv sherpa-node-list sherpa-list-item[data-kind="preset-filter:active"]').click();
  await settle(page);
  await header(page, 'Active').dblclick();
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => el.hasAttribute('data-locked'))).toBe(true);
  await press(page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]'));
  await settle(page);
  expect(await ed(page, 'ed.path().length')).toBe(1);
  expect(await ed(page, "ed.workflow().nodes.find((n) => n.kind.startsWith('preset-filter:active')).kind")).toBe('preset-filter:active-copy');
  expect(await ed(page, "ed.library().nodes['preset-filter:active-copy'].settings")).toEqual({ source: 'customers' });
});

test('saved again elsewhere: the use says "Update available" with its diff; Update instance stays in the draft until Save, and discard gives it back', async ({ page }) => {
  await bind(page);
  expect(await caption(page, 'Trials')).toBeNull();
  await ed(page, "ed.refresh(window.all([{ ...window.ENTITIES.trials, graph: { ...window.ENTITIES.trials.graph, nodes: [{ ...window.ENTITIES.trials.graph.nodes[0], values: { type: 'eq', b: 'lead' } }, window.ENTITIES.trials.graph.nodes[1]] } }]))");
  await settle(page);
  expect(await caption(page, 'Trials')).toBe('Update available');
  await header(page, 'Trials').click();
  await settle(page);
  expect(await page.locator('#inspector .update-pane sherpa-key-value-list').evaluate((el) => el.shadowRoot!.textContent)).toContain('Nodes changed');
  const split = page.locator('#inspector .update-split > sherpa-button');
  expect(await split.first().getAttribute('data-label')).toBe('Update instance');
  await press(split.first());
  await settle(page);
  expect(await caption(page, 'Trials')).toBeNull();
  await ed(page, 'ed.discard()');
  await settle(page);
  expect(await caption(page, 'Trials')).toBe('Update available');
});

test('"Update all instances" updates every other graph that uses it, and never the entity open on the canvas', async ({ page }) => {
  await bind(page);
  // Top holds Outer only; a second graph, Other, uses Trials too.
  const other = { v: 1, type: 'preset-filter', id: 'other', label: 'Other', origin: 'mine', graph: { nodes: [{ id: 't', kind: 'preset-filter:trials', x: 0, y: 0, version: 'old' }], routes: [{ from: 't', to: '#out/where' }] } };
  const lead = "{ ...window.ENTITIES.trials, graph: { ...window.ENTITIES.trials.graph, nodes: [{ ...window.ENTITIES.trials.graph.nodes[0], values: { type: 'eq', b: 'lead' } }, window.ENTITIES.trials.graph.nodes[1]] } }";
  await ed(page, `ed.refresh(window.all([${JSON.stringify(other)}, ${lead}]))`);
  await settle(page);
  await header(page, 'Trials').click();
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  const menu = page.locator('#inspector .update-split > sherpa-button[data-type="icon"]');
  await press(menu);
  await settle(page);
  await menu.locator('sherpa-menu > button', { hasText: /^Update all instances$/ }).click();
  await settle(page);
  await press(page.locator('#confirm > sherpa-container-footer > sherpa-button').last());
  await settle(page);
  expect(await caption(page, 'Trials')).toBeNull();
  expect(await ed(page, 'ed.save()')).toBe(true);
  // Other is handed over, updated; Outer is the draft Save writes, never a stale copy of it.
  const handed = await page.evaluate(() => (window as unknown as { savedNodes: [string, { nodes: { version?: string }[] }][] }).savedNodes.map(([id]) => id));
  expect(handed).toEqual(['preset-filter:other']);
  expect(await page.evaluate(() => (window as unknown as { saved: { id: string }[] }).saved.map((d) => d.id))).toEqual(['outer']);
});
