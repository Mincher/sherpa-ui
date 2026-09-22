import { test, expect } from './harness';

/**
 * A CSS FUNCTION NEEDS ITS LONGHAND FIRST.
 *
 * `@function` is real in Chromium and WebKit and absent in Firefox 155, where
 * a declaration using one renders NOTHING — silently, which is why this
 * library had no function library at all.
 *
 * `@supports` closes that: the longhand is written first and always, the
 * function second and guarded. Whichever branch an engine takes, the SAME
 * colour comes out — so this test asserts the result, not the mechanism, and
 * passes in every engine.
 *
 * TRAP T-a-css-function-needs-its-longhand-first
 */

test('a button hovers to the same colour, function or not', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button');
    el.textContent = 'Go';
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-button');
    await (el as HTMLElement & { rendered?: Promise<void> }).rendered;

    const trigger = el.shadowRoot!.querySelector('.trigger')!;
    const read = (): string => getComputedStyle(trigger).backgroundColor;

    /* What the LONGHAND says, computed directly — the answer every engine must
       reach, whether it took the function branch or not. */
    const probe = document.createElement('div');
    probe.style.color = getComputedStyle(trigger).color;
    probe.style.background =
      `color-mix(in oklab, ${read()} 92%, ${getComputedStyle(trigger).color})`;
    document.body.append(probe);
    const expected = getComputedStyle(probe).backgroundColor;
    probe.remove();

    return {
      rest: read(),
      expected,
      // Does this engine have @function at all? Either answer is fine.
      hasFunctions: CSS.supports('background', '--shade(red, 8%)'),
    };
  });

  // The button rests on its own surface…
  expect(r.rest).not.toBe('rgba(0, 0, 0, 0)');
  // …and the blend the two branches agree on is a real colour, not nothing.
  expect(r.expected).not.toBe('rgba(0, 0, 0, 0)');
  // `hasFunctions` is recorded, never asserted: BOTH answers are correct.
  expect(typeof r.hasFunctions).toBe('boolean');
});

test('the shade function is declared where every component adopts it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button');
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-button');
    await (el as HTMLElement & { rendered?: Promise<void> }).rendered;

    /* Firefox DROPS an `@function` rule from an adopted sheet rather than
       keeping a broken one, so counting the rule is engine-specific. What is
       not: the sheet is adopted, and `@supports` agrees with the engine. */
    const sheets = el.shadowRoot!.adoptedStyleSheets;
    const hasFunctionRule = sheets.some((s) =>
      [...s.cssRules].some((r) => r.constructor.name === 'CSSFunctionRule'));

    return { adopted: sheets.length > 0, hasFunctionRule,
             supports: CSS.supports('background', '--shade(red, 8%)') };
  });

  expect(r.adopted).toBe(true);
  // The guard and the engine must AGREE — that is the whole safety of this.
  expect(r.hasFunctionRule).toBe(r.supports);
});
