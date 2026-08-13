import { test, expect } from '@playwright/test';

/**
 * sherpa-input-password on the reforged base — a password variation of input-text.
 * Exercises the value property, the show/hide toggle flipping the inner input
 * type + aria-pressed + aria-label, the `visible` property, event re-dispatch,
 * native attribute mirroring, and disabled inactive tokens.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('value property reads and writes the inner control; starts masked', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-password') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    el.setAttribute('value', 's3cret');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const readInitial = el.value;
    el.value = 'newpass';
    return { readInitial, controlAfter: control.value, type: control.type };
  });
  expect(r.readInitial).toBe('s3cret');
  expect(r.controlAfter).toBe('newpass');
  expect(r.type).toBe('password');
});

test('toggle flips input type + aria-pressed + aria-label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-password') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const toggle = el.shadowRoot!.querySelector<HTMLButtonElement>('.toggle')!;

    const before = {
      type: control.type,
      pressed: toggle.getAttribute('aria-pressed'),
      label: toggle.getAttribute('aria-label'),
    };
    toggle.click();
    const shown = {
      type: control.type,
      pressed: toggle.getAttribute('aria-pressed'),
      label: toggle.getAttribute('aria-label'),
    };
    toggle.click();
    const hiddenAgain = { type: control.type, pressed: toggle.getAttribute('aria-pressed') };
    return { before, shown, hiddenAgain };
  });
  expect(r.before).toEqual({ type: 'password', pressed: 'false', label: 'Show password' });
  expect(r.shown).toEqual({ type: 'text', pressed: 'true', label: 'Hide password' });
  expect(r.hiddenAgain).toEqual({ type: 'password', pressed: 'false' });
});

test('visible property drives the toggle state', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-password') as HTMLElement & {
      rendered?: Promise<void>;
      visible?: boolean;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    el.visible = true;
    const shown = { type: control.type, visible: el.visible };
    el.visible = false;
    const hidden = { type: control.type, visible: el.visible };
    return { shown, hidden };
  });
  expect(r.shown).toEqual({ type: 'text', visible: true });
  expect(r.hidden).toEqual({ type: 'password', visible: false });
});

test('re-dispatches input/change with the value in detail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-password') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('input', (e) => events.push({ type: 'input', value: (e as CustomEvent).detail.value }));
    el.addEventListener('change', (e) => events.push({ type: 'change', value: (e as CustomEvent).detail.value }));
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = 'typed';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return events;
  });
  expect(r).toEqual([
    { type: 'input', value: 'typed' },
    { type: 'change', value: 'typed' },
  ]);
});

test('disabled mirrors to the control and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-password') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
