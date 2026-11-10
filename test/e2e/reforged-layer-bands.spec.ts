import { test, expect, type Page } from './fixture';

/**
 * THE LAYER SCALE, back to front (Will, TODO 832): content < bars < banners < panels < floating <
 * toasts, written once in sherpa-layers.css. Each band is read where it is USED, and the order is
 * read where the bands MEET: the fixed region over the grid scrolled under it, the reach banner
 * over the fixed region, the docked panel over the banner, a floating panel over the docked one, a
 * toast over all. By `elementsFromPoint` and by pixels, in three engines.
 * TRAP T-the-layers-are-one-scale
 */

type Box = { x: number; y: number; w: number; h: number };
type Rgb = [number, number, number];
const NAMES = ['content', 'bars', 'banners', 'panels', 'floating', 'toasts'] as const;

const settle = (page: Page) => page.evaluate(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(() => setTimeout(done, 60)))));

async function open(page: Page): Promise<void> {
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.goto('/test/reforged/outlet.html');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet') as HTMLElement & { start(o: unknown): Promise<void> };
    const base = new URL('/test/reforged/outlet-layers/app.json', location.href);
    await outlet.start({ app: await (await fetch(base)).json(), base, session: new SessionStore(), stores: () => ({}) });
  });
  await settle(page);
  await page.evaluate(async () => {
    const grid = document.getElementById('grid') as HTMLElement & { populate(d: unknown): Promise<void> };
    await grid.populate({
      key: 'id',
      columns: [{ field: 'name', header: 'Name' }, { field: 'plan', header: 'Plan' }],
      rows: Array.from({ length: 30 }, (_, i) => ({ id: `r${i}`, name: `Customer ${i}`, plan: i % 2 ? 'Pro' : 'Free' })),
    });
    document.querySelector('sherpa-app-shell')!.shadowRoot!.querySelector('.context-frame')!.scrollTop = 60;
  });
  await settle(page);
}

const box = (page: Page, id: string, sel?: string): Promise<Box> => page.evaluate(([i, s]) => {
  const host = i === 'outlet' ? document.querySelector('sherpa-outlet')! : i === 'shell' ? document.querySelector('sherpa-app-shell')! : document.getElementById(i!)!;
  const r = (s ? host.shadowRoot!.querySelector(s)! : host).getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, [id, sel] as const);
const topAt = (page: Page, x: number, y: number) => page.evaluate(([px, py]) => {
  const hit = document.elementsFromPoint(px!, py!)[0];
  if (!hit) return null;
  if (hit.closest('[slot="context-header"]')) return 'bars';
  if (hit.closest('sherpa-toast')) return 'toasts';
  const panel = hit.closest('sherpa-overlay-panel');
  if (panel) return panel.id;
  return hit.closest('sherpa-outlet') ? 'outlet' : hit.localName;
}, [x, y]);
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

test('the scale is read where it is used: each band is the number its component draws at, and they rise in order', async ({ page }) => {
  await open(page);
  const r = await page.evaluate(() => {
    const z = (el: Element, pseudo?: string) => Number(getComputedStyle(el, pseudo).zIndex);
    const shell = document.querySelector('sherpa-app-shell')!;
    const named = Object.fromEntries(['content', 'bars', 'banners', 'panels', 'floating', 'toasts'].map((n) => [n, Number(getComputedStyle(shell).getPropertyValue(`--sherpa-layer-${n}`))]));
    const peek = document.getElementById('peek') as HTMLElement & { show(): void };
    peek.show();
    return {
      named,
      bars: z(shell.shadowRoot!.querySelector('.context-header')!),
      rail: z(shell.shadowRoot!.querySelector('.nav')!),
      content: z(shell.shadowRoot!.querySelector('.content')!),
      banners: (() => { const o = document.querySelector('sherpa-outlet')!; return z(o.shadowRoot!.querySelector('.reach')!); })(),
      panels: z(peek.shadowRoot!.querySelector('.root')!),
    };
  });
  const order = NAMES.map((n) => r.named[n]!);
  expect(order, 'the scale rises').toEqual([...order].sort((a, b) => a - b));
  expect(new Set(order).size).toBe(order.length);
  expect([r.content, r.bars, r.rail, r.banners, r.panels]).toEqual([r.named['content'], r.named['bars'], r.named['bars'], r.named['banners'], r.named['panels']]);
});

test('where the bands meet, the higher is on top: bars over the page, a banner over bars, a docked panel over a banner, a floating one over that, a toast over all', async ({ page }) => {
  await open(page);
  const [metrics, grid] = [await box(page, 'metrics'), await box(page, 'grid')];
  const y = metrics.y + Math.round(metrics.h / 2);
  const x = grid.x + 60;
  // Bars over the content scrolled under them.
  expect(await topAt(page, x, y)).toBe('bars');
  const region: Rgb = [232, 240, 255];
  expect(far(await pixel(page, x, y), region)).toBeLessThanOrEqual(4);

  // A banner over the bars.
  await page.evaluate(() => document.querySelector('sherpa-provider')!.dispatchEvent(
    new CustomEvent('reach-change', { detail: { reach: 'unreached', failure: { kind: 'offline' } } })));
  await settle(page);
  const banner = await box(page, 'outlet', '.reach-unreached');
  const at = { x: banner.x + 200, y: banner.y + Math.round(banner.h / 2) };
  expect(await topAt(page, at.x, at.y)).toBe('outlet');
  expect(far(await pixel(page, at.x, at.y), region), 'the banner covers the region').toBeGreaterThan(8);

  // A docked panel over the banner.
  await page.evaluate(() => (document.getElementById('peek') as HTMLElement & { show(): void }).show());
  await settle(page);
  const peek = await box(page, 'peek', '.root');
  expect(peek.x).toBeLessThan(banner.x + banner.w);
  expect(await topAt(page, peek.x + 40, at.y)).toBe('peek');

  // A floating panel over the docked one: opened second, then pressed.
  await page.evaluate(() => {
    const flo = document.createElement('sherpa-overlay-panel') as HTMLElement & { show(): void };
    flo.id = 'flo';
    flo.setAttribute('data-heading', 'Floating');
    flo.setAttribute('data-floatable', '');
    for (const [a, v] of [['data-x', String(innerWidth - 560)], ['data-y', '40'], ['data-width', '400'], ['data-height', '300'], ['data-mode', 'floating']]) flo.setAttribute(a!, v!);
    document.body.append(flo);
    flo.show();
  });
  await settle(page);
  const flo = await box(page, 'flo', '.root');
  expect(await topAt(page, flo.x + 40, flo.y + 120)).toBe('flo');
  expect(await page.evaluate(() => Number(getComputedStyle(document.getElementById('flo')!.shadowRoot!.querySelector('.root')!).zIndex))).toBeGreaterThan(
    await page.evaluate(() => Number(getComputedStyle(document.getElementById('peek')!.shadowRoot!.querySelector('.root')!).zIndex)));

  // A toast over all of them, at the stack's corner.
  await page.evaluate(async () => {
    const { SherpaToast } = await import('/dist/index.js');
    SherpaToast.show('Layers', 'info', { duration: 0 });
  });
  await settle(page);
  const toast = await page.evaluate(() => {
    const r = document.querySelector('sherpa-toast')!.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
  });
  expect(toast.w).toBeGreaterThan(0);
  expect(await topAt(page, toast.x + Math.round(toast.w / 2), toast.y + Math.round(toast.h / 2))).toBe('toasts');
});

test('a panel peeking from its tab in the shell\'s area is over the fixed region: a strip of tabs makes no layer of its own', async ({ page }) => {
  await open(page);
  await page.evaluate(() => {
    const peek = document.getElementById('peek') as HTMLElement & { show(): void };
    for (const a of ['data-minimisable', 'data-hover-open']) peek.setAttribute(a, '');
    peek.setAttribute('data-side', 'end');
    peek.setAttribute('data-mode', 'tab');
    document.querySelector('sherpa-app-shell')!.append(peek);
    peek.show();
  });
  await settle(page);
  const tab = await box(page, 'peek', '.tab');
  await page.mouse.move(tab.x + Math.round(tab.w / 2), tab.y + Math.round(tab.h / 2));
  await expect.poll(() => page.evaluate(() => document.getElementById('peek')!.matches(':state(peeking)'))).toBe(true);
  const [metrics, root] = [await box(page, 'metrics'), await box(page, 'peek', '.root')];
  expect(root.x).toBeLessThan(metrics.x + metrics.w);
  expect(await topAt(page, root.x + 40, metrics.y + Math.round(metrics.h / 2))).toBe('peek');
});
