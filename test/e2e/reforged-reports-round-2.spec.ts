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

test('import() says a source it does not have, and a state of the old shape', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    root.append(provider);
    await provider.open(page({}), { stores: { s: store() } });
    await provider.import({ v: 2, queries: { nope: {} } });
    const unknown = [...seen];
    // v1 named its queries \`sources\`. 366 step 24
    await provider.import({ v: 1, sources: {} });
    undo();
    return { unknown, old: seen.slice(unknown.length) };
  })()`) as { unknown: string[]; old: string[] };
  expect(r.unknown).toContain('provider-unknown-source');
  expect(r.old).toEqual(['unknown-state']);
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

/* A bundler's CSS rule can turn a sheet into a module (webpack's style-loader),
   and Vite's dev server answers a plain fetch for a .css with JavaScript.
   TODO 218. TRAP T-a-bundler-can-turn-a-file-into-a-module */
test('a sheet is asked for AS CSS, and one that comes back as JavaScript is refused and says the fix', async ({ page }) => {
  const accept: string[] = [];
  await page.route('**/module-sheet.css', (route) => {
    accept.push(route.request().headers()['accept'] ?? '');
    return route.fulfill({ status: 200, contentType: 'text/css',
      body: 'import API from "!../style-loader/dist/runtime/injectStylesIntoStyleTag.js";\nexport default {};' });
  });
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { SherpaElement } = lib;
    const said = [];
    // ONE sink: this one stands in for the setup's until stop().
    const stop = onReport((x) => said.push(x.code + ': ' + x.message));
    class Probe extends SherpaElement {
      static css = new URL('/module-sheet.css', location.href);
    }
    customElements.define('sherpa-probe-module', Probe);
    const a = document.createElement('sherpa-probe-module');
    root.append(a);
    await a.rendered;
    stop();
    undo();
    return { said };
  })()`) as { said: string[] };
  expect(accept).toEqual(['text/css']);
  expect(r.said).toHaveLength(1);
  expect(r.said[0]).toMatch(/^sheet-failed: .*JavaScript came back, not CSS/);
  expect(r.said[0]).toContain("dependency: { not: ['url'] }");
});

test('a file Vite before 8 left in .vite/ says the fix', async ({ page }) => {
  await page.route('**/.vite/deps/probe-sheet.css', (route) => route.fulfill({ status: 404, body: '' }));
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { SherpaElement } = lib;
    const said = [];
    // ONE sink: this one stands in for the setup's until stop().
    const stop = onReport((x) => said.push(x.code + ': ' + x.message));
    class Probe extends SherpaElement {
      static css = new URL('/node_modules/.vite/deps/probe-sheet.css', location.href);
    }
    customElements.define('sherpa-probe-vite', Probe);
    const a = document.createElement('sherpa-probe-vite');
    root.append(a);
    await a.rendered;
    stop();
    undo();
    return { said };
  })()`) as { said: string[] };
  expect(r.said).toHaveLength(1);
  expect(r.said[0]).toMatch(/^sheet-failed: .*404/);
  expect(r.said[0]).toContain("optimizeDeps: { exclude: ['sherpa-ui'] }");
});
