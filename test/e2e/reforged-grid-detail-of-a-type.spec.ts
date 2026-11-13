import { test, expect } from './harness';

/**
 * A grid's rows OPEN on rows of another type (Will, TODO 963: "We should use a nested grid to show User Accounts
 * associated with each User on the Users view"). A page's `ui` gives the grid its `detail` — the type, the field of that
 * type that holds a row's key, and the sub-grid's columns — and its provider reads that type's rows for the rows shown,
 * keyed by each row's key. The detail is configuration: kept across every populate.
 */
type Grid = HTMLElement & {
  rendered: Promise<void>;
  detail: { type?: string; by?: string; key?: string; rows?: Record<string, { id: string }[]>; headings?: Record<string, string> } | null;
  populate(data: unknown): Promise<void>;
};

test.beforeEach(async ({ page }) => {
  await page.evaluate(async () => {
    const { ArrayStore, registerEntityType } = await import('/dist/index.js');
    // The type its rows open on says its words: the sub-grid's headings are its labels.
    (window as never as { taken: unknown }).taken = registerEntityType({ id: 'account', label: 'Account', key: 'id',
      fields: { id: { label: 'Account' }, user: { label: 'User' }, scope: { label: 'Scope' }, customer: { label: 'Customer' } } } as never);
    const root = document.getElementById('root')!;
    const provider = document.createElement('sherpa-provider') as HTMLElement & { open(def: unknown, options: unknown): Promise<unknown> };
    provider.innerHTML = '<sherpa-data-grid id="grid"></sherpa-data-grid>';
    root.append(provider);
    const user = new ArrayStore([{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }, { id: 3, name: 'Cy' }], { key: 'id' });
    const account = new ArrayStore([
      { id: 'a1', user: 1, scope: 'Organisation' },
      { id: 'a2', user: 1, scope: 'Customer', customer: 'Contoso' },
      { id: 'a3', user: 2, scope: 'Service' },
    ], { key: 'id' });
    await provider.open({
      v: 1, id: 'users',
      source: { store: 'user', fields: { name: { label: 'Name' } } },
      ui: { grid: { key: 'id', columns: [{ field: 'name' }],
        detail: { type: 'account', by: 'user', columns: [{ field: 'scope' }, { field: 'customer' }] } } },
    }, { stores: { user, account } });
    await window.__settled();
  });
});

const grid = 'document.getElementById("grid")';

test('the provider reads each shown row\'s rows of the type, by its key, and the sub-grid\'s key is the type\'s', async ({ page }) => {
  await expect.poll(() => page.evaluate((sel) => Object.keys((eval(sel) as Grid).detail?.rows ?? {}).sort(), grid)).toEqual(['1', '2']);
  const detail = await page.evaluate((sel) => {
    const d = (eval(sel) as Grid).detail!;
    return { type: d.type, by: d.by, key: d.key, one: d.rows!['1']!.map((r) => r.id), two: d.rows!['2']!.map((r) => r.id), headings: d.headings };
  }, grid);
  expect(detail).toEqual({ type: 'account', by: 'user', key: 'id', one: ['a1', 'a2'], two: ['a3'],
    headings: { id: 'Account', user: 'User', scope: 'Scope', customer: 'Customer' } });
  expect(await page.evaluate(() => typeof (window as never as { taken: unknown }).taken)).toBe('function');
});

test('a row opens on its own rows, and a later populate keeps the detail', async ({ page }) => {
  await expect.poll(() => page.evaluate((sel) => !!(eval(sel) as Grid).detail?.rows, grid)).toBe(true);
  // Ada's row opens on her two Accounts.
  await page.locator('#grid .row-open').first().click();
  const sub = page.locator('#grid .detail-grid');
  await expect.poll(() => sub.evaluate((el) => el.shadowRoot!.querySelectorAll('tbody tr.row').length)).toBe(2);
  // Its headings are the type's words, not its field names.
  expect(await sub.evaluate((el) => [...el.shadowRoot!.querySelectorAll('thead th[data-field] .head-label')].map((label) => label.textContent!.trim()))).toEqual(['Scope', 'Customer']);
  // Rows alone, as a binder gives them: the detail stays, and so does the open row's sub-grid.
  await page.evaluate(async (sel) => {
    const el = eval(sel) as Grid;
    await el.populate({ rows: [{ id: 1, name: 'Ada' }, { id: 2, name: 'Bo' }] });
  }, grid);
  expect(await page.evaluate((sel) => (eval(sel) as Grid).detail?.type, grid)).toBe('account');
  await expect.poll(() => sub.evaluate((el) => el.shadowRoot!.querySelectorAll('tbody tr.row').length)).toBe(2);
});
