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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return count;
  });
  expect(fired).toBe(1);
});

test('the card has a MINIMUM width, so a short form does not shrink it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-dialog') as HTMLElement & {
      rendered?: Promise<void>; show?: () => void;
    };
    el.setAttribute('data-heading', 'Add customer');
    // Two narrow fields — the exact case that used to draw a 176px card.
    el.innerHTML = '<div>a</div><div>b</div>';
    root.appendChild(el);
    await el.rendered;
    el.show?.();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const card = el.shadowRoot!.querySelector('.root') as HTMLElement;
    return { w: Math.round(card.getBoundingClientRect().width), viewport: window.innerWidth };
  });
  // 24rem = 384px, or 92vw on a narrow screen. The example app used to prop this
  // up from the outside with `min-width: 380px` on its own form div — which meant
  // every app had to know to do it.
  expect(r.w).toBeGreaterThanOrEqual(Math.min(384, Math.round(r.viewport * 0.92)) - 1);
});

test('the card still has a MAXIMUM, so a long form does not fill the screen', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '';
    const el = document.createElement('sherpa-dialog') as HTMLElement & {
      rendered?: Promise<void>; show?: () => void;
    };
    el.innerHTML = '<div style="inline-size:3000px">very wide</div>';
    root.appendChild(el);
    await el.rendered;
    el.show?.();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const card = el.shadowRoot!.querySelector('.root') as HTMLElement;
    return { w: Math.round(card.getBoundingClientRect().width), viewport: window.innerWidth };
  });
  // 32rem = 512px, or 92vw.
  expect(r.w).toBeLessThanOrEqual(Math.min(512, Math.round(r.viewport * 0.92)) + 1);
});
