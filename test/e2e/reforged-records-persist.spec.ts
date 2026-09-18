import { test, expect } from '@playwright/test';

/**
 * A RECORD SURVIVES A RELOAD.
 *
 * The example's customer store moved from `ArrayStore` to `IdbStore`
 * (`examples/views/records-data.js`), and this is the only thing that proves
 * it: a full `page.reload()`, which throws away every module, every custom
 * element and every in-memory store there has ever been.
 *
 * The existing cross-view test navigates with the ROUTER and deliberately does
 * NOT reload — it proves the store is app-level rather than view-level. That is
 * a different claim, and an ArrayStore passes it. Only a reload tells the two
 * apart.
 *
 * TRAP T-idb-is-the-only-real-local-store
 * TRAP T-idb-bulk-is-one-transaction — why the seed runs once, not per load
 */
const APP = 'http://localhost:4200/?view=records';

/** How many customers the grid says there are, once it has drawn. */
async function rowCount(page: import('@playwright/test').Page): Promise<number> {
  await page.waitForFunction(() => {
    const grid = document.querySelector('sherpa-data-grid');
    return (grid?.shadowRoot?.querySelectorAll('tbody tr').length ?? 0) > 0;
  }, undefined, { timeout: 15000 });
  return page.evaluate(() => {
    const pager = document.querySelector('sherpa-pagination');
    return Number(pager?.getAttribute('data-total-pages') ?? 0);
  });
}

/** Add one customer through the view's OWN dialog — not by poking the store. */
async function addCustomer(page: import('@playwright/test').Page, name: string): Promise<void> {
  await page.evaluate(async (who) => {
    const root = document.querySelector('sherpa-app-shell')!;
    (root.querySelector('#add-btn') as HTMLElement)?.dispatchEvent(
      new CustomEvent('button-click', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 200));
    const field = root.querySelector('#f-name') as HTMLElement & { value?: string };
    if (field) field.value = who;
    (root.querySelector('#save-btn') as HTMLElement)?.dispatchEvent(
      new CustomEvent('button-click', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 400));
  }, name);
}

test('a customer added on Records is still there after a FULL reload', async ({ page }) => {
  // A FRESH database per run, so a previous run's records cannot make this pass.
  // The app names its database `sherpa-examples`; deleting it puts the seed back
  // to first-run.
  await page.goto(APP);
  await page.evaluate(() => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('sherpa-examples');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  }));
  await page.reload();

  const seeded = await rowCount(page);

  await addCustomer(page, 'Persist Probe');
  const afterAdd = await rowCount(page);

  /* THE RELOAD. Not the router — a real one. Every module is re-imported, every
     custom element re-registered, and any in-memory store is gone. What comes
     back has to come from disk. */
  await page.reload();
  const afterReload = await rowCount(page);

  /* The record ITSELF, by name — a count of 5 could be any five hundredth row.
     Asked of the STORE rather than driven through the UI: a bound grid REPORTS
     its sort (the source owns it), so setting data-sort-field on the element is
     overwritten on the next push and the probe never reaches page 1. The store
     is the thing under test anyway; the grid is how a person would look. */
  const found = await page.evaluate(async () => {
    const { IdbStore } = await import('/dist/index.js');
    const store = new IdbStore({
      name: 'customers', database: 'sherpa-examples', key: 'email',
    });
    const row = await store.load({ filter: ['name', 'eq', 'Persist Probe'] });
    store.close();
    return row.total === 1;
  });

  expect(seeded, 'the demo records seeded on a first run').toBe(4); // 100 rows / 25
  expect(afterAdd, 'adding one took it past a page boundary').toBe(5);
  // THE POINT. An ArrayStore would be back to 4 here.
  expect(afterReload, 'the record survived a full reload').toBe(5);
  expect(found, 'and it is the record we added, not just a count').toBe(true);
});

test('the seed runs ONCE — a reload does not re-add the demo records', async ({ page }) => {
  /* The failure this guards is the opposite one: a seed that runs on every load
     would erase the edit it is meant to preserve, or double the records. Both
     look like "the demo data is fine" until someone edits something. */
  await page.goto(APP);
  await page.evaluate(() => new Promise<void>((resolve) => {
    const request = indexedDB.deleteDatabase('sherpa-examples');
    request.onsuccess = () => resolve();
    request.onerror = () => resolve();
    request.onblocked = () => resolve();
  }));

  await page.reload();
  const first = await rowCount(page);
  await page.reload();
  const second = await rowCount(page);
  await page.reload();
  const third = await rowCount(page);

  expect([first, second, third]).toEqual([4, 4, 4]);
});
