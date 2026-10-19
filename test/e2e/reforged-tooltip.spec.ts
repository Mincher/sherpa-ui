import { test, expect } from './harness';

/**
 * sherpa-tooltip on the reforged base — a CSS-driven hover/focus tooltip. Show/hide
 * is pure CSS (:hover / :focus-within); JS only mirrors data-text into the bubble
 * and wires aria-describedby. Proves the bubble is hidden by default, revealed on
 * hover, carries the text, and sets the a11y association.
 */


test('mirrors data-text into the bubble and sets aria-describedby', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-text', 'Delete this item');
    el.innerHTML = '<button>Trash</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bubble = el.shadowRoot!.querySelector('.bubble')!;
    return {
      text: el.shadowRoot!.querySelector('.tip-text')!.textContent,
      describedby: el.getAttribute('aria-describedby'),
      bubbleId: bubble.id,
    };
  });
  expect(r.text).toBe('Delete this item');
  expect(r.describedby).toBeTruthy();
  expect(r.describedby).toBe(r.bubbleId); // association points at the bubble
});

test('the bubble is shut by default and opens in the top layer on hover', async ({ page }) => {
  await page.evaluate(async () => {
    const t = document.createElement('sherpa-tooltip') as HTMLElement & { rendered?: Promise<void> };
    t.setAttribute('data-text', 'Hi there');
    t.innerHTML = '<button id="trig">Hover me</button>';
    document.getElementById('root')!.appendChild(t);
    await t.rendered;
  });
  const bubble = () => page.evaluate(() => {
    const b = document.querySelector('sherpa-tooltip')!.shadowRoot!.querySelector('.bubble') as HTMLElement;
    const r = b.getBoundingClientRect();
    return { open: b.matches(':popover-open'), visibility: getComputedStyle(b).visibility, width: r.width };
  });
  expect(await bubble()).toMatchObject({ open: false, width: 0 });
  await page.locator('#trig').hover();
  await expect.poll(bubble).toMatchObject({ open: true, visibility: 'visible' });
  expect((await bubble()).width).toBeGreaterThan(0);
  await page.mouse.move(600, 400);
  await expect.poll(bubble).toMatchObject({ open: false });
});

/**
 * NOT CLIPPED: a tooltip in a box with `overflow: hidden` is drawn whole — the
 * bubble is in the top layer. It was a closed popover with no rule to open it,
 * so an ordinary tooltip never showed at all.
 * TRAP T-a-tooltip-is-always-in-the-top-layer
 */
test('a tooltip inside an overflow box shows whole, above the box', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<div id="clip" style="overflow:hidden;block-size:32px;inline-size:100px;margin:80px">'
      + '<sherpa-tooltip data-text="A tip longer than the box that holds it"><button id="trig">x</button></sherpa-tooltip></div>';
    await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
  await page.locator('#trig').hover();
  const r = await page.evaluate(() => {
    const b = document.querySelector('sherpa-tooltip')!.shadowRoot!.querySelector('.bubble') as HTMLElement;
    const box = b.getBoundingClientRect();
    const clip = document.getElementById('clip')!.getBoundingClientRect();
    return { open: b.matches(':popover-open'), wider: box.width > clip.width, above: box.bottom <= clip.top };
  });
  expect(r).toEqual({ open: true, wider: true, above: true });
});

test('it takes the opposite side when its own does not fit, and the arrow follows', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-tooltip data-text="Below, then" data-placement="top" style="position:fixed;inset-block-start:2px;inset-inline-start:200px">'
      + '<button id="trig">x</button></sherpa-tooltip>';
    await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
  });
  await page.locator('#trig').hover();
  const r = await page.evaluate(() => {
    const t = document.querySelector('sherpa-tooltip') as HTMLElement;
    const b = t.shadowRoot!.querySelector('.bubble')!.getBoundingClientRect();
    const trig = document.getElementById('trig')!.getBoundingClientRect();
    return { below: b.top >= trig.bottom, bottomState: t.matches(':state(side-bottom)'), topState: t.matches(':state(side-top)') };
  });
  expect(r).toEqual({ below: true, bottomState: true, topState: false });
});

/** The default is read, never written. TODO 344 */
test('with no data-placement, or an empty one, it opens on top and writes nothing', async ({ page }) => {
  for (const attr of ['', ' data-placement=""']) {
    await page.evaluate(async (a) => {
      document.getElementById('root')!.innerHTML = `<sherpa-tooltip data-text="Above"${a} style="position:fixed;inset-block-start:200px;inset-inline-start:200px"><button id="trig">x</button></sherpa-tooltip>`;
      await (document.querySelector('sherpa-tooltip') as HTMLElement & { rendered: Promise<void> }).rendered;
    }, attr);
    await page.locator('#trig').hover();
    await page.waitForFunction(() => document.querySelector('sherpa-tooltip')!.matches(':state(side-top), :state(side-bottom), :state(side-left), :state(side-right)'));
    const r = await page.evaluate(() => {
      const t = document.querySelector('sherpa-tooltip') as HTMLElement;
      const b = t.shadowRoot!.querySelector('.bubble')!.getBoundingClientRect();
      return { written: t.getAttribute('data-placement') || null, above: b.bottom <= document.getElementById('trig')!.getBoundingClientRect().top, top: t.matches(':state(side-top)') };
    });
    expect(r).toEqual({ written: null, above: true, top: true });
    await page.mouse.move(600, 400);
  }
});

test('text property reflects to data-text and the bubble', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tooltip') as HTMLElement & {
      rendered?: Promise<void>;
      text?: string;
    };
    el.innerHTML = '<button>x</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.text = 'Set via property';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      attr: el.getAttribute('data-text'),
      bubble: el.shadowRoot!.querySelector('.tip-text')!.textContent,
    };
  });
  expect(r.attr).toBe('Set via property');
  expect(r.bubble).toBe('Set via property');
});
