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

/**
 * SHUT AND OPENED AGAIN AT ONCE, it stays open. The native close event is
 * queued, so it lands after the second open — and it shut the dialog again.
 * The page's Save filter dialog, cancelled and reopened, hit this.
 * TRAP T-a-reopened-dialog-hears-a-late-close
 */
test('a dialog shut and opened again at once stays open', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-dialog') as DialogEl & { open: boolean };
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const heard: string[] = [];
    el.addEventListener('close', () => heard.push('close'));
    el.show!();
    el.close!();
    el.show!();
    await new Promise((res) => setTimeout(res, 100));
    const again = { open: el.open, attr: el.hasAttribute('open'), heard: [...heard] };
    el.close!();
    await new Promise((res) => setTimeout(res, 100));
    return { again, shut: { open: el.open, heard } };
  });
  // The close that was undone before it landed is not reported.
  expect(r.again).toEqual({ open: true, attr: true, heard: [] });
  expect(r.shut).toEqual({ open: false, heard: ['close'] });
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

test('data-type="overlay" opens NON-modal, fills its box, takes focus, and ESC closes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.cssText = 'position: relative; display: grid; inline-size: 600px; block-size: 400px';
    const el = document.createElement('sherpa-dialog') as DialogEl;
    el.dataset['type'] = 'overlay';
    el.innerHTML = '<p>settings</p>';
    box.appendChild(el);
    document.getElementById('root')!.appendChild(box);
    await el.rendered;
    const dialog = el.shadowRoot!.querySelector<HTMLDialogElement>('.root')!;
    const closedDisplay = getComputedStyle(el).display;

    el.show!();
    const rect = dialog.getBoundingClientRect();
    const opened = {
      modal: dialog.matches(':modal'),
      size: `${rect.width}x${rect.height}`,
      focusWithin: el.matches(':focus-within'),
    };
    let closeEvents = 0;
    el.addEventListener('close', () => { closeEvents += 1; });
    // The native `close` is QUEUED, so wait for it rather than a tick.
    const closed = new Promise((res) => { el.addEventListener('close', res, { once: true }); setTimeout(res, 1000); });
    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, composed: true }));
    await closed;
    return { closedDisplay, opened, afterEsc: el.open, closeEvents };
  });
  expect(r.closedDisplay).toBe('none');       // closed, it takes no room and blocks nothing
  expect(r.opened.modal).toBe(false);         // the page beside it stays live
  expect(r.opened.size).toBe('600x400');      // fills its container
  expect(r.opened.focusWithin).toBe(true);    // so ESC reaches it
  expect(r.afterEsc).toBe(false);
  expect(r.closeEvents).toBe(1);
});
