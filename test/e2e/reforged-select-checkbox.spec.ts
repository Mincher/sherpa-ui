import { test, expect } from '@playwright/test';

/**
 * sherpa-select-checkbox on the reforged base — a labelled checkbox wrapping a
 * native <input type="checkbox">. Exercises label/description sync, the checked /
 * indeterminate / value properties, native attribute mirroring, disabled with
 * inactive tokens (no opacity), the re-dispatched change event, and — the core
 * contract — that the input's native :checked state alone drives the visual
 * (a filled box + checkmark), with no JS styling.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.waitForFunction(() => !!customElements.get('sherpa-select-checkbox'));
});

test('label + description are mirrored into the field', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'Accept terms');
    el.setAttribute('data-description', 'Required to continue.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      label: s.querySelector('.label')!.textContent,
      description: s.querySelector('.description')!.textContent,
    };
  });
  expect(r.label).toBe('Accept terms');
  expect(r.description).toBe('Required to continue.');
});

test('checked property reflects to the host attr and the inner input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
      checked?: boolean;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;

    const before = { prop: el.checked, input: input.checked };
    el.checked = true;
    const after = { prop: el.checked, input: input.checked, attr: el.hasAttribute('checked') };
    return { before, after };
  });
  expect(r.before).toEqual({ prop: false, input: false });
  expect(r.after).toEqual({ prop: true, input: true, attr: true });
});

test('initial checked attribute drives the inner input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('checked', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector<HTMLInputElement>('.control')!.checked;
  });
  expect(r).toBe(true);
});

test(':checked drives the visual — filled box + checkmark, no JS styling', async ({ page }) => {
  // Measure each state on its own fresh element (avoids the same-node computed
  // -style caching quirk); the checked one starts checked via the attribute.
  const r = await page.evaluate(async () => {
    const paint = async (checked: boolean) => {
      const el = document.createElement('sherpa-select-checkbox') as HTMLElement & { rendered?: Promise<void> };
      if (checked) el.setAttribute('checked', '');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
      return {
        bg: getComputedStyle(input).backgroundColor,
        mark: getComputedStyle(input, '::after').content,
      };
    };
    const off = await paint(false);
    const on = await paint(true);
    return { unchecked: off.bg, checked: on.bg, markContent: on.mark };
  });
  // Unchecked box is the white container surface; checked box is the primary fill.
  expect(r.unchecked).toBe('rgb(255, 255, 255)');
  expect(r.checked).toBe('rgb(60, 94, 221)'); // surface-control-primary #3c5edd
  expect(r.checked).not.toBe(r.unchecked);
  expect(r.markContent).not.toBe('none'); // ::after checkmark rendered
});

test('indeterminate property drives input.indeterminate + the dash visual', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
      indeterminate?: boolean;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;

    el.indeterminate = true;
    const bg = getComputedStyle(input).backgroundColor;
    const dash = getComputedStyle(input, '::after').content;
    return { indeterminate: input.indeterminate, bg, dash };
  });
  expect(r.indeterminate).toBe(true);
  expect(r.bg).toBe('rgb(60, 94, 221)'); // filled like checked
  expect(r.dash).not.toBe('none'); // ::after dash rendered
});

test('toggling the native input re-dispatches change with { checked, value }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('value', 'yes');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: Array<{ checked: boolean; value: string; indeterminate: boolean }> = [];
    el.addEventListener('change', (e) => events.push((e as CustomEvent).detail));

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));

    return { events, hostChecked: el.hasAttribute('checked') };
  });
  expect(r.events).toEqual([{ checked: true, value: 'yes', indeterminate: false }]);
  expect(r.hostChecked).toBe(true); // native change mirrored back to the host
});

test('disabled mirrors to the input and uses inactive tokens (no opacity)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('disabled', '');
    el.setAttribute('data-label', 'Nope');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const field = el.shadowRoot!.querySelector('.field')!;
    return {
      inputDisabled: input.disabled,
      fieldCursor: getComputedStyle(field).cursor,
      inputOpacity: getComputedStyle(input).opacity,
    };
  });
  expect(r.inputDisabled).toBe(true);
  expect(r.fieldCursor).toBe('not-allowed');
  expect(r.inputOpacity).toBe('1'); // inactive tokens, never opacity dimming
});

test('value defaults to "on" and reflects through the property', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const def = { prop: el.value, input: input.value };
    el.value = 'custom';
    return { def, after: { prop: el.value, input: input.value } };
  });
  expect(r.def).toEqual({ prop: 'on', input: 'on' });
  expect(r.after).toEqual({ prop: 'custom', input: 'custom' });
});
