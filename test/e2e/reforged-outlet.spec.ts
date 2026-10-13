import { test, expect } from './fixture';

/**
 * THE OUTLET LOADS THE ROUTE'S CONTEXT: the one app.json names — its markup,
 * its module, its chrome — hands it one ctx, binds its settings, and tears it
 * down for the next. TODO 194. TRAP T-an-outlet-loads-the-context
 */
test('the outlet loads the route\'s Context, hands it one ctx, and tears it down for the next', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(`(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const header = document.querySelector('sherpa-app-header');
    const shell = document.querySelector('sherpa-app-shell');
    const router = document.querySelector('sherpa-router');
    const events = [];
    for (const type of ['context-change', 'context-markup', 'context-load']) {
      outlet.addEventListener(type, (e) => events.push(type + ':' + e.detail.context));
    }
    const base = new URL('/test/reforged/outlet/app.json', location.href);
    const app = await (await fetch(base)).json();
    await outlet.start({ app, base, session: new SessionStore({ pinned: true }), stores: () => ({}) });
    const alpha = {
      text: outlet.querySelector('#alpha')?.textContent, heading: header.getAttribute('data-heading'),
      icon: header.getAttribute('data-icon'), ctx: { ...window.__alpha }, pin: outlet.querySelector('#pin').checked,
      params: router.dataset.params,
    };
    await router.go({ context: 'beta' });
    const beta = {
      text: outlet.querySelector('#beta')?.textContent, alphaGone: !outlet.querySelector('#alpha'),
      heading: header.getAttribute('data-heading'), icon: header.getAttribute('data-icon'),
      noHeader: shell.hasAttribute('data-no-header'), teardown: window.__alpha.gone, aborted: window.__alpha.aborted,
    };
    return { alpha, beta, events, context: outlet.context };
  })()`) as Record<string, unknown>;
  expect(r['alpha']).toEqual({
    text: 'Alpha', heading: 'Alpha', icon: 'home', pin: true, params: 'context=alpha view',
    ctx: { root: 'context-root', keys: ['header', 'label', 'panels', 'session', 'signal', 'view'], label: 'Alpha', header: true, gone: false },
  });
  expect(r['beta']).toEqual({
    text: 'Beta', alphaGone: true, heading: 'Beta', icon: null, noHeader: true, teardown: true, aborted: true,
  });
  expect(r['events']).toEqual([
    'context-change:alpha', 'context-markup:alpha', 'context-load:alpha',
    'context-change:beta', 'context-markup:beta', 'context-load:beta',
  ]);
  expect(r['context']).toBe('beta');
});
