import { test, expect } from '@playwright/test';

/**
 * sherpa-overlay-panel on the reforged base — a NON-modal floating panel on
 * native <dialog>.show(). Proves show()/close() drive dialog.open + the
 * reflected `open` attribute, that the open dialog is non-modal (no ::backdrop
 * pseudo painted → the page stays interactive), and that closing fires a
 * composed `close`.
 */

const HARNESS = '/test/reforged/harness.html';

type PanelEl = HTMLElement & {
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

test('show() opens non-modally and reflects open; close() closes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.innerHTML = '<div slot="header">Filters</div><p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const dialog = el.shadowRoot!.querySelector<HTMLDialogElement>('.root')!;

    el.show!();
    // Non-modal: the dialog is open but NOT the top-layer modal, so
    // matches(':modal') is false (showModal would make it true).
    const opened = {
      prop: el.open,
      native: dialog.open,
      attr: el.hasAttribute('open'),
      modal: dialog.matches(':modal'),
    };
    el.close!();
    const closed = { prop: el.open, native: dialog.open, attr: el.hasAttribute('open') };
    return { opened, closed };
  });
  expect(r.opened.prop).toBe(true);
  expect(r.opened.native).toBe(true);
  expect(r.opened.attr).toBe(true);
  expect(r.opened.modal).toBe(false); // non-modal floating panel
  expect(r.closed).toEqual({ prop: false, native: false, attr: false });
});

test('closing the panel fires a composed close event', async ({ page }) => {
  const fired = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
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
