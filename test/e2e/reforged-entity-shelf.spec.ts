import { test, expect, parkThePointer, type Page } from './fixture';
import { gotoHarness } from './harness';

/**
 * AN ENTITY SHELF crosses tabs — Will, plan 746 E2. The reader's entities of every type are ONE
 * named part of the page keeper, app-wide: an entity saved in one tab is in a second tab's shelf at
 * once (its `storage` event), and after a reload; a preset lists read only; one that another uses is
 * not removed. They are in the one browser database too, and a v2 database's `nodes` store is read
 * once as entities of the type `node`. TRAP T-only-a-named-part-crosses-tabs
 */
const SETUP = `async () => {
  const { PageKeeper } = await import('/dist/index.js');
  const keeper = new PageKeeper();
  window.keeper = keeper;
  window.filter = (id, label, kind) => ({ v: 3, type: 'filter', id, label,
    graph: kind ? { nodes: [{ id: 'inner', kind, x: 0, y: 0 }], connections: [{ from: 'inner', to: '#out/where' }] } : { nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
      { id: 'status', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
      { id: 'filter', kind: 'condition', x: 540, y: 0, values: { type: 'eq' } }, { id: 'field', kind: 'field', x: 270, y: 0, values: { field: 'status' } } ],
      connections: [{ from: 'start/rows', to: 'field' }, { from: 'field/field', to: 'filter' }, { from: 'status/value', to: 'filter/b' }, { from: 'filter/true', to: '#out/where' }] },
    settings: { source: 'customers' } });
  keeper.entityPresets = [window.filter('shipped', 'Shipped')];
  window.heard = [];
  keeper.entities.watch((list) => window.heard.push(list.map((e) => e.id)));
}`;
const setup = (page: Page) => page.evaluate(`(${SETUP})()`);
type W = { keeper: { entities: { list(): { id: string; origin: string }[]; save(e: unknown): Promise<boolean>; remove(id: string): boolean; export(id: string): string; import(json: string): Promise<string | undefined> } }; filter(id: string, label: string, kind?: string): unknown; heard: string[][] };
const listed = (page: Page) => page.evaluate(() => (window as unknown as W).keeper.entities.list().map((e) => `${e.id}${e.origin === 'preset' ? ' (preset)' : ''}`));
const save = (page: Page, id: string, label: string, kind?: string) => page.evaluate(([i, l, k]) => (window as unknown as W).keeper.entities.save((window as unknown as W).filter(i!, l!, k)), [id, label, kind]);
const clear = (page: Page) => page.evaluate(() => { for (const key of Object.keys(localStorage)) if (key.startsWith('sherpa:')) localStorage.removeItem(key); });

test('a saved entity shows in a second tab, live and after a reload; a preset is read only; one that is used stays', async ({ context }) => {
  const first = parkThePointer(await context.newPage());
  await gotoHarness(first);
  await clear(first);
  await setup(first);
  expect(await listed(first)).toEqual(['shipped (preset)']);
  expect(await save(first, 'recent', 'Recent')).toBe(true);
  expect(await listed(first)).toEqual(['shipped (preset)', 'recent']);

  // A SECOND TAB: the same localStorage.
  const second = parkThePointer(await context.newPage());
  await gotoHarness(second);
  await setup(second);
  expect(await listed(second)).toEqual(['shipped (preset)', 'recent']);
  // …and what it saves reaches the first, whose watcher heard the storage event.
  expect(await save(second, 'outer', 'Outer', 'filter:recent')).toBe(true);
  await expect.poll(() => listed(first)).toEqual(['shipped (preset)', 'recent', 'outer']);
  expect((await first.evaluate(() => (window as unknown as W).heard)).at(-1)).toEqual(['shipped', 'recent', 'outer']);

  // A preset is never the reader's: not saved over, not removed. One that is used is not removed.
  expect(await save(second, 'shipped', 'Over it')).toBe(false);
  expect(await second.evaluate(() => (window as unknown as W).keeper.entities.remove('shipped'))).toBe(false);
  expect(await second.evaluate(() => (window as unknown as W).keeper.entities.remove('recent'))).toBe(false);
  expect(await listed(second)).toEqual(['shipped (preset)', 'recent', 'outer']);

  // A RELOAD sees it too.
  await second.reload();
  await gotoHarness(second);
  await setup(second);
  expect(await listed(second)).toEqual(['shipped (preset)', 'recent', 'outer']);

  // Out and back in as JSON; then forgotten, it goes from every tab.
  const json = await second.evaluate(() => (window as unknown as W).keeper.entities.export('outer'));
  expect(JSON.parse(json).$schema).toContain('entity.v3.json');
  await second.evaluate(() => (window as unknown as W).keeper.entities.remove('outer'));
  await expect.poll(() => listed(first)).toEqual(['shipped (preset)', 'recent']);
  expect(await second.evaluate((text) => (window as unknown as W).keeper.entities.import(text), json)).toBe('outer');
  await expect.poll(() => listed(first)).toEqual(['shipped (preset)', 'recent', 'outer']);
});

