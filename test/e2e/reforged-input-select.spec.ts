import { test, expect } from '@playwright/test';

/**
 * sherpa-input-select on the reforged base — a labelled native <select>. Exercises
 * label/description sync, option stamping via populate(), the value property, the
 * change re-dispatch, and the disabled path (inactive tokens, not opacity).
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() => customElements.whenDefined('sherpa-input-select'));
});

test('label + description are mirrored into the field', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Country');
    el.setAttribute('data-description', 'Where you live.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      label: s.querySelector('.label')!.textContent,
      description: s.querySelector('.description')!.textContent,
    };
  });
  expect(r.label).toBe('Country');
  expect(r.description).toBe('Where you live.');
});

test('populate() stamps options; selected + disabled honoured', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      value?: string;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { value: 'us', label: 'United States' },
      { value: 'ca', label: 'Canada', selected: true },
      { value: 'zz', label: 'Nowhere', disabled: true },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const opts = Array.from(el.shadowRoot!.querySelectorAll('option'));
    return {
      count: opts.length,
      labels: opts.map((o) => o.textContent),
      value: el.value,
      disabledOne: (opts[2] as HTMLOptionElement).disabled,
    };
  });
  expect(r.count).toBe(3);
  expect(r.labels).toEqual(['United States', 'Canada', 'Nowhere']);
  expect(r.value).toBe('ca'); // the selected option
  expect(r.disabledOne).toBe(true);
});

test('value property reads and writes the inner select', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      value?: string;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ value: 'a' }, { value: 'b' }, { value: 'c' }]);
    await new Promise((res) => setTimeout(res, 20));
    const initial = el.value;
    el.value = 'c';
    const control = el.shadowRoot!.querySelector<HTMLSelectElement>('.control')!;
    return { initial, controlAfter: control.value };
  });
  expect(r.initial).toBe('a'); // first option
  expect(r.controlAfter).toBe('c');
});

test('change on the inner select re-dispatches with the value in detail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ value: 'x' }, { value: 'y' }]);
    await new Promise((res) => setTimeout(res, 20));

    let detail: unknown = null;
    el.addEventListener('change', (e) => (detail = (e as CustomEvent).detail));
    const control = el.shadowRoot!.querySelector<HTMLSelectElement>('.control')!;
    control.value = 'y';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return detail;
  });
  expect(r).toEqual({ value: 'y' });
});

test('disabled mirrors to the select and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLSelectElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
