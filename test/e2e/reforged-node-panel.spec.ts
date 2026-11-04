import { test, expect, type Page } from './harness';

/**
 * The node panel — Will, plan 713 M8, D14, D16. A card of every node a reader may place, by
 * category, FLOATING on the canvas 32px from its top, bottom and left edges. A search narrows
 * it by name ("cou" shows only Count). An item is placed by a click (the middle of the view),
 * by Enter, or by a drag onto the canvas (where it is let go): each through the draft's one
 * door, picked, its inspector open. A line let go on the bare canvas opens "Add a node": the
 * kinds that take its type, a Value first. Each by real pointer and key.
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 900px; block-size: 600px';
    const panel = document.createElement('sherpa-node-panel');
    panel.slot = 'panel';
    el.appendChild(panel);
    document.getElementById('root')!.appendChild(el);
    const inspector = document.createElement('sherpa-overlay-panel');
    inspector.id = 'inspector';
    document.getElementById('root')!.appendChild(inspector);
    await el.rendered;
  });
});

/** A workflow bound on the harness canvas with its node panel: a Store, far right of the panel. */
const BIND = `async () => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 2, id: 'g', nodes: [{ id: 'start', kind: 'store', x: 420, y: 40, values: { store: 'customers' } }], routes: [] };
  window.editor = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'), panel: canvas.querySelector('sherpa-node-panel'),
    fields: { status: { label: 'Status' } }, stores: ['customers'], values: { status: ['active', 'trial'] },
  });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await customElements.whenDefined('sherpa-node-panel');
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
  const box = (await page.locator('sherpa-node-panel sherpa-input-text.find input').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}
const item = (page: Page, kind: string) => page.locator(`sherpa-node-panel sherpa-list-item[data-kind="${kind}"]`);

test('it floats on the canvas, 32px from the top, bottom and left', async ({ page }) => {
  await bind(page);
  const [canvas, card] = await page.evaluate(() => {
    const c = document.querySelector('#root sherpa-layout-canvas')!.getBoundingClientRect();
    const p = document.querySelector('sherpa-node-panel')!.getBoundingClientRect();
    return [c, p].map((r) => ({ left: r.left, top: r.top, right: r.right, bottom: r.bottom }));
  });
  expect(Math.abs(card!.top - canvas!.top - 32)).toBeLessThanOrEqual(1);
  expect(Math.abs(canvas!.bottom - card!.bottom - 32)).toBeLessThanOrEqual(1);
  expect(Math.abs(card!.left - canvas!.left - 32)).toBeLessThanOrEqual(1);
  // It keeps its place as the view pans: it is not on the plane.
  await page.evaluate(() => (document.querySelector('#root sherpa-layout-canvas') as HTMLElement & { panTo(x: number, y: number): void }).panTo(300, 200));
  const after = await page.evaluate(() => document.querySelector('sherpa-node-panel')!.getBoundingClientRect().left);
  expect(after).toBe(card!.left);
});

test('it lists each category with its kinds, never a Query-only one; "cou" shows only Count', async ({ page }) => {
  await bind(page);
  const heads = await page.locator('sherpa-node-panel sherpa-accordion').evaluateAll((els) => els.map((e) => e.getAttribute('data-heading')));
  expect(heads).toEqual(['Sources', 'Custom Nodes', 'Variables', 'Logic', 'Collections', 'Output']);
  const names = () => page.locator('sherpa-node-panel sherpa-list-item:visible').evaluateAll((els) => els.map((e) => e.getAttribute('data-label')));
  expect(await names()).toEqual(['Store', 'Value', 'Pick', 'Condition', 'Sort', 'Group', 'Count', 'Output']);
  await page.locator('sherpa-node-panel sherpa-input-text.find input').fill('cou');
  expect(await names()).toEqual(['Count']);
  expect(await page.locator('sherpa-node-panel sherpa-accordion:visible').count()).toBe(1);
  await page.locator('sherpa-node-panel sherpa-input-text.find input').fill('zzz');
  expect(await names()).toEqual([]);
  await page.locator('sherpa-node-panel sherpa-input-text.find input').fill('');
  expect((await names()).length).toBe(8);
});

test('a click places the node at the middle of the view, picked, its inspector open', async ({ page }) => {
  await bind(page);
  await item(page, 'value').click();
  await settle(page);
  const r = await draft(page);
  expect(r.nodes.map((n) => n.id)).toEqual(['start', 'value-1']);
  const open = await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { open: boolean }).open);
  expect(open).toBe(true);
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
    return !!el && !!el.getRootNode() && ((el.getRootNode() as ShadowRoot).host as HTMLElement | undefined)?.dataset?.['kind'] === 'count';
  });
  for (let i = 0; i < 40 && !(await onValue()); i++) await page.keyboard.press('Tab');
  // WebKit's Tab skips buttons unless asked to; the row's own button takes the focus there.
  if (test.info().project.name === 'webkit') {
    await page.locator('sherpa-node-panel sherpa-list-item[data-kind="count"]').evaluate((el) => (el.shadowRoot!.querySelector('button:not(.drag):not(.expand)') as HTMLElement).focus());
  }
  expect(await onValue()).toBe(true);
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await draft(page)).nodes.map((n) => n.kind)).toEqual(['store', 'count']);
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
  expect(r.nodes.map((n) => n.kind)).toEqual(['store', 'value']);
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
    const el = [...document.querySelectorAll<HTMLElement & { socketRect(s: string): DOMRect }>('#root sherpa-layout-canvas > sherpa-node')].find((n) => n.dataset['heading'] === 'Store')!;
    const r = el.socketRect('output');
    return [r.left + r.width / 2, r.top + r.height / 2];
  });
  await page.mouse.move(x1!, y1!);
  await page.mouse.down();
  await page.mouse.move(x1! + 150, y1! + 200, { steps: 8 });
  await page.mouse.up();
  const menu = page.locator('sherpa-node-panel sherpa-menu.add');
  await expect(menu).toHaveAttribute('open', '');
  const choices = await page.locator('sherpa-node-panel sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => (e as HTMLButtonElement).value));
  expect(choices).toEqual(['pick', 'condition', 'sort', 'group', 'count', 'output']);
  const count = page.locator('sherpa-node-panel sherpa-menu.add button[value="count"]');
  // WebKit's hit test puts a menu's card over its rows for a pointer; the key reaches them.
  if (test.info().project.name === 'webkit') {
    await count.evaluate((b: HTMLElement) => b.focus());
    await page.keyboard.press('Enter');
  } else await count.click();
  await settle(page);
  const r = await draft(page);
  expect(r.nodes.map((n) => n.kind)).toEqual(['store', 'count']);
  expect(r.routes).toEqual(['start → count-1']);
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
  const choices = await page.locator('sherpa-node-panel sherpa-menu.add button[value]').evaluateAll((els) => els.map((e) => (e as HTMLButtonElement).value));
  // A Sort's header takes any type: the kinds that give one, a Value first.
  expect(choices[0]).toBe('value');
  expect(choices).not.toContain('output');
});
