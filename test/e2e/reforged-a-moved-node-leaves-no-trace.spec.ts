import { test, expect, type Page } from './harness';

/**
 * A MOVED NODE LEAVES NO TRACE — TODO 799. On a canvas under 1 zoom, Chromium drew a node's rounded
 * hairline a screen px past its box and repainted only the box when the node moved: a faint empty box
 * stayed where it was. A drag and Arrange each move the Output node; round where it was and where
 * it is, the canvas reads as it does once ALL of it is repainted, and the old place as empty canvas.
 * Real pointer; read in PIXELS. TRAP T-a-scaled-hairline-paints-past-its-box
 */
type Box = { x: number; y: number; width: number; height: number };

const NODES: [string, string, number, number][] = [['s1', 'source', 0, 0], ['p1', 'field', 420, 260], ['e1', 'output', 840, 40], ['s2', 'source', 840, 800]];
const CONNECTIONS = [{ from: 's1/rows', to: 'p1' }, { from: 'p1/field', to: 'e1' }];
/** The zoom it showed at, and a pan that puts the Output's edges on whole screen px: where it showed most. */
const ZOOM = 0.5;

async function start(page: Page): Promise<void> {
  await page.evaluate(async ([ns, rs, zoom]) => {
    document.getElementById('root')!.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 1000px; block-size: 640px">
        <sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar>
      </sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>`);
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const flow = { v: 3 as const, id: 'f', nodes: ns.map(([id, kind, x, y]) => ({ id, kind, x, y, heading: id })), connections: rs };
    const canvas = document.getElementById('cv') as HTMLElement & { zoomTo(z: number): void; panTo(x: number, y: number): void };
    bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, toolbar: canvas.querySelector('sherpa-node-toolbar')!, stores: ['users'],
    });
    await window.__settled();
    canvas.zoomTo(zoom);
    canvas.panTo(60, 80);
  }, [NODES, CONNECTIONS, ZOOM] as const);
  await settle(page);
}
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const box = async (page: Page, id: string): Promise<Box> => (await page.locator(`#cv > sherpa-node[data-heading="${id}"]`).boundingBox())!;
const apart = (a: Box, b: Box) => a.x + a.width < b.x || b.x + b.width < a.x || a.y + a.height < b.y || b.y + b.height < a.y;
async function pick(page: Page, ids: string[]): Promise<void> {
  await page.keyboard.down('Shift');
  for (const id of ids) {
    const b = await box(page, id);
    await page.mouse.click(b.x + b.width / 2, b.y + 8);
  }
  await page.keyboard.up('Shift');
  await settle(page);
}
/** The tool's own button, pressed from its inside: the details panel a pick opens may cover the toolbar's last tools. */
async function press(page: Page, name: string): Promise<void> {
  await page.locator(`sherpa-node-toolbar sherpa-button.${name}`).evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await settle(page);
}

/** Pixels of two PNGs that differ by more than 2 in a channel, inside the regions (page px; the shots start
 *  at `at`); the second read `down` px lower. */
async function differ(page: Page, a: Buffer, b: Buffer, at: Box, regions: Box[], down = 0): Promise<{ count: number; max: number }> {
  return page.evaluate(async ([a64, b64, at, regions, down]) => {
    const load = async (b64: string) => {
      const img = new Image();
      img.src = `data:image/png;base64,${b64}`;
      await img.decode();
      const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
      c.drawImage(img, 0, 0);
      return c.getImageData(0, 0, img.width, img.height);
    };
    const [A, B] = await Promise.all([load(a64), load(b64)]);
    let count = 0;
    let max = 0;
    const seen = new Set<number>();
    for (const r of regions) {
      for (let y = Math.max(0, Math.floor(r.y - at.y)); y < Math.min(A.height, Math.ceil(r.y + r.height - at.y)); y++) {
        for (let x = Math.max(0, Math.floor(r.x - at.x)); x < Math.min(A.width, Math.ceil(r.x + r.width - at.x)); x++) {
          const i = (y * A.width + x) * 4;
          const j = ((y + down) * A.width + x) * 4;
          if (seen.has(i)) continue;
          seen.add(i);
          const d = Math.max(...[0, 1, 2].map((k) => Math.abs(A.data[i + k]! - B.data[j + k]!)));
          if (d > 2) count++;
          max = Math.max(max, d);
        }
      }
    }
    return { count, max };
  }, [a.toString('base64'), b.toString('base64'), at, regions, down] as const);
}
const round = (b: Box, by = 3): Box => ({ x: b.x - by, y: b.y - by, width: b.width + 2 * by, height: b.height + 2 * by });

/** What the move left undrawn, round where the node was and where it is: the canvas now, against the
 *  canvas once hidden for a frame and shown again, which repaints all of it. */
async function unrepainted(page: Page, was: Box, now: Box): Promise<{ count: number; max: number }> {
  await page.mouse.move(-1, -1);
  await settle(page);
  const cv = (await page.locator('#cv').boundingBox())!;
  const drawn = await page.screenshot({ clip: cv });
  await page.locator('#cv').evaluate(async (el) => {
    const frames = () => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    (el as HTMLElement).style.visibility = 'hidden';
    await frames();
    (el as HTMLElement).style.visibility = '';
    await frames();
  });
  const repainted = await page.screenshot({ clip: cv });
  return differ(page, drawn, repainted, cv, [round(was), round(now)]);
}

test('a drag by the header: round where the Output was and where it is, the canvas reads as repainted; the old place is empty canvas', async ({ page }) => {
  await start(page);
  const was = await box(page, 'e1');
  await page.mouse.move(was.x + was.width / 2, was.y + 8);
  await page.mouse.down();
  await page.mouse.move(was.x + was.width / 2 - 100, was.y + 108, { steps: 4 });
  await page.mouse.move(was.x + was.width / 2 - 200, was.y + 208, { steps: 4 });
  await page.mouse.up();
  await settle(page);
  const now = await box(page, 'e1');
  expect(apart(round(was), round(now))).toBe(true);
  // As the move left it: the old place against blank canvas a whole number of grid steps below, where the crosses line up.
  const step = ZOOM * await page.locator('#cv').evaluate((cv) => parseFloat(getComputedStyle(cv).getPropertyValue('--_step')));
  expect(Number.isInteger(step)).toBe(true);
  const old = round(was);
  const blank = { ...old, y: old.y + 12 * step };
  for (const id of ['s1', 'p1', 'e1', 's2']) expect(apart(blank, await box(page, id))).toBe(true);
  await page.mouse.move(-1, -1);
  await settle(page);
  const cv = (await page.locator('#cv').boundingBox())!;
  const shot = await page.screenshot({ clip: cv });
  expect(await differ(page, shot, shot, cv, [old], 12 * step)).toEqual({ count: 0, max: expect.any(Number) });
  expect(await unrepainted(page, was, now)).toEqual({ count: 0, max: expect.any(Number) });
});

test('Arrange: round where the Output was and where it is, the canvas reads as repainted', async ({ page }) => {
  await start(page);
  await pick(page, ['s1', 'p1', 'e1']);
  const was = await box(page, 'e1');
  await press(page, 'arrange');
  const now = await box(page, 'e1');
  expect(now).not.toEqual(was);
  expect(await unrepainted(page, was, now)).toEqual({ count: 0, max: expect.any(Number) });
});
