import { test, expect } from './harness';

/**
 * AN ICON'S BOX IS THE CONTRACT; THE DRAWING FILLS IT ON ITS LONGEST AXIS.
 *
 * TRAP T-icon-box-is-not-the-glyph.
 *
 * A Figma icon is a `content/size/*` SQUARE holding art that varies: `filter`
 * (17:4701) inks 10.5 x 9.625 inside its 14 frame, `triangle-down` 7 x 4.375.
 * The square is the layout contract and never moves.
 *
 * Will's rule, and what this file enforces:
 *   - the BOX tracks its own icon-size token, exactly;
 *   - the drawing's LONGEST axis is 100% of that box;
 *   - the drawing keeps its 1:1 aspect — never stretched;
 *   - nothing ever paints outside the box.
 *
 * It replaces a rule that a glyph must EQUAL its box, written when icons were a
 * webfont. That was never true of the art: Font Awesome at `font-size == box`
 * painted ~101% of it, a third over the Figma vector, and ate the surrounding
 * air. The filter chip was the visible case — a correct 24 chip, a correct 14
 * box, and a funnel with no room around it.
 */

/** The sizes a wrapper is asked to be, from `Structure / icon-size` per mode. */
const BUTTON_SIZES: Record<string, string> = {
  '2xs': '10px', xs: '10px', sm: '14px', lg: '16px', xl: '16px', default: '14px',
};

test('every button size paints its box at its own icon-size token', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = ['2xs', 'xs', 'sm', 'lg', 'xl', ''].map((s) =>
      `<sherpa-button data-type="icon" ${s ? `data-size="${s}"` : ''}` +
      ` data-icon-start="fa-solid fa-gear" data-m="${s || 'default'}"></sherpa-button>`).join('');
    const btns = [...root.querySelectorAll('sherpa-button')] as (HTMLElement & {
      rendered?: Promise<void>; shadowRoot: ShadowRoot;
    })[];
    await Promise.all(btns.map((b) => b.rendered));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return btns.map((b) => {
      const box = b.shadowRoot.querySelector('.icon-start') as HTMLElement;
      const ink = box.querySelector('path')!.getBoundingClientRect();
      const rect = box.getBoundingClientRect();
      return {
        mode: b.dataset['m'],
        token: getComputedStyle(b).getPropertyValue('--sherpa-button-size-icon').trim(),
        boxW: Math.round(rect.width * 10) / 10,
        boxH: Math.round(rect.height * 10) / 10,
        inkW: ink.width,
        inkH: ink.height,
      };
    });
  });

  for (const row of r) {
    const want = BUTTON_SIZES[row.mode!]!;
    // The token itself must be what Figma says.
    expect(row.token, `${row.mode}: token`).toBe(want);
    // The BOX is the layout contract — exactly the token, and SQUARE.
    expect(`${row.boxH}px`, `${row.mode}: box height`).toBe(want);
    expect(`${row.boxW}px`, `${row.mode}: box width`).toBe(want);
    // THE RULE: the drawing's longest axis fills that box.
    expect(Math.max(row.inkW, row.inkH), `${row.mode}: longest axis`)
      .toBeCloseTo(parseFloat(want), 1);
  }
});

test('a drawing fills its longest axis, keeps 1:1, and never overflows', async ({ page }) => {
  const bad = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const cases: string[] = [
      '<sherpa-button data-icon-start="fa-solid fa-gear">Go</sherpa-button>',
      '<sherpa-button data-type="icon" data-size="2xs" data-icon-start="fa-solid fa-gear"></sherpa-button>',
      '<sherpa-button data-type="icon" data-size="xl" data-icon-start="fa-solid fa-gear"></sherpa-button>',
      '<sherpa-input-text data-icon-start="fa-solid fa-magnifying-glass" placeholder="x"></sherpa-input-text>',
      '<sherpa-input-text data-icon-end="fa-solid fa-xmark" placeholder="x"></sherpa-input-text>',
      '<sherpa-quick-filter data-label="Region" data-icon-start="fa-solid fa-filter" data-menu></sherpa-quick-filter>',
      '<sherpa-toast data-status="success" data-heading="Saved"></sherpa-toast>',
      '<sherpa-callout data-status="info" data-heading="Note"></sherpa-callout>',
      '<sherpa-nav-item data-label="Home" data-icon="fa-solid fa-house"></sherpa-nav-item>',
      '<sherpa-tag data-icon="fa-solid fa-tag">Tag</sherpa-tag>',
      '<sherpa-chip data-icon="fa-solid fa-tag">Chip</sherpa-chip>',
    ];
    const out: { html: string; cls: string; box: string; ink: string; why: string }[] = [];
    for (const html of cases) {
      root.innerHTML = html;
      const el = root.firstElementChild as HTMLElement & {
        rendered?: Promise<void>; shadowRoot: ShadowRoot;
      };
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();

      for (const box of [...el.shadowRoot.querySelectorAll('.sherpa-icon-box')] as HTMLElement[]) {
        const rect = box.getBoundingClientRect();
        // A hidden member of a status set has no box to judge.
        if (rect.width === 0) continue;
        const shapes = [...box.querySelectorAll('path,rect,circle,polygon,ellipse')];
        if (shapes.length === 0) continue;
        // The union of every shape is the drawing's true extent.
        let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
        for (const s of shapes) {
          const b = s.getBoundingClientRect();
          if (b.width === 0 && b.height === 0) continue;
          x0 = Math.min(x0, b.left); y0 = Math.min(y0, b.top);
          x1 = Math.max(x1, b.right); y1 = Math.max(y1, b.bottom);
        }
        if (x1 === -Infinity) continue;
        const w = x1 - x0, h = y1 - y0;
        const cls = [...box.classList].join(' ');
        const note = { html, cls, box: `${rect.width}x${rect.height}`, ink: `${w.toFixed(2)}x${h.toFixed(2)}` };
        // Half a pixel of slack: a curve's antialiased edge is not geometry.
        if (w > rect.width + 0.5 || h > rect.height + 0.5) out.push({ ...note, why: 'OVERFLOWS' });
        else if (Math.abs(Math.max(w, h) - rect.width) > 0.5) out.push({ ...note, why: 'longest axis is not 100%' });
      }
    }
    return out;
  });

  expect(bad, `icons breaking the fit rule:\n${
    bad.map((b) => `  ${b.why}: ${b.cls} — box ${b.box}, ink ${b.ink}\n    ${b.html}`).join('\n')
  }`).toEqual([]);
});
