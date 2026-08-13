import { test, expect } from '@playwright/test';

/**
 * sherpa-dialog on the reforged base — a native <dialog> modal. Proves data-open
 * drives dialog.showModal()/close() and the open property, the close button and
 * close() method dismiss it, and dialog-open / dialog-close fire. The element must
 * be connected for showModal() to work (top-layer), so every case appends first.
 */

const HARNESS = '/test/reforged/harness.html';

type DialogEl = HTMLElement & {
  rendered?: Promise<void>;
  open?: boolean;
  show?: () => void;
  close?: () => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-dialog'));
});

test('data-open opens the native <dialog> and fires dialog-open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.setAttribute('data-label', 'Confirm');
    el.innerHTML = '<p>Body</p><div slot="footer">actions</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let opened = 0;
    el.addEventListener('dialog-open', () => opened++);

    el.setAttribute('data-open', '');
    await new Promise((res) => setTimeout(res, 10));

    const dialog = el.shadowRoot!.querySelector('dialog') as HTMLDialogElement;
    const title = el.shadowRoot!.querySelector('.title-text')!.textContent;
    return { nativeOpen: dialog.open, prop: el.open, opened, title };
  });
  expect(r.nativeOpen).toBe(true); // showModal() ran
  expect(r.prop).toBe(true); // open property reflects data-open
  expect(r.opened).toBe(1);
  expect(r.title).toBe('Confirm');
});

test('close() dismisses it and fires dialog-close, clearing data-open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.innerHTML = '<p>Body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.show!();
    await new Promise((res) => setTimeout(res, 10));

    let closed = 0;
    el.addEventListener('dialog-close', () => closed++);

    el.close!();
    await new Promise((res) => setTimeout(res, 10));

    const dialog = el.shadowRoot!.querySelector('dialog') as HTMLDialogElement;
    return { nativeOpen: dialog.open, hasAttr: el.hasAttribute('data-open'), closed };
  });
  expect(r.nativeOpen).toBe(false);
  expect(r.hasAttr).toBe(false); // native close reflected back to data-open
  expect(r.closed).toBe(1);
});

test('the close button dismisses the dialog', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.setAttribute('data-open', '');
    el.innerHTML = '<p>Body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 10));

    let closed = 0;
    el.addEventListener('dialog-close', () => closed++);

    el.shadowRoot!.querySelector<HTMLElement>('.close')!.click();
    await new Promise((res) => setTimeout(res, 10));

    const dialog = el.shadowRoot!.querySelector('dialog') as HTMLDialogElement;
    return { nativeOpen: dialog.open, closed };
  });
  expect(r.nativeOpen).toBe(false);
  expect(r.closed).toBe(1);
});

test('footer region collapses when the footer slot is empty', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-dialog') as DialogEl;
    bare.innerHTML = '<p>Body only</p>';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const full = document.createElement('sherpa-dialog') as DialogEl;
    full.innerHTML = '<p>Body</p><button slot="footer">OK</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: DialogEl) =>
      getComputedStyle(el.shadowRoot!.querySelector('.footer')!).display !== 'none';
    return {
      bareHasFooter: bare.hasAttribute('data-has-footer'),
      bareFooterVisible: vis(bare),
      fullHasFooter: full.hasAttribute('data-has-footer'),
      fullFooterVisible: vis(full),
    };
  });
  expect(r.bareHasFooter).toBe(false);
  expect(r.bareFooterVisible).toBe(false); // collapsed
  expect(r.fullHasFooter).toBe(true);
  expect(r.fullFooterVisible).toBe(true);
});
