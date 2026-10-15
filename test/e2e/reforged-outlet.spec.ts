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
    ctx: { root: 'context-root', keys: ['header', 'id', 'label', 'panels', 'session', 'signal', 'view'], label: 'Alpha', id: 'alpha', header: true, gone: false },
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

/* SETTINGS OPEN OVER THE CONTEXT, which is never reloaded: ?settings=<page>
   opens it in the overlay, and the back arrow asks the router to close it. */
test('a Settings page opens over the Context and its back arrow closes it', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  await page.evaluate(`(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const router = document.querySelector('sherpa-router');
    router.dataset.overlay = 'settings';
    router.dataset.params = 'context view settings';
    const dialog = document.getElementById('settings');
    window.__events = [];
    for (const type of ['settings-open', 'settings-close', 'context-load']) {
      outlet.addEventListener(type, (e) => window.__events.push(type + (e.detail?.page ? ':' + e.detail.page : '')));
    }
    const base = new URL('/test/reforged/outlet/app.json', location.href);
    const app = await (await fetch(base)).json();
    await outlet.start({
      app, base, session: new SessionStore({}), stores: () => ({}),
      settings: { dialog, header: dialog.querySelector('sherpa-app-header'), root: document.getElementById('settings-root') },
    });
    await router.go({ settings: 'prefs' });
  })()`);
  // Shown LAST, once its module has run.
  await page.waitForFunction(() => (document.getElementById('settings') as HTMLElement & { open: boolean }).open);
  const open = await page.evaluate(`(() => {
    const outlet = document.querySelector('sherpa-outlet');
    const header = document.querySelector('#settings sherpa-app-header');
    const shot = {
      page: outlet.settingsPage, text: document.querySelector('#prefs')?.textContent,
      heading: header.getAttribute('data-heading'), ctx: { ...window.__prefs }, context: outlet.querySelector('#alpha') !== null,
    };
    header.dispatchEvent(new CustomEvent('back-click', { bubbles: true, composed: true }));
    return shot;
  })()`);
  await page.waitForFunction(() => (window as unknown as { __events: string[] }).__events.includes('settings-close'));
  const closed = await page.evaluate(`(() => ({
    page: document.querySelector('sherpa-outlet').settingsPage, shown: document.getElementById('settings').open,
    gone: window.__prefs.gone, url: location.search, events: window.__events,
  }))()`);
  expect(open).toEqual({
    page: 'prefs', text: 'Preferences', heading: 'Preferences',
    ctx: { root: 'settings-root', label: 'Preferences', id: 'prefs', gone: false }, context: true,
  });
  expect(closed).toEqual({
    page: null, shown: false, gone: true, url: '?context=alpha',
    events: ['context-load', 'settings-open:prefs', 'settings-close'],
  });
});

/* THE OUTLET KEEPS THE NAV: its rows from app.json, a Context entering Recents
   when it loads (Home never does), and the ★ starring the View on screen.
   TRAP T-the-outlet-keeps-the-nav */
test('the nav is drawn from app.json, Recents follow each load, and the star keeps a favourite', async ({ page }) => {
  await page.goto('/test/reforged/outlet.html');
  await page.waitForFunction(() => (window as unknown as { __ready?: boolean }).__ready === true);
  const r = await page.evaluate(`(async () => {
    const { SessionStore } = await import('/dist/index.js');
    const outlet = document.querySelector('sherpa-outlet');
    const nav = document.querySelector('sherpa-nav');
    const router = document.querySelector('sherpa-router');
    const base = new URL('/test/reforged/outlet/app.json', location.href);
    const app = await (await fetch(base)).json();
    const session = new SessionStore({ nav: { pinned: false, favorites: [], recent: [], hierarchy: false } });
    localStorage.removeItem('sherpa:session:/nav/favorites');
    localStorage.removeItem('sherpa:session:/nav/recent');
    await outlet.start({ app, base, session, stores: () => ({}) });
    const ids = () => [...nav.shadowRoot.querySelectorAll('.nav-row[data-id]')].map((r) => r.dataset.id);
    const first = { ids: ids(), current: nav.dataset.currentId, recent: session.get('/nav/recent').length };
    await router.go({ context: 'beta' });
    await window.__settled?.();
    document.dispatchEvent(new CustomEvent('view-favorite'));
    await outlet.refreshNav();
    return { first, recent: session.get('/nav/recent'), favorites: session.get('/nav/favorites'), current: nav.dataset.currentId, ids: ids() };
  })()`) as Record<string, unknown>;
  expect(r['first']).toEqual({ ids: ['home', 'recent', 'favorites'], current: 'home', recent: 0 });
  expect(r['recent']).toEqual([{ context: 'beta', label: 'Beta' }]);
  expect(r['favorites']).toEqual([{ context: 'beta', label: 'Beta', key: 'beta' }]);
  expect(r['current']).toBe('context-beta');
  expect(r['ids']).toEqual(expect.arrayContaining(['recent:beta', 'favorites:beta']));
});
