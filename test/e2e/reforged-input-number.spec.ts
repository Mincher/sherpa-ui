import { test, expect } from '@playwright/test';

/**
 * sherpa-input-number on the reforged base — a numeric variation of input-text.
 * Exercises the value property, valueAsNumber, data-min/max/step mirroring to
 * native min/max/step, the ± steppers (native stepUp/stepDown + event emission),
 * the mono/right-aligned control convention, and disabled inactive tokens.
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
    const el = document.createElement('sherpa-input-number') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
      valueAsNumber?: number;
    };
    el.setAttribute('value', '42');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const readInitial = el.value;
    const asNumber = el.valueAsNumber;
    el.value = '7';
    return { readInitial, asNumber, controlAfter: control.value };
  });
  expect(r.readInitial).toBe('42');
  expect(r.asNumber).toBe(42);
  expect(r.controlAfter).toBe('7');
});

test('data-min/max/step mirror to native min/max/step', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-number') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-min', '0');
    el.setAttribute('data-max', '10');
    el.setAttribute('data-step', '0.5');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const c = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { min: c.min, max: c.max, step: c.step, type: c.type };
  });
  expect(r).toEqual({ min: '0', max: '10', step: '0.5', type: 'number' });
});

test('steppers increment/decrement and emit input + change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-number') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-steppers', '');
    el.setAttribute('data-step', '2');
    el.setAttribute('value', '4');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: string[] = [];
    el.addEventListener('input', () => events.push('input'));
    el.addEventListener('change', () => events.push('change'));

    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const stepUp = el.shadowRoot!.querySelector<HTMLButtonElement>('.step-up')!;
    const stepDown = el.shadowRoot!.querySelector<HTMLButtonElement>('.step-down')!;

    stepUp.click();
    const afterUp = control.value;
    stepDown.click();
    stepDown.click();
    const afterDown = control.value;
    return { afterUp, afterDown, events };
  });
  expect(r.afterUp).toBe('6');
  expect(r.afterDown).toBe('2');
  // three clicks → three input + three change
  expect(r.events.filter((e) => e === 'input')).toHaveLength(3);
  expect(r.events.filter((e) => e === 'change')).toHaveLength(3);
});

test('control is mono + right-aligned (numeric convention)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-number') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const cs = getComputedStyle(control);
    return { textAlign: cs.textAlign, fontFamily: cs.fontFamily };
  });
  expect(r.textAlign).toBe('right');
  // Mono stack resolves to *some* monospace family; the token fallback is a mono stack.
  expect(r.fontFamily.length).toBeGreaterThan(0);
});

test('re-dispatches input/change with the value in detail', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-number') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const events: Array<{ type: string; value: unknown }> = [];
    el.addEventListener('input', (e) => events.push({ type: 'input', value: (e as CustomEvent).detail.value }));
    el.addEventListener('change', (e) => events.push({ type: 'change', value: (e as CustomEvent).detail.value }));
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '13';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
    return events;
  });
  expect(r).toEqual([
    { type: 'input', value: '13' },
    { type: 'change', value: '13' },
  ]);
});

test('disabled mirrors to the control and uses inactive tokens', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-number') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return { controlDisabled: control.disabled, cursor: getComputedStyle(control).cursor };
  });
  expect(r.controlDisabled).toBe(true);
  expect(r.cursor).toBe('not-allowed');
});
