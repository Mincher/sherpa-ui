import { test, expect, type Page } from './harness';

/**
 * The node editor's toolbar, Undo and Redo — Will, TODOs 560 and 561. A toolbar floats at the
 * canvas's bottom centre, 32px up, and the node panel keeps 32px from the top. Save is
 * a placeholder, off; Undo and Redo are on only when there is a step, and Ctrl/Cmd+Z and Shift+Ctrl/
 * Cmd+Z do the same. Each edit — a placement, a move, a pick, a route, a cut, a remove, a Custom
 * Node's inside, make and ungroup — steps back to the SAME workflow and forward again. Real pointer and key.
 * TRAP T-an-edit-is-a-step
 */
const ORG = {
  v: 1, label: 'Org permissions', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value', control: 'text', default: 'admin' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  // The users' Role, a Field, Equals the Role given (plan 783).
  nodes: [{ id: 'has-role', kind: 'condition', x: 330, y: 0, values: { type: 'eq' } }, { id: 'role-field', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  routes: [
    { from: '#in/users', to: 'role-field' }, { from: 'role-field/field', to: 'has-role' }, { from: '#in/role', to: 'has-role/b' },
    { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role', to: '#out' },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-breadcrumbs id="trail" hidden></sherpa-breadcrumbs>
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 600px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
        <sherpa-node-panel slot="panel"></sherpa-node-panel>
      </sherpa-layout-canvas>
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
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-panel');
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
});

const BIND = `async (org) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const { useOf } = await import('/dist/data.js');
  const library = { v: 1, nodes: { 'org-permissions': structuredClone(org) } };
  const flow = { v: 2, id: 'g', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    useOf(library, 'org-permissions', { id: 'perm', x: 330, y: 0 }),
    useOf(library, 'org-permissions', { id: 'perm2', x: 330, y: 260 }),
    { id: 'sort', kind: 'collection', x: 0, y: 260, values: { type: 'sort', direction: 'asc' } },
    { id: 'end', kind: 'output', x: 700, y: 0 },
  ], routes: [{ from: 'start/rows', to: 'perm/users' }, { from: 'perm', to: 'end' }] };
  const canvas = document.getElementById('cv');
  window.ed = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'), panel: canvas.querySelector('sherpa-node-panel'),
    toolbar: canvas.querySelector('sherpa-node-toolbar'), customDialog: document.getElementById('custom'), breadcrumbs: document.getElementById('trail'), library,
    fieldsOf: { users: { status: { label: 'Status', values: ['active', 'trial'] }, role: { label: 'Role' } } }, stores: ['users'],
  });
  await window.__settled();
  // The nodes sit right of the card, so a real pointer reaches them.
  canvas.zoomTo(0.6);
  canvas.panTo(340, 40);
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const bind = (page: Page) => page.evaluate(`(${BIND})(${JSON.stringify(ORG)})`);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
/** The workflow and the library as the draft holds them now: what an undo must put back. */
const state = (page: Page) => page.evaluate(() => JSON.stringify([(window as never as { ed: { workflow(): unknown } }).ed.workflow(), (window as never as { ed: { library(): unknown } }).ed.library()]));
const tool = (page: Page, name: string) => page.locator(`sherpa-node-toolbar sherpa-button.${name}`);
/** Save as Custom Node: the toolbar's button, then the dialog's name (and description) and its Save. */
const saveAs = async (page: Page, name: string, description = '') => {
  await press(page, 'group');
  await page.locator('#custom sherpa-input-text[name="label"] input').fill(name);
  if (description) await page.locator('#custom sherpa-input-text[name="description"] textarea').fill(description);
  await page.locator('#custom sherpa-button[data-action="save"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
};
const press = async (page: Page, name: string) => {
  await tool(page, name).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
};
/** The page's primary modifier: Cmd on an Apple platform, else Ctrl (the browser's own platform, not the runner's). */
const primary = (page: Page) => page.evaluate(() => /mac|iphone|ipad/i.test(navigator.platform) ? 'Meta' : 'Control');
const can = (page: Page) => page.evaluate(() => ({
  undo: !!document.querySelector('sherpa-node-toolbar')!.hasAttribute('data-can-undo'),
  redo: !!document.querySelector('sherpa-node-toolbar')!.hasAttribute('data-can-redo'),
  buttons: ['save', 'undo', 'redo'].map((n) => document.querySelector('sherpa-node-toolbar')!.shadowRoot!.querySelector(`sherpa-button.${n}`)!.hasAttribute('disabled')),
}));
const header = (page: Page, heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
const item = (page: Page, kind: string) => page.locator(`sherpa-node-panel sherpa-list-item[data-kind="${kind}"]`);
const STORE_ROWS = '#cv > sherpa-node[data-heading="Source"] sherpa-node-row';
const SORT = '#cv > sherpa-node[data-heading="Collection"]';
const SORT_ROWS = `${SORT} sherpa-node-row`;
const SOCKET = `(el, side) => { const r = el.socketRect(side); return [r.left + r.width / 2, r.top + r.height / 2]; }`;
const at = (page: Page, selector: string, side: string) =>
  page.evaluate(([sel, s, socket]) => eval(socket!)(document.querySelector(sel!), s), [selector, side, SOCKET]) as Promise<[number, number]>;
async function drag(page: Page, [x1, y1]: [number, number], [x2, y2]: [number, number]): Promise<void> {
  await page.mouse.move(x1, y1);
  await page.mouse.down();
  await page.mouse.move((x1 + x2) / 2, (y1 + y2) / 2, { steps: 4 });
  await page.mouse.move(x2, y2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}

test('the toolbar floats at the bottom centre, 32px up, never over the card; the panel is flush; the controls and minimap keep clear at 3 widths', async ({ page }) => {
  await bind(page);
  for (const width of [1500, 900, 600]) {
    const r = await page.evaluate((w) => {
      const cv = document.getElementById('cv')!;
      cv.style.inlineSize = `${w}px`;
      const box = (e: Element) => { const b = e.getBoundingClientRect(); return { left: b.left, top: b.top, right: b.right, bottom: b.bottom }; };
      return {
        canvas: box(cv), bar: box(document.querySelector('sherpa-node-toolbar')!), panel: box(document.querySelector('sherpa-node-panel')!),
        controls: box(cv.shadowRoot!.querySelector('.controls')!), minimap: box(cv.shadowRoot!.querySelector('.minimap')!),
      };
    }, width);
    // Centred on the canvas, so a panel over its end leaves it in reach; never over the card, 32px clear. TODO 796
    const mid = (r.canvas.left + r.canvas.right) / 2;
    const centred = Math.abs((r.bar.left + r.bar.right) / 2 - mid) <= 1;
    expect(centred || Math.abs(r.bar.left - (r.panel.right + 32)) <= 1, `${width}: centred, or 32px past the card`).toBe(true);
    expect(r.bar.left, `${width}: clear of the card`).toBeGreaterThanOrEqual(r.panel.right + 31);
    if (width === 1500) expect(centred, '1500: centred').toBe(true);
    expect(Math.abs(r.canvas.bottom - r.bar.bottom - 32), `${width}: 32px up`).toBeLessThanOrEqual(1);
    expect([r.panel.top, r.panel.bottom, r.panel.left], `${width}: flush`).toEqual([r.canvas.top, r.canvas.bottom, r.canvas.left]);
    const hit = (a: typeof r.bar, b: typeof r.bar) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
    expect(hit(r.bar, r.controls), `${width}: toolbar x controls`).toBe(false);
    expect(hit(r.bar, r.minimap), `${width}: toolbar x minimap`).toBe(false);
    expect(hit(r.controls, r.minimap), `${width}: controls x minimap`).toBe(false);
    expect(hit(r.bar, r.panel), `${width}: toolbar x panel`).toBe(false);
    expect(hit(r.minimap, r.panel), `${width}: minimap x panel`).toBe(false);
  }
  // It keeps its place as the view pans.
  const before = await page.evaluate(() => document.querySelector('sherpa-node-toolbar')!.getBoundingClientRect().left);
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { panTo(x: number, y: number): void }).panTo(300, 200));
  const left = await page.evaluate(() => document.querySelector('sherpa-node-toolbar')!.getBoundingClientRect().left);
  expect(left).toBe(before);
});

test('Save is a placeholder, off; Undo and Redo are off until there is a step, and say their keys', async ({ page }) => {
  await bind(page);
  expect(await can(page)).toEqual({ undo: false, redo: false, buttons: [true, true, true] });
  const tips = await page.locator('sherpa-node-toolbar sherpa-button').evaluateAll((els) => els.map((e) => e.getAttribute('data-tip')));
  expect(tips.slice(0, 3)).toEqual(['Save', 'Undo (Ctrl+Z)', 'Redo (Shift+Ctrl+Z)']);
  await item(page, 'math').click();
  await settle(page);
  expect(await can(page)).toEqual({ undo: true, redo: false, buttons: [true, false, true] });
});

test('a click places a node; Undo takes it away, Redo puts it back; a new edit after an undo ends Redo', async ({ page }) => {
  await bind(page);
  const ids = () => page.evaluate(() => (window as never as { ed: { workflow(): { nodes: { id: string }[] } } }).ed.workflow().nodes.map((n) => n.id));
  await item(page, 'math').click();
  await settle(page);
  expect(await ids()).toContain('math-1');
  await press(page, 'undo');
  expect(await ids()).not.toContain('math-1');
  expect(await can(page)).toEqual({ undo: false, redo: true, buttons: [true, true, false] });
  await press(page, 'redo');
  expect(await ids()).toContain('math-1');
  await press(page, 'undo');
  await item(page, 'value').click();
  await settle(page);
  expect(await can(page)).toMatchObject({ undo: true, redo: false });
  expect(await ids()).toContain('value-1');
  expect(await ids()).not.toContain('math-1');
});

test('Ctrl/Cmd+Z and Shift+Ctrl/Cmd+Z do the same, with the canvas focused; a text field keeps its own', async ({ page }) => {
  await bind(page);
  const before = await state(page);
  await item(page, 'math').click();
  await settle(page);
  const after = await state(page);
  await page.locator('#cv').evaluate((el) => (el.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  const mod = await primary(page);
  await page.keyboard.press(`${mod}+z`);
  await settle(page);
  expect(await state(page)).toBe(before);
  await page.keyboard.press(`Shift+${mod}+z`);
  await settle(page);
  expect(await state(page)).toBe(after);
});

test('a route and a row pick: each is one step, back and forward, to the same workflow', async ({ page }) => {
  await bind(page);
  const s0 = await state(page);
  // A row pick.
  await page.locator('#cv > sherpa-node[data-heading="Collection"] sherpa-input-text[name="direction"] select').selectOption('desc');
  await settle(page);
  const s1 = await state(page);
  expect(s1).not.toBe(s0);
  // A route: the Source's rows to the Sort.
  await drag(page, await at(page, STORE_ROWS, 'output'), await at(page, SORT, 'input'));
  const s2 = await state(page);
  expect(s2).not.toBe(s1);
  await press(page, 'undo');
  expect(await state(page)).toBe(s1);
  await press(page, 'undo');
  expect(await state(page)).toBe(s0);
  await press(page, 'redo');
  expect(await state(page)).toBe(s1);
  await press(page, 'redo');
  expect(await state(page)).toBe(s2);
});

/** Each edit kind: what it does, from the editor as it is bound. */
const EDITS: [string, (page: Page) => Promise<void>][] = [
  ['place', async (page) => { await item(page, 'math').click(); }],
  ['move', async (page) => {
    const b = (await header(page, 'Collection').boundingBox())!;
    await drag(page, [b.x + 40, b.y + 10], [b.x + 100, b.y + 60]);
  }],
  ['row pick', async (page) => { await page.locator('#cv > sherpa-node[data-heading="Collection"] sherpa-input-text[name="direction"] select').selectOption('desc'); }],
  ['route', async (page) => {
    await drag(page, await at(page, STORE_ROWS, 'output'), await at(page, SORT, 'input'));
  }],
  ['cut a route', async (page) => {
    const [mx, my] = await page.evaluate(() => {
      const hit = document.querySelector<SVGPolylineElement>('#cv svg.graph-routes polyline[data-to="end"]')!;
      const p = hit.points.getItem(8);
      const m = hit.getScreenCTM()!;
      return [m.a * p.x + m.e, m.d * p.y + m.f];
    });
    await page.mouse.click(mx!, my!);
    await page.keyboard.press('Delete');
  }],
  ['an override', async (page) => {
    const spot = await page.evaluate(() => {
      const cv = document.getElementById('cv')!;
      const b = cv.getBoundingClientRect();
      for (let y = b.bottom - 120; y > b.top + 20; y -= 20) {
        for (let x = b.right - 40; x > b.left + 340; x -= 20) {
          const free = document.elementsFromPoint(x, y).every((e) => e.localName !== 'sherpa-node' && e.localName !== 'sherpa-node-panel')
            && cv.shadowRoot!.elementsFromPoint(x, y).every((e) => !e.closest('.minimap, .controls'));
          if (free) return [x, y] as [number, number];
        }
      }
      throw new Error('no blank spot');
    });
    await drag(page, await at(page, `${SORT_ROWS}:has([name="direction"])`, 'input'), spot);
  }],
  ['remove a node', async (page) => {
    await page.locator(SORT).click({ position: { x: 40, y: 12 } });
    await settle(page);
    await page.locator('#inspector').getByRole('button', { name: 'Remove node' }).click();
  }],
  ['an edit inside a Custom Node', async (page) => {
    await page.evaluate("window.ed.open('perm')");
    await settle(page);
    await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
  }],
  ['make a Custom Node', async (page) => {
    await header(page, 'Source').focus();
    await page.keyboard.press('Space');
    await header(page, 'Collection').focus();
    await page.keyboard.press('Space');
    await settle(page);
    await saveAs(page, 'Pair');
  }],
];
for (const [name, edit] of EDITS) {
  test(`${name}: Undo puts the same workflow back, Redo makes it again`, async ({ page }) => {
    await bind(page);
    const before = await state(page);
    await edit(page);
    await settle(page);
    const after = await state(page);
    expect(after).not.toBe(before);
    await press(page, 'undo');
    expect(await state(page)).toBe(before);
    await press(page, 'redo');
    expect(await state(page)).toBe(after);
  });
}

test('Ungroup is a step too: Undo makes the Custom Node again, a second Undo puts the pair back', async ({ page }) => {
  await bind(page);
  const s0 = await state(page);
  await header(page, 'Source').focus();
  await page.keyboard.press('Space');
  await header(page, 'Collection').focus();
  await page.keyboard.press('Space');
  await settle(page);
  await saveAs(page, 'Pair');
  await settle(page);
  const made = await state(page);
  await header(page, 'Pair').click();
  await settle(page);
  await page.locator('#inspector sherpa-button[data-label="Ungroup"]').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  const ungrouped = await state(page);
  await press(page, 'undo');
  expect(await state(page)).toBe(made);
  await press(page, 'undo');
  expect(await state(page)).toBe(s0);
  await press(page, 'redo');
  await press(page, 'redo');
  expect(await state(page)).toBe(ungrouped);
});

test('undo works inside an opened Custom Node, and leaving it keeps the history', async ({ page }) => {
  await bind(page);
  const s0 = await state(page);
  await item(page, 'math').click();
  await settle(page);
  await page.evaluate("window.ed.open('perm')");
  await settle(page);
  await page.locator('#cv > sherpa-node[data-heading="Condition"] sherpa-input-text[name="type"] select').selectOption('ne');
  await settle(page);
  const inner = await state(page);
  // Undo inside its own level: the edit goes, and the trail stays.
  await press(page, 'undo');
  expect(await page.evaluate('window.ed.path()')).toEqual(['perm']);
  expect(await page.evaluate("window.ed.library().nodes['org-permissions'].nodes[0].values.type")).toBe('eq');
  await press(page, 'redo');
  expect(await state(page)).toBe(inner);
  // Leave it: the history is kept; two undos reach where it began, and the placement is gone.
  await page.evaluate('window.ed.back()');
  await settle(page);
  expect(await can(page)).toMatchObject({ undo: true });
  await press(page, 'undo');
  await press(page, 'undo');
  expect(await state(page)).toBe(s0);
});

test('Save clears nothing; Discard resets the history', async ({ page }) => {
  await bind(page);
  await item(page, 'math').click();
  await settle(page);
  expect(await page.evaluate('window.ed.save()')).toBe(true);
  expect(await can(page)).toMatchObject({ undo: true });
  await press(page, 'undo');
  expect(await can(page)).toMatchObject({ undo: false, redo: true });
  await page.evaluate('window.ed.discard()');
  await settle(page);
  expect(await can(page)).toMatchObject({ undo: false, redo: false });
});
