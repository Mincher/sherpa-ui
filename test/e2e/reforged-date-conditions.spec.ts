import { test, expect } from './harness';

/**
 * A DATE's Advanced rows — TODO 90 with 21d. Simple stays the calendar; the
 * rows ask On, Before, After, Between, In the last and In the next, with a
 * day box, two for Between, and a count and a unit.
 * TRAP T-a-relative-date-stays-relative
 */

type Menu = HTMLElement & {
  rendered: Promise<void>; mode: string; values: string[];
  conditions: Record<string, unknown>[]; reading: Record<string, unknown>;
};

const ROWS = [
  { op: 'lt', text: '2026-09-03' },
  { join: 'or', op: 'last', text: '7', unit: 'week' },
  { join: 'or', op: 'between', picked: ['2026-01-01', '2026-01-31'] },
];

test('a date menu offers Advanced rows that ask a date\'s questions, and reads them back', async ({ page }) => {
  const r = await page.evaluate(async (rows) => {
    const { menuFor } = await import('/dist/core/ui/filter-menu.js');
    // A host whose root holds the menu prototype. TRAP T-a-family-shares-markup
    const host = (await (async () => { const g = document.createElement('sherpa-data-grid') as HTMLElement & { rendered: Promise<void> }; document.body.append(g); await g.rendered; return g.shadowRoot!; })());
    const { menu } = menuFor(host, { id: 'created', label: 'Created', kind: 'date', advanced: true });
    document.getElementById('root')!.replaceChildren(menu);
    const m = menu as Menu;
    await m.rendered;
    m.mode = 'advanced';
    m.conditions = rows;
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
    const shown = (row: Element) => [...row.children].filter((c) => getComputedStyle(c).display !== 'none')
      .map((c) => c.classList[0]);
    const labels = [...m.shadowRoot!.querySelectorAll('.condition-row')[0]!.querySelector('.condition')!
      .shadowRoot!.querySelectorAll('option')].map((o) => o.textContent);
    return {
      type: m.getAttribute('data-type'),
      switchShown: getComputedStyle(m.shadowRoot!.querySelector('.use-condition')!).display !== 'none',
      takes: [...m.shadowRoot!.querySelectorAll<HTMLElement>('.condition-row')].map((row) => row.dataset['takes']),
      shown: [...m.shadowRoot!.querySelectorAll('.condition-row')].map(shown),
      labels,
      back: m.conditions,
      calendarHidden: getComputedStyle(m.shadowRoot!.querySelector('.rows')!).display === 'none',
    };
  }, ROWS);
  expect(r.type).toBe('filter');
  expect(r.switchShown).toBe(true);
  expect(r.takes).toEqual(['date', 'duration', 'dates']);
  expect(r.shown).toEqual([
    ['condition', 'condition-date', 'drop-condition'],
    ['join', 'condition', 'condition-count', 'condition-unit', 'drop-condition'],
    ['join', 'condition', 'condition-date', 'condition-date-to', 'drop-condition'],
  ]);
  expect(r.labels).toEqual(['On', 'Before', 'After', 'Between', 'In the last', 'In the next']);
  expect(r.back).toEqual(ROWS);
  expect(r.calendarHidden).toBe(true);
});

test('the switch to Advanced carries the calendar\'s day over as On', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { menuFor } = await import('/dist/core/ui/filter-menu.js');
    // A host whose root holds the menu prototype. TRAP T-a-family-shares-markup
    const host = (await (async () => { const g = document.createElement('sherpa-data-grid') as HTMLElement & { rendered: Promise<void> }; document.body.append(g); await g.rendered; return g.shadowRoot!; })());
    const { menu } = menuFor(host, { id: 'created', label: 'Created', kind: 'date', advanced: true });
    document.getElementById('root')!.replaceChildren(menu);
    const m = menu as Menu;
    await m.rendered;
    m.values = ['2026-09-03'];
    await window.__settled();
    m.shadowRoot!.querySelector('.use-advanced')!.shadowRoot!.querySelector('button')!.click();
    await window.__settled();
    return { mode: m.mode, rows: m.conditions, reading: m.reading };
  });
  expect(r.mode).toBe('advanced');
  expect(r.rows).toEqual([{ op: 'eq', picked: ['2026-09-03'] }]);
  expect(r.reading).toMatchObject({ mode: 'advanced', conditions: [{ op: 'eq', picked: ['2026-09-03'] }] });
});
