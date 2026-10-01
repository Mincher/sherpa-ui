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

/**
 * NO ROOM, NO PANEL. The shell measures its OWN body: the Context beside a
 * panel area keeps a tablet's width. A narrow window, or a pinned nav, shuts
 * the panel and brings the toolbars back; room again gives it back.
 * TODO 146, level 1. TRAP T-the-panel-is-desktop-only
 */
test('with no room in the shell the panel shuts and the toolbars come back; room gives it back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  type Provider = HTMLElement & { filterMode: string };
  const ask = (): Promise<void> => page.evaluate(() => {
    (document.querySelector('sherpa-provider') as Provider).filterMode = 'panel';
  });
  const look = (): Promise<{ open: boolean; stepped: boolean; room: boolean }> => page.evaluate(() => ({
    open: document.querySelector('#filter-panel')!.hasAttribute('open'),
    stepped: document.querySelector('#qft')!.hasAttribute('data-panel-mode'),
    room: !document.querySelector('sherpa-app-shell')!.hasAttribute('data-no-room'),
  }));
  const pin = (): Promise<void> => page.evaluate(() => {
    (document.querySelector('sherpa-nav')!.shadowRoot!.querySelector('.pin') as HTMLElement).click();
  });
  const SHOWN = { open: true, stepped: true, room: true };
  const SHUT = { open: false, stepped: false, room: false };

  await ask();
  await expect.poll(look).toEqual(SHOWN);

  // A tablet window: no room, so the toolbars are back — and asking again is refused.
  await page.setViewportSize({ width: 1024, height: 900 });
  await expect.poll(look).toEqual(SHUT);
  await ask();
  expect(await look()).toEqual(SHUT);

  // Wide again: the reader still wants the panel.
  await page.setViewportSize({ width: 1280, height: 900 });
  await expect.poll(look).toEqual(SHOWN);

  // A pinned nav takes room too: 1280 less the open rail leaves no room.
  await pin();
  await expect.poll(look).toEqual(SHUT);
  await pin();
  await expect.poll(look).toEqual(SHOWN);
});

/**
 * THE CONTEXT STEPS BY ITS OWN WIDTH. TODO 146, level 2: an open panel area
 * takes room, so the Context's grid steps down a band — 12 columns to 8 at
 * 1440 — and back when it shuts. With nothing open, the band is the one the
 * window gave before. TRAP T-a-context-steps-by-its-own-width
 */
test('the Context grid steps by its own width: a panel area takes it from 12 columns to 8, and back', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const tracks = (): Promise<number> => page.evaluate(() =>
    getComputedStyle(document.querySelector('#context-root .sherpa-grid')!).gridTemplateColumns.split(' ').length);
  const mode = (m: string): Promise<void> => page.evaluate((v) => {
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = v;
  }, m);

  expect(await tracks()).toBe(12);
  await mode('panel');
  await expect.poll(tracks).toBe(8);
  await mode('toolbars');
  await expect.poll(tracks).toBe(12);
});
