import { test, expect, type Page } from './harness';

/**
 * A SAVED Custom Node is retagged in place (Will, TODO 819): its inspector has a Tags field, and
 * the tags are its DEFINITION's, which every use shares. A tag typed there lists the node under it
 * in the panel at once; it is one step, so Undo takes it off and Redo puts it back; Save hands the
 * definition over with it. Inside an opened Custom Node, its Group Input and Output carry the same
 * field. A preset's field is read only. A tag chip's Backspace takes the tag, never the node. Real
 * pointer and keys.
 */
const ORG = {
  v: 1, label: 'Org permissions', tags: ['permissions'],
  inputs: [{ name: 'users', label: 'Users', type: 'object' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  routes: [{ from: '#in/users', to: 'role' }],
};

test.beforeEach(async ({ page }) => {
  // Wide, so the inspector at the window's right leaves the canvas clear.
  await page.setViewportSize({ width: 1800, height: 900 });
  await page.evaluate(async (org) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 800px"><sherpa-node-toolbar slot="toolbar" data-can-save></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-list');
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const library = {
      v: 1,
      nodes: {
        'org-permissions': structuredClone(org),
        'owner-check': { ...structuredClone(org), label: 'Owner check', tags: ['checks'], preset: true },
      },
    };
    const at = (id: string, kind: string, x: number, y: number) => useOf(library as never, kind, { id, x, y });
    const flow = {
      v: 2, id: 'g',
      nodes: [
        { id: 'start', kind: 'source', x: 380, y: 40, values: { store: 'users' } },
        at('perm', 'org-permissions', 760, 40), at('perm2', 'org-permissions', 760, 320), at('own', 'owner-check', 380, 320),
      ],
      routes: [{ from: 'start/rows', to: 'perm/users' }],
    };
    const w = window as unknown as Record<string, unknown>;
    w['savedNodes'] = [];
    const canvas = document.getElementById('cv')!;
    const toolbar = canvas.querySelector('sherpa-node-toolbar')!;
    const ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      toolbar: toolbar as never, library: library as never,
      onSaveNode: (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]),
      fieldsOf: { users: { role: { label: 'Role' } } }, stores: ['users'],
    });
    // The toolbar's Save is the app's to answer, as an app does.
    toolbar.addEventListener('toolbar-select', (e) => { if ((e as CustomEvent<{ action: string }>).detail.action === 'save') ed.save(); });
    w['ed'] = ed;
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, ORG);
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const tool = (page: Page, name: string) => page.locator(`#cv sherpa-node-toolbar sherpa-button.${name}`);
const tagsField = (page: Page) => page.locator('#inspector sherpa-input-text[name="#tags"]');
type Tagged = HTMLElement & { tags: string[]; suggestions: { value: string }[] };
const fieldTags = (page: Page) => tagsField(page).evaluate((el) => (el as Tagged).tags);
const defTags = (page: Page, id: string) => page.evaluate((k) => (window as unknown as { ed: { library(): { nodes: Record<string, { tags?: string[] }> } } }).ed.library().nodes[k]?.tags ?? [], id);
/** The Nodes panel's Custom Nodes tab, pressed as a reader does: what is saved, and its tags, sit there. TODO 837 */
const openCustom = (page: Page) => page.locator('sherpa-node-list sherpa-tabs .tab[data-id="custom"]').click();
/** The panel's headings that show, a tag's marked. */
const headings = async (page: Page) => { await openCustom(page); return page.evaluate(() => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll<HTMLElement>('.category-heading, .tag-heading')]
  .filter((h) => h.checkVisibility()).map((h) => (h.classList.contains('tag-heading') ? `› ${h.dataset['heading']}` : h.dataset['heading']))); };
/** The nodes the panel lists under one tag. */
const under = async (page: Page, tag: string) => { await openCustom(page); return page.evaluate((t) => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll(`.tag:has(> .tag-heading[data-heading="${t}"]) sherpa-list-item`)].map((i) => i.getAttribute('data-label')), tag); };
/** Click into the Tags field's own text, and type a tag. */
const typeTag = async (page: Page, word: string) => {
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  await tagsField(page).locator('input.control:visible').click();
  await page.keyboard.type(word);
  await page.keyboard.press('Enter');
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(true));
};

test('a tag typed in a saved Custom Node\'s inspector is its definition\'s: listed under it at once, an Undo step, kept by Save', async ({ page }) => {
  await header(page, 'Org permissions').first().click();
  await settle(page);
  await expect(page.locator('#inspector')).toHaveAttribute('open', '');
  // The field says whose tags they are, and offers the app's.
  expect(await fieldTags(page)).toEqual(['permissions']);
  expect(await tagsField(page).evaluate((el) => (el as Tagged).suggestions.map((s) => s.value))).toEqual(['checks', 'permissions']);
  expect(await tagsField(page).getAttribute('data-description')).toBe('The Custom Node\'s own tags: every use of it shares them');
  expect(await tagsField(page).getAttribute('readonly')).toBeNull();
  expect(await headings(page)).not.toContain('› billing');

  await typeTag(page, 'billing');
  expect(await defTags(page, 'org-permissions')).toEqual(['permissions', 'billing']);
  // The panel follows at once: a heading for the tag, the node under it; the search finds it by it.
  expect(await headings(page)).toContain('› billing');
  expect(await under(page, 'billing')).toEqual(['Org permissions']);
  // No use goes stale for a tag: no update is offered, and no node says one is.
  expect(await page.locator('#inspector .update-pane').count()).toBe(0);
  expect(await page.locator('#cv > sherpa-node[data-caption]').count()).toBe(0);
  // The other use shows the same tags: they are the definition's.
  await header(page, 'Org permissions').nth(1).click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions', 'billing']);

  // One step: Undo takes it off, field and panel; Redo puts it back.
  await tool(page, 'undo').click();
  await settle(page);
  expect(await defTags(page, 'org-permissions')).toEqual(['permissions']);
  expect(await fieldTags(page)).toEqual(['permissions']);
  expect(await headings(page)).not.toContain('› billing');
  await tool(page, 'redo').click();
  await settle(page);
  expect(await defTags(page, 'org-permissions')).toEqual(['permissions', 'billing']);
  expect(await headings(page)).toContain('› billing');

  // Save hands the definition over, its tags with it; the field and the panel keep them.
  await tool(page, 'save').click();
  await settle(page);
  const saved = await page.evaluate(() => (window as unknown as { savedNodes: [string, { tags?: string[] }][] }).savedNodes);
  expect(saved.map(([id, d]) => [id, d.tags])).toEqual([['org-permissions', ['permissions', 'billing']]]);
  expect(await fieldTags(page)).toEqual(['permissions', 'billing']);
  expect(await headings(page)).toContain('› billing');
});

test('a tag chip\'s Backspace takes the tag off, never the node', async ({ page }) => {
  await header(page, 'Org permissions').first().click();
  await settle(page);
  await typeTag(page, 'billing');
  // From the empty text, ArrowLeft goes to the last tag; Backspace there removes it.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Backspace');
  await settle(page);
  expect(await defTags(page, 'org-permissions')).toEqual(['permissions']);
  expect(await page.locator('#cv > sherpa-node[data-heading="Org permissions"]').count()).toBe(2);
  await expect(page.locator('#inspector')).toHaveAttribute('open', '');
});

test('inside an opened Custom Node, its Group Input and Output carry the definition\'s Tags', async ({ page }) => {
  await header(page, 'Org permissions').first().dblclick();
  await settle(page);
  await header(page, 'Group Output').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions']);
  await typeTag(page, 'roles');
  expect(await defTags(page, 'org-permissions')).toEqual(['permissions', 'roles']);
  await header(page, 'Group Input').click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions', 'roles']);
  // A node of the body has no Tags of its own.
  await header(page, 'Field').click();
  await settle(page);
  expect(await tagsField(page).count()).toBe(0);
  // Back out (Escape): the panel lists it under the new tag (inside, it offers no node that would hold it), and its use shows it.
  await header(page, 'Field').focus();
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await under(page, 'roles')).toEqual(['Org permissions']);
  await header(page, 'Org permissions').first().click();
  await settle(page);
  expect(await fieldTags(page)).toEqual(['permissions', 'roles']);
});

test('a preset\'s Tags field is read only: no tag added or taken off, by keys or pointer', async ({ page }) => {
  await header(page, 'Owner check').click();
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  expect(await fieldTags(page)).toEqual(['checks']);
  expect(await tagsField(page).getAttribute('readonly')).toBe('');
  expect(await tagsField(page).getAttribute('data-description')).toBe('The Custom Node\'s own tags, read only: it is a preset');
  // A chip of a read-only field has no dismiss.
  expect(await tagsField(page).evaluate((el) => [...el.shadowRoot!.querySelectorAll('.tags > .tag')].map((c) => c.hasAttribute('data-dismissible')))).toEqual([false]);
  await tagsField(page).locator('input.control:visible').click();
  await page.keyboard.type('mine');
  await page.keyboard.press('Enter');
  // Delete on its chip (Backspace on a read-only field is WebKit's Back): the tag stays, and so does the node.
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await defTags(page, 'owner-check')).toEqual(['checks']);
  expect(await fieldTags(page)).toEqual(['checks']);
  expect(await page.locator('#cv > sherpa-node[data-heading="Owner check"]').count()).toBe(1);
  expect(await page.evaluate(() => (window as unknown as { ed: { can(): { undo: boolean } } }).ed.can().undo)).toBe(false);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(true));
  // Inside it, read only too.
  await header(page, 'Owner check').dblclick();
  await settle(page);
  await header(page, 'Group Input').click();
  await settle(page);
  expect(await tagsField(page).getAttribute('readonly')).toBe('');
});
