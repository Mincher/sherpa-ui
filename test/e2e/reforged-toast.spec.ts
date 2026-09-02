import { test, expect } from '@playwright/test';

/**
 * sherpa-toast on the reforged base — a transient notification. Exercises the
 * message + status render, the manual close path (toast-dismiss + removal), the
 * auto-dismiss timer, and the static factory helpers.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => customElements.whenDefined('sherpa-toast'));
});

test('renders the message and reflects the status', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-status', 'success');
    el.setAttribute('data-message', 'Saved.');
    el.setAttribute('data-duration', '0'); // no auto-dismiss during the assert
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      message: el.shadowRoot!.querySelector('.message')!.textContent,
      status: el.getAttribute('data-status'),
    };
  });
  expect(r.message).toBe('Saved.');
  expect(r.status).toBe('success');
});

test('the close button fires toast-dismiss and removes the toast', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-message', 'Close me');
    el.setAttribute('data-duration', '0');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let dismissed = 0;
    el.addEventListener('toast-dismiss', () => dismissed++);
    el.shadowRoot!.querySelector<HTMLElement>('.close')!.click();

    return { dismissed, connected: el.isConnected };
  });
  expect(r.dismissed).toBe(1);
  expect(r.connected).toBe(false);
});

test('auto-dismisses after data-duration and fires toast-dismiss', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-toast') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-message', 'Bye');
    el.setAttribute('data-duration', '60');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const dismissed = await new Promise<boolean>((resolve) => {
      el.addEventListener('toast-dismiss', () => resolve(true));
      setTimeout(() => resolve(false), 1000);
    });
    return { dismissed, connected: el.isConnected };
  });
  expect(r.dismissed).toBe(true);
  expect(r.connected).toBe(false);
});

test('static helper creates, appends, and returns a toast', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mod = await import('/dist/components/sherpa-toast/sherpa-toast.js');
    const SherpaToast = (mod as { SherpaToast: { critical(m: string, o?: { duration?: number }): HTMLElement } }).SherpaToast;
    const toast = SherpaToast.critical('Boom', { duration: 0 }) as HTMLElement & { rendered?: Promise<void> };
    await toast.rendered;
    return {
      inBody: toast.parentElement === document.body,
      status: toast.getAttribute('data-status'),
      message: toast.shadowRoot!.querySelector('.message')!.textContent,
    };
  });
  expect(r.inBody).toBe(true);
  expect(r.status).toBe('critical');
  expect(r.message).toBe('Boom');
});
