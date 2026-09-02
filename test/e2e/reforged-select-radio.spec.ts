import { test, expect } from '@playwright/test';

/**
 * sherpa-select-radio on the reforged base — a labelled radio wrapping a native
 * <input type="radio">. Exercises label/description sync, the checked / value
 * properties, native attribute mirroring (incl. name-based grouping), disabled
 * with inactive tokens (no opacity), the re-dispatched change event, and — the
 * core contract — that the input's native :checked state alone drives the visual
 * (a white face with a coloured inner dot), with no JS styling.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.waitForFunction(() => !!customElements.get('sherpa-select-radio'));
});

test('label + description are mirrored into the field', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-label', 'Standard shipping');
    el.setAttribute('data-description', '3–5 business days.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      label: s.querySelector('.label')!.textContent,
      description: s.querySelector('.description')!.textContent,
    };
  });
  expect(r.label).toBe('Standard shipping');
  expect(r.description).toBe('3–5 business days.');
});

test('checked property reflects to the host attr and the inner input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
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

test(':checked drives the visual — white face + coloured dot, no JS styling', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
      rendered?: Promise<void>;
      checked?: boolean;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;

    const dotBefore = getComputedStyle(input, '::after').content;
    el.checked = true;
    const face = getComputedStyle(input).backgroundColor;
    const dotAfter = getComputedStyle(input, '::after').content;
    const dotColor = getComputedStyle(input, '::after').backgroundColor;
    return { dotBefore, face, dotAfter, dotColor };
  });
  expect(r.dotBefore).toBe('none'); // no dot until :checked
  expect(r.face).toBe('rgb(255, 255, 255)'); // radio keeps a white face
  expect(r.dotAfter).not.toBe('none'); // ::after dot rendered on :checked
  expect(r.dotColor).toBe('rgb(59, 76, 205)'); // Saturated accent #3b4ccd (look-tier --_status-surface)
});

test('radios sharing a name group natively — selecting one deselects the other', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (value: string, checked = false) => {
      const el = document.createElement('sherpa-select-radio') as HTMLElement & {
        rendered?: Promise<void>;
        checked?: boolean;
      };
      el.setAttribute('name', 'ship');
      el.setAttribute('value', value);
      if (checked) el.setAttribute('checked', '');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return el;
    };
    const a = await mk('a', true);
    const b = await mk('b');
    const inputB = b.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const inputA = a.shadowRoot!.querySelector<HTMLInputElement>('.control')!;

    // The inner inputs share a name, but native radio grouping does NOT cross
    // shadow-DOM boundaries — the COMPONENT coordinates the group instead.
    const sameName = inputA.name === 'ship' && inputB.name === 'ship';

    inputB.checked = true; // user picks B
    inputB.dispatchEvent(new Event('change', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 0)); // let group coordination settle

    return {
      sameName,
      aChecked: (a as unknown as { checked: boolean }).checked, // component deselected A
      aInputChecked: inputA.checked,
      bChecked: (b as unknown as { checked: boolean }).checked,
    };
  });
  expect(r.sameName).toBe(true);
  expect(r.aChecked).toBe(false); // component-level grouping cleared A
  expect(r.aInputChecked).toBe(false);
  expect(r.bChecked).toBe(true);
});

test('change re-dispatches with { checked, value }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('value', 'express');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: Array<{ checked: boolean; value: string }> = [];
    el.addEventListener('change', (e) => events.push((e as CustomEvent).detail));

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    return { events, hostChecked: el.hasAttribute('checked') };
  });
  expect(r.events).toEqual([{ checked: true, value: 'express' }]);
  expect(r.hostChecked).toBe(true);
});

test('disabled mirrors to the input and uses inactive tokens (no opacity)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
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

test('value reflects through the property', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-select-radio') as HTMLElement & {
      rendered?: Promise<void>;
      value?: string;
    };
    el.setAttribute('value', 'one');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const def = { prop: el.value, input: input.value };
    el.value = 'two';
    return { def, after: { prop: el.value, input: input.value } };
  });
  expect(r.def).toEqual({ prop: 'one', input: 'one' });
  expect(r.after).toEqual({ prop: 'two', input: 'two' });
});
