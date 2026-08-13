import { test, expect } from '@playwright/test';

/**
 * sherpa-input-date on the reforged base — a labelled date field wrapping a native
 * <input type="date">. Exercises label/description text sync, the value property,
 * native type + attribute mirroring (data-min/data-max → min/max), disabled inactive
 * tokens, and change event re-dispatch.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type DateEl = HTMLElement & { rendered?: Promise<void>; value?: string };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-input-date/sherpa-input-date.js');
    await customElements.whenDefined('sherpa-input-date');
  });
});

test('wraps a native <input type="date"> and mirrors label/description', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date') as DateEl;
    el.setAttribute('data-label', 'Start date');
    el.setAttribute('data-description', 'When the project begins.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      type: s.querySelector<HTMLInputElement>('.control')!.type,
      label: s.querySelector('.label')!.textContent,
      description: s.querySelector('.description')!.textContent,
    };
  });
  expect(r.type).toBe('date');
  expect(r.label).toBe('Start date');
  expect(r.description).toBe('When the project begins.');
});

test('value property reads and writes the inner control', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date') as DateEl;
    el.setAttribute('value', '2026-08-13');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const readInitial = el.value;
    el.value = '2027-01-01';
    return { readInitial, controlAfter: control.value };
  });
  expect(r.readInitial).toBe('2026-08-13');
  expect(r.controlAfter).toBe('2027-01-01');
});

test('data-min / data-max mirror to native min / max on the control', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date') as DateEl;
    el.setAttribute('data-min', '2026-01-01');
    el.setAttribute('data-max', '2026-12-31');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { min: control.min, max: control.max };
  });
  expect(r.min).toBe('2026-01-01');
  expect(r.max).toBe('2026-12-31');
});

test('re-dispatches change with the value in detail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date') as DateEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('change', (e) => events.push({ type: 'change', value: (e as CustomEvent).detail.value }));
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '2026-08-13';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return events;
  });
  expect(r).toEqual([{ type: 'change', value: '2026-08-13' }]);
});

test('disabled mirrors to the control and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-date') as DateEl;
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
