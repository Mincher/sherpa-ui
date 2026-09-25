import { test, expect, type Bar } from './harness';

/**
 * A CHIP CARRIES ITS ANSWER — a saved custom filter.
 *
 * Will, 2026-09-25: presets "are actually compound conditional filters that
 * (potentially) use more than 1 field". So a def can carry its READINGS, field
 * by field. The chip is a toggle; it wears fx, and the info-blue when on; and a
 * bound source applies it as ONE named part.
 * TRAP T-a-saved-filter-is-its-readings
 */
type Source = {
  declareField(f: string, facts: { type: string }): void;
  bind(el: Element, o?: { steerOnly?: boolean }): () => void;
  load(): Promise<unknown>;
  debugState(): { total: number; parts: Record<string, unknown> };
};

test('a chip that carries its readings is a Custom Condition Filter, and a bound source applies it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => Source;
    };
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, health: 40, owner: 'Unassigned' },
      { id: 2, health: 80, owner: 'Dana' },
      { id: 3, health: 55, owner: 'Dana' },
    ]) });
    source.declareField('health', { type: 'number' });
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'at-risk', label: 'At risk', readings: { health: { op: 'lt', text: '60' } } },
      { id: 'risky-unowned', label: 'Risky and unowned', readings: {
        health: { op: 'lt', text: '60' }, owner: { op: 'eq', picked: ['Unassigned'] },
      } },
    ], { style: 'inline-size: 1200px' });
    source.bind(bar, { steerOnly: true });
    await source.load();

    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const look = (id: string) => ({
      kind: chip(id).dataset['kind'] ?? null,
      condition: chip(id).getAttribute('data-condition'),
      badge: chip(id).dataset['count'] ?? '',
      on: chip(id).hasAttribute('data-current'),
    });
    const flip = async (id: string) => {
      chip(id).shadowRoot!.querySelector<HTMLElement>('.body')!.click();
      await window.__settled();
      await source.load();
    };
    const answer = () => ({
      total: source.debugState().total,
      parts: Object.keys(source.debugState().parts).sort(),
    });

    const before = { chip: look('at-risk'), ...answer() };
    await flip('at-risk');
    const one = { chip: look('at-risk'), ...answer() };
    await flip('risky-unowned');
    const two = answer();
    await flip('at-risk');
    await flip('risky-unowned');
    const off = { chip: look('at-risk'), ...answer() };
    return { before, one, two, off };
  });

  const chip = { kind: 'custom', condition: 'custom', badge: 'fx' };
  // A Custom Condition Filter from the start: fx and custom, but not on.
  expect(r.before).toEqual({ chip: { ...chip, on: false }, total: 3, parts: [] });
  // On: its readings narrow the rows, as ONE named part.
  expect(r.one).toEqual({ chip: { ...chip, on: true }, total: 2, parts: ['saved:at-risk'] });
  // Two saved filters AND, each its own part; the second spans two fields.
  expect(r.two).toEqual({ total: 1, parts: ['saved:at-risk', 'saved:risky-unowned'] });
  // Off: the parts go, and every row comes back.
  expect(r.off).toEqual({ chip: { ...chip, on: false }, total: 3, parts: [] });
});

/**
 * THEY LIVE WITH THEIR DATA. A saved filter's readings name fields, and other
 * records may not have them — so a set is kept per DATA, not per page. The
 * saved-view door otherwise: localStorage, and the same name saves over the old
 * one, which is how Edit then Save updates a filter.
 * TRAP T-a-saved-filter-lives-with-its-data
 */
test('saved filters live with their data: saved, read back, replaced by name, deleted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Set = Record<string, { label: string; readings: Record<string, unknown> }>;
    const m = await import('/dist/data.js') as unknown as {
      saveFilterAs(data: string, label: string, readings: Record<string, unknown>): Set;
      loadSavedFilters(data: string): Set;
      deleteSavedFilter(data: string, id: string): Set;
    };
    localStorage.clear();
    m.saveFilterAs('customers', 'At risk', { health: { op: 'lt', text: '60' } });
    const two = m.saveFilterAs('customers', 'Big spenders', { spend: { op: 'gt', text: '1000' } });
    const elsewhere = m.loadSavedFilters('orders');
    const again = m.saveFilterAs('customers', 'At risk', { health: { op: 'lt', text: '50' } });
    const left = m.deleteSavedFilter('customers', 'at-risk');
    const read = m.loadSavedFilters('customers');
    // A broken entry is dropped, never handed on to a bar.
    localStorage.setItem('sherpa:filters:customers',
      JSON.stringify({ ok: { label: 'OK', readings: {} }, bad: { label: 3 }, worse: 'x' }));
    const guarded = m.loadSavedFilters('customers');
    localStorage.clear();
    return {
      two: Object.keys(two), elsewhere, again: again['at-risk'],
      left: Object.keys(left), read: Object.keys(read), guarded: Object.keys(guarded),
    };
  });

  expect(r.two).toEqual(['at-risk', 'big-spenders']);
  // Other records see none of them.
  expect(r.elsewhere).toEqual({});
  // The same NAME saves over the old one.
  expect(r.again).toEqual({ label: 'At risk', readings: { health: { op: 'lt', text: '50' } } });
  expect(r.left).toEqual(['big-spenders']);
  expect(r.read).toEqual(['big-spenders']);
  expect(r.guarded).toEqual(['ok']);
});
