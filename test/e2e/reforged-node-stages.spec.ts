import { test, expect, type Page } from './harness';

/**
 * STAGES on a workflow's canvas — Will, 2026-11-10. A graph has one stage at least, Stage 1, round every node. Add stage
 * puts a new one after the last; a node let go in a stage joins it, and a stage grows to hold its nodes. More on a bar
 * offers Edit (name, line, colour) and Remove (its nodes stay, in none). Arrange stages is an edit mode: the toolbar and the
 * panels hide, a footer offers Cancel and Save; a drag or an arrow key on a bar orders the stages, each node with its own.
 * Real pointer and keys.
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
          <sherpa-input-text name="colour" data-label="Colour" data-type="color"></sherpa-input-text>
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
    (window as never as { ed: unknown }).ed = bindWorkflow(canvas, { v: 2, id: 'g', nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'sort', kind: 'sort', x: 330, y: 0, values: { direction: 'asc' } },
      { id: 'end', kind: 'output', x: 660, y: 0 },
    ], routes: [{ from: 'start/rows', to: 'sort' }, { from: 'sort/rows', to: 'end' }] }, {
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
const addStage = async (page: Page) => {
  await page.locator('#cv > .stage-tools .add-stage').click();
  await settle(page);
};
const more = async (page: Page, n: number, action: string) => {
  await stage(page, n).locator('.bar').hover();
  await stage(page, n).locator('.more').click();
  await stage(page, n).locator(`.more sherpa-menu button[value="${action}"]`).click();
  await settle(page);
};
/** Drag a node by its header to a point on the screen. */
const dragNode = async (page: Page, heading: string, to: { x: number; y: number }) => {
  const box = (await page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`).boundingBox())!;
  await page.mouse.move(box.x + 20, box.y + 10);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 10 });
  await page.mouse.up();
  await settle(page);
};

test('one stage round every node; Add stage puts an empty one after it', async ({ page }) => {
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
  // Add stage and Arrange stages stand at the canvas's top right, past every stage's bar.
  const tools = (await page.locator('#cv > .stage-tools').boundingBox())!;
  const canvas = (await page.locator('#cv').boundingBox())!;
  expect(tools.x + tools.width).toBeGreaterThan(canvas.x + canvas.width - 64);
  expect(tools.y).toBeLessThan(canvas.y + 40);
});

test('a node let go in a stage joins it; its old stage shrinks; Undo puts it back as one step', async ({ page }) => {
  await addStage(page);
  const two = (await stage(page, 1).boundingBox())!;
  const before = (await stage(page, 0).boundingBox())!.width;
  await dragNode(page, 'Output', { x: two.x + 60, y: two.y + 120 });
  expect(await stageOf(page, 'end')).toBe('stage-2');
  expect((await stage(page, 0).boundingBox())!.width).toBeLessThan(before);
  await page.locator('sherpa-node-toolbar sherpa-button.undo').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
  expect(await stageOf(page, 'end')).toBe('stage-1');
});

test('Edit names, describes and colours a stage; Remove leaves its nodes where they are, in none', async ({ page }) => {
  await addStage(page);
  await more(page, 1, 'edit');
  await page.locator('#stage sherpa-input-text[name="label"] input').fill('Deliver');
  await page.locator('#stage sherpa-input-text[name="description"] textarea').fill('Where the rows go out');
  await page.locator('#stage sherpa-input-text[name="colour"] input').evaluate((i: HTMLInputElement) => {
    i.value = '#2e9e6b';
    i.dispatchEvent(new Event('input', { bubbles: true }));
  });
  await page.locator('#stage sherpa-button[data-action="save"]').click();
  await settle(page);
  expect((await flow(page)).stages![1]).toMatchObject({ label: 'Deliver', description: 'Where the rows go out', colour: '#2e9e6b' });
  await expect(stage(page, 1)).toHaveAttribute('data-colour', '#2e9e6b');
  // Remove Stage 1: its nodes stay put, in no stage.
  const xs = (await flow(page)).nodes.map((n) => n.x);
  await more(page, 0, 'remove');
  const w = await flow(page);
  expect(w.stages!.map((s) => s.label)).toEqual(['Deliver']);
  expect(w.nodes.map((n) => [n.x, n.stage])).toEqual(xs.map((x) => [x, undefined]));
  // The last stage cannot be removed.
  await expect(stage(page, 0)).not.toHaveAttribute('data-removable');
});

test('Arrange stages: the toolbar and panels hide, a footer shows; an arrow key or a drag orders them; Cancel keeps, Save writes', async ({ page }) => {
  await addStage(page);
  const two = (await stage(page, 1).boundingBox())!;
  await dragNode(page, 'Output', { x: two.x + 60, y: two.y + 120 });
  await page.locator('#cv > .stage-tools .stages-more').click();
  await page.locator('#cv > .stage-tools sherpa-menu button[value="arrange"]').click();
  await settle(page);
  await expect(page.locator('#cv')).toHaveAttribute('data-editing', '');
  await expect(page.locator('#cv sherpa-node-toolbar')).toBeHidden();
  await expect(page.locator('#nodes')).toBeHidden();
  await expect(page.locator('#cv > sherpa-container-footer')).toBeVisible();
  // An arrow key moves Stage 2 first; Cancel leaves the order as it was.
  await stage(page, 1).locator('.bar').focus();
  await page.keyboard.press('ArrowLeft');
  await settle(page);
  await expect(stage(page, 0)).toHaveAttribute('data-heading', 'Stage 2');
  await page.locator('#cv > sherpa-container-footer sherpa-button[data-action="cancel"]').click();
  await settle(page);
  await expect(page.locator('#cv')).not.toHaveAttribute('data-editing');
  expect((await flow(page)).stages!.map((s) => s.id)).toEqual(['stage-1', 'stage-2']);
  // A drag of Stage 2's bar past Stage 1's middle, then Save: Stage 2 first, its node with it.
  await page.locator('#cv > .stage-tools .stages-more').click();
  await page.locator('#cv > .stage-tools sherpa-menu button[value="arrange"]').click();
  await settle(page);
  const end = (await flow(page)).nodes.find((n) => n.id === 'end')!.x;
  const bar = (await stage(page, 1).locator('.bar').boundingBox())!;
  const first = (await stage(page, 0).boundingBox())!;
  await page.mouse.move(bar.x + 40, bar.y + bar.height / 2);
  await page.mouse.down();
  await page.mouse.move(first.x - 20, bar.y + bar.height / 2, { steps: 12 });
  await page.mouse.up();
  await settle(page);
  await page.locator('#cv > sherpa-container-footer sherpa-button[data-action="save"]').click();
  await settle(page);
  const w = await flow(page);
  expect(w.stages!.map((s) => s.id)).toEqual(['stage-2', 'stage-1']);
  const moved = w.nodes.find((n) => n.id === 'end')!.x;
  expect(moved).toBeLessThan(end);
  expect(Math.max(...w.nodes.filter((n) => n.stage === 'stage-2').map((n) => n.x))).toBeLessThan(Math.min(...w.nodes.filter((n) => n.stage === 'stage-1').map((n) => n.x)));
  await expect(page.locator('#cv sherpa-node-toolbar')).toBeVisible();
});
