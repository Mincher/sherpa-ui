import { test, expect } from './harness';

/**
 * A VIEW KEEPS WHAT THE READER LEFT ON IT — Will, TODO 144: filters survive a
 * View swap in the session, unsaved. Kept in the page's one document, for the
 * TAB (370), while the keeper's `eachView` says so; one left over another
 * definition of its View is dropped. TRAP T-a-view-keeps-what-the-reader-left
 */
const SETUP = `
  const { ArrayStore, DataSource, PageKeeper, memoryTier } = await import('/dist/index.js');
  const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const settle = async () => { await window.__settled(); await frames(); };
  const root = document.getElementById('root');
  root.innerHTML = '';
  const rows = [{ id: 1, region: 'EMEA' }, { id: 2, region: 'APAC' }, { id: 3, region: 'EMEA' }];
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  source.declareField('region', { label: 'Region' });
  let VIEWS = {
    all: { label: 'All', query: { v: 1, scopes: { view: {} } } },
    risk: { label: 'Risk', query: { v: 1, scopes: { view: { holds: ['region'] } } } },
  };
  let each = true;
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier(), eachView: () => each });
  const provider = document.createElement('sherpa-provider');
  provider.keeper = keeper;
  root.append(provider);
  await provider.provide({ sources: { s: source }, views: () => VIEWS, key: 'p' });
  await source.load();
  // A pick, as the View chip reports one.
  const pick = async (id) => {
    provider.dispatchEvent(new CustomEvent('quick-filter-change', { bubbles: true, composed: true, detail: { scope: 'bar', values: { view: [id] } } }));
    await settle();
  };
  // A reader's own change on the View on screen, kept in its frame.
  const choose = async (region) => {
    source.query.ask({ scope: 'view', field: 'region', reading: { picked: [region] } });
    await source.load();
    await settle();
  };
  const region = () => source.query.reading('view', 'region')?.picked ?? [];
  const left = () => Object.keys(keeper.read('p').left ?? {});
`;

test('a View keeps what the reader left on it, through a swap and back; a changed View drops it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    await pick('risk');
    await choose('EMEA');
    await pick('all');
    const away = region();
    await pick('risk');
    const back = region();
    const kept = left();
    // Risk's own definition changes: what was left over the old one must not hide it.
    await pick('all');
    VIEWS = { ...VIEWS, risk: { label: 'Risk', query: { v: 1, scopes: { view: { holds: ['region'], where: { region: { eq: 'APAC' } } } } } } };
    await pick('risk');
    return { away, back, kept, changed: region(), dropped: left() };
  })()`) as Record<string, unknown>;
  expect(r['away']).toEqual([]);
  expect(r['back']).toEqual(['EMEA']);
  expect(r['kept']).toEqual(['risk']);
  expect(r['changed']).toEqual(['APAC']);
  expect(r['dropped']).toEqual([]);
});

test('each View off: a reader\'s change keeps no View\'s, and a View opens on its own filters', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    each = false;
    await pick('risk');
    await choose('EMEA');
    const none = keeper.read('p').left ?? null;
    await pick('all');
    await pick('risk');
    // The View on screen is still kept, for a reload.
    return { none, own: region(), view: keeper.read('p').view };
  })()`) as Record<string, unknown>;
  expect(r['none']).toBeNull();
  expect(r['own']).toEqual([]);
  expect(r['view']).toBe('risk');
});
