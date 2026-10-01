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
  bind(el: Element, o?: { steerOnly?: boolean }): () => void;
  load(): Promise<unknown>;
  debugState(): { total: number; parts: Record<string, unknown> };
};

test('a chip that carries its readings is an Advanced filter, and a bound source applies it', async ({ page }) => {
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

/**
 * SAVE PACKS. Will, 2026-09-25: "Pack / unpack" — Save moves the answered
 * fields into ONE chip, which comes on, and the fields clear. The bar offers
 * "Save filter" only where there is something to save, and only when its host
 * saves: a chip holding an Advanced filter, and the Add menu for every answered
 * field. The bar ASKS (`filter-save`); the host names and stores it, and hands
 * it back with `packFilter`. TRAP T-save-packs-the-fields-into-one-chip
 */
const OPTS = [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }];
const PLANS = [{ value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }];

test('"Save filter" shows where there is something to save, and asks with its readings', async ({ page }) => {
  const r = await page.evaluate(async ({ OPTS, PLANS }) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true, active: true,
        op: 'contains', text: 'Da', options: OPTS },
      { id: 'plan', label: 'Plan', select: 'multiple', active: true, options: PLANS },
    ], { style: 'inline-size: 1200px' });
    bar.available([{ id: 'tier', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }] }]);
    await window.__settled();
    const menu = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"] sherpa-menu`)!;
    const addMenu = () => bar.shadowRoot!.querySelector<HTMLElement>('.add-btn sherpa-menu')!;
    const saveable = () => ({
      owner: menu('owner').hasAttribute('data-saveable'),
      plan: menu('plan').hasAttribute('data-saveable'),
      add: addMenu().hasAttribute('data-saveable'),
    });
    const off = saveable();
    bar.setAttribute('data-saveable', '');
    await window.__settled();
    const on = saveable();

    const asked: unknown[] = [];
    bar.addEventListener('filter-save', (e) => asked.push((e as CustomEvent).detail.readings));
    const press = (m: HTMLElement) => m.shadowRoot!.querySelector<HTMLElement>('.save')!.click();
    press(menu('owner'));
    await window.__settled();
    press(addMenu());
    await window.__settled();
    return { off, on, asked };
  }, { OPTS, PLANS });

  // No host that saves, no Save.
  expect(r.off).toEqual({ owner: false, plan: false, add: false });
  // An Advanced filter is saveable on its own; a ticked value is not, but the
  // whole bar is.
  expect(r.on).toEqual({ owner: true, plan: false, add: true });
  expect(r.asked).toEqual([
    { owner: { conditions: [{ op: 'contains', text: 'Da' }] } },
    { owner: { conditions: [{ op: 'contains', text: 'Da' }] }, plan: { picked: ['Pro'] } },
  ]);
});

test('packFilter shows the saved chip ON and clears the fields it came from, in one event', async ({ page }) => {
  const r = await page.evaluate(async ({ OPTS, PLANS }) => {
    const { ArrayStore, DataSource, onReport } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => Source;
      onReport(fn: (r: { code: string }) => void): () => void;
    };
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, owner: 'Dana', plan: 'Pro' }, { id: 2, owner: 'Ravi', plan: 'Pro' },
      { id: 3, owner: 'Dana', plan: 'Free' },
    ]) });
    const bar = await window.__mount<Bar & {
      packFilter(s: { id: string; label: string; readings: Record<string, unknown> }): void;
      savedReadings: Record<string, unknown>;
    }>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true, active: true,
        op: 'contains', text: 'Da', options: OPTS },
      { id: 'plan', label: 'Plan', select: 'multiple', active: true, options: PLANS },
    ], { style: 'inline-size: 1200px', 'data-saveable': true });
    source.bind(bar, { steerOnly: true });
    bar.report();
    await window.__settled();
    await source.load();
    const before = source.debugState().total;

    let events = 0;
    bar.addEventListener('quick-filter-change', () => { events += 1; });
    const readings = { owner: { conditions: [{ op: 'contains', text: 'Da' }] }, plan: { picked: ['Pro'] } };
    bar.packFilter({ id: 'custom:mine', label: 'Mine', readings });
    await window.__settled();
    await source.load();

    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const fields = (bar as unknown as { readings: Record<string, { picked: unknown[]; conditions: unknown[]; text: string }> }).readings;
    const reports: string[] = [];
    const stop = onReport((rep) => reports.push(rep.code));
    bar.packFilter({ id: 'owner', label: 'Owner again', readings });
    stop();
    return {
      before, events,
      saved: { on: chip('custom:mine').hasAttribute('data-current'),
        condition: chip('custom:mine').getAttribute('data-condition') },
      owner: { on: chip('owner').hasAttribute('data-current'),
        rows: (fields.owner.conditions ?? []).length, picked: fields.owner.picked },
      plan: { on: chip('plan').hasAttribute('data-current'), picked: fields.plan.picked },
      savedReadings: bar.savedReadings,
      total: source.debugState().total,
      parts: Object.keys(source.debugState().parts),
      reports,
    };
  }, { OPTS, PLANS });

  expect(r.before).toBe(1);
  // ONE event, for the whole pack.
  expect(r.events).toBe(1);
  expect(r.saved).toEqual({ on: true, condition: 'advanced' });
  // The fields it came from are EMPTY and off — their answer is the chip's now.
  expect(r.owner).toEqual({ on: false, rows: 0, picked: [] });
  expect(r.plan).toEqual({ on: false, picked: [] });
  expect(r.savedReadings).toEqual({ 'custom:mine': {
    owner: { conditions: [{ op: 'contains', text: 'Da' }] }, plan: { picked: ['Pro'] },
  } });
  // The same rows, one part now, and nothing filters twice.
  expect(r.total).toBe(1);
  expect(r.parts).toEqual(['saved:custom:mine']);
  // A saved chip cannot take a FIELD's id.
  expect(r.reports).toEqual(['id-taken']);
});

/**
 * THE CUSTOM SECTION. Will: saved filters go "to the add filters menu under a
 * 'Custom' section at the bottom" — the ones not added yet. The menu draws the heading where a section
 * starts, and its search hides the heading when nothing under it matches. A
 * saved filter added from there comes ON: its answer is given.
 * TRAP T-saved-filters-are-the-custom-section
 */
test('the Add menu offers saved filters at the bottom, under Custom', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const held = { owner: { conditions: [{ op: 'contains', text: 'Da' }] } };
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', removable: true, custom: true,
        options: [{ value: 'Dana', label: 'Dana' }] },
      { id: 'custom:held', label: 'Held one', readings: held, removable: true },
    ], { style: 'inline-size: 1200px' });
    bar.available([
      { id: 'tier', label: 'Tier', options: [{ value: 'gold', label: 'Gold' }] },
      { id: 'custom:mine', label: 'Mine', readings: held },
      { id: 'custom:big', label: 'Big spenders', readings: { spend: { op: 'gt', text: '1000' } } },
    ]);
    await window.__settled();
    const menu = bar.shadowRoot!.querySelector<HTMLElement & { shadowRoot: ShadowRoot }>('.add-btn sherpa-menu')!;
    const rows = () => [...menu.children]
      .filter((n) => !n.classList.contains('qf-all') && !(n as HTMLElement).hasAttribute('data-filtered-out'))
      .map((n) => (n.classList.contains('menu-section') ? `§${n.textContent}`
        : `${n.querySelector('input')!.value}${n.querySelector('input')!.checked ? '*' : ''}`));
    const search = async (q: string) => {
      const box = menu.shadowRoot.querySelector<HTMLElement & { value: string }>('.search')!;
      box.value = q;
      box.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await window.__settled();
      return rows();
    };
    const all = rows();
    const big = await search('big');
    const own = await search('own');
    await search('');
    bar.addFilters(['custom:mine']);
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="custom:mine"]');
    return { all, big, own, added: chip?.hasAttribute('data-current') ?? null };
  });

  /* ADDED, AVAILABLE, CUSTOM — and a filter in ONE of them: the held saved
     one is Added, not Custom too. Will, 2026-09-25. */
  expect(r.all).toEqual([
    '§Added filters', 'owner*', 'custom:held*',
    '§Available filters', 'tier',
    '§Saved filters', 'custom:mine', 'custom:big',
  ]);
  // The heading goes with the rows under it.
  expect(r.big).toEqual(['§Saved filters', 'custom:big']);
  expect(r.own).toEqual(['§Added filters', 'owner*']);
  expect(r.added).toBe(true);
});

/**
 * EDIT IN PLACE; DELETE FORGETS. A reader's OWN saved chip opens "Edit filter"
 * and "Delete filter"; an app preset offers neither — it is the app's, and its
 * menu only shows its conditions (TODO 49). Edit filter makes its rows
 * editable where they are (TODO 181). TRAP T-a-saved-filter-keeps-its-edit
 */
test('a reader\'s own saved chip offers Edit and Delete; a preset does not', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const readings = { health: { op: 'lt', text: '60' } };
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'at-risk', label: 'At risk', readings },
      { id: 'custom:mine', label: 'Mine', readings, editable: true, removable: true },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    const buttons = (id: string) => [...(chip(id).querySelector(':scope > sherpa-menu')?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? [])];
    return {
      preset: { menu: chip('at-risk').hasAttribute('data-menu'), actions: buttons('at-risk').map((b) => b.value) },
      own: { menu: chip('custom:mine').hasAttribute('data-menu'), actions: buttons('custom:mine').map((b) => b.value),
        shown: buttons('custom:mine').filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.value),
        condition: chip('custom:mine').getAttribute('data-condition') },
    };
  });

  // A preset has a menu — its conditions — and no action in it.
  expect(r.preset).toEqual({ menu: true, actions: [] });
  // Still an Advanced filter with a menu: the answer is given. Save and Discard wait for a change.
  expect(r.own).toEqual({ menu: true, actions: ['save-edit', 'discard-edit', 'edit', 'delete'],
    shown: ['edit', 'delete'], condition: 'advanced' });
});

test('Edit filter edits in place, and the fields are left as they were; Delete forgets the chip', async ({ page }) => {
  const r = await page.evaluate(async ({ OPTS }) => {
    const { ArrayStore, DataSource } = await import('/dist/data.js') as unknown as {
      ArrayStore: new (rows: unknown[]) => unknown;
      DataSource: new (o: { store: unknown }) => Source;
    };
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, owner: 'Dana', tier: 'gold' }, { id: 2, owner: 'Dana', tier: 'silver' },
      { id: 3, owner: 'Ravi', tier: 'gold' },
    ]) });
    const readings = { owner: { conditions: [{ op: 'contains', text: 'Da' }] }, tier: { picked: ['gold'] } };
    const bar = await window.__mount<Bar & { savedReadings: Record<string, unknown> }>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', custom: true, removable: true, options: OPTS },
      { id: 'custom:mine', label: 'Mine', readings, editable: true, removable: true, active: true },
    ], { style: 'inline-size: 1200px', 'data-saveable': true });
    bar.available([{ id: 'tier', label: 'Tier', select: 'multiple',
      options: [{ value: 'gold', label: 'Gold' }, { value: 'silver', label: 'Silver' }] }]);
    source.bind(bar, { steerOnly: true });
    bar.report();
    await window.__settled();
    await source.load();
    const before = { total: source.debugState().total, parts: Object.keys(source.debugState().parts) };

    let events = 0;
    bar.addEventListener('quick-filter-change', () => { events += 1; });
    const chip = (id: string) => bar.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`);
    const menu = (id: string) => chip(id)!.querySelector<HTMLElement>(':scope > sherpa-menu')!;
    const press = (id: string, value: string) => menu(id).querySelector<HTMLButtonElement>(`button[value="${value}"]`)!.click();
    press('custom:mine', 'edit');
    await window.__settled();
    await source.load();
    const fields = [...menu('custom:mine').querySelectorAll<HTMLElement>(':scope > .saved-field > sherpa-menu')];
    const edited = {
      events,
      saved: chip('custom:mine')!.hasAttribute('data-current'),
      editing: menu('custom:mine').hasAttribute('data-editing'),
      fields: fields.map((m) => `${m.dataset['field']}:${m.hasAttribute('data-readonly')}`),
      owner: chip('owner')!.hasAttribute('data-current'),
      tier: !!chip('tier'),
      total: source.debugState().total,
      parts: Object.keys(source.debugState().parts),
    };

    const told: unknown[] = [];
    bar.addEventListener('filter-delete', (e) => told.push((e as CustomEvent).detail));
    menu('custom:mine').removeAttribute('data-editing');
    press('custom:mine', 'delete');
    await window.__settled();
    const addRows = [...bar.shadowRoot!.querySelectorAll<HTMLInputElement>('.add-btn sherpa-menu input')]
      .map((i) => i.value);
    // The same doors, CALLED: a panel in panel mode has only these.
    const bar2 = bar as unknown as { packFilter(s: unknown): void; deleteFilter(id: string): void; unpackFilter?: unknown };
    bar2.packFilter({ id: 'custom:again', label: 'Again', readings });
    await window.__settled();
    bar2.deleteFilter('custom:again');
    const called = { gone: !chip('custom:again'), told: told.at(-1), unpack: typeof bar2.unpackFilter };
    return { before, edited, told: told.slice(0, 1), gone: !chip('custom:mine'),
      offered: addRows.includes('custom:mine'), called };
  }, { OPTS });

  expect(r.before).toEqual({ total: 1, parts: ['saved:custom:mine'] });
  // Nothing is reported, the saved chip stays on, and no field comes onto the bar.
  expect(r.edited).toEqual({
    events: 0, saved: true, editing: true,
    fields: ['owner:false', 'tier:false'],
    owner: false, tier: false,
    total: 1, parts: ['saved:custom:mine'],
  });
  expect(r.told).toEqual([{ id: 'custom:mine' }]);
  expect(r.gone).toBe(true);
  expect(r.offered).toBe(false);
  expect(r.called).toEqual({ gone: true, told: { id: 'custom:again' }, unpack: 'undefined' });
});

/**
 * THE PANEL, which answers for the bar in panel mode — the bar is hidden then,
 * so the panel needs every door the bar has. A saved filter in its Presets is
 * Advanced; a reader's own edits in place, and its Delete the panel ASKS for, as
 * it asks for Add and Remove; and a whole SCOPE saves as one chip.
 * TRAP T-the-panel-saves-a-whole-scope
 */
test('the panel: saved presets are Advanced, and a scope asks to save and delete', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const readings = { health: { op: 'lt', text: '60' } };
    const panel = await window.__mount<HTMLElement & { show(): void; populate(d: unknown): unknown }>(
      'sherpa-filter-panel', undefined, { style: 'inline-size: 400px' });
    await panel.populate([{
      scope: 'data', label: 'Data', filters: [
        { id: 'at-risk', label: 'At risk', preset: true, readings, active: true },
        { id: 'custom:mine', label: 'Mine', preset: true, readings, editable: true },
        { id: 'owner', label: 'Owner', select: 'multiple',
          options: [{ value: 'Dana', label: 'Dana', selected: true }, { value: 'Ravi', label: 'Ravi' }] },
      ],
    }]);
    panel.show();
    await window.__settled();
    const sr = panel.shadowRoot!;
    const chip = (v: string) => sr.querySelector<HTMLElement>(`.field[data-field="presets"] .value[data-value="${v}"]`)!;
    const face = (v: string) => ({
      condition: chip(v).getAttribute('data-condition'), badge: chip(v).dataset['count'] ?? '',
      actions: [...(chip(v).querySelector(':scope > sherpa-menu')?.querySelectorAll(':scope > button') ?? [])].map((b) => b.value),
    });
    const presets = { preset: face('at-risk'), own: face('custom:mine') };

    const save = () => sr.querySelector<HTMLElement>('.scope[data-scope="data"] .scope-save')!;
    // Its ROW is what shows or not: the first row of the scope's body (TODO 117).
    const hidden = save().getClientRects().length === 0;
    panel.setAttribute('data-saveable', '');
    await window.__settled();
    const shown = save().getClientRects().length > 0;

    const asked: unknown[] = [];
    for (const type of ['filter-save', 'filter-edit', 'filter-delete', 'preset-edit']) {
      panel.addEventListener(type, (e) => asked.push({ type, ...(e as CustomEvent).detail }));
    }
    save().dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    const own = chip('custom:mine').querySelector<HTMLElement>(':scope > sherpa-menu')!;
    // Edit filter edits in place: nothing is asked.
    own.querySelector<HTMLButtonElement>(':scope > button[value="edit"]')!.click();
    const editing = own.hasAttribute('data-editing');
    own.removeAttribute('data-editing');
    own.querySelector<HTMLButtonElement>(':scope > button[value="delete"]')!.click();
    return { presets, hidden, shown, asked, editing };
  });

  // Advanced, and no badge: it is RESULTS since TODO 60, and a panel draws none.
  const fx = { condition: 'advanced', badge: '' };
  expect(r.presets).toEqual({ preset: { ...fx, actions: [] },
    own: { ...fx, actions: ['save-edit', 'discard-edit', 'edit', 'delete'] } });
  // Only when the host saves.
  expect(r.hidden).toBe(true);
  expect(r.shown).toBe(true);
  // The scope's ANSWERED fields, each as it can be saved — never the presets.
  expect(r.asked).toEqual([
    { type: 'filter-save', scope: 'data', readings: { owner: { picked: ['Dana'] } } },
    { type: 'filter-delete', scope: 'data', id: 'custom:mine' },
  ]);
  expect(r.editing).toBe(true);
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
      { id: 'custom:mine', label: 'Mine', editable: true, removable: true, readings: { owner: { picked: ['Dana', 'Unassigned'] } } },
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
    const listed = Object.fromEntries(['at-risk', 'risky', 'custom:mine', 'told'].map((id) => [id, rows(id)]));
    const carets = ['at-risk', 'risky', 'custom:mine', 'told'].map((id) => chip(id).hasAttribute('data-menu'));

    // The BODY still switches it, and it is reported as a toggle.
    let heard: string[] = [];
    bar.addEventListener('quick-filter-change', (e) => { heard = (e as CustomEvent).detail.active; });
    chip('at-risk').shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    const on = { current: chip('at-risk').hasAttribute('data-current'), active: bar.active, heard, amber: chip('at-risk').hasAttribute('data-empty') };

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
  // The reader's OWN keeps its actions, under its conditions (TODO 50).
  expect(r.listed['custom:mine']).toEqual([
    'p.section:Owner', 'menu:owner', 'hr:', 'button:Save filter', 'button:Discard changes',
    'button:Edit filter', 'button:Delete filter',
  ]);
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
        { id: 'custom:mine', label: 'Mine', preset: true, editable: true, readings: { owner: { picked: ['Dana'] } } },
      ],
    }], { open: true, style: 'inline-size: 400px' });
    await window.__settled();
    const chip = (id: string) => panel.shadowRoot!.querySelector<HTMLElement>(`.value[data-value="${id}"]`)!;
    const rows = (id: string): string[] => [...chip(id).querySelector(':scope > sherpa-menu')!.children].map((row) =>
      (row.classList.contains('saved-field') ? `menu:${row.getAttribute('data-field')}` : `${row.localName}:${row.textContent!.trim()}`));
    return { risky: rows('risky'), mine: rows('custom:mine'), caret: chip('risky').hasAttribute('data-menu') };
  });

  expect(r.caret).toBe(true);
  // A field the panel holds shows its own menu; one it does not, its words.
  expect(r.risky).toEqual(['p:health', 'p:Less than 60', 'p:Owner', 'menu:owner']);
  // The reader's OWN keeps its actions (TODO 181).
  expect(r.mine).toEqual(['p:Owner', 'menu:owner', 'hr:', 'button:Save filter', 'button:Discard changes',
    'button:Edit filter', 'button:Delete filter']);
});
