import { test, expect } from '@playwright/test';

/**
 * A NUMBER INPUT IS SHERPA'S OWN — TODO 127. It came back native once.
 *
 * `sherpa-input-text data-type="number"`: right-aligned, "Enter a value" when
 * empty, and two composed sherpa-buttons in place of the native spinner. A
 * filter's number body is that field, never a bare <input type="number">.
 *
 * TRAP T-a-number-input-wears-sherpas-steppers
 */
const HARNESS = '/test/reforged/harness.html';

type Field = HTMLElement & { rendered?: Promise<void>; value: string };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('a number field is right-aligned, says "Enter a value", and hides the native spinner', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-text') as Field;
    el.setAttribute('data-type', 'number');
    el.setAttribute('data-label', 'Seats');
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const style = getComputedStyle(control);
    const own = { type: control.type, placeholder: control.placeholder, align: style.textAlign, appearance: style.appearance };
    // A page's own words win.
    el.setAttribute('placeholder', 'Any');
    return { own, given: control.placeholder };
  });
  expect(r.own.type).toBe('number');
  expect(r.own.placeholder).toBe('Enter a value');
  expect(['end', 'right']).toContain(r.own.align);
  expect(r.own.appearance).toBe('textfield');
  expect(r.given).toBe('Any');
});

test('its steppers are sherpa-buttons: they step by `step`, stop at the bounds, and report a change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-text') as Field;
    el.setAttribute('data-type', 'number');
    el.setAttribute('aria-label', 'Seats');
    el.setAttribute('min', '0');
    el.setAttribute('max', '10');
    el.setAttribute('step', '5');
    el.setAttribute('value', '5');
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const steps = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.steppers sherpa-button')];
    const press = (i: number) => steps[i]!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    const seen: string[] = [];
    el.addEventListener('change', (e) => seen.push((e as CustomEvent).detail?.value));
    press(0);
    const up = el.value;
    press(0);
    const atMax = el.value;
    press(1);
    press(1);
    press(1);
    return {
      icons: steps.map((s) => s.getAttribute('data-icon-start')),
      names: steps.map((s) => s.shadowRoot!.querySelector('.trigger')!.getAttribute('aria-label')),
      // Out of the tab order: the arrow keys in the field do the same.
      tab: steps.map((s) => s.shadowRoot!.querySelector('.trigger')!.getAttribute('tabindex')),
      up, atMax, down: el.value, seen: seen.filter(Boolean),
    };
  });
  expect(r.icons).toEqual(['chevron-up', 'chevron-down']);
  expect(r.names).toEqual(['Increase', 'Decrease']);
  expect(r.tab).toEqual(['-1', '-1']);
  expect(r.up).toBe('10');
  expect(r.atMax).toBe('10');
  expect(r.down).toBe('0');
  expect(r.seen).toEqual(['10', '5', '0']);
});

test('a filter menu\'s number body is that field, with no bare native input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const menu = document.createElement('sherpa-menu') as HTMLElement & { rendered?: Promise<void> };
    menu.setAttribute('data-body', 'number');
    menu.setAttribute('data-min', '0');
    menu.setAttribute('data-max', '500');
    document.getElementById('root')!.appendChild(menu);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const field = menu.shadowRoot!.querySelector<Field>('.body-number-one')!;
    const control = field.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    return {
      tag: field.localName,
      type: field.getAttribute('data-type'),
      placeholder: control.placeholder,
      max: control.max,
      steppers: field.shadowRoot!.querySelectorAll('.steppers sherpa-button').length,
      bare: menu.shadowRoot!.querySelectorAll('input[type="number"]').length,
    };
  });
  expect(r).toEqual({ tag: 'sherpa-input-text', type: 'number', placeholder: 'Enter a value', max: '500', steppers: 2, bare: 0 });
});

test('a stepper with nowhere to go is inactive: Increase at max, Decrease at min', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-text') as Field;
    el.setAttribute('data-type', 'number');
    el.setAttribute('aria-label', 'Seats');
    el.setAttribute('min', '0');
    el.setAttribute('max', '10');
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const off = (): boolean[] => [...el.shadowRoot!.querySelectorAll('.steppers sherpa-button')].map((s) => s.hasAttribute('disabled'));
    const empty = off();
    el.value = '0';
    const atMin = off();
    el.value = '5';
    const between = off();
    // As a reader types it.
    const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '10';
    control.dispatchEvent(new Event('input', { bubbles: true }));
    const atMax = off();
    el.setAttribute('max', '20');
    const raised = off();
    el.setAttribute('disabled', '');
    return { empty, atMin, between, atMax, raised, disabled: off() };
  });
  // [Increase, Decrease]. An EMPTY field can step either way.
  expect(r).toEqual({
    empty: [false, false], atMin: [false, true], between: [false, false],
    atMax: [true, false], raised: [false, false], disabled: [true, true],
  });
});

test('a narrow number field narrows its steppers, so its digits show', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<div style="inline-size: 320px"><sherpa-input-text class="wide" data-type="number" aria-label="a" value="100000"></sherpa-input-text></div>'
      + '<div style="inline-size: 92px"><sherpa-input-text class="narrow" data-type="number" aria-label="b" value="1000" style="min-inline-size: 0"></sherpa-input-text></div>';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const read = (sel: string) => {
      const el = root.querySelector(sel)!;
      const control = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
      const step = el.shadowRoot!.querySelector('.steppers sherpa-button')!.shadowRoot!.querySelector('.trigger')!;
      return { step: Math.round(step.getBoundingClientRect().width), fits: control.scrollWidth <= control.clientWidth };
    };
    return { wide: read('.wide'), narrow: read('.narrow') };
  });
  expect(r.wide).toEqual({ step: 32, fits: true });
  expect(r.narrow.step).toBeLessThan(32);
  expect(r.narrow.fits).toBe(true);
});
