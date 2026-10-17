import { test, expect } from './fixture';

/**
 * A native <button class="sherpa-button"> wears the Button's look — the same
 * sheet the Button's own control wears — in a page and in a shadow root, and
 * takes the Button's pins: a look, a status beneath it, disabled.
 * TRAP T-a-native-wears-the-button-class
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true, {
    timeout: 15_000,
  });
  // A page links the look beside tokens.css.
  await page.evaluate(() => new Promise<void>((done) => {
    const link = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '/dist/styles/button.css' });
    link.onload = () => done();
    document.head.append(link);
  }));
});

/** Each case: a sherpa-button and a native, given the same attributes, in the same wrapper. */
const CASES: Array<{ name: string; attrs: Record<string, string>; wrap?: string }> = [
  { name: 'default', attrs: {} },
  { name: 'saturated', attrs: { 'data-look': 'saturated' } },
  { name: 'transparent', attrs: { 'data-look': 'transparent' } },
  { name: 'small', attrs: { 'data-size': 'sm' } },
  { name: 'saturated critical', attrs: { 'data-look': 'saturated', 'data-status': 'critical' } },
  { name: 'under a critical wrapper', attrs: {}, wrap: 'critical' },
  { name: 'pressed', attrs: { 'aria-pressed': 'true' } },
];

const PROPS = ['backgroundColor', 'color', 'borderTopColor', 'borderTopWidth', 'borderTopLeftRadius',
  'minHeight', 'fontSize', 'lineHeight', 'paddingLeft'] as const;

test('a native in the page draws as the Button does, in each look, size and state', async ({ page }) => {
  const r = await page.evaluate(async ({ cases, props }) => {
    const root = document.getElementById('root')!;
    const out: Record<string, { button: Record<string, string>; native: Record<string, string> }> = {};
    for (const c of cases) {
      root.replaceChildren();
      const box = document.createElement('div');
      if (c.wrap) box.dataset['status'] = c.wrap;
      const button = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
      const native = document.createElement('button');
      native.className = 'sherpa-button';
      for (const [k, v] of Object.entries(c.attrs)) {
        button.setAttribute(k, v);
        native.setAttribute(k, v);
      }
      button.textContent = native.textContent = 'Save';
      box.append(button, native);
      root.append(box);
      await button.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const read = (el: Element) => {
        const cs = getComputedStyle(el) as unknown as Record<string, string>;
        return Object.fromEntries(props.map((p) => [p, cs[p]!]));
      };
      out[c.name] = { button: read(button.shadowRoot!.querySelector('.trigger')!), native: read(native) };
    }
    return out;
  }, { cases: CASES, props: [...PROPS] });
  for (const c of CASES) expect(r[c.name]!.native, c.name).toEqual(r[c.name]!.button);
  // The status took: a saturated critical is not a saturated default.
  expect(r['saturated critical']!.native.backgroundColor).not.toBe(r['saturated']!.native.backgroundColor);
});

test('a native in a disabled fieldset is inactive, as a disabled Button is', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const button = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    button.setAttribute('disabled', '');
    button.textContent = 'Save';
    const set = document.createElement('fieldset');
    set.disabled = true;
    const native = Object.assign(document.createElement('button'), { className: 'sherpa-button', textContent: 'Save' });
    set.append(native);
    root.replaceChildren(button, set);
    await button.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const read = (el: Element) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, ink: cs.color, cursor: cs.cursor, events: cs.pointerEvents };
    };
    return { button: read(button.shadowRoot!.querySelector('.trigger')!), native: read(native) };
  });
  expect(r.native).toEqual(r.button);
  expect(r.native.cursor).toBe('not-allowed');
});

test('a native inside a shadow root wears the look too, its size and look included', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const host = document.createElement('sherpa-container') as HTMLElement & { rendered?: Promise<void> };
    const button = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    button.setAttribute('data-look', 'saturated');
    button.setAttribute('data-size', 'sm');
    button.textContent = 'Save';
    root.replaceChildren(host, button);
    await host.rendered;
    await button.rendered;
    const native = Object.assign(document.createElement('button'), { className: 'sherpa-button', textContent: 'Save' });
    native.setAttribute('data-look', 'saturated');
    native.setAttribute('data-size', 'sm');
    host.shadowRoot!.append(native);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const read = (el: Element) => {
      const cs = getComputedStyle(el);
      return { bg: cs.backgroundColor, ink: cs.color, height: cs.minHeight, font: cs.fontSize, pad: cs.paddingLeft };
    };
    return { button: read(button.shadowRoot!.querySelector('.trigger')!), native: read(native) };
  });
  expect(r.native).toEqual(r.button);
});
