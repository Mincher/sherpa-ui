import { test, expect, type Page } from './fixture';

/**
 * A PAGE IS NO STACKING CONTEXT OF ITS OWN (Will, TODO 823). The outlet used to isolate each element of a
 * Context, so on the Node Editor page a floating Nodes card never came in front of the inspector beside it.
 * Now a page's layers meet the shell's: a pressed floating panel comes to the front across them; the
 * "Unable to reach data" banner is over the page's layers and under the panels (100); the shell's fixed
 * region stays over a grid scrolled under it, as the grid keeps its own layers; and a panel still covers
 * the app header. Real pointer and keys; read back by `elementsFromPoint` and by pixels, in three engines.
 * TRAP T-a-reach-banner-takes-no-room TRAP T-a-pressed-panel-comes-to-the-front TRAP T-a-grid-keeps-its-own-layers
 */

type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];
const W = 1600;
const H = 900;

/** The outlet's page has no harness: two frames and a beat, for what a press or a load set in motion. */
const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)))));

/** The outlet started on this fixture's app, on one of its pages. */
async function open(page: Page, context: 'rows' | 'canvas'): Promise<void> {
  await page.setViewportSize({ width: W, height: H });
  await page.goto('/test/reforged/outlet.html');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(async (ctx) => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as HTMLElement & { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/outlet-layers/app.json', location.href);
    const app = await (await fetch(base)).json();
    await outlet.start({ app, base, session: new SessionStore(), stores: () => ({}) });
    if (ctx !== 'rows') await (document.querySelector('sherpa-router') as HTMLElement & { go(c: unknown): Promise<void> }).go({ context: ctx });
  }, context);
  await settle(page);
}

/** A box: by id, or a part in a host's shadow root. */
const box = (page: Page, id: string, sel?: string): Promise<Box> => page.evaluate(([i, s]) => {
  const host = i === 'outlet' ? document.querySelector('sherpa-outlet')! : i === 'shell' ? document.querySelector('sherpa-app-shell')! : document.getElementById(i!)!;
  const r = (s ? host.shadowRoot!.querySelector(s)! : host).getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, [id, sel] as const);

/** What is drawn on top at a point: the nearest element with an id, or a known host, up from the topmost. */
const top = (page: Page, x: number, y: number): Promise<string | undefined> => page.evaluate(([px, py]) => {
  const hit = document.elementsFromPoint(px!, py!)[0];
  return hit?.closest('[id], sherpa-app-header, sherpa-outlet')?.id || hit?.closest('sherpa-app-header, sherpa-outlet')?.localName;
}, [x, y]);

/** The pixels at a point, one per device px. */
async function pixel(page: Page, x: number, y: number): Promise<Rgb> {
  const shot = await page.screenshot({ clip: { x, y, width: 1, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return [...c.getImageData(0, 0, 1, 1).data].slice(0, 3) as Rgb;
  }, shot.toString('base64'));
}
const far = (a: Rgb, b: Rgb): number => Math.max(...a.map((v, i) => Math.abs(v - b[i]!)));

/** The rows page's grid, filled and scrolled under the fixed region. */
async function rowsUnderTheTop(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const grid = document.getElementById('grid') as HTMLElement & { populate(d: unknown): Promise<void> };
    await grid.populate({
      key: 'id',
      columns: [{ field: 'name', header: 'Name' }, { field: 'plan', header: 'Plan' }, { field: 'seats', header: 'Seats', type: 'number' }],
      rows: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: `Customer ${i}`, plan: i % 2 ? 'Pro' : 'Free', seats: i })),
    });
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!.scrollTop = 60;
  });
  await settle(page);
}

test('on a page, a floating card and a floating panel each come to the front on a press, and on a focus', async ({ page }) => {
  await open(page, 'canvas');
  const cv = await box(page, 'cv');
  await page.evaluate(([x, y]) => {
    const set = (el: Element, b: number[]) => ['data-x', 'data-y', 'data-width', 'data-height'].forEach((a, i) => el.setAttribute(a, String(b[i])));
    const nodes = document.getElementById('nodes')!;
    set(nodes, [40, 40, 320, 420]);
    nodes.setAttribute('data-mode', 'floating');
    const inspector = document.getElementById('inspector') as HTMLElement & { show(): void };
    set(inspector, [x! + 240, y! + 120, 420, 400]);
    inspector.setAttribute('data-mode', 'floating');
    inspector.show();
  }, [cv.x, cv.y]);
  await settle(page);
  const [nodes, inspector] = [await box(page, 'nodes', '.root'), await box(page, 'inspector', '.root')];
  const at = { x: Math.round((inspector.x + nodes.x + nodes.w) / 2), y: inspector.y + 120 };
  // Opened last, the panel is in front where they overlap.
  expect(await top(page, at.x, at.y)).toBe('inspector');
  // A press on the card's header, where nothing covers it: the card comes in front.
  await page.mouse.click(nodes.x + 60, nodes.y + 20);
  await settle(page);
  expect(await top(page, at.x, at.y)).toBe('nodes');
  // …and the panel, pressed, comes back.
  await page.mouse.click(inspector.x + inspector.w - 40, inspector.y + 200);
  await settle(page);
  expect(await top(page, at.x, at.y)).toBe('inspector');
  // A focus into the card brings it forward too: the keys reach it.
  await page.evaluate(() => (document.getElementById('nodes')!.shadowRoot!.querySelector('.grip') as HTMLElement).focus());
  await settle(page);
  expect(await top(page, at.x, at.y)).toBe('nodes');
});

test('the shell\'s fixed region stays over a page\'s grid scrolled under it: the grid keeps its own layers', async ({ page }) => {
  await open(page, 'rows');
  await rowsUnderTheTop(page);
  const [metrics, grid, head] = [await box(page, 'metrics'), await box(page, 'grid'), await box(page, 'grid', '.head')];
  // The grid's head has passed under the fixed region.
  expect(head.y).toBeLessThan(metrics.y + metrics.h);
  expect(head.y + head.h).toBeGreaterThan(metrics.y);
  const at = { x: grid.x + 60, y: Math.round((Math.max(head.y, metrics.y) + Math.min(head.y + head.h, metrics.y + metrics.h)) / 2) };
  expect(await top(page, at.x, at.y)).toBe('metrics');
  // By pixels: the fixed region's own colour, not the grid head's.
  expect(far(await pixel(page, at.x, at.y), [232, 240, 255]), 'the fixed region is drawn over the grid').toBeLessThanOrEqual(4);
});

test('the reach banner is over a page\'s layers and under the panels, at z-index 100', async ({ page }) => {
  await open(page, 'rows');
  await rowsUnderTheTop(page);
  await page.evaluate(() => document.querySelector('sherpa-provider')!.dispatchEvent(
    new CustomEvent('reach-change', { detail: { reach: 'unreached', failure: { kind: 'offline' } } })));
  await settle(page);
  const banner = await box(page, 'outlet', '.reach-unreached');
  expect(banner.w).toBeGreaterThan(0);
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('sherpa-outlet')!.shadowRoot!.querySelector('.reach')!).zIndex)).toBe('100');
  // Over the fixed region and the grid under it: what is on top at its middle is the banner.
  const mid = { x: banner.x + 200, y: banner.y + Math.round(banner.h / 2) };
  expect(await top(page, mid.x, mid.y)).toBe('context-root');
  // By pixels: its own surface, where it covers the fixed region, is not the region's colour.
  expect(far(await pixel(page, mid.x, mid.y), [232, 240, 255]), 'the banner is drawn over the fixed region').toBeGreaterThan(8);
  // A panel on the right edge is over it where they meet.
  await page.evaluate(() => (document.getElementById('peek') as HTMLElement & { show(): void }).show());
  await settle(page);
  const peek = await box(page, 'peek', '.root');
  expect(peek.x).toBeLessThan(banner.x + banner.w);
  expect(await top(page, peek.x + 40, mid.y)).toBe('peek');
});

test('a panel still covers the app header; nothing of the page does', async ({ page }) => {
  await open(page, 'rows');
  await rowsUnderTheTop(page);
  const header = await box(page, 'shell', '.header');
  // The page scrolled under it: the header is on top across it.
  for (const x of [header.x + 200, header.x + Math.round(header.w / 2), header.x + header.w - 200]) {
    expect(await top(page, x, header.y + Math.round(header.h / 2))).toBe('sherpa-app-header');
  }
  await page.evaluate(() => (document.getElementById('peek') as HTMLElement & { show(): void }).show());
  await settle(page);
  const peek = await box(page, 'peek', '.root');
  expect(await top(page, peek.x + 40, header.y + Math.round(header.h / 2))).toBe('peek');
});
