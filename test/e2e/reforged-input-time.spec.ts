import { test, expect } from '@playwright/test';

/**
 * sherpa-input-time on the reforged base — a labelled time field wrapping a native
 * <input type="time">. Exercises label text sync, the value property, native type +
 * attribute mirroring (data-min/data-max/data-step → min/max/step), disabled inactive
 * tokens, and change event re-dispatch.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type TimeEl = HTMLElement & { rendered?: Promise<void>; value?: string };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-input-time/sherpa-input-time.js');
    await customElements.whenDefined('sherpa-input-time');
  });
});

test('wraps a native <input type="time"> and mirrors the label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-time') as TimeEl;
    el.setAttribute('data-label', 'Reminder at');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      type: s.querySelector<HTMLInputElement>('.control')!.type,
      label: s.querySelector('.label')!.textContent,
    };
  });
  expect(r.type).toBe('time');
  expect(r.label).toBe('Reminder at');
});

test('value property reads and writes the inner control', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-time') as TimeEl;
    el.setAttribute('value', '09:30');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const readInitial = el.value;
    el.value = '17:45';
    return { readInitial, controlAfter: control.value };
  });
  expect(r.readInitial).toBe('09:30');
  expect(r.controlAfter).toBe('17:45');
});

test('data-min / data-max / data-step mirror to native min / max / step', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-time') as TimeEl;
    el.setAttribute('data-min', '08:00');
    el.setAttribute('data-max', '18:00');
    el.setAttribute('data-step', '300');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { min: control.min, max: control.max, step: control.step };
  });
  expect(r.min).toBe('08:00');
  expect(r.max).toBe('18:00');
  expect(r.step).toBe('300');
});

test('re-dispatches change with the value in detail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-time') as TimeEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('change', (e) => events.push({ type: 'change', value: (e as CustomEvent).detail.value }));
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '14:15';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return events;
  });
  expect(r).toEqual([{ type: 'change', value: '14:15' }]);
});

test('disabled mirrors to the control and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-time') as TimeEl;
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
