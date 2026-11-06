import { test, expect, type Page } from './harness';

/**
 * A node's header always moves it — Will, TODO 738. A drag that starts on the
 * header's icon, heading, description, empty area or padding moves the node by the
 * drag, selects no text and starts no native drag; the grip shows on hover and on
 * focus and moves nothing: a tab on the header's LEFT edge, as tall as the header and outside it, its glyph
 * turned a quarter (TODO 849). Each by real pointer events.
 */
type Canvas = HTMLElement & { rendered: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<sherpa-node id="a" data-heading="Start here" data-description="A description line" data-icon="play" data-x="40" data-y="60"></sherpa-node>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (el.querySelector('sherpa-node') as Canvas).rendered;
    await window.__settled();
  });
});

/** The middle of a part of the header, found through its shadow roots. */
const PART = `(sel) => {
  const node = document.querySelector('#a');
  const header = node.shadowRoot.querySelector('.header');
  const find = (root, s) => root.querySelector(s) ?? [...root.querySelectorAll('*')].map((e) => e.shadowRoot && find(e.shadowRoot, s)).find(Boolean);
  const hr = header.getBoundingClientRect();
  if (sel === 'empty') return [hr.right - 4, hr.top + hr.height / 2];
  if (sel === 'padding') return [hr.left + 2, hr.top + 2];
  const r = find(header, sel).getBoundingClientRect();
  return [r.left + Math.min(r.width / 2, 12), r.top + r.height / 2];
}`;
const at = (page: Page, sel: string) => page.evaluate(`(${PART})(${JSON.stringify(sel)})`) as Promise<[number, number]>;
const place = (page: Page) => page.evaluate(() => { const n = document.querySelector('#a')!; return [n.getAttribute('data-x'), n.getAttribute('data-y')]; });

for (const part of ['.glyph', '.icon', '.title', '.description', 'empty', 'padding']) {
  test(`a drag from the header's ${part} moves the node`, async ({ page }) => {
    await page.evaluate(() => {
      (window as any).heard = [];
      document.addEventListener('dragstart', () => (window as any).heard.push('dragstart'), true);
    });
    const [x, y] = await at(page, part);
    await page.mouse.move(x, y);
    await page.mouse.down();
    await page.mouse.move(x + 40, y + 20, { steps: 4 });
    await page.mouse.move(x + 80, y + 40, { steps: 4 });
    await page.mouse.up();
    expect(await place(page)).toEqual(['120', '100']);
    expect(await page.evaluate(() => (window as any).heard)).toEqual([]);
    expect(await page.evaluate(() => getSelection()!.toString())).not.toMatch(/Start|description/);
  });
}

test('with text already selected on the page, a drag from the header still moves the node and starts no native drag', async ({ page }) => {
  await page.evaluate(() => {
    (window as any).heard = [];
    // A dragstart that is cancelled starts no drag.
    document.addEventListener('dragstart', (e) => { if (!e.defaultPrevented) (window as any).heard.push('dragstart'); });
    getSelection()!.selectAllChildren(document.body);
  });
  const [x, y] = await at(page, '.title');
  await page.mouse.move(x, y);
  await page.mouse.down();
  await page.mouse.move(x + 40, y + 20, { steps: 4 });
  await page.mouse.move(x + 80, y + 40, { steps: 4 });
  await page.mouse.up();
  expect(await place(page)).toEqual(['120', '100']);
  expect(await page.evaluate(() => (window as any).heard.length)).toBe(0);
});

test('the grip shows on hover and on focus, and the header does not change size', async ({ page }) => {
  const read = () => page.evaluate(() => {
    const root = document.querySelector('#a')!.shadowRoot!;
    const h = root.querySelector('.header')!.getBoundingClientRect();
    const g = root.querySelector('.grip')!;
    return { box: [h.width, h.height], visibility: getComputedStyle(g).visibility, size: g.getBoundingClientRect().width, drawn: g.querySelector('svg') !== null };
  });
  const bare = await read();
  expect(bare.visibility).toBe('hidden');
  expect(bare.drawn).toBe(true);
  const [x, y] = await at(page, 'empty');
  await page.mouse.move(x - 40, y);
  const hovered = await read();
  expect(hovered.visibility).toBe('visible');
  expect(hovered.box).toEqual(bare.box);
  await page.mouse.move(5, 5);
  await page.evaluate(() => (document.querySelector('#a')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const focused = await read();
  expect(focused.visibility).toBe('visible');
  expect(focused.box).toEqual(bare.box);
});

test('the grip is a tab on the header\'s left edge, as tall as it, outside it, its glyph turned a quarter; the header is still the handle', async ({ page }) => {
  const read = () => page.evaluate(() => {
    const root = document.querySelector('#a')!.shadowRoot!;
    const h = root.querySelector('.header')!;
    const [hr, gr] = [h.getBoundingClientRect(), root.querySelector('.grip')!.getBoundingClientRect()];
    const svg = root.querySelector('.grip svg')!;
    return {
      right: Math.round(gr.right - hr.left), top: Math.round(gr.top - hr.top), height: Math.round(gr.height - hr.height), wide: gr.width > 8,
      turned: getComputedStyle(svg).rotate, handle: [h.getAttribute('role'), h.getAttribute('aria-roledescription'), root.querySelector('.grip')!.getAttribute('aria-hidden')],
      box: [hr.width, hr.height],
    };
  });
  const bare = await read();
  // Its right edge is the header's left, its top the header's, its height the header's: a tab on the edge, outside the box.
  expect(bare).toMatchObject({ right: 0, top: 0, height: 0, wide: true, turned: '90deg', handle: ['button', 'node', 'true'] });
  const [x, y] = await at(page, 'empty');
  await page.mouse.move(x - 40, y);
  expect((await read()).box).toEqual(bare.box);
  // Pixels: the tab is drawn when the pointer is over the header, a tinted box at the left of the header.
  const box = (await page.locator('#a').locator('.grip').boundingBox())!;
  const header = (await page.locator('#a').locator('.header[role="button"]').boundingBox())!;
  expect(box.x + box.width).toBeLessThanOrEqual(header.x + 1);
  // A press on the header, and the arrows, still move the node.
  await page.locator('#a').locator('.header[role="button"]').focus();
  const before = await place(page);
  await page.keyboard.press('ArrowRight');
  expect(await place(page)).not.toEqual(before);
});
