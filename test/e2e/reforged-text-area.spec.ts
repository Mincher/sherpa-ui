import { test, expect, type Page } from './harness';

/**
 * A TEXT AREA (Will, TODO 953): "They don't scroll. I don't see the focus or input cursor when they are clicked on either.
 * We need to make sure that we're using text areas correctly and not just making a sherpa-input taller." Every field
 * that takes more than one line wears one look, sherpa-text-area.css: it grows with its text from its fewest lines to its
 * most, then scrolls. A canvas leaves a plain wheel to a box that scrolls under it, and the Markdown editor keeps the
 * caret in view as code places it.
 */
const lines = (n: number): string => Array.from({ length: n }, (_, i) => `line ${i + 1}`).join('\n');

/** The text box's height, its scroll height and where it is scrolled to. */
const sized = (page: Page, host: string, part: string) => page.locator(host).evaluate((el, p) => {
  const box = el.shadowRoot!.querySelector<HTMLElement>(p)!;
  return { height: box.clientHeight, scroll: box.scrollHeight, top: box.scrollTop };
}, part);

test('a multiline input is a text area: four lines at rest, grows with its text to twenty, then scrolls', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-text') as HTMLElement & { rendered: Promise<void>; value: string };
    el.setAttribute('data-multiline', '');
    el.style.inlineSize = '320px';
    document.getElementById('root')!.append(el);
    await el.rendered;
  });
  const host = 'sherpa-input-text';
  expect((await sized(page, host, 'textarea')).height).toBe(80);
  // Padded all round, the text at the top: the row is the text's box.
  const row = await page.locator(host).evaluate((el) => {
    const s = getComputedStyle(el.shadowRoot!.querySelector('.control-row')!);
    return [s.paddingBlockStart, s.paddingBlockEnd, s.alignItems];
  });
  expect(row).toEqual(['8px', '8px', 'flex-start']);
  await page.locator(host).evaluate((el, text) => {
    const area = el.shadowRoot!.querySelector('textarea')!;
    area.value = text;
  }, lines(8));
  expect((await sized(page, host, 'textarea')).height).toBe(160);
  await page.locator(host).evaluate((el, text) => { el.shadowRoot!.querySelector('textarea')!.value = text; }, lines(40));
  const long = await sized(page, host, 'textarea');
  expect(long.height).toBe(400);
  expect(long.scroll).toBeGreaterThan(long.height);
});

test('the prompt composer grows from one line to eight by CSS alone, and writes no height', async ({ page }) => {
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-prompt-composer/sherpa-prompt-composer.js');
    const el = document.createElement('sherpa-prompt-composer') as HTMLElement & { rendered: Promise<void>; value: string };
    el.style.inlineSize = '480px';
    document.getElementById('root')!.append(el);
    await el.rendered;
  });
  const host = 'sherpa-prompt-composer';
  expect((await sized(page, host, '.input')).height).toBe(24);
  // The platform's own padding on a textarea, above and below its lines.
  const pad = await page.locator(host).evaluate((el) => {
    const s = getComputedStyle(el.shadowRoot!.querySelector('.input')!);
    return parseFloat(s.paddingBlockStart) + parseFloat(s.paddingBlockEnd);
  });
  await page.locator(host).evaluate((el, text) => { (el as HTMLElement & { value: string }).value = text; }, lines(3));
  expect((await sized(page, host, '.input')).height).toBe(60 + pad);
  await page.locator(host).evaluate((el, text) => { (el as HTMLElement & { value: string }).value = text; }, lines(20));
  const long = await sized(page, host, '.input');
  expect(long.height).toBe(160);
  expect(long.scroll).toBeGreaterThan(long.height);
  expect(await page.locator(host).evaluate((el) => el.shadowRoot!.querySelector<HTMLElement>('.input')!.style.height)).toBe('');
});

test('the Markdown editor keeps the caret in view as it types past its most lines', async ({ page }) => {
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-markdown-editor') as HTMLElement & { rendered: Promise<void> };
    el.style.inlineSize = '480px';
    document.getElementById('root')!.append(el);
    await el.rendered;
    await window.__settled();
  });
  await page.locator('sherpa-markdown-editor .content').click();
  for (let i = 0; i < 26; i++) {
    await page.keyboard.type(`line ${i + 1}`);
    await page.keyboard.press('Enter');
  }
  await page.keyboard.type('the end');
  const r = await page.locator('sherpa-markdown-editor').evaluate((el) => {
    const content = el.shadowRoot!.querySelector<HTMLElement>('.content')!;
    const caret = document.getSelection()!.getRangeAt(0).getBoundingClientRect();
    const box = content.getBoundingClientRect();
    return { height: content.clientHeight, top: content.scrollTop, inView: caret.bottom <= box.bottom + 1 && caret.top >= box.top - 1 };
  });
  expect(r.height).toBe(400);
  expect(r.top).toBeGreaterThan(0);
  expect(r.inView).toBe(true);
});

test('on a canvas, a plain wheel over a text that scrolls is the text\'s; elsewhere, and with Ctrl, it is the canvas\'s', async ({ page }) => {
  await page.evaluate(async (text) => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<textarea id="long" style="--x: 100px; --y: 80px; inline-size: 200px; block-size: 100px; overflow-y: auto"></textarea>'
      + '<textarea id="short" style="--x: 400px; --y: 80px; inline-size: 200px; block-size: 100px; overflow-y: auto">one line</textarea>';
    document.getElementById('root')!.append(el);
    await el.rendered;
    el.querySelector<HTMLTextAreaElement>('#long')!.value = text;
    await window.__settled();
  }, lines(40));
  const view = () => page.locator('sherpa-layout-canvas').evaluate((el) => JSON.stringify((el as HTMLElement & { view: unknown }).view));
  const top = () => page.locator('#long').evaluate((el) => el.scrollTop);
  const at = async (id: string) => { const b = (await page.locator(id).boundingBox())!; await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2); };

  const before = await view();
  await at('#long');
  await page.mouse.wheel(0, 200);
  await expect.poll(top).toBeGreaterThan(0);
  expect(await view()).toBe(before);

  // A text with nothing to scroll: the wheel pans the canvas.
  await at('#short');
  await page.mouse.wheel(0, 120);
  await expect.poll(view).not.toBe(before);

  // Ctrl and the wheel zoom the canvas, over a text too.
  const panned = await view();
  await at('#long');
  await page.keyboard.down('Control');
  await page.mouse.wheel(0, -100);
  await page.keyboard.up('Control');
  await expect.poll(view).not.toBe(panned);
});
