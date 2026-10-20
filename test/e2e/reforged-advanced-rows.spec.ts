import { test, expect } from './harness';

/**
 * EVERY ADVANCED ROW, ASKED AS A READER ASKS IT — TODO 112. For each kind of
 * field and each condition it offers, the row shows the inputs that condition
 * takes, and what is typed or picked there is the clause the data layer runs.
 * Equals picks from the field's own values — or, where it lists none, is typed.
 * TRAP T-one-number-is-a-pick-under-equals
 */

const KINDS = {
  list: { def: { id: 'owner', label: 'Owner', select: 'multiple', advanced: true,
    options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }] }, facts: {} },
  only: { def: { id: 'name', label: 'Name', advanced: 'only' }, facts: {} },
  number: { def: { id: 'seats', label: 'Seats', kind: 'number', advanced: true, min: 0, max: 100 }, facts: { type: 'number' } },
  date: { def: { id: 'created', label: 'Created', kind: 'date', advanced: true }, facts: { type: 'date' } },
  time: { def: { id: 'seen', label: 'Seen', kind: 'date', advanced: true, time: true }, facts: { type: 'date', time: true } },
};

/** For each `kind:op` — the inputs it shows, and the clause they answer. */
const WANT: Record<string, [string, unknown]> = {
  'list:eq': ['condition-pick', ['owner', 'eq', 'Ravi']],
  'list:ne': ['condition-pick', ['owner', 'ne', 'Ravi']],
  'list:contains': ['condition-value', ['owner', 'contains', 'Ada']],
  'list:notcontains': ['condition-value', ['owner', 'notcontains', 'Ada']],
  'list:startswith': ['condition-value', ['owner', 'startswith', 'Ada']],
  'list:endswith': ['condition-value', ['owner', 'endswith', 'Ada']],
  // No list to pick from: Equals is TYPED. Will, TODO 112.
  'only:eq': ['condition-value', ['name', 'eq', 'Ada']],
  'only:ne': ['condition-value', ['name', 'ne', 'Ada']],
  'only:contains': ['condition-value', ['name', 'contains', 'Ada']],
  'only:notcontains': ['condition-value', ['name', 'notcontains', 'Ada']],
  'only:startswith': ['condition-value', ['name', 'startswith', 'Ada']],
  'only:endswith': ['condition-value', ['name', 'endswith', 'Ada']],
  'number:eq': ['condition-value', ['seats', 'eq', 42]],
  'number:ne': ['condition-value', ['seats', 'ne', 42]],
  'number:gt': ['condition-value', ['seats', 'gt', 42]],
  'number:gte': ['condition-value', ['seats', 'gte', 42]],
  'number:lt': ['condition-value', ['seats', 'lt', 42]],
  'number:lte': ['condition-value', ['seats', 'lte', 42]],
  // A number's range: From, To and the slider under them. Will, TODO 375
  'number:between': ['condition-value+condition-value-to+condition-slider', ['seats', 'between', [42, 99]]],
  'number:notbetween': ['condition-value+condition-value-to+condition-slider', ['seats', 'notbetween', [42, 99]]],
  'date:eq': ['condition-date', ['created', 'eq', '2026-09-03']],
  'date:lt': ['condition-date', ['created', 'lt', '2026-09-03']],
  'date:gt': ['condition-date', ['created', 'gt', '2026-09-03']],
  'date:between': ['condition-date+condition-date-to', ['created', 'between', ['2026-09-03', '2026-09-30']]],
  'date:last': ['condition-count+condition-unit', ['created', 'last', { n: 7, unit: 'week' }]],
  'date:next': ['condition-count+condition-unit', ['created', 'next', { n: 7, unit: 'week' }]],
  // A minute is ALL of that minute; Between reaches the end of its last one.
  'time:eq': ['condition-date+condition-time', ['seen', 'between', ['2026-09-03T14:00', '2026-09-03T14:00:59.999']]],
  'time:lt': ['condition-date+condition-time', ['seen', 'lt', '2026-09-03T14:00']],
  'time:gt': ['condition-date+condition-time', ['seen', 'gt', '2026-09-03T14:00:59.999']],
  'time:between': ['condition-date+condition-time+condition-date-to+condition-time-to',
    ['seen', 'between', ['2026-09-03T14:00', '2026-09-30T18:00:59.999']]],
  'time:last': ['condition-count+condition-unit', ['seen', 'last', { n: 7, unit: 'week' }]],
  'time:next': ['condition-count+condition-unit', ['seen', 'next', { n: 7, unit: 'week' }]],
};

test('every Advanced row shows what its condition takes, and answers the clause it says', async ({ page }) => {
  const got = await page.evaluate(async (kinds) => {
    const { menuFor } = await import('/dist/core/ui/filter-menu.js');
    // A host whose root holds the menu prototype. TRAP T-a-family-shares-markup
    const host = (await (async () => { const g = document.createElement('sherpa-data-grid') as HTMLElement & { rendered: Promise<void> }; document.body.append(g); await g.rendered; return g.shadowRoot!; })());
    const { readingClause } = await import('/dist/core/data/filter-state.js');
    const FILL: Record<string, string> = {
      'condition-pick': 'Ravi', 'condition-date': '2026-09-03', 'condition-date-to': '2026-09-30',
      'condition-time': '14:00', 'condition-time-to': '18:00', 'condition-count': '7', 'condition-unit': 'week',
      'condition-value-to': '99',
    };
    const settle = async () => { await window.__settled(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    const out: Record<string, [string, unknown]> = {};
    for (const [kind, { def, facts }] of Object.entries(kinds)) {
      const { menu, items } = menuFor(host, def as never);
      document.getElementById('root')!.replaceChildren(menu);
      const m = menu as HTMLElement & { rendered: Promise<void>; mode: string; conditions: Record<string, unknown>[]; items?(i: unknown): void };
      await m.rendered;
      if (items.length) m.items?.(items);
      await settle();
      m.mode = 'advanced';
      await settle();
      const row = m.shadowRoot!.querySelector<HTMLElement>('.condition-row')!;
      const cond = row.querySelector('.condition')!.shadowRoot!.querySelector('select')!;
      for (const op of [...cond.options].map((o) => o.value)) {
        // As a reader: the condition, then each box it shows.
        cond.value = op;
        cond.dispatchEvent(new Event('change', { bubbles: true }));
        await settle();
        const shown = [...row.children].filter((c) => getComputedStyle(c).display !== 'none').map((c) => c.classList[0]!)
          .filter((c) => c !== 'condition' && c !== 'drop-condition');
        for (const cls of shown) {
          const inner = row.querySelector(`.${cls}`)!.shadowRoot?.querySelector<HTMLInputElement | HTMLSelectElement>('input, select');
          const value = cls === 'condition-value' ? (kind === 'number' ? '42' : 'Ada') : FILL[cls];
          if (!inner || value == null) continue;
          inner.value = value;
          inner.dispatchEvent(new Event('input', { bubbles: true }));
          inner.dispatchEvent(new Event('change', { bubbles: true }));
        }
        await settle();
        out[`${kind}:${op}`] = [shown.join('+'),
          readingClause({ field: def.id as string, ...facts }, { conditions: [m.conditions[0]!], mode: 'advanced' })];
        for (const box of row.querySelectorAll<HTMLElement & { value: string }>('.condition-value, .condition-value-to, .condition-date, .condition-date-to, .condition-time, .condition-time-to, .condition-count')) box.value = '';
        delete row.dataset['want'];
      }
    }
    return out;
  }, KINDS);
  expect(got).toEqual(WANT);
});

test('two rows join by Or or And, and the cross takes one away', async ({ page }) => {
  const r = await page.evaluate(async (def) => {
    const { menuFor } = await import('/dist/core/ui/filter-menu.js');
    // A host whose root holds the menu prototype. TRAP T-a-family-shares-markup
    const host = (await (async () => { const g = document.createElement('sherpa-data-grid') as HTMLElement & { rendered: Promise<void> }; document.body.append(g); await g.rendered; return g.shadowRoot!; })());
    const { readingClause } = await import('/dist/core/data/filter-state.js');
    const settle = async () => { await window.__settled(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    const { menu, items } = menuFor(host, def as never);
    document.getElementById('root')!.replaceChildren(menu);
    const m = menu as HTMLElement & { rendered: Promise<void>; mode: string; conditions: Record<string, unknown>[];
      items?(i: unknown): void; addCondition(): void };
    await m.rendered;
    m.items?.(items);
    await settle();
    m.mode = 'advanced';
    await settle();
    const rows = () => [...m.shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')];
    const set = (row: HTMLElement, cls: string, value: string) => {
      const inner = row.querySelector(`.${cls}`)!.shadowRoot!.querySelector<HTMLInputElement | HTMLSelectElement>('input, select')!;
      inner.value = value;
      inner.dispatchEvent(new Event('input', { bubbles: true }));
      inner.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const clause = () => readingClause({ field: 'owner' }, { conditions: m.conditions, mode: 'advanced' });
    set(rows()[0]!, 'condition-pick', 'Ravi');
    m.addCondition();
    await settle();
    const second = rows()[1]!;
    set(second, 'condition', 'contains');
    await settle();
    set(second, 'condition-value', 'Da');
    await settle();
    const or = clause();
    set(second, 'join', 'and');
    await settle();
    const and = clause();
    // The join shows on the second row, never the first.
    const joins = rows().map((row) => getComputedStyle(row.querySelector('.join')!).display !== 'none');
    second.querySelector('.drop-condition')!.shadowRoot!.querySelector('button')!.click();
    await settle();
    return { or, and, joins, left: rows().length, after: clause() };
  }, KINDS.list.def);
  expect(r.or).toEqual(['or', ['owner', 'eq', 'Ravi'], ['owner', 'contains', 'Da']]);
  expect(r.and).toEqual(['and', ['owner', 'eq', 'Ravi'], ['owner', 'contains', 'Da']]);
  expect(r.joins).toEqual([false, true]);
  expect(r.left).toBe(1);
  expect(r.after).toEqual(['owner', 'eq', 'Ravi']);
});

test('Equals offers the field\'s values on the bar and in the panel; a field with none types it', async ({ page }) => {
  const r = await page.evaluate(async ({ list, only }) => {
    const settle = async () => { await window.__settled(); await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); };
    type Menu = HTMLElement & { mode: string };
    const eqRow = async (menu: Menu) => {
      menu.mode = 'advanced';
      await settle();
      const row = menu.shadowRoot!.querySelector<HTMLElement>('.condition-row')!;
      const cond = row.querySelector('.condition')!.shadowRoot!.querySelector('select')!;
      cond.value = 'eq';
      cond.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      const pick = row.querySelector<HTMLElement>('.condition-pick')!;
      return {
        list: getComputedStyle(pick).display !== 'none'
          ? [...pick.shadowRoot!.querySelector('select')!.options].map((o) => o.value) : 'typed',
      };
    };
    const bar = await window.__mount<HTMLElement>('sherpa-quick-filter-toolbar',
      [{ ...list, active: true }, { ...only, active: true }], { style: 'inline-size: 1200px' });
    await settle();
    const chipMenu = (id: string) => bar.shadowRoot!.querySelector(`.chip[data-id="${id}"] sherpa-menu`) as Menu;
    const onBar = { owner: await eqRow(chipMenu('owner')), name: await eqRow(chipMenu('name')) };
    const panel = await window.__mount<HTMLElement & { populate(d: unknown): Promise<void> }>('sherpa-filter-panel', undefined, { open: true });
    await panel.populate([{ scope: 'data', label: 'Rows', filters: [list] }]);
    await settle();
    panel.shadowRoot!.querySelector('.field[data-field="owner"] .field-advanced')!.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await settle();
    const inPanel = await eqRow(panel.shadowRoot!.querySelector('.field[data-field="owner"] sherpa-menu') as Menu);
    return { onBar, inPanel };
  }, { list: KINDS.list.def, only: KINDS.only.def });
  expect(r.onBar.owner.list).toEqual(['', 'Dana', 'Ravi']);
  expect(r.onBar.name.list).toBe('typed');
  expect(r.inPanel.list).toEqual(['', 'Dana', 'Ravi']);
});
