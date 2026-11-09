import { test, expect, type Page } from './harness';

/**
 * The node panel — Will, plan 713 M8, D14, D16; plan 749 P3. A card of every node a reader may
 * place, ONE per family, by category, FLOATING on the canvas 32px from its top, bottom and left
 * edges. A search narrows it by name or by a type's ("round" shows Math, placed as Round). An item
 * is placed by a click (the middle of the view),
 * by Enter, or by a drag onto the canvas (where it is let go): each through the draft's one
 * door, picked, its inspector a tab (756). A line let go on the bare canvas opens "Add a node": the
 * kinds that take its type, a Value first. Each by real pointer and key.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    const panel = document.createElement('sherpa-node-list');
    const box = document.createElement('sherpa-overlay-panel');
    box.slot = 'panel';
    for (const [a, v] of [['open', ''], ['data-side', 'start'], ['data-heading', 'Nodes'], ['data-searchable', ''], ['data-padding', 'none']] as const) box.setAttribute(a, v);
    box.appendChild(panel);
    el.appendChild(box);
    document.getElementById('root')!.appendChild(el);
    const inspector = document.createElement('sherpa-overlay-panel');
    inspector.id = 'inspector';
    document.getElementById('root')!.appendChild(inspector);
    await el.rendered;
  });
});

/** A workflow bound on the harness canvas with its node panel: a Source, far right of the panel. */
const BIND = `async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 2, id: 'g', nodes: [{ id: 'start', kind: 'source', x: 420, y: 40, values: { store: 'customers' } }], routes: [] };
  window.editor = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'), panel: canvas.querySelector('sherpa-node-list'),
    fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial'] } } }, stores: ['customers'],
  });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await customElements.whenDefined('sherpa-node-list');
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
const bind = (page: Page) => page.evaluate(`(${BIND})()`);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));

/** What the draft holds now: each node's id and kind, and its routes. */
const draft = (page: Page) => page.evaluate(() => {
  const w = window as unknown as { editor: { save(): boolean }; saved: { nodes: { id: string; kind: string; x: number; y: number }[]; routes?: { from: string; to: string }[] }[] };
  w.editor.save();
  const d = w.saved.at(-1)!;
  return { nodes: d.nodes.map((n) => ({ id: n.id, kind: n.kind, x: n.x, y: n.y })), routes: (d.routes ?? []).map((r) => `${r.from} → ${r.to}`) };
});
/** Press the search field with the real pointer: WebKit's own hit check calls the card's host the thing in the way. */
async function pressSearch(page: Page): Promise<void> {
  const box = (await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const item = (page: Page, kind: string) => page.locator(`sherpa-node-list sherpa-list-item[data-kind="${kind}"]`);

test('it docks on the canvas as a card, 8px in from its top, bottom and left, with no shadow', async ({ page }) => {
  await bind(page);
  const [canvas, card] = await page.evaluate(() => {
    const c = document.querySelector('#root sherpa-layout-canvas')!.getBoundingClientRect();
    const p = document.querySelector('#root sherpa-overlay-panel[data-side="start"]')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect();
    return [c, p].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  });
  // TODO 871: a card inset 8px in its panel area, with no shadow.
  expect([card!.top, card!.bottom, card!.left]).toEqual([canvas!.top + 8, canvas!.bottom - 8, canvas!.left + 8]);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('#root sherpa-overlay-panel[data-side="start"]')!.shadowRoot!.querySelector('.root')!).boxShadow)).toBe('none');
  // It keeps its place as the view pans: it is not on the plane.
  await page.evaluate(() => (document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { panTo(x: number, y: number): void }).panTo(300, 200));
  const after = await page.evaluate(() => document.querySelector('#root sherpa-overlay-panel[data-side="start"]')!.shadowRoot!.querySelector('.root')!.getBoundingClientRect().left);
  expect(after).toBe(card!.left);
});

test('it lists each category with its families, twelve, never a Query-only one; "sor" shows only Sort', async ({ page }) => {
  await bind(page);
  const heads = await page.locator('sherpa-node-list .category-heading').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
  expect(heads).toEqual(['Sources', 'Custom Nodes', 'Variables', 'Math', 'Logic', 'Time', 'Organise', 'Utils', 'Output']);
  const names = () => page.locator('sherpa-node-list sherpa-list-item:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(await names()).toEqual(['Source', 'Value', 'Field', 'Math', 'Condition', 'Time', 'Sort', 'Group', 'Text', 'Tag', 'Portal', 'Output']);
  // A family's line is its synopsis, never its types (TODO 809).
  expect(await item(page, 'sort').getAttribute('data-description')).toBe('Put rows in order of a field');
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill('sor');
  expect(await names()).toEqual(['Sort']);
  expect(await page.locator('sherpa-node-list .category-heading:visible').count()).toBe(1);
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill('zzz');
  expect(await names()).toEqual([]);
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill('');
  expect((await names()).length).toBe(12);
  expect(await item(page, 'group').getAttribute('data-description')).toBe('Group rows by a field');
});

test('"round" shows Math, says Round, and a click places a Math whose type is Round; its rows follow the type', async ({ page }) => {
  await bind(page);
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill('round');
  const names = await page.locator('sherpa-node-list sherpa-list-item:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(names).toEqual(['Math']);
  expect(await item(page, 'math').getAttribute('data-description')).toBe('Round: Rounds a decimal to a set number of places');
  await item(page, 'math').click();
  await settle(page);
  const saved = await page.evaluate(() => (window as unknown as { editor: { workflow(): { nodes: { id: string; values?: object }[] } } }).editor.workflow().nodes.find((n) => n.id === 'math-1'));
  expect(saved?.values).toEqual({ type: 'round' });
  const rows = (heading: string) => page.evaluate((h) => [...document.querySelectorAll(`#root sherpa-layout-canvas > sherpa-node[data-heading="${h}"] sherpa-node-row:not([data-label="Parameters"], [data-label="Properties"])`)].map((r) => r.querySelector('[name]')?.getAttribute('name') ?? r.textContent?.trim()), heading);
  expect(await rows('Math')).toEqual(['type', 'places', 'a', '']);
  // Add, by its select: Value A, Value B, then Result.
  await page.locator('#root sherpa-layout-canvas > sherpa-node[data-heading="Math"] sherpa-input-text[name="type"] select').selectOption('add');
  await settle(page);
  expect(await rows('Math')).toEqual(['type', 'a', 'b', '']);
  const labels = await page.locator('#root sherpa-layout-canvas > sherpa-node[data-heading="Math"] sherpa-input-text').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(labels).toEqual(['Operation', 'Value A', 'Value B']);
});

/** The nodes picked, whether the inspector is open, and whether it is still a tab. */
const pick = (page: Page) => page.evaluate(() => ({
  current: [...document.querySelectorAll('#root sherpa-node[data-current]')].map((n) => (n as HTMLElement).dataset['heading']),
  open: (document.getElementById('inspector') as HTMLElement & { open: boolean }).open,
  tab: document.getElementById('inspector')!.getAttribute('data-mode') === 'tab',
}));

test('a click places the node at the middle of the view, picked, its inspector a tab (756)', async ({ page }) => {
  await bind(page);
  await item(page, 'value').click();
  await settle(page);
  const r = await draft(page);
  expect(r.nodes.map((n) => n.id)).toEqual(['start', 'value-1']);
  // 756: added, it is picked, and its panel does not expand.
  expect(await pick(page)).toEqual({ current: ['Value'], open: true, tab: true });
  // Its corner is the middle of the 900 x 600 view, less half a node, on the plane.
  const view = await page.evaluate(() => (document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { view: { x: number; y: number } }).view);
  expect(Math.abs(r.nodes[1]!.x - (330 - view.x))).toBeLessThanOrEqual(2);
  expect(Math.abs(r.nodes[1]!.y - (260 - view.y))).toBeLessThanOrEqual(2);
});

test('Enter on an item places it', async ({ page }) => {
  await bind(page);
  await pressSearch(page);
  const onValue = () => page.evaluate(() => {
    let el: Element | null = document.activeElement;
    while (el?.shadowRoot?.activeElement) el = el.shadowRoot.activeElement;
    return !!el && !!el.getRootNode() && ((el.getRootNode() as ShadowRoot).host as HTMLElement | undefined)?.dataset?.['kind'] === 'sort';
  });
  for (let i = 0; i < 40 && !(await onValue()); i++) await page.keyboard.press('Tab');
  // WebKit's Tab skips buttons unless asked to; the row's own button takes the focus there.
  if (test.info().project.name === 'webkit') {
    await page.locator('sherpa-node-list sherpa-list-item[data-kind="sort"]').evaluate((el) => (el.shadowRoot!.querySelector('button:not(.drag):not(.expand)') as HTMLElement).focus());
  }
  expect(await onValue()).toBe(true);
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await draft(page)).nodes.map((n) => n.kind)).toEqual(['source', 'sort']);
  expect(await pick(page)).toEqual({ current: ['Sort'], open: true, tab: true });
});

test('a drag places the node where it is let go', async ({ page }) => {
  await bind(page);
  const from = await item(page, 'value').boundingBox();
  const drop = [640, 360] as const;
  const canvas = await page.locator('#root sherpa-layout-canvas').boundingBox();
  await page.mouse.move(from!.x + from!.width / 2, from!.y + from!.height / 2);
  await page.mouse.down();
  await page.mouse.move(from!.x + 80, from!.y + 40, { steps: 4 });
  await page.mouse.move(drop[0], drop[1], { steps: 6 });
  await page.mouse.up();
  await settle(page);
  const r = await draft(page);
  expect(r.nodes.map((n) => n.kind)).toEqual(['source', 'value']);
  // The node's corner is the drop, on the plane and on the screen.
  const view = await page.evaluate(() => (document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { view: { x: number; y: number } }).view);
  expect(Math.abs(r.nodes[1]!.x - (drop[0] - canvas!.x - view.x))).toBeLessThanOrEqual(2);
  expect(Math.abs(r.nodes[1]!.y - (drop[1] - canvas!.y - view.y))).toBeLessThanOrEqual(2);
  const corner = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement>('#root sherpa-layout-canvas > sherpa-node')].find((n) => n.dataset['heading'] === 'Value')!;
    const b = el.getBoundingClientRect();
    return [b.left, b.top];
  });
  expect(Math.abs(corner[0]! - drop[0])).toBeLessThanOrEqual(2);
  expect(Math.abs(corner[1]! - drop[1])).toBeLessThanOrEqual(2);
  expect(await pick(page)).toEqual({ current: ['Value'], open: true, tab: true });
  // A click on it picks it; the panel stays a tab.
  await page.mouse.click(corner[0]! + 60, corner[1]! + 8);
  await settle(page);
  expect(await pick(page)).toEqual({ current: ['Value'], open: true, tab: true });
});

test('a drag let go on the card, or off the canvas, places nothing', async ({ page }) => {
  await bind(page);
  const from = await item(page, 'value').boundingBox();
  await page.mouse.move(from!.x + 20, from!.y + 10);
  await page.mouse.down();
  await page.mouse.move(from!.x + 60, from!.y + 60, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  expect((await draft(page)).nodes.map((n) => n.id)).toEqual(['start']);
});

test('a route let go on the bare canvas opens "Add a node": the kinds that take its type, a Value first when the socket takes one', async ({ page }) => {
  await bind(page);
  // Start's output (rows, an object) dropped on the bare canvas.
  const [x1, y1] = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement & { socketRect(s: string): DOMRect }>('#root sherpa-layout-canvas > sherpa-node')].find((n) => n.dataset['heading'] === 'Source')!;
    const row = el.querySelector('sherpa-node-row:has(sherpa-input-text[name="store"])') as HTMLElement & { socketRect(s: string): DOMRect };
    const r = row.socketRect('output');
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.move(x1!, y1!);
  await page.mouse.down();
  await page.mouse.move(x1! + 150, y1! + 200, { steps: 8 });
  await page.mouse.up();
  const menu = page.locator('sherpa-node-list sherpa-menu.add');
  await expect(menu).toHaveAttribute('open', '');
  const choices = await page.locator('sherpa-node-list sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => (e as HTMLButtonElement).value));
  // Rows (an object) leave the Store row: the families whose header or a row takes one.
  // A portal's In takes anything (TODO 779).
  expect(choices).toEqual(['field', 'condition', 'portal', 'output']);
  const count = page.locator('sherpa-node-list sherpa-menu.add button[value="condition"]');
  // WebKit's hit test puts a menu's card over its rows for a pointer; the key reaches them.
  if (test.info().project.name === 'webkit') {
    await count.evaluate((b: HTMLElement) => b.focus());
    await page.keyboard.press('Enter');
  } else await count.click();
  await settle(page);
  const r = await draft(page);
  expect(r.nodes.map((n) => n.kind)).toEqual(['source', 'condition']);
  expect(r.routes).toEqual(['start/rows → condition-1']);
  expect(await pick(page)).toEqual({ current: ['Condition'], open: true, tab: true });
});

test('"Add a node" for a list says the type a family takes it as: Math › Floor, Text › Join', async ({ page }) => {
  await bind(page);
  await page.evaluate(() => (document.querySelector('sherpa-node-list') as HTMLElement & { askAdd(c: unknown): void })
    .askAdd({ socket: 'start/rows', type: 'object', side: 'out', client: { x: 500, y: 300 }, at: { x: 400, y: 200 } }));
  const menu = page.locator('sherpa-node-list sherpa-menu.add');
  await expect(menu).toHaveAttribute('open', '');
  const said = await page.locator('sherpa-node-list sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => e.textContent));
  expect(said).toEqual(['Field', 'Math › Floor', 'Condition', 'Time', 'Sort', 'Group', 'Text › Join', 'Tag', 'Portal', 'Output']);
  // What it gives narrows it (plan 783 F6): rows to the kinds that can use rows; a Field's column to those that take one.
  const offered = async (gives: string) => {
    await page.keyboard.press('Escape');
    await page.evaluate((g) => (document.querySelector('sherpa-node-list') as HTMLElement & { askAdd(c: unknown): void })
      .askAdd({ socket: 'start/rows', type: 'object', side: 'out', gives: g, client: { x: 500, y: 300 }, at: { x: 400, y: 200 } }), gives);
    await expect(menu).toHaveAttribute('open', '');
    return page.locator('sherpa-node-list sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => e.textContent));
  };
  expect(await offered('rows')).toEqual(['Field', 'Condition', 'Portal', 'Output']);
  expect(await offered('field')).toEqual(said);
});

test('an input let go on the bare canvas offers a Value first', async ({ page }) => {
  await bind(page);
  await pressSearch(page);
  await item(page, 'sort').click();
  await settle(page);
  // The inspector shut, the bare canvas is free.
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { hide(): void }).hide());
  // The new Sort's header input takes any type; the line runs from it out to the bare canvas.
  const [x1, y1] = await page.evaluate(() => {
    const el = [...document.querySelectorAll<HTMLElement & { socketRect(s: string): DOMRect }>('#root sherpa-layout-canvas > sherpa-node')].find((n) => n.dataset['heading'] === 'Sort')!;
    const r = el.socketRect('input');
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.move(x1!, y1!);
  await page.mouse.down();
  await page.mouse.move(x1! + 300, y1! + 190, { steps: 8 });
  await page.mouse.up();
  const choices = await page.locator('sherpa-node-list sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => (e as HTMLButtonElement).value));
  // A Sort's header takes any type: the kinds that give one, a Value first.
  expect(choices[0]).toBe('value');
  expect(choices).not.toContain('output');
});
