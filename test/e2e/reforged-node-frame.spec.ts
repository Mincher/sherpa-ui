import { test, expect, type Page } from './harness';

/**
 * FRAMES — Will, TODO 778. Frame nodes lays the picked nodes in ONE column, Arrange's gap apart, and draws a
 * frame round them: a header with its title, its line and Release. A drag on the header moves every node in it,
 * one step; Release takes the frame away and leaves the nodes. Save hands the frame over, and a reload draws it
 * again. Real pointer and keys; places read from the drawn boxes, in pixels. TRAP T-a-frame-is-drawn-round-its-nodes
 */
type Frame = { id: string; label?: string; description?: string; nodes: string[] };
type Flow = { nodes: { id: string; x: number; y: number }[]; routes: { from: string; to: string }[]; frames?: Frame[] };
type Ed = { workflow(): Flow; undo(): boolean; redo(): boolean; save(): boolean };
type Box = { x: number; y: number; width: number; height: number };

const NODES: [string, string, number, number][] = [['s1', 'source', 0, 0], ['p1', 'field', 420, 260], ['e1', 'output', 840, 40], ['s2', 'source', 840, 560]];
const ROUTES = [{ from: 's1/rows', to: 'p1' }, { from: 'p1/field', to: 'e1' }];

async function start(page: Page, flow?: unknown, readOnly = false): Promise<void> {
  await page.evaluate(async ([given, ns, rs, ro]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 640px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = given ?? { v: 2 as const, id: 'f', nodes: ns.map(([id, kind, x, y]) => ({ id, kind, x, y, heading: id })), routes: rs };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    const saved: unknown[] = [];
    canvas.addEventListener('definition-save', (event) => saved.push((event as CustomEvent<{ definition: unknown }>).detail.definition));
    Object.assign(window, { saved });
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'], readOnly: ro,
    });
    await window.__settled();
    canvas.zoomTo(0.5);
    canvas.panTo(60, 80);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, [flow ?? null, NODES, ROUTES, readOnly] as const);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => JSON.parse(JSON.stringify((window as never as { ed: Ed }).ed.workflow())) as Flow);
const ed = (page: Page, call: 'undo' | 'redo') => page.evaluate((c) => (window as never as { ed: Ed }).ed[c](), call).then(() => settle(page));
const node = (page: Page, id: string) => page.locator(`#cv > sherpa-node[data-heading="${id}"]`);
const box = async (page: Page, id: string): Promise<Box> => (await node(page, id).boundingBox())!;
const frameEl = (page: Page) => page.locator('#cv > sherpa-node-frame');
const frameHeader = (page: Page) => frameEl(page).locator('[aria-roledescription="frame"]');
const zoom = (page: Page) => page.locator('#cv').evaluate((cv) => (cv as HTMLElement & { view: { zoom: number } }).view.zoom);
async function pick(page: Page, ids: string[]): Promise<void> {
  await page.keyboard.down('Shift');
  for (const id of ids) {
    const b = await box(page, id);
    await page.mouse.click(b.x + b.width / 2, b.y + 8);
  }
  await page.keyboard.up('Shift');
  await settle(page);
}
/** A real click on a toolbar button, at its middle. */
/** The tool's own button, pressed from its inside: the details panel a pick opens may cover the toolbar's last tools. */
async function press(page: Page, name: string): Promise<void> {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
}
/** Drag from a point by a screen distance, in steps. */
async function drag(page: Page, [x, y]: [number, number], [dx, dy]: [number, number]): Promise<void> {
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + dx / 2, y + dy / 2, { steps: 4 });
  await page.mouse.move(x + dx, y + dy, { steps: 4 });
  await page.mouse.up();
  await settle(page);
}
const inside = (outer: Box, inner: Box) => outer.x < inner.x && outer.y < inner.y && outer.x + outer.width > inner.x + inner.width && outer.y + outer.height > inner.y + inner.height;
/** The frame's header's middle, clear of its Release button. */
async function grip(page: Page): Promise<[number, number]> {
  const h = (await frameHeader(page).boundingBox())!;
  return [h.x + h.width * 0.3, h.y + h.height / 2];
}

test('Frame: two or more picked; one column, Arrange\'s gap apart, left edges kept; a frame round them, its header above; one step', async ({ page }) => {
  await start(page);
  const button = page.locator('sherpa-node-toolbar sherpa-button.frame');
  await expect(button).toHaveAttribute('disabled', '');
  await pick(page, ['s1']);
  await expect(button).toHaveAttribute('disabled', '');
  await pick(page, ['p1', 'e1']);
  await expect(button).not.toHaveAttribute('disabled', '');
  const before = await flow(page);
  await press(page, 'frame');
  const z = await zoom(page);
  const gap = 3 * 56;
  const [s1, p1, e1, s2] = await Promise.all(['s1', 'p1', 'e1', 's2'].map((id) => box(page, id)));
  // ONE column, sources first: the left edges are one, and each top a node's height and the gap below the last.
  expect(Math.abs(s1!.x - p1!.x)).toBeLessThanOrEqual(1);
  expect(Math.abs(p1!.x - e1!.x)).toBeLessThanOrEqual(1);
  expect(s1!.y).toBeLessThan(p1!.y);
  expect(p1!.y).toBeLessThan(e1!.y);
  expect(Math.abs(p1!.y - (s1!.y + s1!.height) - gap * z)).toBeLessThanOrEqual(4 * z + 1);
  expect(Math.abs(e1!.y - (p1!.y + p1!.height) - gap * z)).toBeLessThanOrEqual(4 * z + 1);
  // The top-left of the picked nodes stays where it was.
  const after = await flow(page);
  const at = (f: Flow, id: string) => f.nodes.find((n) => n.id === id)!;
  expect(at(after, 's1')).toMatchObject({ x: 0, y: 0 });
  expect(at(after, 's2')).toEqual(at(before, 's2'));
  // A frame round the three, not the fourth; its header above the first node, with its title and Release.
  expect(after.frames).toEqual([{ id: 'frame-1', label: 'Frame 1', nodes: ['s1', 'p1', 'e1'] }]);
  await expect(frameEl(page)).toHaveCount(1);
  const frame = (await frameEl(page).boundingBox())!;
  for (const b of [s1!, p1!, e1!]) expect(inside(frame, b)).toBe(true);
  expect(inside(frame, s2!)).toBe(false);
  const header = (await frameHeader(page).boundingBox())!;
  expect(header.y + header.height).toBeLessThanOrEqual(s1!.y);
  expect(Math.abs(header.y - frame.y)).toBeLessThanOrEqual(1);
  await expect(frameEl(page).locator('sherpa-container-header')).toHaveAttribute('data-heading', 'Frame 1');
  await expect(frameEl(page).locator('sherpa-button.release')).toBeVisible();
  // Picked, in the look of a picked node; the nodes are let go.
  await expect(frameEl(page)).toHaveAttribute('data-current', '');
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(0);
  // The frame is drawn behind the lines and the nodes.
  expect(await page.locator('#cv').evaluate((cv) => [...cv.children].map((c) => c.localName).indexOf('sherpa-node-frame') < [...cv.children].map((c) => c.localName).indexOf('svg'))).toBe(true);
  // ONE Undo: the places and no frame.
  await ed(page, 'undo');
  expect(await flow(page)).toEqual(before);
  await expect(frameEl(page)).toHaveCount(0);
  await ed(page, 'redo');
  expect(await flow(page)).toEqual(after);
});

test('a drag on the frame header moves every node in it, by the same distance, one step; the others stay', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1', 'e1']);
  await press(page, 'frame');
  const before = await flow(page);
  const was = await Promise.all(['s1', 'p1', 'e1', 's2'].map((id) => box(page, id)));
  const frameWas = (await frameEl(page).boundingBox())!;
  await drag(page, await grip(page), [120, 70]);
  const now = await Promise.all(['s1', 'p1', 'e1', 's2'].map((id) => box(page, id)));
  const z = await zoom(page);
  // Every framed node by the same screen distance as the pointer, the fourth not at all.
  for (const i of [0, 1, 2]) {
    expect(Math.abs(now[i]!.x - was[i]!.x - 120)).toBeLessThanOrEqual(2);
    expect(Math.abs(now[i]!.y - was[i]!.y - 70)).toBeLessThanOrEqual(2);
  }
  expect(now[3]).toEqual(was[3]);
  const frameNow = (await frameEl(page).boundingBox())!;
  expect(Math.abs(frameNow.x - frameWas.x - 120)).toBeLessThanOrEqual(2);
  expect(Math.abs(frameNow.y - frameWas.y - 70)).toBeLessThanOrEqual(2);
  // In the flow, the same delta in plane px.
  const after = await flow(page);
  const d = (id: string) => [after.nodes.find((n) => n.id === id)!.x - before.nodes.find((n) => n.id === id)!.x, after.nodes.find((n) => n.id === id)!.y - before.nodes.find((n) => n.id === id)!.y];
  expect(Math.abs(d('s1')[0]! - 120 / z)).toBeLessThanOrEqual(2);
  expect(d('p1')).toEqual(d('s1'));
  expect(d('e1')).toEqual(d('s1'));
  expect(d('s2')).toEqual([0, 0]);
  // ONE Undo puts every node back; Redo moves them again.
  await ed(page, 'undo');
  expect(await flow(page)).toEqual(before);
  await ed(page, 'redo');
  expect(await flow(page)).toEqual(after);
});

test('Release: the frame goes and its nodes stay; one Undo brings it back', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1', 'e1']);
  await press(page, 'frame');
  const framed = await flow(page);
  const was = await Promise.all(['s1', 'p1', 'e1'].map((id) => box(page, id)));
  const release = (await frameEl(page).locator('sherpa-button.release').boundingBox())!;
  await page.mouse.click(release.x + release.width / 2, release.y + release.height / 2);
  await settle(page);
  await expect(frameEl(page)).toHaveCount(0);
  const after = await flow(page);
  expect(after.frames).toBeUndefined();
  expect(after.nodes).toEqual(framed.nodes);
  expect(await Promise.all(['s1', 'p1', 'e1'].map((id) => box(page, id)))).toEqual(was);
  await ed(page, 'undo');
  expect(await flow(page)).toEqual(framed);
  await expect(frameEl(page)).toHaveCount(1);
});

test('keys: F frames the picked nodes; on the header the arrows move them, Enter opens its panel, Delete releases', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1']);
  await page.locator('#cv').evaluate((cv) => (cv.shadowRoot!.querySelector('.viewport') as HTMLElement).focus());
  await page.keyboard.press('f');
  await settle(page);
  expect((await flow(page)).frames).toEqual([{ id: 'frame-1', label: 'Frame 1', nodes: ['s1', 'p1'] }]);
  // F put the keyboard on the new frame's header.
  await expect.poll(() => frameHeader(page).evaluate((h) => h.matches(':focus'))).toBe(true);
  const before = await flow(page);
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('Shift+ArrowDown');
  await settle(page);
  const after = await flow(page);
  for (const id of ['s1', 'p1']) {
    const [a, b] = [after.nodes.find((n) => n.id === id)!, before.nodes.find((n) => n.id === id)!];
    expect([a.x - b.x, a.y - b.y]).toEqual([8, 32]);
  }
  expect(after.nodes.find((n) => n.id === 'e1')).toEqual(before.nodes.find((n) => n.id === 'e1'));
  // Enter opens its panel: its name, edited there, is its title.
  await page.keyboard.press('Enter');
  await settle(page);
  await page.evaluate(() => (document.getElementById('inspector') as HTMLElement & { minimise(m: boolean): void }).minimise(false));
  const name = page.locator('#inspector sherpa-input-text[name="label"]');
  await expect(name).toBeVisible();
  await name.locator('input').fill('Active customers');
  await name.locator('input').press('Enter');
  await settle(page);
  await expect(frameEl(page).locator('sherpa-container-header')).toHaveAttribute('data-heading', 'Active customers');
  expect((await flow(page)).frames![0]!.label).toBe('Active customers');
  // Delete on the header releases it.
  await frameHeader(page).focus();
  await page.keyboard.press('Delete');
  await settle(page);
  await expect(frameEl(page)).toHaveCount(0);
  expect((await flow(page)).nodes).toEqual(after.nodes);
});

test('a node dragged out of its frame stays in it, and the frame grows round it; a box starts on the frame\'s body', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1']);
  await press(page, 'frame');
  const was = (await frameEl(page).boundingBox())!;
  const p1 = await box(page, 'p1');
  await drag(page, [p1.x + p1.width / 2, p1.y + 8], [200, 120]);
  const now = (await frameEl(page).boundingBox())!;
  expect(now.width).toBeGreaterThan(was.width + 150);
  expect(now.height).toBeGreaterThan(was.height + 90);
  expect(inside(now, await box(page, 'p1'))).toBe(true);
  expect((await flow(page)).frames![0]!.nodes).toEqual(['s1', 'p1']);
  // A box dragged from inside the frame's body, past its nodes, picks what it encloses: the body takes no pointer.
  const s1 = await box(page, 's1');
  await drag(page, [s1.x - 12, s1.y - 6], [s1.width + 24, s1.height + 12]);
  expect(await page.locator('#cv > sherpa-node[data-current]').evaluateAll((ns) => ns.map((n) => n.getAttribute('data-heading')))).toEqual(['s1']);
  await expect(frameEl(page)).not.toHaveAttribute('data-current', '');
});

test('Save hands the frame over; bound again from what was saved, it is drawn round the same nodes', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1', 'e1']);
  await press(page, 'frame');
  expect(await page.evaluate(() => (window as never as { ed: Ed }).ed.save())).toBe(true);
  const saved = await page.evaluate(() => JSON.parse(JSON.stringify((window as never as { saved: Flow[] }).saved.at(-1))) as Flow);
  expect(saved.frames).toEqual([{ id: 'frame-1', label: 'Frame 1', nodes: ['s1', 'p1', 'e1'] }]);
  await page.reload();
  await page.waitForFunction(() => window.__reforgedReady === true);
  await start(page, saved);
  await expect(frameEl(page)).toHaveCount(1);
  const frame = (await frameEl(page).boundingBox())!;
  for (const id of ['s1', 'p1', 'e1']) expect(inside(frame, await box(page, id))).toBe(true);
  expect(inside(frame, await box(page, 's2'))).toBe(false);
});

test('read only, a preset: the frame is drawn, with no Release, and a drag on its header moves nothing', async ({ page }) => {
  const framed = { v: 2, id: 'f', nodes: NODES.map(([id, kind, x, y]) => ({ id, kind, x, y, heading: id })), routes: ROUTES, frames: [{ id: 'frame-1', label: 'Kept', nodes: ['s1', 'p1'] }] };
  await start(page, framed, true);
  await expect(frameEl(page)).toHaveCount(1);
  await expect(frameEl(page)).toHaveAttribute('data-locked', '');
  await expect(frameEl(page).locator('sherpa-button.release')).toBeHidden();
  const was = await Promise.all(['s1', 'p1'].map((id) => box(page, id)));
  await drag(page, await grip(page), [100, 60]);
  expect(await Promise.all(['s1', 'p1'].map((id) => box(page, id)))).toEqual(was);
  expect((await flow(page)).nodes).toEqual(framed.nodes);
  await expect(page.locator('sherpa-node-toolbar sherpa-button.frame')).toHaveAttribute('disabled', '');
});
