import { test, expect } from '@playwright/test';

/**
 * sherpa-provider — a component ASKS, the nearest provider ANSWERS.
 *
 * A grid inside a provider fills with no `bind()` from anyone; one outside
 * waits for a page to populate it. A provider offering two sources refuses an
 * unnamed ask, loudly, and a named one reaches its source. docs/PROVIDER-DESIGN.md.
 * TRAP T-a-component-asks-its-provider
 */
const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

const SETUP = `
  const { ArrayStore, DataSource, onReport } = await import('/dist/index.js');
  const reports = [];
  onReport((r) => reports.push(r.code));
  const rows = (n, tag) => Array.from({ length: n }, (_, i) => ({ id: i, name: tag + i }));
  const source = (n, tag) => new DataSource({ store: new ArrayStore(rows(n, tag), { key: 'id' }) });
  // Every element rendered and painted — never a fixed wait.
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const grid = (attrs = '') => {
    const g = document.createElement('sherpa-data-grid');
    for (const [k, v] of Object.entries(attrs || {})) g.setAttribute(k, v);
    g.columns = [{ field: 'name', header: 'Name' }];
    g.key = 'id';
    return g;
  };
  const drawn = (g) => g.shadowRoot.querySelectorAll('.body .row, tbody tr').length;
`;

test('a grid inside a provider fills with no bind; one outside waits', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const inside = grid();
    provider.append(inside);
    const outside = grid();
    root.append(provider, outside);
    // Asked BEFORE there is a source: it waits, and provide() answers it.
    await settle();
    const before = drawn(inside);
    const src = source(3, 'a');
    provider.provide({ sources: { customers: src } });
    await src.load();
    await settle();
    return { before, inside: drawn(inside), outside: drawn(outside), columns: inside.columns.length,
      locked: inside.hasAttribute('data-locked'), bound: src.boundElements.length, reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toBe(0);
  expect(r['inside']).toBe(3);
  // The page's CONFIGURATION stands — the data came in beside it.
  expect(r['columns']).toBe(1);
  expect(r['locked']).toBe(true);
  expect(r['outside']).toBe(0);
  expect(r['bound']).toBe(1);
  expect(r['reports']).toEqual([]);
});

test('two sources: an unnamed ask is refused loudly, a named one is answered', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const unnamed = grid();
    const named = grid({ 'data-source': 'invoices' });
    const wrong = grid({ 'data-source': 'orders' });
    provider.append(unnamed, named, wrong);
    root.append(provider);
    await settle();
    const customers = source(2, 'c');
    const invoices = source(5, 'i');
    provider.provide({ sources: { customers, invoices } });
    await Promise.all([customers.load(), invoices.load()]);
    await settle();
    return { unnamed: drawn(unnamed), named: drawn(named), wrong: drawn(wrong), reports: [...new Set(reports)].sort() };
  })()`) as Record<string, unknown>;
  expect(r['unnamed']).toBe(0);
  expect(r['named']).toBe(5);
  expect(r['wrong']).toBe(0);
  expect(r['reports']).toEqual(['provider-ambiguous', 'provider-unknown-source']);
});

test('a component that leaves the page leaves its source; a new source reaches what stays', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const provider = document.createElement('sherpa-provider');
    const stays = grid();
    const goes = grid();
    provider.append(stays, goes);
    root.append(provider);
    const first = source(2, 'f');
    provider.provide({ sources: { one: first } });
    await first.load();
    await settle();
    goes.remove();
    await settle();
    const afterRemove = first.boundElements.length;
    // A Context swapping its source swaps it for everything still asking.
    const second = source(4, 's');
    provider.provide({ sources: { one: second } });
    await second.load();
    await settle();
    return { afterRemove, stays: drawn(stays), firstBound: first.boundElements.length, secondBound: second.boundElements.length };
  })()`) as Record<string, number>;
  expect(r['afterRemove']).toBe(1);
  expect(r['stays']).toBe(4);
  expect(r['firstBound']).toBe(0);
  expect(r['secondBound']).toBe(1);
});

/* THE PROVIDER KEEPS THE VIEWS: it hears a View pick from inside, puts the
   View's Query on, keeps the Query in the session, and puts it back — only on
   the View it was made on. TRAP T-a-provider-keeps-the-views */
test('a provider applies a View pick, keeps the Query, and restores it on its own View only', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const store = new Map();
    const session = { get: (k) => store.get(k), set: (k, v) => store.set(k, v) };
    const VIEWS = {
      all: { label: 'All', query: { v: 1, scopes: { view: {} } } },
      odd: { label: 'Odd', query: { v: 1, scopes: { view: { readings: { name: { picked: ['o1', 'o3'] } } } } } },
    };
    const provider = document.createElement('sherpa-provider');
    const g = grid();
    provider.append(g);
    root.append(provider);
    const src = source(4, 'o');
    await provider.provide({ sources: { s: src }, views: VIEWS, session, key: '/q' });
    await src.load();
    await settle();
    const before = drawn(g);
    // A pick reported from inside, as the View chip reports it.
    g.dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true, composed: true, detail: { scope: 'bar', values: { view: ['odd'] } },
    }));
    await settle();
    await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const picked = { rows: drawn(g), view: provider.view, kept: store.get('/q')?.view };
    // A reload on the SAME View puts the kept Query back.
    const again = source(4, 'o');
    await provider.provide({ sources: { s: again }, views: VIEWS, view: 'odd', session, key: '/q' });
    await again.load();
    await settle();
    const restored = drawn(g);
    // On ANOTHER View the kept Query is not its own, so the View's is used.
    const other = source(4, 'o');
    await provider.provide({ sources: { s: other }, views: VIEWS, view: 'all', session, key: '/q' });
    await other.load();
    await settle();
    return { before, picked, restored, other: drawn(g), reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toBe(4);
  expect(r['picked']).toEqual({ rows: 2, view: 'odd', kept: 'odd' });
  expect(r['restored']).toBe(2);
  expect(r['other']).toBe(4);
  expect(r['reports']).toEqual([]);
});
