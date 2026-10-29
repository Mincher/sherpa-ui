import { test, expect } from './harness';

/**
 * sherpa-tooltip — a hover/focus tooltip wrapping a trigger. Its bubble is the
 * SHARED tip every component uses: opened in the top layer by its root's
 * listeners, placed by CSS anchor positioning. TODO 364.
 * TRAP T-a-tooltip-is-always-in-the-top-layer
 */

test('mirrors data-text into the bubble, which is the shared tip', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-text', 'Delete this item');
    el.innerHTML = '<button>Trash</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bubble = el.shadowRoot!.querySelector<HTMLElement>('.bubble')!;
    return { text: bubble.textContent!.trim(), shared: bubble.matches('.sherpa-tip'), popover: bubble.popover };
  });
  expect(r).toEqual({ text: 'Delete this item', shared: true, popover: 'manual' });
});

test('the bubble is shut by default and opens in the top layer on hover and on keyboard focus', async ({ page }) => {
  await page.evaluate(async () => {
    const t = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    t.setAttribute('data-text', 'Hi there');
    t.innerHTML = '<button id="trig">Hover me</button>';
    document.getElementById('root')!.appendChild(t);
    await t.rendered;
  });
  const bubble = () => page.evaluate(() => {
    const b = document.querySelector('sherpa-tooltip')!.shadowRoot!.querySelector('.bubble') as HTMLElement;
    return { open: b.matches(':popover-open'), shown: getComputedStyle(b).display !== 'none', width: b.getBoundingClientRect().width };
  });
  expect(await bubble()).toMatchObject({ open: false, shown: false, width: 0 });
  await page.locator('#trig').hover();
  await expect.poll(bubble).toMatchObject({ open: true, shown: true });
  expect((await bubble()).width).toBeGreaterThan(0);
  await page.mouse.move(600, 400);
  await expect.poll(bubble).toMatchObject({ open: false });
  await page.locator('#trig').focus();
  await expect.poll(bubble).toMatchObject({ open: true, shown: true });
});

/** NOT CLIPPED: in a box with `overflow: hidden` it is drawn whole, above the box. */
test('a tooltip inside an overflow box shows whole, above the box', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<div id="clip" style="overflow:hidden;block-size:32px;inline-size:100px;margin:80px">'
      + '<sherpa-tooltip data-text="A tip longer than the box that holds it"><button id="trig">x</button></sherpa-tooltip></div>';
    await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
  await page.locator('#trig').hover();
  await expect.poll(() => page.evaluate(() => document.querySelector('sherpa-tooltip')!.shadowRoot!
    .querySelector('.bubble')!.matches(':popover-open'))).toBe(true);
  const r = await page.evaluate(() => {
    const box = document.querySelector('sherpa-tooltip')!.shadowRoot!.querySelector('.bubble')!.getBoundingClientRect();
    const clip = document.getElementById('clip')!.getBoundingClientRect();
    return { wider: box.width > clip.width, above: box.bottom <= clip.top };
  });
  expect(r).toEqual({ wider: true, above: true });
});

/** Its side: above by default and written nowhere (TODO 344); below when asked;
 *  and with no room above, another side. */
test('it opens above by default, below when asked, and elsewhere when its side has no room', async ({ page }) => {
  for (const [attr, top, want] of [['', 200, 'above'], [' data-placement=""', 200, 'above'],
    [' data-placement="bottom"', 200, 'below'], [' data-placement="top"', 2, 'not above']] as const) {
    await page.evaluate(async ([a, y]) => {
      document.getElementById('root')!.innerHTML = `<sherpa-tooltip data-text="A tip"${a} style="position:fixed;`
        + `inset-block-start:${y}px;inset-inline-start:200px"><button id="trig">x</button></sherpa-tooltip>`;
      await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
    }, [attr, top] as const);
    await page.locator('#trig').hover();
    await expect.poll(() => page.evaluate(() => document.querySelector('sherpa-tooltip')!.shadowRoot!
      .querySelector('.bubble')!.matches(':popover-open'))).toBe(true);
    const r = await page.evaluate(() => {
      const t = document.querySelector('sherpa-tooltip') as HTMLElement;
      const b = t.shadowRoot!.querySelector('.bubble')!.getBoundingClientRect();
      const trig = document.getElementById('trig')!.getBoundingClientRect();
      return { written: t.getAttribute('data-placement'), above: b.bottom <= trig.top + 1, below: b.top >= trig.bottom - 1 };
    });
    if (want === 'above') expect(r).toMatchObject({ above: true, written: attr ? '' : null });
    if (want === 'below') expect(r.below).toBe(true);
    if (want === 'not above') expect(r.above).toBe(false);
    await page.mouse.move(600, 400);
  }
});

test('text property reflects to data-text and the bubble; with no text it never shows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void>; text?: string };
    el.innerHTML = '<button id="trig">x</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.text = 'Set via property';
    await window.__settled();
    const said = { attr: el.getAttribute('data-text'), bubble: el.shadowRoot!.querySelector('.tip-text')!.textContent };
    el.text = '';
    await window.__settled();
    return { ...said, cleared: el.getAttribute('data-text') };
  });
  expect(r).toEqual({ attr: 'Set via property', bubble: 'Set via property', cleared: null });
  await page.locator('#trig').hover();
  await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res))));
  expect(await page.evaluate(() => getComputedStyle(document.querySelector('sherpa-tooltip')!.shadowRoot!
    .querySelector('.bubble')!).display)).toBe('none');
});
