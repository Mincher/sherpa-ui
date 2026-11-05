import { test, expect, type Page } from './harness';

/**
 * A Custom Node, opened and made — Will, plan 713 M10, M11, D9–D12, D15. Opened (Enter on its
 * header, a double click, the inspector's Open): the canvas shows its inside, Group Input and
 * Output drawn, under breadcrumbs; Escape or a crumb goes back. An edit inside is an edit to the
 * DEFINITION, and each use says an update is available, shows the change as a diff, and updates
 * from a split button whose bulk items ask in a critical dialog. A preset is read only, with "Copy
 * to my nodes". Several picked nodes become one by "Save as Custom Node", and Ungroup undoes it.
 * Each by real pointer and key.
 */
const ORG = {
  v: 1, label: 'Org permissions', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value', control: 'text', default: 'admin' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'has-role', kind: 'condition', x: 0, y: 0, values: { field: 'role', op: 'eq' } }],
  routes: [{ from: '#in/users', to: 'has-role' }, { from: '#in/role', to: 'has-role/value' }, { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role', to: '#out' }],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (org) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-app-header id="trail"><sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs></sherpa-app-header>
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar><sherpa-node-panel slot="panel" style="display: none"></sherpa-node-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>
      <sherpa-dialog id="custom" data-heading="Save as Custom Node">
        <sherpa-stack data-gap="md">
          <sherpa-input-text name="label" data-label="Name" autocomplete="off" required></sherpa-input-text>
          <sherpa-input-text name="description" data-label="Description" data-multiline autocomplete="off"></sherpa-input-text>
        </sherpa-stack>
        <sherpa-container-footer slot="footer">
          <sherpa-button data-action="cancel">Cancel</sherpa-button>
          <sherpa-button data-action="save" data-look="saturated">Save as Custom Node</sherpa-button>
        </sherpa-container-footer>
      </sherpa-dialog>
      <sherpa-dialog id="confirm" data-status="critical" data-heading="Update">
        <p style="margin: 0"></p>
        <sherpa-container-footer slot="footer"><sherpa-button>Cancel</sherpa-button><sherpa-button data-look="saturated">Update</sherpa-button></sherpa-container-footer>
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-panel');
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    (window as unknown as { ORG: unknown }).ORG = org;
  }, ORG);
});

/** Bind a workflow with two uses of Org permissions and a preset; `saved` collects what Save hands over. */
const bind = (page: Page) => page.evaluate(async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { useOf } = await import('/dist/data.js');
  const org = (window as unknown as { ORG: Record<string, unknown> }).ORG;
  const library = {
    v: 1,
    nodes: {
      'org-permissions': structuredClone(org),
      'owner-check': { ...structuredClone(org), label: 'Owner check', preset: true },
    },
  };
  const at = (id: string, kind: string, x: number, y: number) => useOf(library as never, kind, { id, x, y });
  const flow = {
    v: 2, id: 'g',
    nodes: [
      { id: 'start', kind: 'store', x: 420, y: 40, values: { store: 'users' } },
      at('perm', 'org-permissions', 800, 40), at('perm2', 'org-permissions', 800, 360), at('own', 'owner-check', 420, 360),
      { id: 'end', kind: 'output', x: 1200, y: 40 },
    ],
    routes: [{ from: 'start/rows', to: 'perm/users' }, { from: 'start/rows', to: 'perm2/users' }, { from: 'perm', to: 'end' }],
  };
  const w = window as unknown as Record<string, unknown>;
  w['saved'] = [];
  w['savedNodes'] = [];
  document.addEventListener('definition-save', (e) => (w['saved'] as unknown[]).push((e as CustomEvent).detail.definition));
  const canvas = document.getElementById('cv')!;
  w['ed'] = bindWorkflow(canvas as never, flow as never, {
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-panel') as never,
    toolbar: canvas.querySelector('sherpa-node-toolbar') as never, customDialog: document.getElementById('custom') as never, header: document.getElementById('trail') as never, confirm: document.getElementById('confirm') as never, library: library as never,
    onSaveNode: (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]),
    fields: { status: { label: 'Status' }, role: { label: 'Role' } }, stores: ['users'], values: { status: ['active', 'trial'] },
  });
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
});
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const headings = (page: Page) => page.evaluate(() => [...document.querySelectorAll<HTMLElement>('#cv > sherpa-node')].map((n) => n.dataset['heading']));
/** A node's header, by its heading. */
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const tool = (page: Page, name: string) => page.locator(`#cv sherpa-node-toolbar sherpa-button.${name}`);
const press = (page: Page, name: string) => tool(page, name).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
const field = (page: Page, name: string) => page.locator(`#custom sherpa-input-text[name="${name}"]`);
/** The toolbar's Save as Custom Node, the dialog's name and description, and its Save. */
const saveAs = async (page: Page, name: string, description = '') => {
  await press(page, 'group');
  await field(page, 'label').locator('input').fill(name);
  if (description) await field(page, 'description').locator('textarea').fill(description);
  await page.locator('#custom sherpa-button[data-action="save"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
const ed = <T>(page: Page, fn: string) => page.evaluate(`(() => { const ed = window.ed; return ${fn}; })()`) as Promise<T>;

test('Enter on the header opens a Custom Node: Group Input and Output drawn, a trail; Escape goes back', async ({ page }) => {
  await bind(page);
  await header(page, 'Org permissions').first().focus();
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await headings(page)).toEqual(['Group Input', 'Condition', 'Group Output']);
  expect(await ed(page, 'ed.path()')).toEqual(['perm']);
  await page.locator('#trail > sherpa-breadcrumbs .crumb .link').first().waitFor();
  const crumbs = await page.locator('#trail > sherpa-breadcrumbs').evaluate((el) => [...el.shadowRoot!.querySelectorAll('.crumb .link')].map((a) => a.textContent));
  expect(crumbs).toEqual(['Workflow', 'Org permissions']);
  // Its inputs and outputs are drawn from the definition: a row each, by its words.
  const rows = await page.locator('#cv > sherpa-node[data-heading="Group Input"] sherpa-node-row').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(rows).toEqual(['Users', 'Role']);
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual([]);
  expect(await headings(page)).toEqual(['Store', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
  expect(await page.locator('#trail > sherpa-breadcrumbs').evaluate((el) => el.shadowRoot!.querySelectorAll('.crumb').length)).toBe(0);
  // The keyboard is back on the use it opened.
  const on = await page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return ((el?.getRootNode() as ShadowRoot | undefined)?.host as HTMLElement | undefined)?.dataset?.['heading'];
  });
  expect(on).toBe('Org permissions');
});

test('a double click, and the inspector\'s Open, open it; a crumb goes back', async ({ page }) => {
  await bind(page);
  await header(page, 'Org permissions').first().dblclick();
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['perm']);
  await page.locator('#trail > sherpa-breadcrumbs .crumb .link').first().waitFor();
  await page.locator('#trail > sherpa-breadcrumbs').evaluate((el) => (el.shadowRoot!.querySelector('.crumb .link') as HTMLElement).click());
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual([]);
  await header(page, 'Org permissions').nth(1).click();
  await settle(page);
  await page.locator('#inspector sherpa-button[data-label="Open"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['perm2']);
});

test('an edit inside is an edit to the definition: each use says an update is available, with the diff', async ({ page }) => {
  await bind(page);
  expect(await page.locator('#cv > sherpa-node[data-caption]').count()).toBe(0);
  await ed(page, "ed.open('perm')");
  await settle(page);
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="op"] select').selectOption('ne');
  await settle(page);
  expect(await ed(page, "ed.library().nodes['org-permissions'].nodes[0].values.op")).toBe('ne');
  await ed(page, 'ed.back()');
  await settle(page);
  const captions = await page.locator('#cv > sherpa-node[data-heading="Org permissions"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-caption')));
  expect(captions).toEqual(['Update available', 'Update available']);
  expect(await page.locator('#cv > sherpa-node[data-heading="Owner check"]').getAttribute('data-caption')).toBeNull();
  await header(page, 'Org permissions').first().click();
  await settle(page);
  const diff = await page.locator('#inspector .update-pane sherpa-key-value-list').evaluate((el) => el.shadowRoot!.textContent!.replace(/\s+/g, ' '));
  expect(diff).toContain('Nodes changed');
  expect(diff).toContain('has-role');
});

/** An edit inside, so both uses are stale; the first use picked. */
async function stale(page: Page): Promise<void> {
  await bind(page);
  await ed(page, "ed.open('perm')");
  await settle(page);
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="op"] select').selectOption('ne');
  await ed(page, 'ed.back()');
  await settle(page);
  await header(page, 'Org permissions').first().click();
  await settle(page);
}
const captionOf = (page: Page, n: number) => page.locator('#cv > sherpa-node[data-heading="Org permissions"]').nth(n).getAttribute('data-caption');

test('the split button: "Update instance" updates one; the draft keeps it until Save, and discard gives it back', async ({ page }) => {
  await stale(page);
  const split = page.locator('#inspector .update-split sherpa-button');
  expect(await split.first().getAttribute('data-label')).toBe('Update instance');
  await split.first().evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect([await captionOf(page, 0), await captionOf(page, 1)]).toEqual([null, 'Update available']);
  // The pane is gone with the update, and the draft holds it: Save hands it over, with the changed definition.
  expect(await page.locator('#inspector .update-pane').count()).toBe(0);
  await ed(page, 'ed.save()');
  expect(await page.evaluate(() => (window as unknown as { savedNodes: [string, { nodes: { values: { op: string } }[] }][] }).savedNodes.map(([id, d]) => [id, d.nodes[0]!.values.op]))).toEqual([['org-permissions', 'ne']]);
  const saved = await page.evaluate(() => (window as unknown as { saved: { nodes: { id: string; version?: string }[] }[] }).saved.at(-1)!.nodes.filter((n) => n.id.startsWith('perm')).map((n) => n.version));
  expect(saved[0]).not.toBe(saved[1]);
});

test('the split button\'s menu: both bulk items ask in a critical dialog; cancel changes nothing; confirm updates', async ({ page }) => {
  await stale(page);
  const menu = page.locator('#inspector .update-split > sherpa-button[data-type="icon"]');
  const pick = async (label: string) => {
    await menu.evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
    await settle(page);
    await menu.locator('sherpa-menu > button', { hasText: label === 'Update all instances' ? /^Update all instances$/ : label }).click();
    await settle(page);
  };
  const dialog = () => page.locator('#confirm').evaluate((el) => ({ open: (el as HTMLElement & { open: boolean }).open, status: el.getAttribute('data-status'), critical: el.querySelector('sherpa-button[data-status="critical"]')?.textContent }));
  expect(await menu.locator('sherpa-menu > button').allTextContents()).toEqual(['Update all instances on graph', 'Update all instances']);
  await pick('Update all instances on graph');
  expect(await dialog()).toEqual({ open: true, status: 'critical', critical: 'Update' });
  await page.locator('#confirm > sherpa-container-footer > sherpa-button').first().evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect([await captionOf(page, 0), await captionOf(page, 1)]).toEqual(['Update available', 'Update available']);
  await pick('Update all instances');
  expect((await dialog()).open).toBe(true);
  await page.keyboard.press('Escape');
  await settle(page);
  expect([await captionOf(page, 0), await captionOf(page, 1)]).toEqual(['Update available', 'Update available']);
  await pick('Update all instances on graph');
  await page.locator('#confirm > sherpa-container-footer > sherpa-button').last().evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);

  expect([await captionOf(page, 0), await captionOf(page, 1)]).toEqual([null, null]);
  await ed(page, 'ed.discard()');
  await settle(page);
  expect([await captionOf(page, 0), await captionOf(page, 1)]).toEqual([null, null]);
  expect(await ed(page, "ed.library().nodes['org-permissions'].nodes[0].values.op")).toBe('eq');
});

test('a preset opens read only; "Copy to my nodes" makes an editable copy that takes its place', async ({ page }) => {
  await bind(page);
  await header(page, 'Owner check').dblclick();
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['own']);
  // Read only: a field is locked, a node does not move, and the panel says how to change it.
  const locked = await page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => ({
    place: el.hasAttribute('data-locked'), op: el.querySelector('sherpa-input-text[name="op"]')?.hasAttribute('readonly'),
  }));
  expect(locked).toEqual({ place: true, op: true });
  expect(await page.locator('#inspector').getAttribute('data-heading')).toBe('Owner check');
  expect(await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').count()).toBe(1);
  await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await ed(page, "Object.keys(ed.library().nodes).sort()")).toEqual(['org-permissions', 'owner-check', 'owner-check-copy']);
  expect(await ed(page, "ed.library().nodes['owner-check-copy'].preset")).toBeUndefined();
  const op = page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="op"]');
  expect(await op.evaluate((el) => el.hasAttribute('disabled'))).toBe(false);
  await op.locator('select').selectOption('ne');
  await settle(page);
  expect(await ed(page, "ed.library().nodes['owner-check-copy'].nodes[0].values.op")).toBe('ne');
  expect(await ed(page, "ed.library().nodes['owner-check'].nodes[0].values.op")).toBe('eq');
  await ed(page, 'ed.back()');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-heading="Owner check copy"]').count()).toBe(1);
});

test('Shift-click and Space pick several; Escape clears; "Save as Custom Node" makes one use; Ungroup puts the nodes back', async ({ page }) => {
  await bind(page);
  await header(page, 'Org permissions').first().click();
  await header(page, 'Org permissions').nth(1).click({ modifiers: ['Shift'] });
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  expect(await page.locator('#inspector').getAttribute('data-heading')).toBe('2 nodes picked');
  expect(await tool(page, 'group').evaluate((el) => el.hasAttribute('disabled'))).toBe(false);
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(0);
  // By keyboard: focus a header, Space adds it.
  await header(page, 'Store').focus();
  await page.keyboard.press('Space');
  await header(page, 'Output').focus();
  await page.keyboard.press('Space');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  // A loop through outside is refused in words, in the dialog, which stays open.
  await saveAs(page, 'Ends');
  expect(await field(page, 'label').getAttribute('data-description')).toMatch(/would hold a loop/);
  expect(await page.locator('#custom').evaluate((el: HTMLElement & { open: boolean }) => el.open)).toBe(true);
  await page.locator('#custom sherpa-button[data-action="cancel"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await header(page, 'Store').focus();
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(0);
  // The two uses of Org permissions, with the store they share: one Custom Node.
  await header(page, 'Store').focus();
  await page.keyboard.press('Space');
  await header(page, 'Org permissions').first().focus();
  await page.keyboard.press('Space');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  await saveAs(page, 'Users with a role', 'Who holds the role');
  await settle(page);
  expect((await headings(page)).sort()).toEqual(['Org permissions', 'Output', 'Owner check', 'Users with a role']);
  const made = await ed(page, "ed.library().nodes['users-with-a-role']");
  expect((made as { description: string }).description).toBe('Who holds the role');
  expect(await page.locator('#cv svg.graph-routes path[data-to]').count()).toBe(2);
  // The panel lists it, and Save hands it over.
  await ed(page, 'ed.save()');
  expect(await page.evaluate(() => (window as unknown as { savedNodes: [string][] }).savedNodes.map(([id]) => id))).toEqual(['users-with-a-role']);
  // Ungroup, from the inspector: the nodes are back.
  await header(page, 'Users with a role').click();
  await settle(page);
  await page.locator('#inspector sherpa-button[data-label="Ungroup"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect((await headings(page)).sort()).toEqual(['Org permissions', 'Org permissions', 'Output', 'Owner check', 'Store']);
  expect(await page.locator('#cv svg.graph-routes path[data-to]').count()).toBe(3);
});

test('a saved edit reaches a saved edit reaches a second tab: its uses show the update indicator once the save arrives (refresh)', async ({ page }) => {
  await bind(page);
  await ed(page, "ed.open('perm')");
  await settle(page);
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="op"] select').selectOption('ne');
  await ed(page, 'ed.back()');
  await ed(page, 'ed.save()');
  // The second tab: the saved workflow (uses at the old version), the saved library.
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const w = window as unknown as { saved: { id: string }[]; savedNodes: [string, unknown][]; ed: { library(): { nodes: Record<string, unknown> } } };
    const two = document.createElement('sherpa-layout-canvas');
    two.id = 'cv2';
    two.setAttribute('style', 'inline-size: 900px; block-size: 600px');
    document.getElementById('root')!.appendChild(two);
    await (two as HTMLElement & { rendered: Promise<void> }).rendered;
    const library = { v: 1, nodes: { ...w.ed.library().nodes } };
    const flow = structuredClone(w.saved.at(-1)) as never;
    // The library the second tab opens on is the app's: the OLD definition until the save arrives.
    (window as unknown as { ed2: unknown }).ed2 = bindWorkflow(two as never, flow, { session: new SessionStore(), library: { v: 1, nodes: { ...library.nodes, 'org-permissions': (window as unknown as { ORG: unknown }).ORG } } as never, fields: { role: { label: 'Role' } }, stores: ['users'] });
    await window.__settled();
  });
  const caps = () => page.locator('#cv2 > sherpa-node[data-heading="Org permissions"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-caption')));
  expect(await caps()).toEqual([null, null]);
  await page.evaluate(() => {
    const w = window as unknown as { ed2: { refresh(l: unknown): void }; savedNodes: [string, unknown][] };
    w.ed2.refresh({ v: 1, nodes: Object.fromEntries(w.savedNodes) });
  });
  await settle(page);
  expect(await caps()).toEqual(['Update available', 'Update available']);
});

test('the toolbar\'s Save as Custom Node is off with none or one picked, on with two; an empty name is refused; Cancel and Escape change nothing', async ({ page }) => {
  await bind(page);
  const off = () => tool(page, 'group').evaluate((el) => el.hasAttribute('disabled'));
  expect(await off()).toBe(true);
  await header(page, 'Store').click();
  await settle(page);
  expect(await off()).toBe(true);
  await header(page, 'Output').focus();
  await page.keyboard.press('Space');
  await settle(page);
  expect(await off()).toBe(false);
  await press(page, 'group');
  await page.locator('#custom sherpa-button[data-action="save"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  expect(await field(page, 'label').getAttribute('data-description')).toBe('Give the Custom Node a name');
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.locator('#custom').evaluate((el: HTMLElement & { open: boolean }) => el.open)).toBe(false);
  expect(await headings(page)).toEqual(['Store', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
  // A name a shipped kind holds is refused too.
  await press(page, 'group');
  await field(page, 'label').locator('input').fill('Store');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await headings(page)).toEqual(['Store', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
  await page.locator('#custom sherpa-button[data-action="cancel"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await header(page, 'Store').click();
  await settle(page);
  expect(await off()).toBe(true);
  expect(await page.locator('#inspector sherpa-button[data-label="Save as Custom Node"]').count()).toBe(0);
});

test('one picked node shows no tabs; two show a tab each, the active ringed; a tab switches the node, not the pick; the JSON sections read the definition', async ({ page }) => {
  await bind(page);
  await header(page, 'Store').click();
  await settle(page);
  expect(await page.locator('#inspector sherpa-tabs').count()).toBe(0);
  const json = (title: string) => page.locator(`#inspector sherpa-accordion[data-heading="${title}"] sherpa-code-block`).evaluate((el) => el.getAttribute('data-code'));
  expect(JSON.parse((await json('Outgoing JSON'))!).definition).toEqual({ store: 'users' });
  expect(JSON.parse((await json('Incoming JSON'))!)[0].socket).toBe('Store');
  await header(page, 'Output').focus();
  await page.keyboard.press('Space');
  await settle(page);
  const labels = () => page.locator('#inspector sherpa-tabs').evaluate((el) => [...el.shadowRoot!.querySelectorAll('.tab .label')].map((t) => t.textContent));
  expect(await labels()).toEqual(['Store', 'Output']);
  expect(await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading')).toBe('Store');
  await page.locator('#inspector sherpa-tabs').evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[1] as HTMLElement).click());
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading')).toBe('Output');
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  expect(JSON.parse((await json('Incoming JSON'))!)[0].from).toEqual(['Org permissions › True']);
});
