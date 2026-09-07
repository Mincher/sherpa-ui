import { test, expect } from '@playwright/test';

/**
 * sherpa-dialog on the reforged base — a modal surface on native <dialog>.
 * Proves show()/close() drive dialog.open + the reflected `open` attribute,
 * closing fires a composed `close`, and the header/body/footer regions render.
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
});

test('show() opens the modal and reflects open; close() closes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.setAttribute('data-heading', 'Confirm');
    el.innerHTML = '<p>body</p><div slot="footer">actions</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const dialog = el.shadowRoot!.querySelector<HTMLDialogElement>('.root')!;

    el.show!();
    const opened = { prop: el.open, native: dialog.open, attr: el.hasAttribute('open') };
    el.close!();
    const closed = { prop: el.open, native: dialog.open, attr: el.hasAttribute('open') };

    return {
      opened,
      closed,
      heading: el.shadowRoot!.querySelector('.heading-text')!.textContent,
      footerVisible: getComputedStyle(el.shadowRoot!.querySelector('.footer')!).display !== 'none',
    };
  });
  expect(r.opened).toEqual({ prop: true, native: true, attr: true });
  expect(r.closed).toEqual({ prop: false, native: false, attr: false });
  expect(r.heading).toBe('Confirm');
  expect(r.footerVisible).toBe(true);
});

test('closing the dialog fires a composed close event', async ({ page }) => {
  const fired = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let count = 0;
    el.addEventListener('close', () => count++);
    el.show!();
    el.close!();
    // The native <dialog> close event is dispatched on a task — let it flush.
    await new Promise((res) => setTimeout(res, 20));
    return count;
  });
  expect(fired).toBe(1);
});
