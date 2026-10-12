import { test, expect } from './harness';

/**
 * Silent failures, round 2 — each now says what went wrong (TODO 224).
 * TRAP T-a-broken-assumption-reports
 */
const SETUP = `
  const lib = await import('/dist/index.js');
  const { ArrayStore, onReport, onViewPicked } = lib;
  const seen = [];
  const undo = onReport((r) => seen.push(r.code));
  const root = document.getElementById('root');
  root.innerHTML = '';
  const store = () => new ArrayStore([{ id: 1, name: 'a' }], { key: 'id' });
  const page = (ui) => ({ v: 1, id: 't', source: { store: 's', fields: { name: { label: 'Name' } } }, ui });
`;

test('open() configures a plain element, says a refused value, and never waits for a tag no one defined', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    provider.innerHTML = '<div id="plain"></div><sherpa-never-defined id="later"></sherpa-never-defined>';
    root.append(provider);
    const plain = provider.querySelector('#plain');
    Object.defineProperty(plain, 'mood', { set() { throw new Error('no'); }, get() { return ''; } });
    const opened = provider.open(page({ plain: { title: 'Hi', mood: 'x', nonsense: 1 }, later: { x: 1 } }), { stores: { s: store() } });
    const outcome = await Promise.race([opened.then(() => 'opened'), new Promise((done) => setTimeout(() => done('hung'), 3000))]);
    undo();
    return { outcome, title: plain.title, seen };
  })()`) as { outcome: string; title: string; seen: string[] };
  expect(r.outcome).toBe('opened');
  expect(r.title).toBe('Hi');
  expect(r.seen).toEqual(expect.arrayContaining(['provider-unknown-setting', 'provider-refused-setting', 'provider-undefined-element']));
});

test('import() says a source it does not have', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    root.append(provider);
    await provider.open(page({}), { stores: { s: store() } });
    await provider.import({ v: 1, sources: { nope: {} } });
    undo();
    return seen;
  })()`) as string[];
  expect(r).toContain('provider-unknown-source');
});

test('a View applied with gaps reaches onReport, not only the console', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const host = document.createElement('div');
    root.append(host);
    onViewPicked(host, { a: { label: 'A', ui: { ghost: { x: 1 } } } }, { elements: {} }, {});
    host.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { scope: 'bar', values: { view: ['a'] } } }));
    await window.__settled();
    undo();
    return seen;
  })()`) as string[];
  expect(r).toContain('view-gaps');
});

test('a fallback page served for a missing sheet is refused and said, and not kept', async ({ page }) => {
  // A SPA fallback: every unknown path answers with the app's own page, as a 200.
  await page.route('**/missing-sheet.css', (route) =>
    route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><html><body>app</body></html>' }));
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { SherpaElement } = lib;
    class Probe extends SherpaElement {
      static css = new URL('/missing-sheet.css', location.href);
    }
    customElements.define('sherpa-probe-sheet', Probe);
    const a = document.createElement('sherpa-probe-sheet');
    root.append(a);
    await a.rendered;
    const b = document.createElement('sherpa-probe-sheet');
    root.append(b);
    await b.rendered;
    undo();
    return { seen };
  })()`) as { seen: string[] };
  // Asked twice — the failure was not cached — and said each time.
  expect(r.seen.filter((code) => code === 'sheet-failed')).toHaveLength(2);
});
