import { test, expect, type Page } from './harness';

/**
 * STAGES on a workflow's canvas — Will, 2026-11-10. A graph has one stage at least, Stage 1, round every node; a node let
 * go in a stage joins it, and a stage grows to hold its nodes. More, at the end of a bar, offers Edit (name, line, colour),
 * Add stage before, Add stage after and Remove (its nodes stay where they stand, in the next stage); Move left and Move right beside it move the stage
 * one place, each node with it. A default name is its place: Stage 1, Stage 2. Real pointer and keys. TODO 893
 */
test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1100px; block-size: 560px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
        <sherpa-overlay-panel id="nodes" data-side="start" open data-heading="Nodes"></sherpa-overlay-panel>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>
      <sherpa-dialog id="stage" data-heading="Edit stage">
        <sherpa-stack data-gap="md">
          <sherpa-input-text name="label" data-label="Name" required></sherpa-input-text>
          <sherpa-input-text name="description" data-label="Description" data-multiline></sherpa-input-text>
          <sherpa-swatch-picker name="colour" data-label="Colour"></sherpa-swatch-picker>
        </sherpa-stack>
        <sherpa-container-footer slot="footer">
          <sherpa-button data-action="cancel">Cancel</sherpa-button>
          <sherpa-button data-action="save" data-look="saturated">Save</sherpa-button>
        </sherpa-container-footer>
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js' as string);
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas, { v: 3, id: 'g', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'sort', kind: 'sort', x: 330, y: 0, values: { direction: 'asc' } },
      { id: 'end', kind: 'result', x: 660, y: 0 },
    ], connections: [{ from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'end' }] }, {
      session: new SessionStore(), inspector: document.getElementById('inspector'), stageDialog: document.getElementById('stage'),
      toolbar: canvas.querySelector('sherpa-node-toolbar'), stores: ['users'],
      fieldsOf: { users: { status: { label: 'Status', values: ['active'] } } },
    });
    await window.__settled();
    canvas.zoomTo(0.7);
    canvas.panTo(360, 60);
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  });
});

type Flow = { nodes: { id: string; x: number; stage?: string }[]; stages?: { id: string; label: string; x: number; description?: string; colour?: string }[] };
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const flow = (page: Page) => page.evaluate(() => (window as never as { ed: { workflow(): Flow } }).ed.workflow());
const stage = (page: Page, n: number) => page.locator('#cv > sherpa-node-stage').nth(n);
const stageOf = async (page: Page, id: string) => (await flow(page)).nodes.find((n) => n.id === id)?.stage;
/** Add stage after the last, by its More. */
const addStage = async (page: Page) => {
  await more(page, await page.locator('#cv > sherpa-node-stage').count() - 1, 'add-after');
};
async function more(page: Page, n: number, action: string): Promise<void> {
  await stage(page, n).locator('.bar').hover();
  await stage(page, n).locator('.more').click();
  await stage(page, n).locator(`.more sherpa-menu button[value="${action}"]`).click();
  await settle(page);
}
/** Press a stage's Move left or Move right. */
const move = async (page: Page, n: number, side: 'left' | 'right') => {
  await stage(page, n).locator('.bar').hover();
  await stage(page, n).locator(`.move-${side}`).click();
  await settle(page);
};
/** Drag a node by its header to a point on the screen; with Shift held, out of its stage. */
const dragNode = async (page: Page, heading: string, to: { x: number; y: number }, shift = false) => {
  const box = (await page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10);
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  if (shift) await page.keyboard.up('Shift');
  await settle(page);
};

test('one stage round every node; Add stage after puts an empty one after it; More stands at the bar\'s end', async ({ page }) => {
  await expect(page.locator('#cv > sherpa-node-stage')).toHaveCount(1);
  await expect(stage(page, 0)).toHaveAttribute('data-heading', 'Stage 1');
  await expect(stage(page, 0)).not.toHaveAttribute('data-removable');
  await addStage(page);
  await expect(page.locator('#cv > sherpa-node-stage')).toHaveCount(2);
  const [a, b] = [(await stage(page, 0).boundingBox())!, (await stage(page, 1).boundingBox())!];
  expect(b.x).toBeGreaterThan(a.x + a.width);
  const w = await flow(page);
  expect(w.stages!.map((s) => s.label)).toEqual(['Stage 1', 'Stage 2']);
  expect(w.nodes.every((n) => n.stage === 'stage-1')).toBe(true);
  // More stands at the right end of its bar; no stage tools stand at the canvas's top right any more.
  await stage(page, 0).locator('.bar').hover();
  const [bar, more$] = [(await stage(page, 0).locator('.bar').boundingBox())!, (await stage(page, 0).locator('.more').boundingBox())!];
  expect(bar.x + bar.width - (more$.x + more$.width)).toBeLessThan(12);
  await expect(page.locator('#cv > .stage-tools')).toHaveCount(0);
});

test('Add stage before Stage 1 is Stage 1, and the old one Stage 2: a default name is its place', async ({ page }) => {
  await more(page, 0, 'add-before');
  const w = await flow(page);
  expect(w.stages!.map((s) => [s.id, s.label])).toEqual([['stage-2', 'Stage 1'], ['stage-1', 'Stage 2']]);
  // A new stage takes a palette colour at random (TODO 904).
  expect(w.stages![0]!.colour).toMatch(/^var\(--sherpa-data-viz-series-border-(10|[1-9])\)$/);
  await expect(stage(page, 0)).toHaveAttribute('data-heading', 'Stage 1');
  await expect(stage(page, 1)).toHaveAttribute('data-heading', 'Stage 2');
  // Its nodes moved on with the old Stage 1; the Start stands in the new first one (Will, TODO 955).
  expect(w.nodes.filter((n) => n.id !== '#start').every((n) => n.stage === 'stage-1')).toBe(true);
  expect(w.nodes.find((n) => n.id === '#start')?.stage).toBe('stage-2');
});

test('Shift-dragged, a node leaves its stage and joins the one it is let go in; its old stage shrinks; Undo puts it back as one step', async ({ page }) => {
  await addStage(page);
  const two = (await stage(page, 1).boundingBox())!;
  const before = (await stage(page, 0).boundingBox())!.width;
  await dragNode(page, 'Run result', { x: two.x + 60, y: two.y + 120 }, true);
  expect(await stageOf(page, 'end')).toBe('stage-2');
  expect((await stage(page, 0).boundingBox())!.width).toBeLessThan(before);
  await page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await stageOf(page, 'end')).toBe('stage-1');
});

test('Edit names, describes and colours a stage; Remove leaves its nodes where they are, in the stage after it', async ({ page }) => {
  await addStage(page);
  await more(page, 1, 'edit');
  await page.locator('#stage sherpa-input-text[name="label"] input').fill('Deliver');
  await page.locator('#stage sherpa-input-text[name="description"] textarea').fill('Where the rows go out');
  // The colour: a swatch from the palette's grid (TODO 904).
  await page.locator('#stage sherpa-swatch-picker[name="colour"] .trigger').click();
  await page.locator('#stage sherpa-swatch-picker[name="colour"] .swatch[title="Green"]').click();
  const green = 'var(--sherpa-data-viz-series-border-9)';
  await expect(page.locator('#stage sherpa-swatch-picker[name="colour"]')).toHaveAttribute('value', green);
  await page.locator('#stage sherpa-button[data-action="save"]').click();
  await settle(page);
  expect((await flow(page)).stages![1]).toMatchObject({ label: 'Deliver', description: 'Where the rows go out', colour: green });
  await expect(stage(page, 1)).toHaveAttribute('data-colour', green);
  // Remove Stage 1: its nodes stay put, in the stage after it, the first now (899).
  const xs = (await flow(page)).nodes.map((n) => n.x);
  await more(page, 0, 'remove');
  const w = await flow(page);
  expect(w.stages!.map((s) => s.label)).toEqual(['Deliver']);
  expect(w.nodes.map((n) => [n.x, n.stage])).toEqual(xs.map((x) => [x, 'stage-2']));
  // The last stage cannot be removed.
  await expect(stage(page, 0)).not.toHaveAttribute('data-removable');
});

test('Move left and Move right move a stage one place, its nodes with it, one step each; off at the ends; its default name follows', async ({ page, browserName }) => {
  // Safari's Tab skips buttons unless Option is held: its own setting.
  const tab = browserName === 'webkit' ? 'Alt+Tab' : 'Tab';
  await addStage(page);
  const two = (await stage(page, 1).boundingBox())!;
  await dragNode(page, 'Run result', { x: two.x + 60, y: two.y + 120 }, true);
  await expect(stage(page, 0).locator('.move-left')).toHaveAttribute('disabled', '');
  await expect(stage(page, 1).locator('.move-right')).toHaveAttribute('disabled', '');
  const end = (await flow(page)).nodes.find((n) => n.id === 'end')!.x;
  await move(page, 1, 'left');
  let w = await flow(page);
  expect(w.stages!.map((s) => [s.id, s.label])).toEqual([['stage-2', 'Stage 1'], ['stage-1', 'Stage 2']]);
  expect(w.nodes.find((n) => n.id === 'end')!.x).toBeLessThan(end);
  expect(Math.max(...w.nodes.filter((n) => n.stage === 'stage-2').map((n) => n.x))).toBeLessThan(Math.min(...w.nodes.filter((n) => n.stage === 'stage-1').map((n) => n.x)));
  // The keys stay on the stage that moved (its bar: Move left is off at the start). Tab goes on to Move left, off but
  // focusable, then Move right; Enter puts it back.
  expect(await stage(page, 0).evaluate((el) => el.shadowRoot!.activeElement?.className)).toContain('bar');
  await page.keyboard.press(tab);
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await flow(page)).stages!.map((s) => s.id)).toEqual(['stage-2', 'stage-1']);
  await page.keyboard.press(tab);
  await page.keyboard.press('Enter');
  await settle(page);
  w = await flow(page);
  expect(w.stages!.map((s) => s.id)).toEqual(['stage-1', 'stage-2']);
  // Each move is one step: Undo takes the last back.
  await page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect((await flow(page)).stages!.map((s) => s.id)).toEqual(['stage-2', 'stage-1']);
});

test('dragged without Shift, a node stays in its stage, which grows with it; the stage after keeps the same gap', async ({ page }) => {
  await addStage(page);
  const gap = async () => { const [a, b] = [(await stage(page, 0).boundingBox())!, (await stage(page, 1).boundingBox())!]; return Math.round(b.x - (a.x + a.width)); };
  const before = { gap: await gap(), width: (await stage(page, 0).boundingBox())!.width };
  const two = (await stage(page, 1).boundingBox())!;
  // Into stage 2's band, no Shift: it stays in stage 1, which grows to hold it; stage 2 moves on, the gap the same.
  await dragNode(page, 'Run result', { x: two.x + 60, y: two.y + 120 });
  expect(await stageOf(page, 'end')).toBe('stage-1');
  expect((await stage(page, 0).boundingBox())!.width).toBeGreaterThan(before.width);
  expect(Math.abs((await gap()) - before.gap)).toBeLessThanOrEqual(1);
  // Back left: stage 1 shrinks, and stage 2 is drawn back after it, the gap the same.
  const one = (await stage(page, 0).boundingBox())!;
  await dragNode(page, 'Run result', { x: one.x + 200, y: one.y + 300 });
  expect(Math.abs((await gap()) - before.gap)).toBeLessThanOrEqual(1);
});

test('a FRAME dragged follows the nodes\' rule: without Shift its nodes stay in their stage, which grows; with Shift they join the stage it is let go in', async ({ page }) => {
  await addStage(page);
  // Lower, so the frame's header (above its nodes) is clear of the stage bars.
  await page.evaluate(() => (document.getElementById('cv') as HTMLElement & { panTo(x: number, y: number): void }).panTo(360, 160));
  await settle(page);
  // Frame the Source and the Sort.
  const pickHeader = async (heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`).click({ modifiers: ['Shift'] });
  await pickHeader('Source');
  await pickHeader('Sort');
  await page.locator('sherpa-node-toolbar sherpa-button.frame').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  const frameHeader = page.locator('#cv > sherpa-node-frame >> .header[role="group"]');
  await expect(frameHeader).toHaveCount(1);
  const dragFrame = async (to: { x: number; y: number }, shift: boolean) => {
    const h = (await frameHeader.boundingBox())!;
    await page.mouse.move(h.x + 30, h.y + h.height / 2);
    if (shift) await page.keyboard.down('Shift');
    await page.mouse.down();
    await page.mouse.move(to.x, to.y, { steps: 10 });
    await page.mouse.up();
    if (shift) await page.keyboard.up('Shift');
    await settle(page);
  };
  const width = (await stage(page, 0).boundingBox())!.width;
  const two = (await stage(page, 1).boundingBox())!;
  await dragFrame({ x: two.x + 40, y: two.y + 200 }, false);
  expect([await stageOf(page, 'start'), await stageOf(page, 'sort')]).toEqual(['stage-1', 'stage-1']);
  expect((await stage(page, 0).boundingBox())!.width).toBeGreaterThan(width);
  // Shift: out of stage 1, its middle let go over stage 2's middle, past stage 1 now.
  const next = (await stage(page, 1).boundingBox())!;
  const [frame, h] = [(await page.locator('#cv > sherpa-node-frame').boundingBox())!, (await frameHeader.boundingBox())!];
  await dragFrame({ x: next.x + next.width / 2 - frame.width / 2 + (h.x + 30 - frame.x), y: next.y + 200 }, true);
  expect([await stageOf(page, 'start'), await stageOf(page, 'sort')]).toEqual(['stage-2', 'stage-2']);
});

test('the edge between two stages, dragged, widens the one before as the one after narrows; no node moves; one step; the keys too (900)', async ({ page }) => {
  await addStage(page);
  type Two = [[number, number], [number, number]];
  const bands = async (): Promise<Two> => page.locator('#cv > sherpa-node-stage').evaluateAll((els) => els.map((el) => [Number(el.getAttribute('data-x')), Number(el.getAttribute('data-w'))]) as Two);
  const [[x1, w1], [x2, w2]] = await bands();
  const xs = (await flow(page)).nodes.map((n) => n.x);
  // The last stage has no edge; the first's shows a line on a hover.
  await expect(stage(page, 1).locator('.edge')).toBeHidden();
  const edge = stage(page, 0).locator('.edge');
  const box = (await edge.boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  expect(await edge.evaluate((el) => getComputedStyle(el, '::before').borderInlineStartColor)).not.toBe('rgba(0, 0, 0, 0)');
  // Dragged 70 screen px on, at a zoom of 0.7: 100 plane px.
  await page.mouse.down();
  await page.mouse.move(box.x + box.width / 2 + 35, box.y + box.height / 2, { steps: 4 });
  await page.mouse.move(box.x + box.width / 2 + 70, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const [[a, aw], [b, bw]] = await bands();
  expect([a, b]).toEqual([x1, x2 + 100]);
  expect(Math.abs(aw - (w1 + 100))).toBeLessThanOrEqual(1);
  expect(Math.abs(b + bw - (x2 + w2))).toBeLessThanOrEqual(1);
  expect((await flow(page)).nodes.map((n) => n.x)).toEqual(xs);
  // One step: Undo puts both back.
  await page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await bands()).toEqual([[x1, w1], [x2, w2]]);
  // The keys: ArrowRight widens by one step; Home goes to the least, the room its nodes need.
  await edge.focus();
  await page.keyboard.press('ArrowRight');
  await settle(page);
  expect((await bands())[0][1]).toBeGreaterThan(w1);
  await page.keyboard.press('Home');
  await settle(page);
  expect((await bands())[0][1]).toBe(Number(await stage(page, 0).getAttribute('data-min-w')));
  // Locked out by the setting: no edge.
  await stage(page, 0).evaluate((el) => el.setAttribute('data-fixed', ''));
  await expect(edge).toBeHidden();
});

test('with Allow stage resizes to move nodes, the edge goes past the nodes: they are pushed in, in order, drawn as it goes; one Undo (901)', async ({ page }) => {
  await addStage(page);
  // The app's setting, on: a provider writes it; here, by hand, and the stages drawn again by a step and its Undo.
  await page.locator('#cv > sherpa-node-stage').evaluateAll((els) => { for (const el of els) el.setAttribute('data-pushes', ''); });
  const undo = () => page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await page.locator('#cv > sherpa-node[data-heading="Sort"] >> .header[role="button"]').focus();
  await page.keyboard.press('ArrowDown');
  await undo();
  await settle(page);
  const before = await flow(page);
  const at = (f: Flow, id: string) => f.nodes.find((n) => n.id === id)!.x;
  const w1 = Number(await stage(page, 0).getAttribute('data-w'));
  expect(Number(await stage(page, 0).getAttribute('data-min-w'))).toBeLessThan(w1 - 200);
  const box = (await stage(page, 0).locator('.edge').boundingBox())!;
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  // 70 screen px back, at a zoom of 0.7: 100 plane px; the Run result, nearest the edge, comes in as the edge goes.
  await page.mouse.move(box.x + box.width / 2 - 70, box.y + box.height / 2, { steps: 4 });
  const end = page.locator('#cv > sherpa-node[data-heading="Run result"]');
  expect(Number(await end.getAttribute('data-x'))).toBeLessThan(at(before, 'end'));
  await page.mouse.move(box.x + box.width / 2 - 140, box.y + box.height / 2, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const after = await flow(page);
  expect(Math.abs(Number(await stage(page, 0).getAttribute('data-w')) - (w1 - 200))).toBeLessThanOrEqual(1);
  // In order: each still left of the next, and the Run result in by about the 200.
  expect(at(after, 'start')).toBeLessThan(at(after, 'sort'));
  expect(at(after, 'sort')).toBeLessThan(at(after, 'end'));
  expect(Math.abs(at(before, 'end') - at(after, 'end') - 200)).toBeLessThanOrEqual(2);
  // One step: Undo puts the stage and every node back.
  await undo();
  await settle(page);
  expect((await flow(page)).nodes.map((n) => n.x)).toEqual(before.nodes.map((n) => n.x));
  expect(Number(await stage(page, 0).getAttribute('data-w'))).toBe(w1);
});
