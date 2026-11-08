import { test, expect, type Page } from './harness';

/**
 * Save clears nothing, for a DEFINITION too (TODO 829): after Save, Undo takes back an edit to a
 * Custom Node's definition (its tags, a node inside it) as it takes back the workflow's own, the
 * definition is a draft edit again, and the next Save hands that over; Redo puts it forward. Two
 * definitions edited, then saved, both step back. Real pointer and keys. TODO 829
 */
const def = (label: string, tags: string[]) => ({
  v: 1, label, tags,
  inputs: [{ name: 'users', label: 'Users', type: 'object' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  routes: [{ from: '#in/users', to: 'role' }],
});

test.beforeEach(async ({ page }) => {
  // Wide, so the inspector at the window's right leaves the canvas clear.
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.evaluate(async (library) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 800px"><sherpa-node-toolbar slot="toolbar" data-can-save></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-list');
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const flow = {
      v: 2, id: 'g',
      nodes: [
        { id: 'start', kind: 'source', x: 380, y: 40, values: { store: 'users' } },
        useOf(library as never, 'org', { id: 'perm', x: 760, y: 40 }), useOf(library as never, 'admin', { id: 'adm', x: 760, y: 320 }),
      ],
      routes: [{ from: 'start/rows', to: 'perm/users' }],
    };
    const w = window as unknown as Record<string, unknown>;
    w['handed'] = [];
    const canvas = document.getElementById('cv')!;
    const toolbar = canvas.querySelector('sherpa-node-toolbar')!;
    const ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      toolbar: toolbar as never, library: library as never,
      onSaveNode: (id: string, d: { tags?: readonly string[]; nodes: readonly { x: number }[] }) => { (w['handed'] as unknown[]).push([id, d.tags ?? [], d.nodes[0]!.x]); },
      fieldsOf: { users: { role: { label: 'Role' } } }, stores: ['users'],
    });
    // The toolbar's Save is the app's to answer, as an app does.
    toolbar.addEventListener('toolbar-select', (e) => { if ((e as CustomEvent<{ action: string }>).detail.action === 'save') ed.save(); });
    w['ed'] = ed;
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, { v: 1, nodes: { org: def('Org permissions', ['permissions']), admin: def('Is admin', ['admins']) } });
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const press = async (page: Page, name: string) => {
  await page.locator(`#cv sherpa-node-toolbar sherpa-button.${name}`).click();
  await settle(page);
};
const tags = (page: Page, id: string) => page.evaluate((k) => (window as unknown as { ed: { library(): { nodes: Record<string, { tags?: string[] }> } } }).ed.library().nodes[k]?.tags ?? [], id);
const innerX = (page: Page) => page.evaluate(() => (window as unknown as { ed: { library(): { nodes: Record<string, { nodes: { x: number }[] }> } } }).ed.library().nodes['org']!.nodes[0]!.x);
const startX = (page: Page) => page.evaluate(() => (window as unknown as { ed: { workflow(): { nodes: { id: string; x: number }[] } } }).ed.workflow().nodes.find((n) => n.id === 'start')!.x);
/** What each Save handed over, since the last call: [id, tags, first node's x]. */
const handed = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { handed: unknown[] };
  const out = w.handed;
  w.handed = [];
  return out;
});
/** The Nodes panel's Custom Nodes tab, pressed as a reader does: what is saved, and its tags, sit there. TODO 837 */
const openCustom = (page: Page) => page.locator('sherpa-node-list sherpa-tabs .tab[data-id="custom"]').click();
const tagHeadings = async (page: Page) => { await openCustom(page); return page.evaluate(() => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll<HTMLElement>('.tag-heading')]
  .filter((h) => h.checkVisibility()).map((h) => h.dataset['heading'])); };
const typeTag = async (page: Page, heading: string, word: string) => {
  await header(page, heading).click();
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await page.locator('#inspector sherpa-input-text[name="#tags"] input.control:visible').click();
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(true));
};

test('after Save, Undo takes two definitions\' edits back as it does the workflow\'s own; the next Save hands that over; Redo puts them forward', async ({ page }) => {
  await typeTag(page, 'Org permissions', 'billing');
  await typeTag(page, 'Is admin', 'roles');
  // And one of the workflow's own: the Source moved by the keys.
  const x0 = await startX(page);
  await header(page, 'Source').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await settle(page);
  expect(await startX(page)).toBeGreaterThan(x0);
  await press(page, 'save');
  expect(await handed(page)).toEqual([['org', ['permissions', 'billing'], 0], ['admin', ['admins', 'roles'], 0]]);

  // Undo, three times: the move, then each definition's tag, the field and the panel with them.
  await press(page, 'undo');
  expect(await startX(page)).toBe(x0);
  await press(page, 'undo');
  expect(await tags(page, 'admin')).toEqual(['admins']);
  expect(await tagHeadings(page)).not.toContain('roles');
  await press(page, 'undo');
  expect(await tags(page, 'org')).toEqual(['permissions']);
  expect(await tagHeadings(page)).not.toContain('billing');
  // Each is a draft edit again: Save hands over the definitions as they are now.
  await press(page, 'save');
  expect((await handed(page) as [string, string[]][]).map(([id, t]) => [id, t]).sort()).toEqual([['admin', ['admins']], ['org', ['permissions']]]);

  // Redo, twice: forward again, and the next Save hands those over.
  await press(page, 'redo');
  await press(page, 'redo');
  expect(await tags(page, 'org')).toEqual(['permissions', 'billing']);
  expect(await tags(page, 'admin')).toEqual(['admins', 'roles']);
  expect(await tagHeadings(page)).toEqual(expect.arrayContaining(['billing', 'roles']));
  await press(page, 'save');
  expect((await handed(page) as [string, string[]][]).map(([id, t]) => [id, t]).sort()).toEqual([['admin', ['admins', 'roles']], ['org', ['permissions', 'billing']]]);
});

test('an edit inside an opened Custom Node, saved, steps back after Save too, by the keys', async ({ page }) => {
  await header(page, 'Org permissions').dblclick();
  await settle(page);
  await header(page, 'Field').focus();
  await page.keyboard.press('Shift+ArrowRight');
  await settle(page);
  const moved = await innerX(page);
  expect(moved).toBeGreaterThan(0);
  await press(page, 'save');
  expect(await handed(page)).toEqual([['org', ['permissions'], moved]]);
  // Ctrl/Cmd+Z on the canvas: the inner node goes back.
  const mod = await page.evaluate(() => (/mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control'));
  await header(page, 'Field').focus();
  await page.keyboard.press(`${mod}+z`);
  await settle(page);
  expect(await innerX(page)).toBe(0);
  await press(page, 'save');
  expect(await handed(page)).toEqual([['org', ['permissions'], 0]]);
});
