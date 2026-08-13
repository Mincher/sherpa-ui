import { test, expect } from '@playwright/test';

/**
 * sherpa-input-search on the reforged base — a search variation of input-text.
 * Exercises the value property, the [data-has-value] flag driving the clear
 * button's visibility, clear() firing input + search, the Enter-driven search
 * event, native attribute mirroring, and disabled inactive tokens.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('value property reads and writes the inner control', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-search') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    el.setAttribute('value', 'apples');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const readInitial = el.value;
    el.value = 'oranges';
    return { readInitial, controlAfter: control.value, type: control.type };
  });
  expect(r.readInitial).toBe('apples');
  expect(r.controlAfter).toBe('oranges');
  expect(r.type).toBe('search');
});

test('clear button appears only when there is a value; clear() empties + fires', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-search') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const clear = el.shadowRoot!.querySelector<HTMLButtonElement>('.clear')!;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const hiddenWhenEmpty = getComputedStyle(clear).display;

    control.value = 'query';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    const shownWhenValue = getComputedStyle(clear).display;

    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('input', (e) => events.push({ type: 'input', value: (e as CustomEvent).detail.value }));
    el.addEventListener('search', (e) => events.push({ type: 'search', value: (e as CustomEvent).detail.value }));

    clear.click();
    return { hiddenWhenEmpty, shownWhenValue, valueAfter: control.value, events };
  });
  expect(r.hiddenWhenEmpty).toBe('none');
  expect(r.shownWhenValue).not.toBe('none');
  expect(r.valueAfter).toBe('');
  expect(r.events).toEqual([
    { type: 'input', value: '' },
    { type: 'search', value: '' },
  ]);
});

test('input emits input; Enter emits search', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-search') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('input', (e) => events.push({ type: 'input', value: (e as CustomEvent).detail.value }));
    el.addEventListener('search', (e) => events.push({ type: 'search', value: (e as CustomEvent).detail.value }));

    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = 'find me';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    return events;
  });
  expect(r).toEqual([
    { type: 'input', value: 'find me' },
    { type: 'search', value: 'find me' },
  ]);
});

test('label + placeholder are mirrored into the field', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-search') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-label', 'Search');
    el.setAttribute('placeholder', 'Filter…');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      label: s.querySelector('.label')!.textContent,
      placeholder: s.querySelector<HTMLInputElement>('.control')!.placeholder,
    };
  });
  expect(r.label).toBe('Search');
  expect(r.placeholder).toBe('Filter…');
});

test('disabled mirrors to the control and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-search') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
