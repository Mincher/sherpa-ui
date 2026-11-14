import { test, expect, type Page } from './harness';

/**
 * An entity USED as a node — Will, plan 746 E5 (D1, D8, D11). The canvas edits one Filter; its
 * node panel offers what a Filter takes (no Output) and every other entity's node, but not its
 * own nor one that holds it; inside a use opened, what THAT one may place. A saved entity that changed
 * shows "Update available" on its uses, its diff, and the split button; an update stays in the draft
 * until Save or discard; "Update all instances" never writes the entity open on the canvas. Each by
 * real pointer and key. TRAP T-an-entity-is-used-as-a-node
 */
const filter = (id: string, label: string, value: string) => ({
  v: 3, type: 'filter', id, label, settings: { source: 'customers' },
  graph: {
    nodes: [{ id: 'status', kind: 'condition', x: 300, y: 0, values: { type: 'eq', b: value } }, { id: 'field', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
    connections: [{ from: 'field/field', to: 'status' }, { from: 'status/true', to: '#out/where' }],
  },
});

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (entities) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 640px"><sherpa-stack id="trail" slot="trail" data-direction="inline" data-gap="sm"><sherpa-button data-action="back" data-type="icon" data-look="transparent" data-icon-start="arrow-left" aria-label="Back" data-tip="Back (Esc)"></sherpa-button><sherpa-breadcrumbs></sherpa-breadcrumbs></sherpa-stack><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
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

/** Bind the Filter "Outer" — a use of Trials on it — with every entity as the library, "Top" holding Outer. Read only: as
 *  a preset is bound. */
const bind = (page: Page, readOnly: boolean | string = false) => page.evaluate(async (readOnly) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { NODE_KINDS, graphWorkflow, kindsOf, libraryOf, makeShelf, runAct, useOf } = await import('/dist/data.js');
  const w = window as unknown as Record<string, unknown> & { ENTITIES: Record<string, Record<string, unknown>> };
  const { trials, active } = w.ENTITIES;
  const use = useOf(libraryOf([trials as never]), 'filter:trials', { id: 'trials-1', x: 0, y: 0 });
  const outer = { v: 3, type: 'filter', id: 'outer', label: 'Outer', origin: 'mine', graph: { nodes: [use], connections: [{ from: 'trials-1', to: '#out/where' }] } };
  const top = { v: 3, type: 'filter', id: 'top', label: 'Top', origin: 'mine', graph: { nodes: [{ id: 'o', kind: 'filter:outer', x: 0, y: 0 }], connections: [{ from: 'o', to: '#out/where' }] } };
  w['all'] = (more: unknown[] = []) => libraryOf([trials, active, outer, top, ...more] as never);
  // Published: the library with these kinds at their next number, as a Publish hands it over (plan 972).
  w['published'] = (more: unknown[], ...kinds: string[]) => {
    const l = libraryOf([trials, active, outer, top, ...more] as never) as { nodes: Record<string, { version?: number }> };
    for (const k of kinds) l.nodes[k] = { ...l.nodes[k], version: (l.nodes[k]!.version ?? 1) + 1 };
    return l;
  };
  const library = (w['all'] as () => never)();
  // The app's shelf and its acts (plan 972c): a Clone saves the copy, and the outlet hands the library back.
  let mine: Record<string, unknown> = { trials, outer, top };
  const shelf = makeShelf({ presets: () => [active], mine: () => mine, keep: (next: Record<string, unknown>) => { mine = next; }, heard: () => undefined } as never);
  w['shelf'] = shelf;
  const act = async (id: string, call: unknown) => {
    const answer = await runAct(id, call as never, { stores: {}, entities: shelf } as never);
    (w['ed'] as { refresh(l: unknown): void }).refresh(shelf.library());
    return answer;
  };
  const { workflow, kinds } = graphWorkflow(outer as never, { ...NODE_KINDS, ...kindsOf(library) });
  w['saved'] = [];
  w['savedNodes'] = [];
  document.addEventListener('definition-save', (e) => (w['saved'] as unknown[]).push((e as CustomEvent).detail.definition));
  const canvas = document.getElementById('cv')!;
  w['ed'] = bindWorkflow(canvas as never, workflow, {
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
    confirm: document.getElementById('confirm') as never, kinds, library, entity: outer, act, readOnly, kept: () => shelf.get('outer') as never,
    fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial', 'lead'] } } }, stores: ['customers'],
  });
  // The app keeps each Custom Node the draft changed, once, at Save (plan 942 step 2: A).
  (window as never as { __keepEdits(e: unknown, k: (id: string, d: never) => unknown): void }).__keepEdits(w['ed'], (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]));
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}, readOnly);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const ed = <T>(page: Page, fn: string) => page.evaluate(`(() => { const ed = window.ed; return ${fn}; })()`) as Promise<T>;
/** What the panel lists: each item's kind, by its category. */
/** Each category's kinds, by its heading: one in both tabs, as Custom Nodes, the Preset tab's first (plan 936). */
const offered = (page: Page) => page.evaluate(() => {
  const lists: Record<string, string[]> = {};
  for (const a of document.querySelector('#cv sherpa-node-list')!.shadowRoot!.querySelectorAll('.categories > .category')) {
    const heading = a.querySelector('.category-heading')?.getAttribute('data-heading') ?? '';
    lists[heading] = [...(lists[heading] ?? []), ...[...a.querySelectorAll<HTMLElement>('sherpa-list-item[data-kind]')].map((i) => i.dataset['kind']!)];
  }
  return lists;
});
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const caption = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"]`).first().getAttribute('data-caption');
const press = (loc: import('@playwright/test').Locator) => loc.evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());

test('the panel offers what a Filter takes, and every entity\'s node but its own and one that holds it; a click places an instance', async ({ page }) => {
  await bind(page);
  const lists = await offered(page);
  const all = Object.values(lists).flat();
  expect(all).toContain('condition');
  expect(all).not.toContain('output');
  expect(lists['Custom Nodes']).toEqual(['filter:active', 'filter:trials']);
  // A preset, on the Preset Nodes tab, open already.
  await page.locator('#cv sherpa-node-list sherpa-list-item[data-kind="filter:active"]').click();
  await settle(page);
  const placed = await ed<{ kind: string; version?: string }>(page, "ed.workflow().nodes.find((n) => n.kind === 'filter:active')");
  expect(placed.version).toBeTruthy();
  expect(await page.locator('#cv > sherpa-node[data-heading="Active"]').count()).toBe(1);
});

test('a use opens as a Custom Node does; inside, the panel offers what that one may place; a preset\'s inside is read only', async ({ page }) => {
  await bind(page);
  await header(page, 'Trials').focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['trials-1']);
  expect(await page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#cv > sherpa-node')].map((n) => n.dataset['heading']).sort())).toEqual(['Condition', 'Field', 'Group Output']);
  // Outer holds Trials, and Top holds Outer: neither is offered inside it, nor Trials itself.
  expect((await offered(page))['Custom Nodes']).toEqual(['filter:active']);
  await page.keyboard.press('Escape');
  await settle(page);
  expect((await offered(page))['Custom Nodes']).toEqual(['filter:active', 'filter:trials']);
  // A preset placed and opened: locked, with Clone.
  await page.locator('#cv sherpa-node-list sherpa-list-item[data-kind="filter:active"]').click();
  await settle(page);
  await header(page, 'Active').dblclick();
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => el.hasAttribute('data-locked'))).toBe(true);
  await press(page.locator('#inspector sherpa-button[data-label="Clone"]'));
  await settle(page);
  expect(await ed(page, 'ed.path().length')).toBe(1);
  expect(await ed(page, "ed.workflow().nodes.find((n) => n.kind.startsWith('filter:active')).kind")).toBe('filter:active-copy');
  expect(await ed(page, "ed.library().nodes['filter:active-copy'].settings")).toEqual({ source: 'customers' });
});

test('published again elsewhere: the use says "Update available" with its diff; Update instance stays in the draft until Save, and discard gives it back', async ({ page }) => {
  await bind(page);
  expect(await caption(page, 'Trials')).toBeNull();
  await ed(page, "ed.refresh(window.published([{ ...window.ENTITIES.trials, graph: { ...window.ENTITIES.trials.graph, nodes: [{ ...window.ENTITIES.trials.graph.nodes[0], values: { type: 'eq', b: 'lead' } }, window.ENTITIES.trials.graph.nodes[1]] } }], 'filter:trials'))");
  await settle(page);
  expect(await caption(page, 'Trials')).toBe('Update available');
  await header(page, 'Trials').click();
  await settle(page);
  // A Filter's change is said as its Where's, in words, not as the nodes its drawing gave ids (plan 960 U4.4b).
  expect(await page.locator('#inspector .update-pane sherpa-key-value-list').evaluate((el) => el.shadowRoot!.textContent)).toContain('equals trial to equals lead');
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
  const other = { v: 3, type: 'filter', id: 'other', label: 'Other', origin: 'mine', graph: { nodes: [{ id: 't', kind: 'filter:trials', x: 0, y: 0, version: 0 }], connections: [{ from: 't', to: '#out/where' }] } };
  const lead = "{ ...window.ENTITIES.trials, graph: { ...window.ENTITIES.trials.graph, nodes: [{ ...window.ENTITIES.trials.graph.nodes[0], values: { type: 'eq', b: 'lead' } }, window.ENTITIES.trials.graph.nodes[1]] } }";
  await ed(page, `ed.refresh(window.published([${JSON.stringify(other)}, ${lead}], 'filter:trials'))`);
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
  expect(handed).toEqual(['filter:other']);
  expect(await page.evaluate(() => (window as unknown as { saved: { id: string }[] }).saved.map((d) => d.id))).toEqual(['outer']);
});

/** Graph details' version part: its facts as the list says them, its buttons, and History's rows. */
const version = (page: Page) => page.locator('#inspector .graph-version').evaluate((pane) => ({
  facts: [...pane.querySelectorAll('sherpa-key-value-list')].flatMap((l) => [...(l.shadowRoot ?? l).querySelectorAll('dt, dd')].map((n) => n.textContent?.trim())),
  publish: !!pane.querySelector(':scope > sherpa-button[data-label="Publish"]'),
  history: [...pane.querySelectorAll('.graph-history [data-version]')].map((row) => [row.querySelector('p')?.textContent?.split(' · ')[0], row.querySelector('sherpa-button')?.getAttribute('data-label') ?? null]),
  open: pane.querySelector('.graph-history')?.hasAttribute('open') ?? false,
}));
/** Outer published once, then its draft renamed, as the app keeps it. */
const drafted = (page: Page) => page.evaluate(async () => {
  const shelf = (window as unknown as { shelf: { get(id: string): Record<string, unknown>; save(e: unknown): Promise<boolean>; library(): unknown } }).shelf;
  await shelf.save(shelf.get('outer'));
  await shelf.save({ ...shelf.get('outer'), label: 'Outer, renamed' });
  (window as unknown as { ed: { refresh(l: unknown): void } }).ed.refresh(shelf.library());
});

test('Graph details says the open entity\'s version: Unpublished changes and Publish where its draft changed; History rolls back (plan 972, Will)', async ({ page }) => {
  await bind(page);
  await drafted(page);
  await settle(page);
  expect(await version(page)).toEqual({ facts: ['Version', '1', 'Status', 'Unpublished changes'], publish: true, history: [['Version 1', null]], open: false });
  // Publish, through the app's act: version 2, nothing unpublished, and version 1 may be rolled back to.
  await press(page.locator('#inspector .graph-version > sherpa-button[data-label="Publish"]'));
  await settle(page);
  expect(await version(page)).toEqual({ facts: ['Version', '2'], publish: false, history: [['Version 2', null], ['Version 1', 'Roll back to version 1']], open: false });
  // History opened by the reader, then a Roll back: published again as version 3, and History stays open.
  await page.locator('#inspector .graph-history').evaluate((el) => (el.shadowRoot!.querySelector('summary') as HTMLElement).click());
  await settle(page);
  await press(page.locator('#inspector .graph-history [data-version="1"] sherpa-button'));
  await settle(page);
  expect(await version(page)).toMatchObject({ facts: ['Version', '3'], publish: false, open: true });
  expect((await version(page)).history.map(([words]) => words)).toEqual(['Version 3', 'Version 2', 'Version 1']);
  expect(await page.evaluate(() => (window as unknown as { shelf: { get(id: string): { label: string } } }).shelf.get('outer').label)).toBe('Outer');
});

test('a read-only graph says why, in the app\'s words, and shows its version and History, with no Publish and no Roll back; inside a use, no version (972d)', async ({ page }) => {
  const why = 'Needs "Filters · Edit", which Viewer does not have.';
  await bind(page, why);
  await drafted(page);
  await page.evaluate(async () => {
    const shelf = (window as unknown as { shelf: { get(id: string): unknown; save(e: unknown): Promise<boolean> } }).shelf;
    const { publish } = await import('/dist/data.js');
    await publish(shelf as never, 'outer');
  });
  await ed(page, "ed.refresh(window.shelf.library())");
  await settle(page);
  expect(await version(page)).toEqual({ facts: ['Version', '2'], publish: false, history: [['Version 2', null], ['Version 1', null]], open: false });
  const note = page.locator('#inspector .graph-details > sherpa-callout.graph-read-only');
  expect([await note.getAttribute('data-heading'), await note.textContent()]).toEqual(['Read only', why]);
  await header(page, 'Trials').focus();
  await page.keyboard.press('Enter');
  await settle(page);
  await page.locator('#cv').click({ position: { x: 1000, y: 600 } });
  await settle(page);
  expect(await page.locator('#inspector .graph-details').count()).toBe(1);
  expect(await page.locator('#inspector .graph-version').count()).toBe(0);
});
