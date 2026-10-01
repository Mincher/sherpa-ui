import { test, expect, type Bar } from './harness';

/**
 * A SAVED FILTER KEEPS ITS EDIT — Will, TODO 50, and TODO 181: "The
 * preset/saved filter menus should show the condition input rows, in read only
 * mode, rather than just text labels."
 *
 * Each field shows its OWN menu, read-only. Edit filter makes those rows
 * editable in place; the change is sent ONCE, as editing ends, and its source
 * keeps it as an edit until it is saved or put back.
 * TRAP T-a-saved-filter-keeps-its-edit · TRAP T-a-saved-chip-lists-its-conditions
 */

const OWNERS = [
  { value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Unassigned', label: 'Nobody' },
];

/** What the helpers below read off a field menu. */
type FieldMenu = HTMLElement & {
  reading: Record<string, unknown>;
  conditions: { op: string; join?: string; picked?: string[]; text?: string }[];
  values: string[];
};

test('Edit filter edits a saved filter in place; the change is sent once, as editing ends', async ({ page }) => {
  const r = await page.evaluate(async (OPTS) => {
    const saved = { owner: { picked: ['Dana', 'Unassigned'] } };
    const bar = await window.__mount<Bar & {
      drawScope(s: unknown): Promise<void>;
      packFilter(s: { id: string; label: string; readings: unknown }): void;
    }>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', options: OPTS },
      { id: 'custom:mine', label: 'Mine', editable: true, removable: true, active: true, readings: saved },
      { id: 'at-risk', label: 'At risk', readings: { owner: { picked: ['Unassigned'] } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = (id: string) => sr.querySelector<HTMLElement & { toggleMenu(): void }>(`.chip[data-id="${id}"]`)!;
    const menuOf = (id: string) => chip(id).querySelector<HTMLElement & { open: boolean }>(':scope > sherpa-menu')!;
    const field = (id: string) => menuOf(id).querySelector<FieldMenu>(':scope > .saved-field > sherpa-menu')!;
    const parts = (id: string) => [...menuOf(id).children].map((n) =>
      (n.localName === 'div' ? `div.${n.className}:${n.getAttribute('data-field')}` : `${n.localName}:${n.textContent!.trim()}`));
    const shows = (id: string) => [...menuOf(id).querySelectorAll<HTMLButtonElement>(':scope > button')]
      .filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.value);
    const rows = (id: string) => field(id).conditions.map((c) => [c.op, c.join ?? '', ...(c.picked ?? [])]);
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'filter-save', 'quick-filter-change']) {
      bar.addEventListener(type, (e) => heard.push({ type, ...(e as CustomEvent).detail }));
    }

    const own = field('custom:mine');
    const group = own.parentElement!;
    const drawn = {
      own: parts('custom:mine'), shipped: parts('at-risk'), shows: shows('custom:mine'),
      field: ['data-inline', 'data-readonly', 'data-advanced', 'slot'].filter((a) => own.hasAttribute(a)),
      mode: own.dataset['mode'], rows: rows('custom:mine'),
      group: { role: group.getAttribute('role'), name: group.getAttribute('aria-label'), said: group.getAttribute('aria-description') },
    };

    chip('custom:mine').toggleMenu();
    await window.__settled();
    menuOf('custom:mine').querySelector<HTMLElement>('button[value="edit"]')!.click();
    await window.__settled();
    const editing = {
      open: menuOf('custom:mine').open, editing: menuOf('custom:mine').hasAttribute('data-editing'),
      readonly: own.hasAttribute('data-readonly'), shows: shows('custom:mine'),
      focus: (sr.activeElement as HTMLButtonElement | null)?.value,
    };
    // Drop the Nobody row: a draft, so nothing is sent yet.
    own.shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')[1]!.querySelector<HTMLElement>('.drop-condition')!.click();
    await window.__settled();
    const draft = [...heard];
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await window.__settled();
    const closed = { heard: [...heard], open: menuOf('custom:mine').open, readonly: own.hasAttribute('data-readonly') };
    heard.length = 0;

    // Its SOURCE keeps the change and draws it back, IN PLACE.
    const before = menuOf('custom:mine');
    const edit = (closed.heard[0] as { readings: unknown }).readings;
    await bar.drawScope({ holds: ['owner'], readings: {}, presets: { 'custom:mine': true }, edits: { 'custom:mine': edit } });
    await window.__settled();
    const box = (id: string) => chip(id).shadowRoot!.querySelector<HTMLElement>('.body')!;
    const body = (id: string) => getComputedStyle(box(id));
    chip('owner').setAttribute('data-pending', '');
    // Both at REST: a chip's colours transition.
    await Promise.all(['owner', 'custom:mine'].flatMap((id) => box(id).getAnimations().map((a) => a.finished)));
    const back = {
      edited: chip('custom:mine').hasAttribute('data-edited'),
      same: menuOf('custom:mine') === before,
      rows: rows('custom:mine'),
      // The pending look: the active edge, and no fill.
      edge: body('custom:mine').borderColor === body('owner').borderColor,
      fill: body('custom:mine').backgroundColor === body('owner').backgroundColor,
      presets: bar.presets,
    };
    chip('owner').removeAttribute('data-pending');
    // Read OPEN: WebKit keeps a stale style for a row inside a shut card.
    chip('custom:mine').toggleMenu();
    await window.__settled();
    const backShows = shows('custom:mine');
    menuOf('custom:mine').hide();
    await window.__settled();

    menuOf('custom:mine').querySelector<HTMLButtonElement>('button[value="save-edit"]')!.click();
    menuOf('custom:mine').querySelector<HTMLButtonElement>('button[value="discard-edit"]')!.click();
    await window.__settled();
    const actions = { heard: [...heard], rows: rows('custom:mine') };
    heard.length = 0;

    // Saved under its own name: the change is spent, and its source is told.
    bar.packFilter({ id: 'custom:mine', label: 'Mine', readings: edit });
    await window.__settled();
    return {
      drawn, editing, draft, closed, edit, back: { ...back, shows: backShows }, actions,
      packed: { heard: heard.filter((h) => (h as { type: string }).type === 'preset-edit'),
        edited: chip('custom:mine').hasAttribute('data-edited') },
    };
  }, OWNERS);

  // The field's OWN menu, read-only, on its rows; Save and Discard wait for a change.
  expect(r.drawn).toEqual({
    own: ['p:Owner', 'div.saved-field:owner', 'hr:', 'button:Save filter', 'button:Discard changes',
      'button:Edit filter', 'button:Delete filter'],
    shipped: ['p:Owner', 'div.saved-field:owner'],
    shows: ['edit', 'delete'],
    field: ['data-inline', 'data-readonly', 'data-advanced'],
    mode: 'advanced',
    rows: [['eq', '', 'Dana'], ['eq', 'or', 'Unassigned']],
    group: { role: 'group', name: 'Owner', said: 'Is one of Dana, Nobody' },
  });
  // Edit filter keeps the card open and its rows take changes.
  expect(r.editing).toEqual({ open: true, editing: true, readonly: false, shows: ['save-edit', 'discard-edit'], focus: 'save-edit' });
  expect(r.draft).toEqual([]);
  // ONE change as the card closes; the chip it was on stays on.
  expect(r.closed).toEqual({
    heard: [{ type: 'preset-edit', id: 'custom:mine', readings: { owner: { conditions: [{ op: 'eq', picked: ['Dana'] }] } } }],
    open: false, readonly: true,
  });
  expect(r.back).toEqual({
    edited: true, same: true,
    rows: [['eq', '', 'Dana']],
    shows: ['save-edit', 'discard-edit', 'edit', 'delete'],
    edge: true, fill: true,
    // The LIBRARY keeps what was saved.
    presets: { 'custom:mine': { on: true, readings: { owner: { picked: ['Dana', 'Unassigned'] } } },
      'at-risk': { on: false, readings: { owner: { picked: ['Unassigned'] } } } },
  });
  expect(r.actions).toEqual({
    heard: [
      { type: 'filter-save', readings: r.edit, id: 'custom:mine', label: 'Mine' },
      { type: 'preset-edit', id: 'custom:mine', readings: null },
    ],
    // Discard puts the saved rows back.
    rows: [['eq', '', 'Dana'], ['eq', 'or', 'Unassigned']],
  });
  expect(r.packed).toEqual({ heard: [{ type: 'preset-edit', id: 'custom:mine', readings: null }], edited: false });
});

test('an OFF saved filter comes on as its change is kept; a number shows its rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'health', label: 'Health', kind: 'number', advanced: true, min: 0, max: 100 },
      { id: 'custom:risky', label: 'Risky', editable: true, removable: true,
        readings: { health: { conditions: [{ op: 'lt', text: '60' }] } } },
      { id: 'custom:mid', label: 'Mid', readings: { health: { picked: ['10', '40'], range: true } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = (id: string) => sr.querySelector<HTMLElement & { toggleMenu(): void; current: boolean }>(`.chip[data-id="${id}"]`)!;
    const field = (id: string) => chip(id).querySelector<FieldMenu>(':scope > sherpa-menu > .saved-field > sherpa-menu')!;
    const rows = (id: string) => field(id).conditions.map((c) => [c.op, c.join ?? '', c.text ?? '']);
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'quick-filter-change']) {
      bar.addEventListener(type, (e) => heard.push({ type, ...(e as CustomEvent).detail }));
    }
    const shown = { risky: rows('custom:risky'), mid: rows('custom:mid'), mode: field('custom:risky').dataset['mode'] };
    chip('custom:risky').toggleMenu();
    await window.__settled();
    chip('custom:risky').querySelector<HTMLElement>('button[value="edit"]')!.click();
    await window.__settled();
    field('custom:risky').conditions = [{ op: 'lt', text: '50' }];
    await window.__settled();
    chip('custom:risky').querySelector<HTMLElement & { hide(): void }>(':scope > sherpa-menu')!.hide();
    await window.__settled();
    return {
      shown, on: chip('custom:risky').current,
      heard: heard.map((h) => {
        const { type, id, readings, active } = h as Record<string, unknown>;
        return type === 'preset-edit' ? { type, id, readings } : { type, active };
      }),
    };
  });

  expect(r.shown).toEqual({ risky: [['lt', '', '60']], mid: [['gte', '', '10'], ['lte', 'and', '40']], mode: 'advanced' });
  expect(r.on).toBe(true);
  // ON first, then the change: a scope drawn with it off would switch it off.
  expect(r.heard).toEqual([
    { type: 'quick-filter-change', active: ['custom:risky'] },
    { type: 'preset-edit', id: 'custom:risky', readings: { health: { conditions: [{ op: 'lt', text: '50' }] } } },
  ]);
});

/** TRAP T-a-nested-menu-answers-for-itself */
test('a saved filter being edited is its own: the bar, its chips and their radios hear nothing', async ({ page }) => {
  const r = await page.evaluate(async (OPTS) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', options: OPTS, advanced: true, active: true },
      { id: 'plan', label: 'Plan', select: 'single', active: true,
        options: [{ value: 'basic', label: 'Basic' }, { value: 'pro', label: 'Pro' }] },
      { id: 'custom:mine', label: 'Mine', editable: true, active: true,
        readings: { owner: { picked: ['Dana', 'Ravi'] }, plan: { picked: ['basic'] } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = (id: string) => sr.querySelector<HTMLElement & {
      toggleMenu(): void; values: string[]; valueLabel?: string;
    }>(`.chip[data-id="${id}"]`)!;
    const menu = chip('custom:mine').querySelector<HTMLElement>(':scope > sherpa-menu')!;
    const field = (f: string) => menu.querySelector<FieldMenu>(`:scope > .saved-field > sherpa-menu[data-field="${f}"]`)!;
    // The bar's own Plan chip: Pro ticked.
    (bar as unknown as { setChipValues(id: string, v: string[]): void }).setChipValues('plan', ['pro']);
    await window.__settled();
    const look = () => ({
      values: bar.values, active: bar.active,
      mine: ['data-current', 'data-pending', 'data-unavailable', 'data-badge', 'title']
        .map((a) => `${a}=${chip('custom:mine').getAttribute(a)}`),
      chipValues: chip('custom:mine').values, label: chip('custom:mine').valueLabel ?? null,
      plan: chip('plan').querySelector<HTMLInputElement>('input:checked')?.value,
    });
    const heard: string[] = [];
    for (const type of ['quick-filter-change', 'menu-change', 'menu-items', 'preset-edit', 'condition-change', 'change', 'input']) {
      bar.addEventListener(type, () => heard.push(type));
    }
    const was = look();
    chip('custom:mine').toggleMenu();
    await window.__settled();
    menu.querySelector<HTMLElement>('button[value="edit"]')!.click();
    await window.__settled();
    const owner = field('owner');
    owner.shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')[1]!.querySelector<HTMLElement>('.drop-condition')!.click();
    owner.shadowRoot!.querySelector<HTMLElement>('.add-condition')!.click();
    await window.__settled();
    const plan = field('plan');
    plan.conditions = [{ op: 'eq', picked: ['pro'] }];
    await window.__settled();
    const editing = { look: look(), heard: [...heard] };
    // Nothing changed, closed: no edit. A fresh Edit then a close with nothing touched sends nothing.
    return { was, editing };
  }, OWNERS);

  expect(r.editing.look).toEqual(r.was);
  expect(r.was.plan).toBe('pro');
  expect(r.editing.heard).toEqual([]);
});

test('Edit filter, then a close with nothing changed, sends nothing; a rebuild mid-edit keeps the change', async ({ page }) => {
  const r = await page.evaluate(async (OPTS) => {
    const defs = [
      { id: 'owner', label: 'Owner', options: OPTS },
      { id: 'custom:mine', label: 'Mine', editable: true, readings: { owner: { picked: ['Dana', 'Unassigned'] } } },
    ];
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', defs, { style: 'inline-size: 1200px' });
    await window.__settled();
    const sr = bar.shadowRoot!;
    const chip = () => sr.querySelector<HTMLElement & { toggleMenu(): void; current: boolean }>('.chip[data-id="custom:mine"]')!;
    const menu = () => chip().querySelector<HTMLElement & { hide(): void }>(':scope > sherpa-menu')!;
    const field = () => menu().querySelector<FieldMenu>(':scope > .saved-field > sherpa-menu')!;
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'quick-filter-change']) {
      bar.addEventListener(type, (e) => heard.push({ type, ...(e as CustomEvent).detail }));
    }
    const edit = async () => {
      chip().toggleMenu();
      await window.__settled();
      menu().querySelector<HTMLElement>('button[value="edit"]')!.click();
      await window.__settled();
    };

    await edit();
    menu().hide();
    await window.__settled();
    const untouched = [...heard];

    // A change, then the bar is rebuilt under it: the change is sent first.
    await edit();
    field().shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')[1]!.querySelector<HTMLElement>('.drop-condition')!.click();
    await window.__settled();
    bar.populate(defs);
    await window.__settled();
    return {
      untouched,
      rebuilt: heard.map((h) => {
        const { type, id, readings, active } = h as Record<string, unknown>;
        return type === 'preset-edit' ? { type, id, readings } : { type, active };
      }),
      on: chip().current,
    };
  }, OWNERS);

  expect(r.untouched).toEqual([]);
  expect(r.rebuilt).toEqual([
    { type: 'quick-filter-change', active: ['custom:mine'] },
    { type: 'preset-edit', id: 'custom:mine', readings: { owner: { conditions: [{ op: 'eq', picked: ['Dana'] }] } } },
  ]);
  expect(r.on).toBe(true);
});

test('a saved date shows its own calendar: a day press changes nothing until Edit filter', async ({ page }) => {
  await page.evaluate(async () => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'renewal', label: 'Renewal', kind: 'date' },
      { id: 'custom:due', label: 'Due', editable: true, active: true, readings: { renewal: { picked: ['2026-03-04'] } } },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    bar.shadowRoot!.querySelector<HTMLElement & { toggleMenu(): void }>('.chip[data-id="custom:due"]')!.toggleMenu();
    await window.__settled();
  });
  const field = 'sherpa-quick-filter-toolbar .chip[data-id="custom:due"] > sherpa-menu > .saved-field > sherpa-menu';
  // A REAL press: `inert` stops the pointer, not a scripted click().
  const press = async (iso: string) => {
    const box = await page.evaluate(({ field, iso }) => {
      const bar = document.querySelector('sherpa-quick-filter-toolbar')!.shadowRoot!;
      const menu = bar.querySelector(field.replace('sherpa-quick-filter-toolbar ', ''))!;
      const cal = menu.querySelector('sherpa-calendar')!;
      const cell = cal.shadowRoot!.querySelector<HTMLElement>(`sherpa-calendar-cell[data-iso="${iso}"]`)!;
      cell.scrollIntoView({ block: 'center' });
      const r = cell.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, { field, iso });
    await page.mouse.click(box.x, box.y);
    await page.evaluate(() => window.__settled());
  };
  const read = () => page.evaluate((field) => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar')!.shadowRoot!;
    const menu = bar.querySelector<HTMLElement & { values: string[] }>(field.replace('sherpa-quick-filter-toolbar ', ''))!;
    return { values: menu.values, inert: !!menu.shadowRoot!.querySelector('.rows[inert]') };
  }, field);

  const shown = await read();
  await press('2026-03-10');
  const readOnly = await read();
  const heard = await page.evaluate(async () => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar')!;
    const list: unknown[] = [];
    bar.addEventListener('preset-edit', (e) => list.push((e as CustomEvent).detail));
    (window as unknown as { __heard: unknown[] }).__heard = list;
    bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="custom:due"] > sherpa-menu > button[value="edit"]')!.click();
    await window.__settled();
  });
  void heard;
  await press('2026-03-12');
  const editing = await read();
  const sent = await page.evaluate(async () => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar')!;
    bar.shadowRoot!.querySelector<HTMLElement & { hide(): void }>('.chip[data-id="custom:due"] > sherpa-menu')!.hide();
    await window.__settled();
    return (window as unknown as { __heard: unknown[] }).__heard;
  });

  expect(shown).toEqual({ values: ['2026-03-04'], inert: true });
  expect(readOnly).toEqual({ values: ['2026-03-04'], inert: true });
  expect(editing).toEqual({ values: ['2026-03-12'], inert: false });
  expect(sent).toEqual([{ id: 'custom:due', readings: { renewal: { picked: ['2026-03-12'] } } }]);
});

/** THE PANEL, which answers for the bar in panel mode, has the same doors. */
test('in the panel Edit filter edits a saved filter in place; its change is drawn, saved or put back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const owner = { id: 'owner', label: 'Owner', select: 'multiple',
      options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Unassigned', label: 'Nobody' }] };
    const saved = { owner: { picked: ['Dana', 'Unassigned'] } };
    const mine = { id: 'custom:mine', label: 'Mine', preset: true, editable: true, readings: saved };
    const panel = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-filter-panel',
      [{ scope: 'data', label: 'Customer records', filters: [mine, owner] }], { open: true, style: 'inline-size: 400px' });
    await window.__settled();
    const sr = panel.shadowRoot!;
    const chip = () => sr.querySelector<HTMLElement & { toggleMenu(): void }>('.value[data-value="custom:mine"]')!;
    const menu = () => chip().querySelector<HTMLElement & { open: boolean; hide(): void }>(':scope > sherpa-menu')!;
    const field = () => menu().querySelector<FieldMenu>(':scope > .saved-field > sherpa-menu')!;
    const parts = () => [...menu().children].map((n) =>
      (n.localName === 'div' ? `div.${n.className}:${n.getAttribute('data-field')}` : `${n.localName}:${n.textContent!.trim()}`));
    const rows = () => field().conditions.map((c) => [c.op, c.join ?? '', ...(c.picked ?? [])]);
    const shows = () => [...menu().querySelectorAll<HTMLButtonElement>(':scope > button')]
      .filter((b) => getComputedStyle(b).display !== 'none').map((b) => b.value);
    const heard: unknown[] = [];
    for (const type of ['preset-edit', 'filter-save', 'quick-filter-change']) {
      panel.addEventListener(type, (e) => {
        const d = (e as CustomEvent).detail;
        heard.push(type === 'quick-filter-change' ? { type, presets: d.readings?.data?.presets?.picked } : { type, ...d });
      });
    }
    const drawn = { parts: parts(), rows: rows(), readonly: field().hasAttribute('data-readonly') };

    chip().toggleMenu();
    await window.__settled();
    menu().querySelector<HTMLElement>(':scope > button[value="edit"]')!.click();
    await window.__settled();
    const editing = { open: menu().open, readonly: field().hasAttribute('data-readonly'), shows: shows() };
    field().shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')[1]!.querySelector<HTMLElement>('.drop-condition')!.click();
    await window.__settled();
    const draft = [...heard];
    menu().hide();
    await window.__settled();
    const applied = [...heard];
    heard.length = 0;

    // Its source draws the change back. A rebuild mid-edit sends the change first.
    const edit = { owner: { conditions: [{ op: 'eq', picked: ['Dana'] }] } };
    await panel.populate([{ scope: 'data', label: 'Customer records', filters: [
      { ...mine, active: true, edited: edit }, owner,
    ] }]);
    await window.__settled();
    const back = { edited: chip().hasAttribute('data-edited'), rows: rows() };
    chip().toggleMenu();
    await window.__settled();
    menu().querySelector<HTMLElement>(':scope > button[value="edit"]')!.click();
    await window.__settled();
    field().conditions = [{ op: 'eq', picked: ['Ravi'] }];
    await window.__settled();
    await panel.populate([{ scope: 'data', label: 'Customer records', filters: [
      { ...mine, active: true, edited: edit }, owner,
    ] }]);
    await window.__settled();
    const flushed = [...heard];
    heard.length = 0;

    menu().querySelector<HTMLButtonElement>(':scope > button[value="save-edit"]')!.click();
    menu().querySelector<HTMLButtonElement>(':scope > button[value="discard-edit"]')!.click();
    await window.__settled();
    return { drawn, editing, draft, applied, back, flushed, actions: heard, rows: rows(),
      editor: !!sr.querySelector('.editor') };
  });

  expect(r.drawn).toEqual({
    parts: ['p:Owner', 'div.saved-field:owner', 'hr:', 'button:Save filter', 'button:Discard changes',
      'button:Edit filter', 'button:Delete filter'],
    rows: [['eq', '', 'Dana'], ['eq', 'or', 'Unassigned']],
    readonly: true,
  });
  expect(r.editing).toEqual({ open: true, readonly: false, shows: ['save-edit', 'discard-edit'] });
  expect(r.draft).toEqual([]);
  // ON first, as a tap on it would, then the change — in its scope.
  expect(r.applied).toEqual([
    { type: 'quick-filter-change', presets: ['custom:mine'] },
    { type: 'preset-edit', scope: 'data', id: 'custom:mine', readings: { owner: { conditions: [{ op: 'eq', picked: ['Dana'] }] } } },
  ]);
  expect(r.back).toEqual({ edited: true, rows: [['eq', '', 'Dana']] });
  expect(r.flushed).toEqual([
    { type: 'preset-edit', scope: 'data', id: 'custom:mine', readings: { owner: { conditions: [{ op: 'eq', picked: ['Ravi'] }] } } },
  ]);
  expect(r.actions).toEqual([
    { type: 'filter-save', scope: 'data', readings: { owner: { conditions: [{ op: 'eq', picked: ['Dana'] }] } }, id: 'custom:mine', label: 'Mine' },
    { type: 'preset-edit', scope: 'data', id: 'custom:mine', readings: null },
  ]);
  // Discard puts the saved rows back.
  expect(r.rows).toEqual([['eq', '', 'Dana'], ['eq', 'or', 'Unassigned']]);
  expect(r.editor).toBe(false);
});
