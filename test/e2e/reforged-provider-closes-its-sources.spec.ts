import { test, expect } from './harness';

/**
 * A page's source is closed when the page goes: opening a page again, or
 * leaving it, leaves no source still reloading on each change.
 * TRAP T-a-closed-source-hears-nothing
 */
const RUN = (how: 'reopen' | 'close' | 'overtaken') => `(async () => {
  const { ArrayStore, DataSource } = await import('/dist/index.js');
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  provider.innerHTML = '<sherpa-container><sherpa-data-grid></sherpa-data-grid></sherpa-container>';
  root.append(provider);
  const store = new ArrayStore(Array.from({ length: 5 }, (_, i) => ({ id: i + 1, name: 'n' + i })), { key: 'id' });
  const page = { v: 1, id: 't', source: { store: 's', fields: { name: { label: 'Name' } } } };
  const stores = { s: store };
  const close = DataSource.prototype.close;
  let closed = 0;
  DataSource.prototype.close = function () { closed++; return close.call(this); };
  try {
    if ('${how}' === 'overtaken') {
      const [first, second] = await Promise.all([provider.open(page, { stores }), provider.open(page, { stores })]);
      return { first: first === undefined, second: !!second, closed };
    }
    const first = await provider.open(page, { stores });
    const load = first.load.bind(first);
    let loads = 0;
    first.load = (...a) => { loads++; return load(...a); };
    const second = '${how}' === 'reopen' ? await provider.open(page, { stores }) : (provider.close(), null);
    await store.insert({ id: 6, name: 'n5' });
    await new Promise((done) => setTimeout(done, 100));
    return { loads, closed, total: second ? second.total : null };
  } finally {
    DataSource.prototype.close = close;
  }
})()`;

test('opening a page again closes the source it had', async ({ page }) => {
  expect(await page.evaluate(RUN('reopen'))).toEqual({ loads: 0, closed: 1, total: 6 });
});

test('leaving a page closes its source', async ({ page }) => {
  expect(await page.evaluate(RUN('close'))).toEqual({ loads: 0, closed: 1, total: null });
});

test('an open overtaken before it was provided closes the source it made', async ({ page }) => {
  expect(await page.evaluate(RUN('overtaken'))).toEqual({ first: true, second: true, closed: 1 });
});
