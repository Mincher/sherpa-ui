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
 * THE RECORDS PAGE, end to end — against the EXAMPLES server (:4200). A reader
 * answers Owner with a condition, saves it, and names it in the page's own
 * dialog — never the browser's prompt, Will 2026-09-25; the page keeps it over
 * the customer records, and the bar shows it in place of Owner. The rows do not
 * move: the same filter, one chip now.
 */
test('the Records page saves a condition as a filter, and nothing filters twice', async ({ page, browser }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const total = () => page.evaluate(() =>
    (window as unknown as { sherpa: { source: Source } }).sherpa.source.debugState().total);
  const all = await total();

  await page.evaluate(() => {
    localStorage.removeItem('sherpa:filters:customers');
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Bar;
    qft.setChipReading('owner', { conditions: [{ op: 'contains', text: 'Da' }] });
    qft.report();
  });
  await expect.poll(async () => page.evaluate(() => !!document
    .querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
    .querySelector('.chip[data-id="owner"] sherpa-menu[data-saveable]'))).toBe(true);
  // The SOURCE loads on its own clock: wait for the condition to narrow the rows.
  await expect.poll(total).toBeLessThan(all);
  const before = await total();

  await page.evaluate(() => {
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar')!;
    qft.shadowRoot!.querySelector('.chip[data-id="owner"] sherpa-menu')!
      .shadowRoot!.querySelector<HTMLElement>('.save')!.click();
  });
  // THE PAGE'S DIALOG asks for the name, with the field ready to type in.
  await expect.poll(() => page.evaluate(() => {
    const d = document.querySelector('#save-filter') as HTMLElement & { open: boolean };
    const field = document.querySelector('#save-filter-name');
    return { open: d.open, typing: document.activeElement === field };
  })).toEqual({ open: true, typing: true });
  await page.keyboard.type('Dana accounts');
  await page.keyboard.press('Enter');
  const bar = () => page.evaluate(() => {
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Bar & {
      savedReadings: Record<string, unknown>;
    };
    const chip = qft.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="custom:dana-accounts"]');
    return {
      saved: Object.keys(qft.savedReadings),
      on: chip?.hasAttribute('data-current') ?? false,
      owner: qft.shadowRoot!.querySelector('.chip[data-id="owner"]')!.hasAttribute('data-current'),
      kept: Object.keys(JSON.parse(localStorage.getItem('sherpa:filters:customers') ?? '{}')),
    };
  });
  await expect.poll(bar).toEqual({ saved: ['custom:dana-accounts'], on: true, owner: false, kept: ['dana-accounts'] });
  await expect.poll(total).toBe(before);
  expect(await page.evaluate(() => (document.querySelector('#save-filter') as HTMLElement & { open: boolean }).open))
    .toBe(false);
  expect(native).toEqual([]);

  // KEPT FOR THE SESSION: after a reload it is still on, and so are its rows.
  // TRAP T-a-reload-replays-the-readers-answers
  await page.reload();
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(bar).toMatchObject({ saved: ['custom:dana-accounts'], on: true });
  await expect.poll(total).toBe(before);

  /* KEPT FOR GOOD: a FRESH session — a new browser context, carrying only the
     saved filters, which live in localStorage — offers it in Add, under Custom. */
  const saved = await page.evaluate(() => localStorage.getItem('sherpa:filters:customers'));
  const fresh = await (await browser.newContext()).newPage();
  await fresh.addInitScript((v) => { if (v) localStorage.setItem('sherpa:filters:customers', v); }, saved);
  await fresh.goto('http://localhost:4200/?context=records');
  await fresh.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(() => fresh.evaluate(() => {
    const menu = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
      .querySelector('.add-btn sherpa-menu')!;
    // The heading of the section the saved row is IN — the last one above it.
    const kids = [...menu.children];
    const at = kids.findIndex((n) => n.querySelector('input[value="custom:dana-accounts"]'));
    const head = kids.slice(0, at).reverse().find((n) => n.classList.contains('menu-section'));
    return { head: head?.textContent ?? null, row: at >= 0 };
  })).toEqual({ head: 'Saved filters', row: true });
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
  await fresh.context().close();
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
 * EDIT UNPACKS; DELETE FORGETS. A reader's OWN saved chip opens "Edit filter"
 * and "Delete filter"; an app preset offers neither — it is the app's, and its
 * menu only lists its conditions (TODO 49). Edit puts
 * the answer back into its fields — a field not on the bar comes onto it — and
 * the saved chip goes off, in ONE event. Saving next offers the old name, so
 * the same name updates it. TRAP T-edit-unpacks-a-saved-filter
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
    const actions = (id: string) =>
      [...(chip(id).querySelector('sherpa-menu')?.querySelectorAll('button') ?? [])].map((b) => b.value);
    return {
      preset: { menu: chip('at-risk').hasAttribute('data-menu'), actions: actions('at-risk') },
      own: { menu: chip('custom:mine').hasAttribute('data-menu'), actions: actions('custom:mine'),
        condition: chip('custom:mine').getAttribute('data-condition') },
    };
  });

  // A preset has a menu — its conditions — and no action in it.
  expect(r.preset).toEqual({ menu: true, actions: [] });
  // Still an Advanced filter with a menu: the answer is given.
  expect(r.own).toEqual({ menu: true, actions: ['edit', 'delete'], condition: 'advanced' });
});

test('Edit unpacks the answer into its fields, in one event; Delete forgets the chip', async ({ page }) => {
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
    const press = (id: string, value: string) => chip(id)!.querySelector('sherpa-menu')!
      .querySelector<HTMLButtonElement>(`button[value="${value}"]`)!.click();
    press('custom:mine', 'edit');
    await window.__settled();
    await new Promise((res) => setTimeout(res, 150));
    await source.load();
    // What the bar HOLDS says the chip is off now — the panel draws from it.
    const heldOn = bar.presets['custom:mine']?.on;
    const fields = (bar as unknown as { readings: Record<string, { picked: unknown[]; conditions: unknown[] }> }).readings;
    const edited = {
      events,
      saved: chip('custom:mine')!.hasAttribute('data-current'),
      owner: { on: chip('owner')!.hasAttribute('data-current'), rows: fields.owner!.conditions },
      tier: { on: chip('tier')?.hasAttribute('data-current') ?? null, picked: fields.tier?.picked ?? null },
      total: source.debugState().total,
      parts: Object.keys(source.debugState().parts),
    };

    const asked: unknown[] = [];
    bar.addEventListener('filter-save', (e) => asked.push((e as CustomEvent).detail));
    bar.shadowRoot!.querySelector('.add-btn sherpa-menu')!.shadowRoot!
      .querySelector<HTMLElement>('.save')!.click();

    const told: unknown[] = [];
    bar.addEventListener('filter-delete', (e) => told.push((e as CustomEvent).detail));
    press('custom:mine', 'delete');
    await window.__settled();
    const addRows = [...bar.shadowRoot!.querySelectorAll<HTMLInputElement>('.add-btn sherpa-menu input')]
      .map((i) => i.value);
    // The same doors, CALLED: a panel in panel mode has only these.
    const bar2 = bar as unknown as { packFilter(s: unknown): void; unpackFilter(id: string): Promise<void>;
      deleteFilter(id: string): void };
    bar2.packFilter({ id: 'custom:again', label: 'Again', readings });
    const waited = bar2.unpackFilter('custom:again') instanceof Promise;
    await window.__settled();
    bar2.deleteFilter('custom:again');
    const called = { waited, gone: !chip('custom:again'), told: told.at(-1) };
    return { before, edited, heldOn, asked, told: told.slice(0, 1), gone: !chip('custom:mine'),
      offered: addRows.includes('custom:mine'), called };
  }, { OPTS });

  expect(r.before).toEqual({ total: 1, parts: ['saved:custom:mine'] });
  // ONE event: the saved chip off, and both fields holding their part again.
  expect(r.edited).toEqual({
    events: 1, saved: false,
    owner: { on: true, rows: [{ op: 'contains', text: 'Da' }] },
    tier: { on: true, picked: ['gold'] },
    total: 1, parts: [],
  });
  // Saving next offers the name it came from — the same name updates it.
  expect(r.asked).toEqual([{
    readings: { owner: { conditions: [{ op: 'contains', text: 'Da' }] }, tier: { picked: ['gold'] } },
    id: 'custom:mine', label: 'Mine',
  }]);
  expect(r.heldOn).toBe(false);
  expect(r.told).toEqual([{ id: 'custom:mine' }]);
  expect(r.gone).toBe(true);
  expect(r.offered).toBe(false);
  expect(r.called).toEqual({ waited: true, gone: true, told: { id: 'custom:again' } });
});

/** The Records page: Edit, then Save offers the old name back; Delete forgets it. */
test('the Records page edits a saved filter under its own name, and deletes it', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const kept = () => page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('sherpa:filters:customers') ?? '{}')));
  const inBar = (sel: string) => page.evaluate((s) => !!document
    .querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!.querySelector(s), sel);
  const press = (sel: string) => page.evaluate((s) => {
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar')!;
    const el = qft.shadowRoot!.querySelector(s) as HTMLElement & { shadowRoot?: ShadowRoot } | null;
    (el?.shadowRoot?.querySelector<HTMLElement>('.save') ?? el)?.click();
  }, sel);
  /** The page's own dialog asks for the name: keep what it offers, then Save. */
  const asked: string[] = [];
  const nameIt = async (name: string) => {
    await expect.poll(() => page.evaluate(() =>
      (document.querySelector('#save-filter') as HTMLElement & { open: boolean }).open)).toBe(true);
    asked.push(await page.evaluate(() =>
      (document.querySelector('#save-filter-name') as HTMLElement & { value: string }).value));
    await page.evaluate((n) => {
      (document.querySelector('#save-filter-name') as HTMLElement & { value: string }).value = n;
      document.querySelector('#save-filter-ok')!.shadowRoot!.querySelector('button')!.click();
    }, name);
  };

  await page.evaluate(() => {
    localStorage.removeItem('sherpa:filters:customers');
    const qft = document.querySelector('#context-root sherpa-quick-filter-toolbar') as Bar;
    qft.setChipReading('owner', { conditions: [{ op: 'contains', text: 'Da' }] });
    qft.report();
  });
  await expect.poll(() => inBar('.chip[data-id="owner"] sherpa-menu[data-saveable]')).toBe(true);
  await press('.chip[data-id="owner"] sherpa-menu');
  await nameIt('Dana accounts');
  await expect.poll(kept).toEqual(['dana-accounts']);

  // EDIT: the answer goes back to Owner; saving again offers the same name.
  await press('.chip[data-id="custom:dana-accounts"] sherpa-menu button[value="edit"]');
  await expect.poll(() => inBar('.chip[data-id="owner"][data-current]')).toBe(true);
  await press('.add-btn sherpa-menu');
  await nameIt('Dana accounts');
  expect(asked).toEqual(['', 'Dana accounts']);
  await expect.poll(kept).toEqual(['dana-accounts']);

  // DELETE: off the bar, and forgotten.
  await press('.chip[data-id="custom:dana-accounts"] sherpa-menu button[value="delete"]');
  await expect.poll(kept).toEqual([]);
  expect(await inBar('.chip[data-id="custom:dana-accounts"]')).toBe(false);
  expect(native).toEqual([]);
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
});

/**
 * THE PANEL, which answers for the bar in panel mode — the bar is hidden then,
 * so the panel needs every door the bar has. A saved filter in its Presets is
 * Advanced; a reader's own opens Edit and Delete, which the panel ASKS for, as it asks
 * for Add and Remove; and a whole SCOPE saves as one chip.
 * TRAP T-the-panel-saves-a-whole-scope
 */
test('the panel: saved presets are Advanced, and a scope asks to save, edit and delete', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const readings = { health: { op: 'lt', text: '60' } };
    const panel = await window.__mount<HTMLElement & { show(): void; populate(d: unknown): unknown }>(
      'sherpa-filter-panel', undefined, { 'data-min-width': '0', style: 'inline-size: 400px' });
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
      actions: [...(chip(v).querySelector('sherpa-menu')?.querySelectorAll('button') ?? [])].map((b) => b.value),
    });
    const presets = { preset: face('at-risk'), own: face('custom:mine') };

    const save = () => sr.querySelector<HTMLElement>('.scope[data-scope="data"] .scope-save')!;
    // Its ROW is what shows or not: the first row of the scope's body (TODO 117).
    const hidden = save().getClientRects().length === 0;
    panel.setAttribute('data-saveable', '');
    await window.__settled();
    const shown = save().getClientRects().length > 0;

    const asked: unknown[] = [];
    for (const type of ['filter-save', 'filter-edit', 'filter-delete']) {
      panel.addEventListener(type, (e) => asked.push({ type, ...(e as CustomEvent).detail }));
    }
    save().dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
    const own = chip('custom:mine').querySelector('sherpa-menu')!;
    own.querySelector<HTMLButtonElement>('button[value="edit"]')!.click();
    own.querySelector<HTMLButtonElement>('button[value="delete"]')!.click();
    return { presets, hidden, shown, asked };
  });

  // Advanced, and no badge: it is RESULTS since TODO 60, and a panel draws none.
  const fx = { condition: 'advanced', badge: '' };
  expect(r.presets).toEqual({ preset: { ...fx, actions: [] }, own: { ...fx, actions: ['edit', 'delete'] } });
  // Only when the host saves.
  expect(r.hidden).toBe(true);
  expect(r.shown).toBe(true);
  // The scope's ANSWERED fields, each as it can be saved — never the presets.
  expect(r.asked).toEqual([
    { type: 'filter-save', scope: 'data', readings: { owner: { picked: ['Dana'] } } },
    { type: 'filter-edit', scope: 'data', id: 'custom:mine' },
    { type: 'filter-delete', scope: 'data', id: 'custom:mine' },
  ]);
});

/** The Records page in PANEL mode: a scope saves as one chip, and the panel deletes it. */
test('in panel mode the Records page saves a whole scope, and deletes it from the panel', async ({ page }) => {
  const native: string[] = [];
  page.on('dialog', (d) => { native.push(d.type()); void d.dismiss(); });
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await page.evaluate(() => {
    localStorage.removeItem('sherpa:filters:customers');
    document.querySelector('#context-root sherpa-quick-filter-toolbar [data-filter-mode]')!
      .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  });
  const inPanel = (sel: string) => page.evaluate((s) =>
    document.querySelector('#filter-panel')!.shadowRoot!.querySelector(s), sel).then((n) => !!n);
  await expect.poll(() => inPanel('.field[data-field="owner"] .value')).toBe(true);
  const kept = () => page.evaluate(() =>
    Object.keys(JSON.parse(localStorage.getItem('sherpa:filters:customers') ?? '{}')));

  // Answer Owner in the panel, and save the scope.
  await page.evaluate(() => {
    const sr = document.querySelector('#filter-panel')!.shadowRoot!;
    const chip = sr.querySelector<HTMLElement>('.field[data-field="owner"] .value[data-value="Dana Whitlock"]')!;
    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.click();
  });
  await expect.poll(() => inPanel('.scope[data-scope="data"][data-can-save]')).toBe(true);
  await page.evaluate(() => document.querySelector('#filter-panel')!.shadowRoot!
    .querySelector('.scope[data-scope="data"] .scope-save')!
    .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true })));
  // Named in the page's own dialog. Cancel first: nothing is saved.
  const dialogOpen = () => page.evaluate(() =>
    (document.querySelector('#save-filter') as HTMLElement & { open: boolean }).open);
  await expect.poll(dialogOpen).toBe(true);
  await page.evaluate(() => document.querySelector('#save-filter-cancel')!.shadowRoot!
    .querySelector('button')!.click());
  await expect.poll(dialogOpen).toBe(false);
  expect(await kept()).toEqual([]);
  await page.evaluate(() => document.querySelector('#filter-panel')!.shadowRoot!
    .querySelector('.scope[data-scope="data"] .scope-save')!
    .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true })));
  await expect.poll(dialogOpen).toBe(true);
  await page.keyboard.type('Dana only');
  await page.evaluate(() => document.querySelector('#save-filter-ok')!.shadowRoot!
    .querySelector('button')!.click());
  await expect.poll(kept).toEqual(['dana-only']);
  await expect.poll(dialogOpen).toBe(false);
  expect(native).toEqual([]);
  const preset = '.field[data-field="presets"] .value[data-value="custom:dana-only"]';
  await expect.poll(() => page.evaluate((s) => {
    const chip = document.querySelector('#filter-panel')!.shadowRoot!.querySelector<HTMLElement>(s);
    return chip && { on: chip.hasAttribute('data-current'), condition: chip.getAttribute('data-condition') };
  }, preset)).toEqual({ on: true, condition: 'advanced' });

  // DELETE from the panel: gone from it, and forgotten.
  await page.evaluate((s) => document.querySelector('#filter-panel')!.shadowRoot!.querySelector(s)!
    .querySelector('sherpa-menu')!.querySelector<HTMLButtonElement>('button[value="delete"]')!.click(), preset);
  await expect.poll(kept).toEqual([]);
  await expect.poll(() => inPanel(preset)).toBe(false);
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
});

/* Will, TODO 49: "Any preset or saved filter chip should have a menu button to
   show a menu with the conditions applied." Read-only lines, a heading per
   field; the chip is still a toggle. TRAP T-a-saved-chip-lists-its-conditions */
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
    const rows = (id: string): string[] => [...chip(id).querySelector('sherpa-menu')!.children]
      .map((row) => `${row.localName}${row.classList.contains('menu-section') ? '.section' : row.classList.contains('menu-line') ? '.line' : ''}:${row.textContent!.trim()}`);
    const listed = Object.fromEntries(['at-risk', 'risky', 'custom:mine', 'told'].map((id) => [id, rows(id)]));
    const carets = ['at-risk', 'risky', 'custom:mine', 'told'].map((id) => chip(id).hasAttribute('data-menu'));

    // The BODY still switches it, and it is reported as a toggle.
    let heard: string[] = [];
    bar.addEventListener('quick-filter-change', (e) => { heard = (e as CustomEvent).detail.active; });
    chip('at-risk').shadowRoot!.querySelector<HTMLElement>('.body')!.click();
    await window.__settled();
    const on = { current: chip('at-risk').hasAttribute('data-current'), active: bar.active, heard, amber: chip('at-risk').hasAttribute('data-empty') };

    // The CARET opens the list; a line is not a control.
    chip('risky').toggleMenu();
    await window.__settled();
    const menu = chip('risky').querySelector<HTMLElement>('sherpa-menu')!;
    const line = menu.querySelector<HTMLElement>('.menu-line')!;
    const open = menu.hasAttribute('open');
    line.click();
    await window.__settled();
    return {
      listed, carets, on, open,
      after: { open: menu.hasAttribute('open'), current: chip('risky').hasAttribute('data-current') },
      cursor: getComputedStyle(line).cursor,
    };
  });

  expect(r.carets).toEqual([true, true, true, true]);
  // A field the bar does not hold is named by its id; one it holds, by its label.
  expect(r.listed['at-risk']).toEqual(['p.section:health', 'p.line:Less than 60']);
  expect(r.listed['risky']).toEqual([
    'p.section:health', 'p.line:Less than 60', 'p.section:Owner', 'p.line:Equals Nobody',
  ]);
  // The reader's OWN keeps Edit and Delete, under its conditions — and a line
  // opens its field, to change it (TODO 50).
  expect(r.listed['custom:mine']).toEqual([
    'p.section:Owner', 'label:Is one of Dana, Nobody', 'hr:', 'button:Edit filter', 'button:Delete filter',
  ]);
  expect(r.listed['told']).toEqual(['p.section:Health score', 'p.line:Under 60']);
  expect(r.on).toEqual({ current: true, active: ['at-risk'], heard: ['at-risk'], amber: false });
  expect(r.open).toBe(true);
  expect(r.after).toEqual({ open: true, current: false });
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
    const rows = (id: string): string[] => [...chip(id).querySelector('sherpa-menu')!.children]
      .map((row) => `${row.localName}:${row.textContent!.trim()}`);
    return { risky: rows('risky'), mine: rows('custom:mine'), caret: chip('risky').hasAttribute('data-menu') };
  });

  expect(r.caret).toBe(true);
  expect(r.risky).toEqual(['p:health', 'p:Less than 60', 'p:Owner', 'p:Equals Unassigned']);
  // The reader's OWN opens a line's field, to change it (TODO 50).
  expect(r.mine).toEqual(['p:Owner', 'label:Equals Dana', 'hr:', 'button:Edit filter', 'button:Delete filter']);
});
