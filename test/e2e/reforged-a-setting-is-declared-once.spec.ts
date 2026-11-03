import { test, expect } from './harness';

/**
 * A SETTING IS DECLARED ONCE — 695 U2. The provider holds the app's settings: a
 * component reads its own attributes through `static settings`, told again on
 * every change; a source setting goes on the source; a look one on the page's
 * root, which takes off only what it put on; a reader's change made inside is
 * one `setting-change`, the app's own say nothing.
 */
const SETUP = `
  const { ArrayStore, DataSource, SessionStore, Settings, SETTINGS, onReport } = await import('/dist/index.js');
  const reports = [];
  onReport((r) => reports.push(r.code));
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const html = document.documentElement;
  const provider = document.createElement('sherpa-provider');
  const bar = document.createElement('sherpa-quick-filter-toolbar');
  bar.setAttribute('data-scope', 'view');
  const grid = document.createElement('sherpa-data-grid');
  grid.columns = [{ field: 'name', header: 'Name' }];
  grid.key = 'id';
  provider.append(bar, grid);
  root.append(provider);
  const source = new DataSource({ store: new ArrayStore([{ id: 1, name: 'a' }], { key: 'id' }) });
  await provider.provide({ sources: { s: source } });
  await settle();
`;

test('a component is told its settings as attributes, now and at each change; a source one goes on the source', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const read = () => ({
      bar: ['data-limit-options', 'data-no-results', 'data-field-apply', 'data-no-saves', 'data-switchable'].map((a) => bar.getAttribute(a)),
      grid: ['data-limit-options', 'data-heading-group', 'data-no-results'].map((a) => grid.getAttribute(a)),
      source: source.limitOptions,
    });
    const first = read();
    const session = new SessionStore({ filters: { limit: true, results: false } });
    provider.settings = new Settings(SETTINGS, session);
    await settle();
    const given = read();
    session.set('/filters/singleApply', false);
    session.set('/filters/saveAnyScope', true);
    await settle();
    return { first, given, moved: read(), reports };
  })()`) as Record<string, unknown>;
  // The View's bar saves nothing, and a Switch of its own stands: switchable is none.
  expect(r['first']).toEqual({ bar: ['off', null, null, '', null], grid: ['off', '', null], source: false });
  expect(r['given']).toEqual({ bar: ['on', '', null, '', null], grid: ['on', '', null], source: true });
  expect(r['moved']).toEqual({ bar: ['on', '', '', null, null], grid: ['on', '', null], source: true });
  expect(r['reports']).toEqual([]);
});

test('a look setting is on the root while on, and the root keeps what it did not put', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    html.style.setProperty('--sherpa-action-description', 'none');
    const settings = new Settings();
    provider.settings = settings;
    const prop = (p) => html.style.getPropertyValue(p);
    const off = { shape: prop('--sherpa-toggle-shape'), described: prop('--sherpa-action-description') };
    settings.set('toggleShapes', true);
    settings.set('descriptionTips', true);
    const on = { shape: prop('--sherpa-toggle-shape'), tips: html.hasAttribute('data-description-tips') };
    settings.set('actionDescriptions', false);
    const undescribed = { described: prop('--sherpa-action-description'), tips: html.hasAttribute('data-description-tips') };
    settings.set('toggleShapes', false);
    settings.set('actionDescriptions', true);
    const back = { shape: prop('--sherpa-toggle-shape'), described: prop('--sherpa-action-description'), tips: html.hasAttribute('data-description-tips') };
    settings.set('descriptionTips', false);
    html.style.removeProperty('--sherpa-action-description');
    return { off, on, undescribed, back, reports };
  })()`) as Record<string, unknown>;
  expect(r['off']).toEqual({ shape: '', described: 'none' });
  expect(r['on']).toEqual({ shape: 'inline-flex', tips: true });
  // Tips in lines need the descriptions.
  expect(r['undescribed']).toEqual({ described: 'none', tips: false });
  expect(r['back']).toEqual({ shape: '', described: '', tips: true });
  expect(r['reports']).toEqual([]);
});

test('a reader\'s ⋮ change is set and said once; the app\'s own write says nothing', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const heard = [];
    provider.addEventListener('setting-change', (e) => heard.push([e.detail.key, e.detail.value]));
    provider.settings.set('hideUnmatched', true);
    bar.dispatchEvent(new CustomEvent('limit-options-change', { bubbles: true, composed: true, detail: { on: true } }));
    await settle();
    return { heard, limit: provider.settings.get('limitOptions'), attr: bar.getAttribute('data-limit-options'), source: source.limitOptions, reports };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({ heard: [['limitOptions', true]], limit: true, attr: 'on', source: true, reports: [] });
});
