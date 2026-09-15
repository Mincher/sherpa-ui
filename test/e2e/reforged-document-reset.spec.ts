import { test, expect } from '@playwright/test';

/**
 * The DOCUMENT reset — tokens.css owns the page, so an app does not.
 *
 * Every Sherpa app was hand-writing `html, body { margin: 0; height: 100% }` plus
 * the page font, colour and background in its own <style> block, because nothing
 * in the system owned the page itself. A component cannot: `html` and `body` are
 * outside every shadow root, so only a light-DOM sheet can reach them and
 * tokens.css is the only light-DOM sheet Sherpa ships.
 *
 * It is in the `core` layer (the first one) on purpose, so an app that wants a
 * different page background writes ONE unlayered rule and wins.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('the page has no margin and a full-height chain', async ({ page }) => {
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const h = getComputedStyle(document.documentElement);
    return {
      bodyMargin: b.marginTop + ' ' + b.marginRight + ' ' + b.marginBottom + ' ' + b.marginLeft,
      bodyH: b.blockSize,
      htmlH: h.blockSize,
      viewportH: window.innerHeight,
    };
  });
  expect(r.bodyMargin).toBe('0px 0px 0px 0px');
  // The chain is unbroken: one `height: auto` anywhere collapses everything below
  // it, which is what a full-height view (a chat thread, a scrolling grid) needs.
  expect(parseFloat(r.htmlH)).toBe(r.viewportH);
  expect(parseFloat(r.bodyH)).toBe(r.viewportH);
});

test('the page font, colour and background come from tokens', async ({ page }) => {
  const r = await page.evaluate(() => {
    const b = getComputedStyle(document.body);
    const root = getComputedStyle(document.documentElement);
    const resolve = (name: string) => root.getPropertyValue(name).trim();
    return {
      family: b.fontFamily,
      color: b.color,
      background: b.backgroundColor,
      tokenColor: resolve('--sherpa-theme-content-body-base'),
      tokenBg: resolve('--sherpa-theme-surface-default-1'),
    };
  });
  // Not a browser default: the reset really applied.
  expect(r.family).not.toBe('');
  expect(r.color).not.toBe('rgb(0, 0, 0)');
  expect(r.background).not.toBe('rgba(0, 0, 0, 0)');
  // And the values are the TOKENS', not hardcoded — so a Figma re-point follows.
  expect(r.tokenColor).not.toBe('');
  expect(r.tokenBg).not.toBe('');
});

test('an app can still override it with one unlayered rule', async ({ page }) => {
  const r = await page.evaluate(() => {
    const s = document.createElement('style');
    // UNLAYERED — beats every layer, whatever its specificity.
    s.textContent = 'body { background: rgb(1, 2, 3); }';
    document.head.appendChild(s);
    const got = getComputedStyle(document.body).backgroundColor;
    s.remove();
    return got;
  });
  expect(r).toBe('rgb(1, 2, 3)');
});

test('the reset lives in the core layer, before everything else', async ({ page }) => {
  // Read the PARSED sheet, not the text. The built file is minified and the
  // minifier is free to reorder a selector list (`html, body` came back as
  // `body, html`), so a text match would test the minifier rather than the CSS.
  const r = await page.evaluate(() => {
    const sheet = [...document.styleSheets].find((s) => s.href?.includes('tokens.css'));
    if (!sheet) return { order: [] as string[], resetLayers: [] as string[] };

    const order = [...sheet.cssRules]
      .filter((r) => r.constructor.name === 'CSSLayerStatementRule')
      .flatMap((r) => (r as CSSLayerStatementRule).nameList as unknown as string[]);

    // Which layers carry a rule that targets `body`?
    const resetLayers: string[] = [];
    for (const rule of sheet.cssRules) {
      if (rule.constructor.name !== 'CSSLayerBlockRule') continue;
      const block = rule as CSSLayerBlockRule;
      for (const inner of block.cssRules) {
        const sel = (inner as CSSStyleRule).selectorText;
        if (sel && /(^|,\s*)body(\s*$|\s*,)/.test(sel)) {
          if (!resetLayers.includes(block.name)) resetLayers.push(block.name);
        }
      }
    }
    return { order, resetLayers };
  });

  // core is the FIRST layer, so an app's own layer always wins over the reset.
  expect(r.order[0]).toBe('core');
  // And the reset is in it — not in theme or components, where a later layer
  // could not be overridden as simply.
  expect(r.resetLayers).toContain('core');
});
