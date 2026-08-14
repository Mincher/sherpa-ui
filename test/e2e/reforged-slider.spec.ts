import { test, expect } from '@playwright/test';

/**
 * sherpa-slider on the reforged base — a single-value range control wrapping a
 * native <input type=range>. Proves min/max/step mirroring onto the input, the
 * value property + clamping, the value → fill-width bridge (via --_pct, NOT JS
 * styling), the input/change re-dispatch with a { value } detail, and disabled.
 */

const HARNESS = '/test/reforged/harness.html';

type SliderEl = HTMLElement & {
  rendered?: Promise<void>;
  value?: number;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-slider'));
});

test('mirrors min/max/step/value onto the native input and the --_pct fill', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '200');
    el.setAttribute('data-step', '5');
    el.setAttribute('data-value', '50');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    return {
      min: input.min,
      max: input.max,
      step: input.step,
      inputValue: input.value,
      value: el.value,
      pct: el.style.getPropertyValue('--_pct').trim(),
    };
  });
  expect(r.min).toBe('0');
  expect(r.max).toBe('200');
  expect(r.step).toBe('5');
  expect(r.inputValue).toBe('50');
  expect(r.value).toBe(50);
  expect(r.pct).toBe('25%'); // 50 of 0–200 → the JS→CSS-var geometry bridge
});

test('the value property clamps to min/max and reflects to --_pct', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-min', '10');
    el.setAttribute('data-max', '90');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.value = 1000; // over-max
    const over = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    el.value = -1000; // under-min
    const under = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    return { over, under };
  });
  expect(r.over).toEqual({ value: 90, pct: '100%' });
  expect(r.under).toEqual({ value: 10, pct: '0%' });
});

test('a native input event re-dispatches as input with { value }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '100');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: Array<{ type: string; value: number }> = [];
    el.addEventListener('input', (e) =>
      events.push({ type: 'input', value: (e as CustomEvent).detail.value }),
    );
    el.addEventListener('change', (e) =>
      events.push({ type: 'change', value: (e as CustomEvent).detail.value }),
    );

    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    input.value = '60';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 0));

    return {
      events,
      hostValue: el.value,
      pct: el.style.getPropertyValue('--_pct').trim(),
    };
  });
  expect(r.events).toEqual([
    { type: 'input', value: 60 },
    { type: 'change', value: 60 },
  ]);
  expect(r.hostValue).toBe(60);
  expect(r.pct).toBe('60%');
});

test('populate({ value }) sets the value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ value: 33 });
    await new Promise((res) => setTimeout(res, 10));
    return { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
  });
  expect(r.value).toBe(33);
  expect(r.pct).toBe('33%');
});

test('disabled reflects onto the input and is non-interactive', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-value', '20');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    return {
      inputDisabled: input.disabled,
      pointerEvents: getComputedStyle(input).pointerEvents,
    };
  });
  expect(r.inputDisabled).toBe(true);
  expect(r.pointerEvents).toBe('none');
});

test('data-show-value reveals an editable value input; typing updates the slider', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '100');
    el.setAttribute('data-value', '20');
    el.setAttribute('data-show-value', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const field = el.shadowRoot!.querySelector('.value-input') as HTMLInputElement;
    const visible = getComputedStyle(field).display !== 'none';
    const initial = field.value;

    let changed = -1;
    el.addEventListener('change', (e) => (changed = (e as CustomEvent).detail.value));
    field.value = '65';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 10));

    return { visible, initial, changed, hostValue: el.getAttribute('data-value'), pct: (el.style as CSSStyleDeclaration).getPropertyValue('--_pct') };
  });
  expect(r.visible).toBe(true);
  expect(r.initial).toBe('20'); // field mirrors the initial value
  expect(r.changed).toBe(65);   // typing + commit fires change with the new value
  expect(r.hostValue).toBe('65');
  expect(r.pct).toBe('65%');    // the fill bridge tracks the typed value
});

test('the value input clamps out-of-range entries to min/max on commit', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-min', '10');
    el.setAttribute('data-max', '50');
    el.setAttribute('data-value', '30');
    el.setAttribute('data-show-value', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const field = el.shadowRoot!.querySelector('.value-input') as HTMLInputElement;
    field.value = '999';
    field.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 10));
    return { fieldValue: field.value, hostValue: el.getAttribute('data-value') };
  });
  expect(r.fieldValue).toBe('50'); // snapped to max
  expect(r.hostValue).toBe('50');
});
