import { test, expect } from '@playwright/test';

/**
 * TOOLBARS OR PANEL, REMEMBERED FOR THE SESSION.
 *
 * Will, 2026-09-24: "Whether the app is in filter toolbar or filter panel mode
 * needs to be remembered across refreshes and view changes, too."
 *
 * It is APP CHROME, the same tier as the nav pin and the theme mode — a
 * SessionStore pointer, so it survives a reload and a Context change and dies
 * with the session. A saved VIEW is the other tier, and a deliberate act.
 * TRAP T-panel-mode-hides-what-the-panel-answers
 */
test('panel mode survives a reload, in both directions', async ({ page }) => {
  const errs: string[] = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(700);

  const before = await page.evaluate(() =>
    !document.querySelector('#filter-panel')!.hasAttribute('open'));

  await page.evaluate(() => {
    document.querySelector('#context-root sherpa-quick-filter-toolbar [data-filter-mode]')!
      .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(800);
  const opened = await page.evaluate(() => ({
    open: document.querySelector('#filter-panel')!.hasAttribute('open'),
    stored: Object.keys(sessionStorage).filter((k) => k.includes('filter')),
  }));

  // RELOAD.
  await page.reload();
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    const p = document.querySelector('#filter-panel') as HTMLElement & { shadowRoot: ShadowRoot };
    const bar = document.querySelector('#context-root sherpa-quick-filter-toolbar') as HTMLElement;
    return {
      open: p.hasAttribute('open'),
      fields: p.shadowRoot.querySelectorAll('.field').length,
      barHidden: getComputedStyle(bar).display === 'none',
    };
  });

  /* And CLOSING it is remembered too. The door is the page's own mode button
     in the panel's header (the provider's). The header itself has no X: an X
     says "gone", and this switches back to the toolbars.
     TRAP T-the-mode-switch-is-the-pages-own */
  await page.evaluate(() => {
    const p = document.querySelector('#filter-panel') as HTMLElement;
    p.querySelector('[data-filter-mode]')!
      .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(400);
  await page.reload();
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(1200);
  const closedAgain = await page.evaluate(() => ({
    shut: !document.querySelector('#filter-panel')!.hasAttribute('open'),
    barBack: getComputedStyle(
      document.querySelector('#context-root sherpa-quick-filter-toolbar') as HTMLElement,
    ).display !== 'none',
  }));

  expect(errs).toEqual([]);
  // It starts in TOOLBARS mode.
  expect(before).toBe(true);
  expect(opened.open).toBe(true);

  // RELOADED: still open, still filled, and the component bar still stood down.
  expect(after.open).toBe(true);
  expect(after.fields).toBeGreaterThan(0);
  expect(after.barHidden).toBe(true);

  // …and closing is remembered too, with the toolbar back.
  expect(closedAgain).toEqual({ shut: true, barBack: true });
});

/**
 * THE PANEL IS THREE COLUMNS WIDE — exactly a 3-column card of the grid the
 * page has with the panel shut — and its AREA is never under 464px: 150% of
 * what it was at 1280. The content keeps its own grid in what is left.
 * Will, 2026-09-26, and TODO 163. TRAP T-the-shell-owns-the-panel-areas
 */
for (const width of [1280, 1600, 1920, 2400]) {
  test(`the filter panel is three grid columns wide, and its area at least 464px, at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 });
    await page.goto('http://localhost:4200/?context=records');
    await page.waitForFunction(() =>
      !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
        ?.querySelector('.row, [role="row"]'));
    // A metric tile spans three columns at desktop widths.
    const tile = () => page.evaluate(() => Math.round(document.querySelector(
      '#context-root [data-col-span="xsmall"]')!.getBoundingClientRect().width));
    const shut = await tile();

    await page.evaluate(() => {
      document.querySelector('#context-root sherpa-quick-filter-toolbar [data-filter-mode]')!
        .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    });
    await expect.poll(() => page.evaluate(() =>
      document.querySelector('#filter-panel')!.hasAttribute('open'))).toBe(true);
    const r = await page.evaluate(() => ({
      card: Math.round(document.querySelector('#filter-panel')!.shadowRoot!
        .querySelector('.panel')!.getBoundingClientRect().width),
      scrolls: document.documentElement.scrollWidth > innerWidth,
    }));
    // The card is its area less the 16 inset: three columns, or the 464 floor.
    expect(r.card).toBe(Math.max(shut, 464 - 16));
    // The floor holds at 1280 and 1600; from 1920 the three columns are wider.
    expect(r.card === shut).toBe(width >= 1920);
    expect(r.scrolls).toBe(false);
  });
}
