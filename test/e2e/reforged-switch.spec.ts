import { test, expect } from '@playwright/test';

/**
 * sherpa-switch on the reforged base — a binary toggle backed by a real
 * <button role="switch">. Proves the default off state, click toggling with the
 * `change` event, the checked/state property API, the disabled inactive tokens,
 * aria-checked sync, and the simple pill variant hiding its label.
 */

const HARNESS = '/test/reforged/harness.html';

type SwitchEl = HTMLElement & {
  rendered?: Promise<void>;
  checked?: boolean;
  state?: string;
  disabled?: boolean;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('defaults to off and exposes a switch button', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const btn = el.shadowRoot!.querySelector('.track')!;
    return {
      state: el.getAttribute('data-state'),
      checked: el.checked,
      role: btn.getAttribute('role'),
      aria: btn.getAttribute('aria-checked'),
    };
  });
  expect(r.state).toBe('off');
  expect(r.checked).toBe(false);
  expect(r.role).toBe('switch');
  expect(r.aria).toBe('false');
});

test('clicking toggles state and fires change with { checked }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: boolean[] = [];
    el.addEventListener('change', (e) => events.push((e as CustomEvent).detail.checked));

    const btn = el.shadowRoot!.querySelector<HTMLElement>('.track')!;
    btn.click(); // → on
    const afterOn = { state: el.getAttribute('data-state'), aria: btn.getAttribute('aria-checked') };
    btn.click(); // → off
    const afterOff = { state: el.getAttribute('data-state'), aria: btn.getAttribute('aria-checked') };

    return { events, afterOn, afterOff };
  });
  expect(r.events).toEqual([true, false]);
  expect(r.afterOn).toEqual({ state: 'on', aria: 'true' });
  expect(r.afterOff).toEqual({ state: 'off', aria: 'false' });
});

test('checked/state property setters reflect to attribute + aria', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.checked = true;
    // Setter writes data-state; onChange mirrors aria (attributeChangedCallback is sync).
    const btn = el.shadowRoot!.querySelector('.track')!;
    return {
      state: el.getAttribute('data-state'),
      checkedGetter: el.checked,
      aria: btn.getAttribute('aria-checked'),
    };
  });
  expect(r.state).toBe('on');
  expect(r.checkedGetter).toBe(true);
  expect(r.aria).toBe('true');
});

test('the on state paints the success fill', async ({ page }) => {
  // Measure each state on its own fresh element — reading computed style twice on
  // the same node across a custom-property change hits a Chromium caching quirk.
  const r = await page.evaluate(async () => {
    const paint = async (on: boolean) => {
      const el = document.createElement('sherpa-switch') as SwitchEl;
      if (on) el.setAttribute('data-state', 'on');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return getComputedStyle(el.shadowRoot!.querySelector('.track')!).backgroundColor;
    };
    return { off: await paint(false), on: await paint(true) };
  });
  expect(r.on).toBe('rgb(0, 122, 69)'); // ON → theme-surface-success-3 (success-4 #007A45, strong green)
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
    const btn = el.shadowRoot!.querySelector<HTMLElement>('.track')!;
    btn.click();

    const cs = getComputedStyle(btn);
    return {
      state: el.getAttribute('data-state'),
      fired,
      bg: cs.backgroundColor,
      opacity: getComputedStyle(el).opacity,
    };
  });
  expect(r.state).toBe('off'); // no toggle while disabled
  expect(r.fired).toBe(0);
  expect(r.bg).toBe('rgb(179, 179, 195)'); // theme-surface-default-2 (neutral-3 #B3B3C3) inactive
  expect(r.opacity).toBe('1'); // disabled must not rely on opacity
});

test('simple variant hides the ON/OFF label', async ({ page }) => {
  const display = await page.evaluate(async () => {
    const el = document.createElement('sherpa-switch') as SwitchEl;
    el.setAttribute('data-style', 'simple');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.label')!).display;
  });
  expect(display).toBe('none');
});
