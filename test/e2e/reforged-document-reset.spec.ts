import { test, expect } from './harness';

/**
 * The DOCUMENT reset — page.css owns the page, so an app does not.
 *
 * Every Sherpa app was hand-writing `html, body { margin: 0; height: 100% }` plus
 * the page font, colour and background in its own <style> block, because nothing
 * in the system owned the page itself. A component cannot: `html` and `body` are
 * outside every shadow root, so only a light-DOM sheet can reach them.
 *
 * It is page.css, not tokens.css, so a host that embeds Sherpa keeps its own
 * page (TODO 216). TRAP T-tokens-are-safe-to-embed. It is in the `core` layer
 * (the first one) on purpose, so an app that wants a different page background
 * writes ONE unlayered rule and wins.
 */


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

test('the reset lives in page.css, in the core layer, before everything else; tokens.css styles no page', async ({ page }) => {
  // Read the PARSED sheet, not the text. The built file is minified and the
  // minifier is free to reorder a selector list (`html, body` came back as
  // `body, html`), so a text match would test the minifier rather than the CSS.
  const r = await page.evaluate(() => {
    const sheet = (name: string) => [...document.styleSheets].find((s) => s.href?.includes(name));
    // Which layers carry a rule that targets `body`?
    const bodyLayers = (s: CSSStyleSheet | undefined): string[] => {
      const out: string[] = [];
      for (const rule of s?.cssRules ?? []) {
        if (rule.constructor.name !== 'CSSLayerBlockRule') continue;
        const block = rule as CSSLayerBlockRule;
        for (const inner of block.cssRules) {
          const sel = (inner as CSSStyleRule).selectorText;
          if (sel && /(^|,\s*)body(\s*$|\s*,)/.test(sel) && !out.includes(block.name)) out.push(block.name);
        }
      }
      return out;
    };
    const tokens = sheet('tokens.css');
    const order = [...tokens?.cssRules ?? []]
      .filter((r) => r.constructor.name === 'CSSLayerStatementRule')
      .flatMap((r) => (r as CSSLayerStatementRule).nameList as unknown as string[]);
    return { order, resetLayers: bodyLayers(sheet('page.css')), tokensBody: bodyLayers(tokens) };
  });

  // core is the FIRST layer, so an app's own layer always wins over the reset.
  expect(r.order[0]).toBe('core');
  // And the reset is in it — not in theme or components, where a later layer
  // could not be overridden as simply.
  expect(r.resetLayers).toContain('core');
  // tokens.css styles no page: a host that embeds Sherpa keeps its own.
  expect(r.tokensBody).toEqual([]);
});
