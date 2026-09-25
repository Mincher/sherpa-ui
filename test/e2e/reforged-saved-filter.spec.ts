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

/**
 * SAVE PACKS. Will, 2026-09-25: "Pack / unpack" — Save moves the answered
 * fields into ONE chip, which comes on, and the fields clear. The bar offers
 * "Save filter" only where there is something to save, and only when its host
 * saves: a chip holding a Custom Condition, and the Add menu for every answered
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
  // A Custom Condition is saveable on its own; a ticked value is not, but the
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
      owner: { on: chip('owner').hasAttribute('data-current'), text: fields.owner.text,
        rows: fields.owner.conditions.length, picked: fields.owner.picked },
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
  expect(r.saved).toEqual({ on: true, condition: 'custom' });
  // The fields it came from are EMPTY and off — their answer is the chip's now.
  expect(r.owner).toEqual({ on: false, text: '', rows: 0, picked: [] });
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
 * answers Owner with a condition, saves it, and names it; the page keeps it over
 * the customer records, and the bar shows it in place of Owner. The rows do not
 * move: the same filter, one chip now.
 */
test('the Records page saves a condition as a filter, and nothing filters twice', async ({ page }) => {
  page.on('dialog', (d) => void d.accept('Dana accounts'));
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

  // KEPT: after a reload it is offered in Add, under Custom.
  await page.reload();
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  await expect.poll(() => page.evaluate(() => {
    const menu = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
      .querySelector('.add-btn sherpa-menu')!;
    const head = [...menu.children].find((n) => n.classList.contains('menu-section'));
    const row = menu.querySelector('input[value="custom:dana-accounts"]');
    return { head: head?.textContent ?? null, row: !!row };
  })).toEqual({ head: 'Custom', row: true });
  await page.evaluate(() => localStorage.removeItem('sherpa:filters:customers'));
});

/**
 * THE CUSTOM SECTION. Will: saved filters go "to the add filters menu under a
 * 'Custom' section at the bottom". The menu draws the heading where a section
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

  // Fields first; the saved ones LAST, under their heading — a held one ticked.
  expect(r.all).toEqual(['owner*', 'tier', '§Custom', 'custom:held*', 'custom:mine', 'custom:big']);
  // The heading goes with the rows under it.
  expect(r.big).toEqual(['§Custom', 'custom:big']);
  expect(r.own).toEqual(['owner*']);
  expect(r.added).toBe(true);
});
