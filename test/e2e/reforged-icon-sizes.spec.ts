import { test, expect } from '@playwright/test';

/**
 * AN ICON'S GLYPH MUST BE THE SIZE OF ITS BOX.
 *
 * A Font Awesome icon is a FONT CHARACTER. `inline-size` / `block-size` size the
 * <i> box; only `font-size` scales the glyph inside it. A rule that sets the two
 * size properties from an icon token and leaves font-size to inherit therefore
 * produces a box that tracks the design system and a glyph that tracks whatever
 * text happens to sit beside it.
 *
 * It fails QUIETLY, and it fails only at the ends of a scale — measured before
 * the fix, sherpa-button agreed at four of its six sizes and was wrong at the
 * two extremes:
 *
 *   data-size="2xs"   box 10, glyph  8   (rattling inside its square)
 *   data-size="xl"    box 16, glyph 20   (overhanging it)
 *
 * and sherpa-input-text painted a 16px magnifying glass in a 14px box.
 *
 * Figma binds an icon's width AND height to one variable (Structure/icon-size on
 * the Button set 11:2463; the Input Field atom 935:38549 measures 14 x 14), so
 * one variable has to drive all three properties in code too.
 *
 * This measures the element that ACTUALLY PAINTS a glyph — the one whose
 * ::before carries real content in the Font Awesome face — rather than trusting
 * a class name, because the box and the glyph are not always the same element.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('every button size paints its glyph at its own icon-size token', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = ['2xs', 'xs', 'sm', 'lg', 'xl', ''].map((s) =>
      `<sherpa-button data-type="icon" ${s ? `data-size="${s}"` : ''}` +
      ` data-icon-start="fa-solid fa-gear" data-m="${s || 'default'}"></sherpa-button>`).join('');
    const btns = [...root.querySelectorAll('sherpa-button')] as (HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot;
    })[];
    await Promise.all(btns.map((b) => b.rendered));
    await document.fonts.ready;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return btns.map((b) => {
      const i = b.shadowRoot.querySelector('.icon-start') as HTMLElement;
      const cs = getComputedStyle(i);
      const box = i.getBoundingClientRect();
      return {
        mode: b.dataset['m'],
        token: getComputedStyle(b).getPropertyValue('--sherpa-button-size-icon').trim(),
        boxH: Math.round(box.height * 10) / 10,
        fontSize: cs.fontSize,
      };
    });
  });

  // The generated region's map, which is Figma's `Structure / icon-size` per
  // mode (default/sm → content/size/base 14, 2xs/xs → xs 10, lg/xl → large 16).
  const expected: Record<string, string> = {
    '2xs': '10px', xs: '10px', sm: '14px', lg: '16px', xl: '16px', default: '14px',
  };

  for (const row of r) {
    // The token itself must be what Figma says.
    expect(row.token, `${row.mode}: token`).toBe(expected[row.mode!]);
    // …and the BOX and the GLYPH must both be that. The glyph is the half that
    // was missing; a box-only assertion would have passed throughout the bug.
    expect(`${row.boxH}px`, `${row.mode}: box`).toBe(expected[row.mode!]);
    expect(row.fontSize, `${row.mode}: glyph font-size`).toBe(expected[row.mode!]);
  }
});

test('no component paints a glyph at a size its own box disagrees with', async ({ page }) => {
  const bad = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const cases: string[] = [
      '<sherpa-button data-icon-start="fa-solid fa-gear">Go</sherpa-button>',
      '<sherpa-button data-type="icon" data-size="2xs" data-icon-start="fa-solid fa-gear"></sherpa-button>',
      '<sherpa-button data-type="icon" data-size="xl" data-icon-start="fa-solid fa-gear"></sherpa-button>',
      '<sherpa-input-text data-icon-start="fa-solid fa-magnifying-glass" placeholder="x"></sherpa-input-text>',
      '<sherpa-input-text data-icon-end="fa-solid fa-xmark" placeholder="x"></sherpa-input-text>',
    ];
    const out: { html: string; cls: string; boxH: number; fontSize: string }[] = [];
    for (const html of cases) {
      root.innerHTML = html;
      const el = root.firstElementChild as HTMLElement & {
        rendered?: Promise<void>; shadowRoot: ShadowRoot;
      };
      await el.rendered;
      await document.fonts.ready;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      for (const n of [...el.shadowRoot.querySelectorAll('*')] as HTMLElement[]) {
        const cs = getComputedStyle(n);
        const before = getComputedStyle(n, '::before');
        // Only the element that actually PAINTS: real ::before content, in the
        // Font Awesome face. A class name alone is not proof of a glyph.
        const paints = before.content !== 'none' && before.content !== '' &&
          /Font Awesome/i.test(before.fontFamily || cs.fontFamily);
        if (!paints) continue;
        const box = n.getBoundingClientRect();
        if (box.height === 0) continue;
        if (Math.abs(parseFloat(cs.fontSize) - box.height) > 0.6) {
          out.push({ html, cls: String(n.className).slice(0, 44), boxH: box.height, fontSize: cs.fontSize });
        }
      }
    }
    return out;
  });

  expect(bad, `glyphs painted at a size their own box disagrees with:\n${
    bad.map((b) => `  ${b.cls}: box ${b.boxH} vs font-size ${b.fontSize}\n    ${b.html}`).join('\n')
  }`).toEqual([]);
});
