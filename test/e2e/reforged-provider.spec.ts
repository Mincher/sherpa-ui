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
  const settle = () => new Promise((r) => setTimeout(r, 120));
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
