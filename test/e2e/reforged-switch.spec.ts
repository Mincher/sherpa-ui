import { test, expect } from '@playwright/test';

/**
 * sherpa-switch on the reforged base — a binary toggle backed by a native
 * <input type="checkbox" role="switch"> inside a <label>. Proves the default off
 * state, native toggling (click / checked property) with the `change` event, the
 * checked property API, the disabled inactive tokens, and the simple pill variant
 * hiding its label.
 */

const HARNESS = '/test/reforged/harness.html';

type SwitchEl = HTMLElement & {
  rendered?: Promise<void>;
  checked?: boolean;
  disabled?: boolean;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('defaults to off and exposes a native switch input', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.input')!;
    return {
      checked: el.checked,
      inputChecked: input.checked,
      type: input.getAttribute('type'),
      role: input.getAttribute('role'),
    };
  });
  expect(r.checked).toBe(false);
  expect(r.inputChecked).toBe(false);
  expect(r.type).toBe('checkbox');
  expect(r.role).toBe('switch');
});

test('clicking the label toggles and fires change with { checked }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: boolean[] = [];
    el.addEventListener('change', (e) => events.push((e as CustomEvent).detail.checked));

    const label = el.shadowRoot!.querySelector<HTMLElement>('.track')!;
    label.click(); // → on (native label forwards the click to the input)
    const afterOn = el.checked;
    label.click(); // → off
    const afterOff = el.checked;

    return { events, afterOn, afterOff };
  });
  expect(r.events).toEqual([true, false]);
  expect(r.afterOn).toBe(true);
  expect(r.afterOff).toBe(false);
});

test('the checked property setter reflects to the input + attribute', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.checked = true;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.input')!;
    return {
      checkedGetter: el.checked,
      inputChecked: input.checked,
      attr: el.hasAttribute('checked'),
    };
  });
  expect(r.checkedGetter).toBe(true);
  expect(r.inputChecked).toBe(true);
  expect(r.attr).toBe(true);
});

test('the on state paints the success fill', async ({ page }) => {
  // Measure each state on its own fresh element — reading computed style twice on
  // the same node across a custom-property change hits a Chromium caching quirk.
  const r = await page.evaluate(async () => {
    const paint = async (on: boolean) => {
      const el = document.createElement('sherpa-switch') as SwitchEl;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      if (on) el.checked = true;
      return getComputedStyle(el.shadowRoot!.querySelector('.track')!).backgroundColor;
    };
    return { off: await paint(false), on: await paint(true) };
  });
  expect(r.on).toBe('rgb(0, 173, 98)'); // ON → theme-surface-success-3 (#00AD62, strong green)
  expect(r.off).not.toBe(r.on);
});

test('disabled blocks toggling and uses inactive tokens (never opacity)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = 0;
    el.addEventListener('change', () => fired++);
    const label = el.shadowRoot!.querySelector<HTMLElement>('.track')!;
    label.click(); // a disabled input can't be toggled by a click

    const cs = getComputedStyle(el.shadowRoot!.querySelector('.track')!);
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.input')!;
    return {
      checked: el.checked,
      inputDisabled: input.disabled,
      fired,
      bg: cs.backgroundColor,
      opacity: getComputedStyle(el).opacity,
    };
  });
  expect(r.checked).toBe(false); // no toggle while disabled
  expect(r.inputDisabled).toBe(true);
  expect(r.fired).toBe(0);
  expect(r.bg).toBe('rgb(179, 179, 195)'); // theme-surface-default-2 (neutral-3 #B3B3C3) inactive
  expect(r.opacity).toBe('1'); // disabled must not rely on opacity
});

test('simple variant hides the ON/OFF label', async ({ page }) => {
  const display = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    el.setAttribute('data-type', 'simple');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.label')!).display;
  });
  expect(display).toBe('none');
});

test('on swaps the knob and label sides, and back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const side = async (type: string | null, on: boolean) => {
      const el = document.createElement('sherpa-switch') as SwitchEl;
      if (type) el.setAttribute('data-type', type);
      el.style.setProperty('--sherpa-motion-fast', '0s');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.checked = on;
      const sr = el.shadowRoot!;
      const track = sr.querySelector('.track')!.getBoundingClientRect();
      const knob = sr.querySelector('.knob')!.getBoundingClientRect();
      const label = sr.querySelector('.label')!.getBoundingClientRect();
      return {
        knobAtEnd: track.right - knob.right < track.width / 4,
        labelFirst: label.width > 0 && label.left < knob.left,
      };
    };
    return {
      off: await side(null, false),
      on: await side(null, true),
      simpleOn: await side('simple', true),
    };
  });
  expect(r.off).toEqual({ knobAtEnd: false, labelFirst: false });
  expect(r.on).toEqual({ knobAtEnd: true, labelFirst: true });
  expect(r.simpleOn.knobAtEnd).toBe(true);
});

test('the ON / OFF text stays inside the track in every density', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const out: string[] = [];
    for (const density of ['compact', '', 'comfortable']) {
      if (density) document.documentElement.dataset['density'] = density;
      else delete document.documentElement.dataset['density'];
      for (const on of [false, true]) {
        const el = document.createElement('sherpa-switch') as SwitchEl;
        el.style.setProperty('--sherpa-motion-fast', '0s');
        document.getElementById('root')!.appendChild(el);
        await el.rendered;
        el.checked = on;
        const sr = el.shadowRoot!;
        const track = sr.querySelector<HTMLElement>('.track')!;
        const label = sr.querySelector<HTMLElement>('.label')!;
        const cs = getComputedStyle(track);
        const t = track.getBoundingClientRect();
        const l = label.getBoundingClientRect();
        const inStart = t.left + parseFloat(cs.borderLeftWidth) + parseFloat(cs.paddingLeft);
        const inEnd = t.right - parseFloat(cs.borderRightWidth) - parseFloat(cs.paddingRight);
        const inside = l.left >= inStart - 0.5 && l.right <= inEnd + 0.5;
        const fits = label.scrollWidth <= label.clientWidth;
        if (!inside || !fits) out.push(`${density || 'default'} ${on ? 'ON' : 'OFF'}`);
      }
    }
    delete document.documentElement.dataset['density'];
    return out;
  });
  expect(r, 'label outside the track, or its text clipped').toEqual([]);
});
