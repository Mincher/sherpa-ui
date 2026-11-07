import { test, expect, type Page } from './harness';

/**
 * A Custom Node, opened and made — Will, plan 713 M10, M11, D9–D12, D15. Opened (Enter on its
 * header, a double click, the inspector's Open): the canvas shows its inside, Group Input and
 * Output drawn, under breadcrumbs; Escape or a crumb goes back. An edit inside is an edit to the
 * DEFINITION, and each use says an update is available, shows the change as a diff, and updates
 * from a split button whose bulk items ask in a critical dialog. A preset is read only, with "Copy
 * to my nodes". Several picked nodes become one by "Save as Custom Node", and Ungroup undoes it.
 * A connection let go on a use's header is a new input of its definition (763). Each by real
 * pointer and key.
 */
const ORG = {
  v: 1, label: 'Org permissions', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value', control: 'text', default: 'admin' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  // The users' Role, a Field; Equals the Role given, as Value B (plan 783).
  nodes: [{ id: 'has-role', kind: 'condition', x: 360, y: 0, values: { type: 'eq' } }, { id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  routes: [
    { from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: '#in/role', to: 'has-role/b' },
    { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role', to: '#out' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async (org) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-app-header id="trail"><sherpa-breadcrumbs slot="breadcrumbs"></sherpa-breadcrumbs></sherpa-app-header>
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none" style="display: none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
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
    await customElements.whenDefined('sherpa-node-list');
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
      { id: 'start', kind: 'source', x: 420, y: 40, values: { store: 'users' } },
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
    session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
    toolbar: canvas.querySelector('sherpa-node-toolbar') as never, customDialog: document.getElementById('custom') as never, header: document.getElementById('trail') as never, confirm: document.getElementById('confirm') as never, library: library as never,
    onSaveNode: (id: string, d: unknown) => (w['savedNodes'] as unknown[]).push([id, d]),
    fieldsOf: { users: { status: { label: 'Status', values: ['active', 'trial'] }, role: { label: 'Role' } } }, stores: ['users'],
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
  expect(await headings(page)).toEqual(['Group Input', 'Condition', 'Field', 'Group Output']);
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
  expect(await headings(page)).toEqual(['Source', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
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
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
  await settle(page);
  expect(await ed(page, "ed.library().nodes['org-permissions'].nodes[0].values.type")).toBe('ne');
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
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
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
  expect(await page.evaluate(() => (window as unknown as { savedNodes: [string, { nodes: { values: { type: string } }[] }][] }).savedNodes.map(([id, d]) => [id, d.nodes[0]!.values.type]))).toEqual([['org-permissions', 'ne']]);
  const saved = await page.evaluate(() => (window as unknown as { saved: { nodes: { id: string; version?: string }[] }[] }).saved.at(-1)!.nodes.filter((n) => n.id.startsWith('perm')).map((n) => n.version));
  expect(saved[0]).not.toBe(saved[1]);
});

test('the split button\'s menu: both bulk items ask in a critical dialog; cancel changes nothing; confirm updates', async ({ page }) => {
  await stale(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
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
  expect(await ed(page, "ed.library().nodes['org-permissions'].nodes[0].values.type")).toBe('eq');
});

test('a preset opens read only; "Copy to my nodes" makes an editable copy that takes its place', async ({ page }) => {
  await bind(page);
  await header(page, 'Owner check').dblclick();
  await settle(page);
  expect(await ed(page, 'ed.path()')).toEqual(['own']);
  // Read only: a field is locked, a node does not move, and the panel says how to change it.
  const locked = await page.locator('#cv > sherpa-node[data-heading="Condition"]').evaluate((el) => ({
    place: el.hasAttribute('data-locked'), op: el.querySelector('sherpa-input-text[name="type"]')?.hasAttribute('readonly'),
  }));
  expect(locked).toEqual({ place: true, op: true });
  expect(await page.locator('#inspector').getAttribute('data-heading')).toBe('Owner check');
  expect(await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').count()).toBe(1);
  await page.locator('#inspector sherpa-button[data-label="Copy to my nodes"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await ed(page, "Object.keys(ed.library().nodes).sort()")).toEqual(['org-permissions', 'owner-check', 'owner-check-copy']);
  expect(await ed(page, "ed.library().nodes['owner-check-copy'].preset")).toBeUndefined();
  const op = page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"]');
  expect(await op.evaluate((el) => el.hasAttribute('disabled'))).toBe(false);
  await op.locator('select').selectOption('ne');
  await settle(page);
  expect(await ed(page, "ed.library().nodes['owner-check-copy'].nodes[0].values.type")).toBe('ne');
  expect(await ed(page, "ed.library().nodes['owner-check'].nodes[0].values.type")).toBe('eq');
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
  await header(page, 'Source').focus();
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
  await header(page, 'Source').focus();
  await page.keyboard.press('Escape');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(0);
  // The two uses of Org permissions, with the store they share: one Custom Node.
  await header(page, 'Source').focus();
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
  expect((await headings(page)).sort()).toEqual(['Org permissions', 'Org permissions', 'Output', 'Owner check', 'Source']);
  expect(await page.locator('#cv svg.graph-routes path[data-to]').count()).toBe(3);
});

/** A drawn socket's middle on the screen: a node's header or one of its rows. */
const socketAt = (page: Page, selector: string, side: string) => page.locator(selector).evaluate((el, s) => {
  const r = (el as HTMLElement & { socketRect(side: string): DOMRect }).socketRect(s);
  return [r.left + r.width / 2, r.top + r.height / 2] as [number, number];
}, side);
/** A line drawn by the pointer, from one socket to another. */
const drawLine = async (page: Page, from: [number, number], to: [number, number]) => {
  await page.mouse.move(...from);
  await page.mouse.down();
  await page.mouse.move((from[0] + to[0]) / 2, (from[1] + to[1]) / 2, { steps: 4 });
  await page.mouse.move(...to, { steps: 4 });
  await page.mouse.up();
  await settle(page);
};
const routesOf = (page: Page, at = 'ed.workflow().routes') => ed<{ from: string; to: string }[]>(page, at).then((rs) => rs.map((r) => `${r.from} → ${r.to}`).sort());

test('two sources let go on one Custom Node\'s header are two new inputs: a row each, inside too, routed on by the reader; Save writes them; Ungroup joins through them (763)', async ({ page }) => {
  await bind(page);
  const perm2 = '#cv > sherpa-node[data-heading="Org permissions"] >> nth=1';
  // An object, then a boolean, onto the HEADER of the second use: never matched to Users, its free row of their type.
  await drawLine(page, await socketAt(page, '#cv > sherpa-node[data-heading="Source"] sherpa-node-row:has(sherpa-input-text[name="store"])', 'output'), await socketAt(page, perm2, 'input'));
  await drawLine(page, await socketAt(page, '#cv > sherpa-node[data-heading="Org permissions"] >> nth=0', 'output'), await socketAt(page, perm2, 'input'));
  expect(await routesOf(page)).toEqual(['perm → end', 'perm → perm2/perm', 'start/rows → perm/users', 'start/rows → perm2/start-rows', 'start/rows → perm2/users']);
  expect(await page.locator('#cv svg.graph-routes path[data-from="start/rows"][data-to="perm2/start-rows"]').count()).toBe(1);
  // A row's words are its own, or its field's where it has a control (Role).
  expect(await page.locator(perm2).locator('sherpa-node-row').evaluateAll((els) => els.map((e) => [e.getAttribute('data-label') ?? e.firstElementChild?.getAttribute('data-label'), e.getAttribute('data-input-socket')]))).toEqual([
    ['Users', 'object'], ['Role', 'value'], ['Source › Rows', 'object'], ['Org permissions', 'boolean'], ['Allowed', null],
  ]);
  // The inside is shared: the other use says it can update; this one follows it.
  expect(await page.locator('#cv > sherpa-node[data-heading="Org permissions"]').evaluateAll((els) => els.map((e) => e.getAttribute('data-caption')))).toEqual(['Update available', null]);
  // Inside, a Group Input row each, an output socket of the source's type, routed to nothing yet.
  await ed(page, "ed.open('perm2')");
  await settle(page);
  const rows = () => page.locator('#cv > sherpa-node[data-heading="Group Input"] sherpa-node-row').evaluateAll((els) => els.map((e) => [e.getAttribute('data-label'), e.getAttribute('data-output-socket'), e.hasAttribute('data-output-routed')]));
  expect(await rows()).toEqual([['Users', 'object', true], ['Role', 'value', true], ['Source › Rows', 'object', false], ['Org permissions', 'boolean', false]]);
  // The reader routes Source › Rows on to the Field, by the pointer: it takes the place of Users there.
  await drawLine(page, await socketAt(page, '#cv > sherpa-node[data-heading="Group Input"] sherpa-node-row[data-label="Source › Rows"]', 'output'), await socketAt(page, '#cv > sherpa-node[data-heading="Field"]', 'input'));
  expect(await routesOf(page, "ed.library().nodes['org-permissions'].routes")).toContain('#in/start-rows → role');
  expect(await rows()).toEqual([['Users', 'object', false], ['Role', 'value', true], ['Source › Rows', 'object', true], ['Org permissions', 'boolean', false]]);
  await ed(page, 'ed.back()');
  await settle(page);
  // Save hands the definition over with its two new inputs.
  expect(await ed(page, 'ed.save()')).toBe(true);
  expect(await ed(page, "window.savedNodes.find(([id]) => id === 'org-permissions')[1].inputs.map((i) => i.name)")).toEqual(['users', 'role', 'start-rows', 'perm']);
  // Ungroup: the Source goes on to the Field through its row; the True and Users rows feed nothing inside, so their routes go.
  await header(page, 'Org permissions').nth(1).click();
  await settle(page);
  await page.locator('#inspector sherpa-button[data-label="Ungroup"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await routesOf(page)).toEqual(['perm → end', 'role/field → has-role', 'start/rows → perm/users', 'start/rows → role']);
});

test('a preset\'s header refuses a new input as any refused drop does: in words, the line not kept, a moved end back on its row (763, 803)', async ({ page }) => {
  await bind(page);
  await page.evaluate(async () => {
    const { onReport } = await import('/dist/data.js') as { onReport(fn: (r: { code: string; message: string }) => void): () => void };
    const w = window as unknown as { said: string[] };
    w.said = [];
    onReport((r) => w.said.push(`${r.code}: ${r.message}`));
  });
  const refused = 'workflow-route: bindWorkflow: a preset is read only: Copy to my nodes to add an input.';
  const rows = '#cv > sherpa-node[data-heading="Source"] sherpa-node-row:has(sherpa-input-text[name="store"])';
  const own = '#cv > sherpa-node[data-heading="Owner check"]';
  const lines = () => page.locator('#cv svg.graph-routes path[data-from]').evaluateAll((els) => els.map((p) => `${p.getAttribute('data-from')} → ${p.getAttribute('data-to')}`).sort());
  await drawLine(page, await socketAt(page, rows, 'output'), await socketAt(page, own, 'input'));
  expect(await ed(page, 'window.said')).toEqual([refused]);
  expect(await routesOf(page)).toEqual(['perm → end', 'start/rows → perm/users', 'start/rows → perm2/users']);
  expect(await lines()).toEqual(['perm → end', 'start/rows → perm/users', 'start/rows → perm2/users']);
  expect(await page.locator('#cv svg.graph-routes path.graph-draft').count(), 'no line is left where it was let go').toBe(0);
  expect(await ed(page, "ed.library().nodes['owner-check'].inputs.length")).toBe(2);
  // A route into its Users row is the workflow's own; its end lifted and let go on the header is refused, and goes back.
  await drawLine(page, await socketAt(page, rows, 'output'), await socketAt(page, `${own} sherpa-node-row[data-label="Users"]`, 'input'));
  expect(await routesOf(page)).toContain('start/rows → own/users');
  await drawLine(page, await socketAt(page, `${own} sherpa-node-row[data-label="Users"]`, 'input'), await socketAt(page, own, 'input'));
  expect(await ed(page, 'window.said')).toEqual([refused, refused]);
  expect(await routesOf(page)).toEqual(['perm → end', 'start/rows → own/users', 'start/rows → perm/users', 'start/rows → perm2/users']);
  expect(await lines()).toContain('start/rows → own/users');
  expect(await page.locator('#cv svg.graph-routes path.graph-draft').count()).toBe(0);
});

test('inside, a picklist row routed from the Group Input, which sends nothing yet, shows nothing and says where from: never its first choice (774)', async ({ page }) => {
  await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    // The Source's Status, Equals Value B; Value B not yet routed.
    const library = {
      v: 1, nodes: {
        'has-status': {
          v: 1, label: 'Has status', inputs: [{ name: 'status', label: 'Status', type: 'value' }], outputs: [{ name: 'matching', label: 'Matching', type: 'object' }],
          nodes: [
            { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'pick', kind: 'field', x: 360, y: 0, values: { field: 'status' } },
            { id: 'match', kind: 'condition', x: 720, y: 0, values: { type: 'eq' } },
          ],
          routes: [{ from: 'start/rows', to: 'pick' }, { from: 'pick/field', to: 'match' }, { from: 'match/rows', to: '#out/matching' }],
        },
      },
    };
    const flow = { v: 2, id: 'g774', nodes: [useOf(library as never, 'has-status', { id: 'has', x: 200, y: 100 })], routes: [] };
    (window as unknown as Record<string, unknown>)['ed'] = bindWorkflow(document.getElementById('cv') as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, header: document.getElementById('trail') as never, library: library as never,
      fieldsOf: { users: { status: { label: 'Status', values: ['active', 'trial'] } } }, stores: ['users'],
    });
    await window.__settled();
  });
  await header(page, 'Has status').dblclick();
  await settle(page);
  await page.locator('#inspector').evaluate((el: HTMLElement & { hide(): void }) => el.hide());
  await page.locator('#cv').evaluate((c: HTMLElement & { fit(): void }) => c.fit());
  await settle(page);
  const b = '#cv > sherpa-node[data-heading="Condition"] sherpa-node-row:has(> sherpa-input-text[data-label="Value B"])';
  const shows = () => page.locator(`${b} > sherpa-input-text`).evaluate((f: HTMLElement & { value: string }) => {
    const select = f.shadowRoot!.querySelector('select')!;
    return { value: f.value, shows: select.selectedIndex < 0 ? '' : select.options[select.selectedIndex]!.textContent, note: f.getAttribute('data-description'), readonly: f.hasAttribute('readonly') };
  });
  // By the pointer: the Group Input's Status on to Value B.
  await drawLine(page, await socketAt(page, '#cv > sherpa-node[data-heading="Group Input"] sherpa-node-row[data-label="Status"]', 'output'), await socketAt(page, b, 'input'));
  expect(await routesOf(page, "ed.library().nodes['has-status'].routes")).toContain('#in/status → match/b');
  expect(await shows()).toEqual({ value: '', shows: '', note: 'From Group Input › Status', readonly: true });
  expect(await ed(page, "ed.library().nodes['has-status'].nodes.find((n) => n.id === 'match').values.b ?? null")).toBe(null);
  // Its inspector says the same, once.
  await header(page, 'Condition').click();
  await settle(page);
  expect(await page.locator('#inspector sherpa-input-text[data-label="Value B"]').evaluate((f: HTMLElement & { value: string }) => [f.value, f.getAttribute('data-description')])).toEqual(['', 'From Group Input › Status']);
});

test('a route a file kept on a use\'s header reads once as its own new input: drafted, kept for the tab, never added twice; Discard reads it again (763)', async ({ page }) => {
  const read = await page.evaluate(async () => {
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const { useOf } = await import('/dist/data.js');
    const org = (window as unknown as { ORG: Record<string, unknown> }).ORG;
    const library = { v: 1, nodes: { 'org-permissions': structuredClone(org) } };
    const flow = {
      v: 2, id: 'held',
      nodes: [{ id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, useOf(library as never, 'org-permissions', { id: 'perm', x: 400, y: 0 })],
      routes: [{ from: 'start/rows', to: 'perm' }],
    };
    const session = new SessionStore();
    const canvas = document.getElementById('cv')!;
    const open = () => bindWorkflow(canvas as never, flow as never, { session, library: library as never, stores: ['users'] });
    const said = (ed: ReturnType<typeof open>) => ({
      routes: (ed.workflow().routes ?? []).map((r: { from: string; to: string }) => `${r.from} → ${r.to}`),
      inputs: ed.library().nodes['org-permissions']!.inputs.map((i: { name: string }) => i.name),
    });
    const first = open();
    const was = said(first);
    first.stop();
    // The tab opens it again, as a reload does: the draft and the edit are kept together.
    const again = open();
    const kept = said(again);
    again.discard();
    const discarded = said(again);
    again.stop();
    return { was, kept, discarded };
  });
  const form = { routes: ['start/rows → perm/start-rows'], inputs: ['users', 'role', 'start-rows'] };
  expect(read).toEqual({ was: form, kept: form, discarded: form });
});

test('a saved edit reaches a saved edit reaches a second tab: its uses show the update indicator once the save arrives (refresh)', async ({ page }) => {
  await bind(page);
  await ed(page, "ed.open('perm')");
  await settle(page);
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
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
    (window as unknown as { ed2: unknown }).ed2 = bindWorkflow(two as never, flow, { session: new SessionStore(), library: { v: 1, nodes: { ...library.nodes, 'org-permissions': (window as unknown as { ORG: unknown }).ORG } } as never, fieldsOf: { users: { role: { label: 'Role' } } }, stores: ['users'] });
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
  await header(page, 'Source').click();
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
  expect(await headings(page)).toEqual(['Source', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
  // A name a shipped kind holds is refused too.
  await press(page, 'group');
  await field(page, 'label').locator('input').fill('Source');
  await page.keyboard.press('Enter');
  await settle(page);
  expect(await headings(page)).toEqual(['Source', 'Org permissions', 'Org permissions', 'Owner check', 'Output']);
  await page.locator('#custom sherpa-button[data-action="cancel"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await header(page, 'Source').click();
  await settle(page);
  expect(await off()).toBe(true);
  expect(await page.locator('#inspector sherpa-button[data-label="Save as Custom Node"]').count()).toBe(0);
});

test('one picked node shows no tabs; two show a tab each, the active ringed; a tab switches the node, not the pick; the JSON sections read the definition', async ({ page }) => {
  await bind(page);
  await header(page, 'Source').click();
  await settle(page);
  expect(await page.locator('#inspector sherpa-tabs:not(.content-tabs)').count()).toBe(0);
  const json = (title: string) => page.locator(`#inspector sherpa-accordion[data-heading="${title}"] sherpa-code-block`).evaluate((el) => el.getAttribute('data-code'));
  expect(JSON.parse((await json('Outgoing JSON'))!).definition).toEqual({ store: 'users' });
  expect(JSON.parse((await json('Incoming JSON'))!)[0].socket).toBe('Store');
  await header(page, 'Output').focus();
  await page.keyboard.press('Space');
  await settle(page);
  const labels = () => page.locator('#inspector sherpa-tabs:not(.content-tabs)').evaluate((el) => [...el.shadowRoot!.querySelectorAll('.tab .label')].map((t) => t.textContent));
  expect(await labels()).toEqual(['Source', 'Output']);
  expect(await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading')).toBe('Source');
  await page.locator('#inspector sherpa-tabs:not(.content-tabs)').evaluate((el) => (el.shadowRoot!.querySelectorAll('.tab')[1] as HTMLElement).click());
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-active]').getAttribute('data-heading')).toBe('Output');
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  expect(JSON.parse((await json('Incoming JSON'))!)[0].from).toEqual(['Org permissions']);
});
