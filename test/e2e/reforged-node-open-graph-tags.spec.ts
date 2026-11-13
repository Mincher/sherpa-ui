import { test, expect, type Page } from './harness';

/**
 * When the open graph IS a Custom Node (TODO 828), its own Group Input and Output carry its Tags:
 * a draft beside the workflow's, an Undo step, never an edit of the library's copy of it (which
 * holds the graph as last saved). `ed.tags()` is what the app's Save writes, and a step after Save
 * still steps it (829). A preset's field is read only. Real pointer and keys.
 */
const ORG = {
  v: 3, type: 'node', id: 'org', label: 'Org permissions', tags: ['permissions'],
  graph: { nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }], connections: [{ from: '#in/users', to: 'role' }, { from: 'role/rows', to: '#out/allowed' }] },
  settings: { inputs: [{ name: 'users', label: 'Users', type: 'object' }], outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }] },
};

/** Bind the canvas to the entity as the app does, a preset read only; the toolbar's Save is the app's. */
const bind = (page: Page, preset = false) => page.evaluate(async ({ entity, preset }) => {
  const root = document.getElementById('root')!;
  root.insertAdjacentHTML('beforeend', `
    <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 640px"><sherpa-node-toolbar slot="toolbar" data-can-save></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
    <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
  await customElements.whenDefined('sherpa-node-list');
  await customElements.whenDefined('sherpa-node-toolbar');
  await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { NODE_KINDS, graphWorkflow, libraryOf } = await import('/dist/data.js');
  const own = preset ? { ...entity, origin: 'preset' } : entity;
  const library = libraryOf([own as never]);
  const { workflow, kinds } = graphWorkflow(own as never, NODE_KINDS);
  const w = window as unknown as Record<string, unknown>;
  w['handed'] = [];
  w['written'] = [];
  const canvas = document.getElementById('cv')!;
  const toolbar = canvas.querySelector('sherpa-node-toolbar')!;
  const ed = bindWorkflow(canvas as never, workflow, {
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
    toolbar: toolbar as never, kinds, library, entity: { type: 'node', id: 'org' }, readOnly: preset,
    fieldsOf: { users: { role: { label: 'Role' } } }, stores: ['users'],
  });
  // The app keeps each Custom Node the draft changed, once, at Save (plan 942 step 2: A).
  (window as never as { __keepEdits(e: unknown, k: (id: string, d: never) => unknown): void }).__keepEdits(ed, (id: string) => { (w['handed'] as unknown[]).push(id); });
  // The app's Save: the graph and its own tags (saveGraph's `tags`), then the editor's.
  toolbar.addEventListener('toolbar-select', (e) => {
    if ((e as CustomEvent<{ action: string }>).detail.action !== 'save') return;
    (w['written'] as unknown[]).push(ed.tags());
    ed.save();
  });
  w['ed'] = ed;
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}, { entity: ORG, preset });

test.beforeEach(async ({ page }) => {
  // Wide, so the inspector at the window's right leaves the canvas clear.
  await page.setViewportSize({ width: 1800, height: 900 });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const tagsField = (page: Page) => page.locator('#inspector sherpa-input-text[name="#tags"]');
const fieldTags = (page: Page) => tagsField(page).evaluate((el) => (el as HTMLElement & { tags: string[] }).tags);
const edTags = (page: Page) => page.evaluate(() => (window as unknown as { ed: { tags(): readonly string[] | undefined } }).ed.tags());
const libTags = (page: Page) => page.evaluate(() => (window as unknown as { ed: { library(): { nodes: Record<string, { tags?: string[] }> } } }).ed.library().nodes['org']?.tags);
const press = async (page: Page, name: string) => {
  await page.locator(`#cv sherpa-node-toolbar sherpa-button.${name}`).click();
  await settle(page);
};

test('the open Custom Node\'s own Tags, on its Group Input and Output: a draft, an Undo step, written by the app\'s Save', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await header(page, 'Group Output').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions']);
  expect(await tagsField(page).getAttribute('data-description')).toBe('The Custom Node\'s own tags: every use of it shares them');
  await tagsField(page).locator('input.control:visible').click();
  await page.keyboard.type('billing');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await edTags(page)).toEqual(['permissions', 'billing']);
  // The library's copy is the graph as saved: it is not edited.
  expect(await libTags(page)).toEqual(['permissions']);
  await header(page, 'Group Input').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions', 'billing']);
  // A body node has none.
  await header(page, 'Field').click();
  await settle(page);
  expect(await tagsField(page).count()).toBe(0);

  await press(page, 'undo');
  expect(await edTags(page)).toEqual(['permissions']);
  await press(page, 'redo');
  expect(await edTags(page)).toEqual(['permissions', 'billing']);
  // Save: the app writes them; the editor hands over no definition of its own graph.
  await press(page, 'save');
  expect(await page.evaluate(() => (window as unknown as { written: unknown[] }).written)).toEqual([['permissions', 'billing']]);
  expect(await page.evaluate(() => (window as unknown as { handed: unknown[] }).handed)).toEqual([]);
  // After Save it is still a step: Undo takes it back, and the next Save writes that.
  await press(page, 'undo');
  expect(await edTags(page)).toEqual(['permissions']);
  await header(page, 'Group Output').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions']);
  await press(page, 'save');
  expect(await page.evaluate(() => (window as unknown as { written: unknown[] }).written)).toEqual([['permissions', 'billing'], ['permissions']]);
});

test('a preset Custom Node open on the canvas: its own Tags are read only', async ({ page }) => {
  await bind(page, true);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await header(page, 'Group Input').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions']);
  expect(await tagsField(page).getAttribute('readonly')).toBe('');
  expect(await tagsField(page).getAttribute('data-description')).toBe('The Custom Node\'s own tags, read only: it is a preset');
  await tagsField(page).locator('input.control:visible').click();
  await page.keyboard.type('mine');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await edTags(page)).toEqual(['permissions']);
  expect(await page.evaluate(() => (window as unknown as { ed: { can(): { undo: boolean } } }).ed.can().undo)).toBe(false);
});
