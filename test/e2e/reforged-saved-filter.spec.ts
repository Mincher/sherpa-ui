import { test, expect, type Bar } from './harness';

/**
 * A CHIP CARRIES ITS ANSWER — a saved Advanced filter.
 *
 * Will, 2026-09-25: presets "are actually compound conditional filters that
 * (potentially) use more than 1 field". So a def can carry its READINGS, field
 * by field. The chip is a toggle; it reads Advanced, and the info-blue when on; and a
 * bound source applies it as ONE named part.
 * TRAP T-a-saved-filter-is-its-readings
 */
type Source = {
  declareField(f: string, facts: { type: string }): void;
  load(): Promise<unknown>;
  debugState(): { total: number; parts: Record<string, unknown> };
};

test('a chip that carries its readings is an Advanced filter, and a bound source applies it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => Source;
      bindSource(source: Source, el: Element, o?: { steerOnly?: boolean }): () => void;
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
    bindSource(source, bar, { steerOnly: true });
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

  // No badge: it is RESULTS since TODO 60, and this bar is bound with no scope.
  const chip = { kind: 'advanced', condition: 'advanced', badge: '' };
  // An Advanced filter from the start, but not on.
  expect(r.before).toEqual({ chip: { ...chip, on: false }, total: 3, parts: [] });
  // On: its readings narrow the rows, as ONE named part.
  expect(r.one).toEqual({ chip: { ...chip, on: true }, total: 2, parts: ['saved:at-risk'] });
  // Two saved filters AND, each its own part; the second spans two fields.
  expect(r.two).toEqual({ total: 1, parts: ['saved:at-risk', 'saved:risky-unowned'] });
  // Off: the parts go, and every row comes back.
  expect(r.off).toEqual({ chip: { ...chip, on: false }, total: 3, parts: [] });
});

/* Will, TODO 49: "Any preset or saved filter chip should have a menu button to
   show a menu with the conditions applied." TODO 181: each field shows its own
   menu, read-only; a field with no menu here is a line of words. The chip is
   still a toggle. TRAP T-a-saved-chip-lists-its-conditions */
test('every saved chip on a bar opens its conditions, a heading per field; it is still a toggle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const health = { op: 'lt', text: '60' };
    const bar = await window.__mount<Bar & { active: string[] }>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' },
        { value: 'Unassigned', label: 'Nobody' }] },
      { id: 'at-risk', label: 'At risk', readings: { health } },
      { id: 'risky', label: 'Risky and unowned', readings: { health, owner: { op: 'eq', picked: ['Unassigned'] } } },
      { id: 'mine', label: 'Mine', removable: true, readings: { owner: { picked: ['Dana', 'Unassigned'] } } },
      // In its SOURCE's words, where it has one.
      { id: 'told', label: 'Told', readings: { health }, says: [{ field: 'health', label: 'Health score', lines: ['Under 60'] }] },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement & { toggleMenu(): void }>(`.chip[data-id="${id}"]`)!;
    const rows = (id: string): string[] => [...chip(id).querySelector(':scope > sherpa-menu')!.children].map((row) => {
      if (row.classList.contains('saved-field')) return `menu:${row.getAttribute('data-field')}`;
      const kind = row.classList.contains('menu-section') ? '.section' : row.classList.contains('menu-line') ? '.line' : '';
      return `${row.localName}${kind}:${row.textContent!.trim()}`;
    });
    const listed = Object.fromEntries(['at-risk', 'risky', 'mine', 'told'].map((id) => [id, rows(id)]));
    const carets = ['at-risk', 'risky', 'mine', 'told'].map((id) => chip(id).hasAttribute('data-menu'));

    // The BODY still switches it, and it is reported as a toggle.
    let heard: string[] = [];
    bar.addEventListener('quick-filter-change', (e) => { heard = (e as CustomEvent).detail.active; });
    chip('at-risk').shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    const on = { current: chip('at-risk').hasAttribute('data-current'), active: bar.active, heard, amber: chip('at-risk').hasAttribute('data-filters-nothing') };

    // The CARET opens the list; neither a line nor a read-only row is a control.
    chip('risky').toggleMenu();
    await window.__settled();
    const menu = chip('risky').querySelector<HTMLElement>(':scope > sherpa-menu')!;
    const line = menu.querySelector<HTMLElement>(':scope > .menu-line')!;
    const field = menu.querySelector<HTMLElement & { reading: unknown }>(':scope > .saved-field > sherpa-menu')!;
    const was = JSON.stringify(field.reading);
    const open = menu.hasAttribute('open');
    line.click();
    field.shadowRoot!.querySelector<HTMLElement>('.condition-row')!.click();
    await window.__settled();
    return {
      listed, carets, on, open,
      after: { open: menu.hasAttribute('open'), current: chip('risky').hasAttribute('data-current'),
        same: JSON.stringify(field.reading) === was,
        inert: !!field.shadowRoot!.querySelector('.condition-rows[inert]') },
      cursor: getComputedStyle(line).cursor,
    };
  });

  expect(r.carets).toEqual([true, true, true, true]);
  // A field the bar does not hold is named by its id, in words; one it holds, by its label, in its menu.
  expect(r.listed['at-risk']).toEqual(['p.section:health', 'p.line:Less than 60']);
  expect(r.listed['risky']).toEqual(['p.section:health', 'p.line:Less than 60', 'p.section:Owner', 'menu:owner']);
  // Its conditions only: a saved set is changed by saving again (TODO 105).
  expect(r.listed['mine']).toEqual(['p.section:Owner', 'menu:owner']);
  expect(r.listed['told']).toEqual(['p.section:Health score', 'p.line:Under 60']);
  expect(r.on).toEqual({ current: true, active: ['at-risk'], heard: ['at-risk'], amber: false });
  expect(r.open).toBe(true);
  expect(r.after).toEqual({ open: true, current: false, same: true, inert: true });
  expect(r.cursor).not.toBe('pointer');
});

test('a preset chip in the panel opens its conditions too', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const panel = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-filter-panel', [{
      scope: 'data', label: 'Customer records',
      filters: [
        { id: 'owner', label: 'Owner', options: [{ value: 'Dana', label: 'Dana' }, { value: 'Unassigned', label: 'Unassigned' }] },
        { id: 'risky', label: 'Risky and unowned', preset: true,
          readings: { health: { op: 'lt', text: '60' }, owner: { op: 'eq', picked: ['Unassigned'] } } },
        { id: 'mine', label: 'Mine', preset: true, readings: { owner: { picked: ['Dana'] } } },
      ],
    }], { open: true, style: 'inline-size: 400px' });
    await window.__settled();
    const chip = (id: string) => panel.shadowRoot!.querySelector<HTMLElement>(`.value[data-value="${id}"]`)!;
    const rows = (id: string): string[] => [...chip(id).querySelector(':scope > sherpa-menu')!.children].map((row) =>
      (row.classList.contains('saved-field') ? `menu:${row.getAttribute('data-field')}` : `${row.localName}:${row.textContent!.trim()}`));
    return { risky: rows('risky'), mine: rows('mine'), caret: chip('risky').hasAttribute('data-menu') };
  });

  expect(r.caret).toBe(true);
  // A field the panel holds shows its own menu; one it does not, its words.
  expect(r.risky).toEqual(['p:health', 'p:Less than 60', 'p:Owner', 'menu:owner']);
  // Its conditions only (TODO 105).
  expect(r.mine).toEqual(['p:Owner', 'menu:owner']);
});
