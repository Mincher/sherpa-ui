import { test, expect, type Page } from './harness';

/**
 * A node's header always moves it — Will, TODO 738. A drag that starts on the
 * header's icon, heading, description, empty area or padding moves the node by the
 * drag, selects no text and starts no native drag; the grip shows on hover and on
 * focus and moves nothing: an icon at the header's LEFT that takes no room while hidden and nudges the heading
 * right when it shows (TODO 849). Each by real pointer events.
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

test('the grip shows on hover and on focus, at the header\'s left, and nudges the heading right', async ({ page }) => {
  const read = () => page.evaluate(() => {
    const root = document.querySelector('#a')!.shadowRoot!;
    const h = root.querySelector('.header')!.getBoundingClientRect();
    const g = root.querySelector('.grip')!;
    const t = root.querySelector('.heading')!.getBoundingClientRect();
    return { box: [h.width, h.height], display: getComputedStyle(g).display, drawn: g.querySelector('svg') !== null, headingX: Math.round(t.x - h.x), gripX: Math.round(g.getBoundingClientRect().x - h.x) };
  });
  const bare = await read();
  expect(bare.display).toBe('none');
  expect(bare.drawn).toBe(true);
  const [x, y] = await at(page, 'empty');
  await page.mouse.move(x - 40, y);
  const hovered = await read();
  expect(hovered.display).toBe('flex');
  // The header is the same box; its heading moved right by the grip, which is the first thing in it.
  expect(hovered.box).toEqual(bare.box);
  expect(hovered.headingX).toBeGreaterThan(bare.headingX);
  expect(hovered.gripX).toBeLessThan(hovered.headingX);
  await page.mouse.move(5, 5);
  await page.evaluate(() => (document.querySelector('#a')!.shadowRoot!.querySelector('.header') as HTMLElement).focus());
  await page.keyboard.press('Tab');
  await page.keyboard.press('Shift+Tab');
  const focused = await read();
  expect(focused.display).toBe('flex');
  expect(focused.box).toEqual(bare.box);
});

test('the header is still the handle, and a press and the arrows move the node', async ({ page }) => {
  const handle = await page.evaluate(() => {
    const h = document.querySelector('#a')!.shadowRoot!.querySelector('.header')!;
    return [h.getAttribute('role'), h.getAttribute('aria-roledescription'), h.querySelector('.grip')!.getAttribute('aria-hidden')];
  });
  expect(handle).toEqual(['button', 'node', 'true']);
  await page.locator('#a').locator('.header[role="button"]').focus();
  const before = await place(page);
  await page.keyboard.press('ArrowRight');
  expect(await place(page)).not.toEqual(before);
});
