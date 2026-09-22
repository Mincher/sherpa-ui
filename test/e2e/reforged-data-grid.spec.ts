import { test, expect } from '@playwright/test';

/** sherpa-data-grid — columns/rows from populate(); click-to-sort; row-click. */

const HARNESS = '/test/reforged/harness.html';

const CONFIG = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'score', header: 'Score', type: 'number' },
  ],
  rows: [
    { name: 'Charlie', score: 30 },
    { name: 'Alice', score: 90 },
    { name: 'Bob', score: 60 },
  ],
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('renders header cells and a row per record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sr = el.shadowRoot!;
    return {
      headers: Array.from(sr.querySelectorAll('.head-label')).map((h) => h.textContent),
      rows: sr.querySelectorAll('.body .row').length,
      firstCell: sr.querySelector('.body .row .cell')!.textContent,
      numericAlign: getComputedStyle(sr.querySelector('.cell[data-type="number"]')!).textAlign,
    };
  }, CONFIG);
  expect(r.headers).toEqual(['Name', 'Score']);
  expect(r.rows).toBe(3);
  expect(r.firstCell).toBe('Charlie'); // unsorted → source order
  expect(r.numericAlign).toBe('end'); // numeric column right-aligned
});

test('clicking a header sorts asc then desc and reflects the attributes', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const names = () =>
      Array.from(el.shadowRoot!.querySelectorAll('.body .row')).map((row) => row.querySelector('.cell')!.textContent);
    const scoreHeader = () =>
      Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.head-cell')).find(
        (h) => h.dataset['field'] === 'score',
      )!;

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // asc by score
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const asc = names();
    const ascAttr = { field: el.dataset['sortField'], dir: el.dataset['sortDirection'] };

    scoreHeader().querySelector<HTMLElement>('.head-btn')!.click(); // desc
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const desc = names();

    return { asc, ascAttr, desc };
  }, CONFIG);
  expect(r.asc).toEqual(['Charlie', 'Bob', 'Alice']); // 30, 60, 90
  expect(r.ascAttr).toEqual({ field: 'score', dir: 'asc' });
  expect(r.desc).toEqual(['Alice', 'Bob', 'Charlie']); // 90, 60, 30
});

test('clicking a row fires row-click with the record', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(config);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let row: Record<string, unknown> | null = null;
    el.addEventListener('row-click', (e) => (row = (e as CustomEvent).detail.row));
    el.shadowRoot!.querySelector<HTMLElement>('.body .row')!.click();
    return row;
  }, CONFIG);
  expect(r).toEqual({ name: 'Charlie', score: 30 });
});

test('an empty rows array shows the empty state', async ({ page }) => {
  const shown = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ columns: [{ field: 'x' }], rows: [] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      empty: el.hasAttribute('data-empty'),
      visible: getComputedStyle(el.shadowRoot!.querySelector('.empty')!).display !== 'none',
    };
  });
  expect(shown.empty).toBe(true);
  expect(shown.visible).toBe(true);
});

test('every cell type uses the Figma label typography, not the UA <th> bold', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(config: unknown): void;
    };
    grid.setAttribute('data-filterable', '');
    grid.setAttribute('data-selectable', '');
    document.getElementById('root')!.appendChild(grid);
    await grid.rendered;
    grid.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'qty', header: 'Qty', type: 'number' },
      ],
      rows: [{ name: 'Alpha', qty: 3 }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = grid.shadowRoot!;
    const read = (sel: string): Record<string, string> => {
      const el = sr.querySelector(sel);
      if (!el) return { missing: sel };
      const s = getComputedStyle(el);
      return { weight: s.fontWeight, style: s.fontStyle, size: s.fontSize,
               lh: s.lineHeight, align: s.textAlign };
    };
    return { headBtn: read('.head-btn'), filterInput: read('.filter-input'), cell: read('.body .row .cell') };
  });

  // Figma binds the label on EVERY Grid Cell type (group / header / cell / filter)
  // to content/weight/regular 400 · content/size/base 14 · line-height/base 20,
  // start-aligned and never italic. The header reads as a header because of its
  // darker surface band, not a heavier weight.
  //
  // A <th> ships `font-weight: bold` + `text-align: center` from the UA stylesheet,
  // and the filter input's `font: inherit` faithfully inherited that — so the
  // secondary header rendered at 700 while the header button sat at a hand-set 600.
  for (const [name, got] of Object.entries({ headBtn: r.headBtn, filterInput: r.filterInput, cell: r.cell })) {
    expect(got['missing'], `${name} selector found`).toBeUndefined();
    expect(got['weight'], `${name} weight`).toBe('400');
    expect(got['style'], `${name} style`).toBe('normal');
    expect(got['size'], `${name} size`).toBe('14px');
    expect(got['lh'], `${name} line-height`).toBe('20px');
    expect(got['align'], `${name} align`).toBe('start');
  }
});

/* ── Column filters ──────────────────────────────────────────────────────── */

/** A grid with two text columns and one numeric, so a mixed filter is exercised. */
const FILTER_CONFIG = {
  columns: [
    { field: 'name', header: 'Name' },
    { field: 'status', header: 'Status' },
    { field: 'spend', header: 'Spend', type: 'number' },
  ],
  rows: [
    { name: 'Marcus Reyes', status: 'trial', spend: 257 },
    { name: 'Omar Haddad', status: 'trial', spend: 805 },
    { name: 'Jane Okafor', status: 'active', spend: 120 },
    { name: 'Nina Berg', status: 'active', spend: 668 },
  ],
};

/**
 * Install an in-page grid builder on `window`, so each test can build one without
 * an `eval`'d string. Returns the element, already populated.
 */
interface GridEl extends HTMLElement {
  rendered?: Promise<void>;
  populate(config: unknown): void;
}
declare global {
  interface Window {
    __buildGrid(config: unknown): Promise<GridEl>;
  }
}

async function installBuilder(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    window.__buildGrid = async (config: unknown) => {
      const root = document.getElementById('root')!;
      root.innerHTML = '';
      const el = document.createElement('sherpa-data-grid') as GridEl;
      el.setAttribute('data-filterable', '');
      root.appendChild(el);
      await el.rendered;
      el.populate(config);
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el;
    };
  });
}

test('typing in a filter narrows rows to substring matches in THAT column', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const cell = (field: string): HTMLElement =>
      sr.querySelector(`.filter-cell[data-field="${field}"]`) as HTMLElement;
    const type = async (field: string, value: string): Promise<void> => {
      const input = cell(field).querySelector<HTMLInputElement>('.filter-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };
    const names = (): (string | null)[] =>
      Array.from(sr.querySelectorAll('.body .row')).map((row) => row.children[1]!.textContent);

    const events: unknown[] = [];
    el.addEventListener('filter-change', (e) => events.push((e as CustomEvent).detail));

    await type('name', 'ar'); // substring, not prefix: Marcus AND Omar
    const substring = names();

    await type('name', 'MARCUS'); // case-insensitive
    const insensitive = names();

    await type('name', ''); // cleared → everything back
    const cleared = names();

    // A second column ANDs with the first.
    await type('status', 'trial');
    const oneFilter = names();
    await type('name', 'omar');
    const twoFilters = names();

    // A numeric column filters on its stringified value.
    await type('name', '');
    await type('status', '');
    await type('spend', '80');
    const numeric = names();

    return { substring, insensitive, cleared, oneFilter, twoFilters, numeric, events };
  }, FILTER_CONFIG);

  // Substring, so "ar" finds both "Marcus" and "Omar" — a table filter is a find,
  // not a prefix match.
  expect(r.substring).toEqual(['Marcus Reyes', 'Omar Haddad']);
  expect(r.insensitive).toEqual(['Marcus Reyes']);
  expect(r.cleared).toHaveLength(4);

  // Several filters must ALL match.
  expect(r.oneFilter).toEqual(['Marcus Reyes', 'Omar Haddad']);
  expect(r.twoFilters).toEqual(['Omar Haddad']);

  // Values are stringified, so a numeric column filters as readily as a text one.
  expect(r.numeric).toEqual(['Omar Haddad']);

  // The event still fires for callers driving a server-side query, and carries the
  // whole filter set plus the resulting count.
  const last = r.events[r.events.length - 1] as Record<string, unknown>;
  expect(last['field']).toBe('spend');
  expect(last['visible']).toBe(1);
  expect(last['filters']).toEqual({ spend: '80' });
});

test('a SORTED or FILTERED column FLAGS its header, and the CHIPS say so — no tint', async ({ page }) => {
  // A sort orders what the grid shows; a filter narrows it. Both are the column
  // acting on the view, so both read the same — and both say so through the
  // heading's CHIPS, each painting its own on-state.
  //
  // The HEADING ITSELF IS NOT PAINTED. It was once — a brand-tinted fill meant
  // to survive a glance at row 40 — but with the chips carrying an on-state of
  // their own that fill became a second highlight saying the same word, and two
  // competing down a header row read as noise. The attribute STAYS, because
  // `data-status` is the system-wide door a host styles; this component just
  // declines to paint it. So this test checks the FLAG and the CHIP, and pins
  // the surface and ink as UNCHANGED.
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const type = async (field: string, value: string): Promise<void> => {
      const input = sr
        .querySelector(`.filter-cell[data-field="${field}"]`)!
        .querySelector<HTMLInputElement>('.filter-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await settle();
    };
    // Which FIELDS carry the mode — a count alone cannot tell the sorted column
    // from the filtered one once both are lit. `filters` should stay EMPTY
    // throughout: the secondary filter row never takes the mode.
    const status = () => ({
      heads: Array.from(sr.querySelectorAll<HTMLElement>('.head-cell'))
        .filter((th) => th.dataset['status'] === 'active')
        .map((th) => th.dataset['field']),
      filters: Array.from(sr.querySelectorAll<HTMLElement>('.filter-cell'))
        .filter((th) => th.dataset['status'] === 'active')
        .map((th) => th.dataset['field']),
    });
    // The flag must NOT become paint. The heading keeps the plain header
    // surface and ink it has when nothing is acting on the column — the signal
    // is the chip's own on-state, read here as `sortOn`.
    const paint = (field: string) => {
      const th = sr.querySelector(`.head-cell[data-field="${field}"]`) as HTMLElement;
      return {
        background: getComputedStyle(th).backgroundColor,
        label: getComputedStyle(th.querySelector('.head-label')!).color,
        // The sort CHIP paints itself from its own on-state. That is now the
        // ONLY thing the sorted column shows.
        sortOn: th.querySelector('.head-sort')!.hasAttribute('data-current'),
      };
    };

    // Both columns' resting paint, BEFORE anything acts on the view. A number
    // column is right-aligned and monospaced where a text one is not, so the
    // "unchanged" assertions below compare each column against ITSELF.
    const clean = { ...status(), paint: paint('name'), spendPaint: paint('spend') };

    // SORT alone.
    sr.querySelector<HTMLElement>('.head-cell[data-field="spend"] .head-btn')!.click();
    await settle();
    const sorted = { ...status(), paint: paint('spend') };

    // FILTER a DIFFERENT column: now two columns are acting on the view, and
    // only the filtered one lights its filter cell.
    await type('name', 'ar');
    const both = { ...status(), paint: paint('name') };

    // Clearing the filter leaves the sort's own flag standing.
    await type('name', '');
    const filterCleared = status();

    // Sorting a column that is ALSO filtered must not flag it twice or fight
    // itself — one attribute, one state.
    await type('spend', '80');
    const sortedAndFiltered = { ...status(), paint: paint('spend') };

    // Naming an UNSORTABLE column as the sort field is not a sort, so that
    // column takes nothing — the flag follows the real state, not the attribute.
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'locked', header: 'Locked', sortable: false },
      ],
      rows: [{ name: 'Marcus Reyes', locked: 'yes' }],
    });
    el.dataset['sortField'] = 'locked';
    await settle();
    const unsortable = status();

    return { clean, sorted, both, filterCleared, sortedAndFiltered, unsortable };
  }, FILTER_CONFIG);

  // Nothing acting on the view: no column carries the mode.
  expect(r.clean.heads).toEqual([]);
  expect(r.clean.filters).toEqual([]);

  // A sort FLAGS the heading.
  expect(r.sorted.heads).toEqual(['spend']);
  expect(r.sorted.filters).toEqual([]);
  // The chip is what shows it.
  expect(r.sorted.paint.sortOn).toBe(true);
  // And the heading itself is untouched — same surface, same ink as at rest.
  expect(r.sorted.paint.background).toBe(r.clean.spendPaint.background);
  expect(r.sorted.paint.label).toBe(r.clean.spendPaint.label);

  // Two columns can be active at once for two different reasons.
  expect(r.both.heads.sort()).toEqual(['name', 'spend']);
  // The secondary FILTER row is never lit — not even the column being filtered.
  // That row already says what it is doing: the text is in the box.
  expect(r.both.filters).toEqual([]);
  // A FILTERED heading is no more painted than a sorted one.
  expect(r.both.paint.background).toBe(r.clean.paint.background);
  expect(r.both.paint.label).toBe(r.clean.paint.label);

  // Clearing the filter drops that column back; the sorted one holds.
  expect(r.filterCleared.heads).toEqual(['spend']);
  expect(r.filterCleared.filters).toEqual([]);

  // Sorted AND filtered is still ONE flag on one heading, and still no paint.
  expect(r.sortedAndFiltered.heads).toEqual(['spend']);
  expect(r.sortedAndFiltered.filters).toEqual([]);
  expect(r.sortedAndFiltered.paint.background).toBe(r.clean.spendPaint.background);
  expect(r.sortedAndFiltered.paint.label).toBe(r.clean.spendPaint.label);

  // An unsortable column named as the sort field is not sorted, so it is not
  // active either — the flag follows the real state, not the attribute.
  expect(r.unsortable.heads).toEqual([]);
});

test('a populated filter shows a clear button that empties only its own column', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const cell = (field: string): HTMLElement =>
      sr.querySelector(`.filter-cell[data-field="${field}"]`) as HTMLElement;
    const clear = (field: string): HTMLElement =>
      cell(field).querySelector('.filter-clear') as HTMLElement;
    const shown = (el2: Element): boolean => getComputedStyle(el2).display !== 'none';
    const type = async (field: string, value: string): Promise<void> => {
      const input = cell(field).querySelector<HTMLInputElement>('.filter-input')!;
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };

    const empty = { clearShown: shown(clear('name')), flag: cell('name').hasAttribute('data-has-value') };

    await type('name', 'ar');
    await type('status', 'trial');
    const populated = {
      clearShown: shown(clear('name')),
      flag: cell('name').hasAttribute('data-has-value'),
      // It sits INSIDE the input's box, at its trailing edge. The box (border,
      // padding, radius, focus ring) is on `.filter-field`, not the <input>, which
      // is what puts the button within the border rather than beside it.
      insideBorder: (() => {
        const f = cell('name').querySelector('.filter-field')!.getBoundingClientRect();
        const c = clear('name').getBoundingClientRect();
        return c.left >= f.left && c.right <= f.right && c.top >= f.top && c.bottom <= f.bottom;
      })(),
      // …and the text stops before it, so a long value cannot run underneath.
      textStopsBeforeButton: (() => {
        const i = cell('name').querySelector('.filter-input')!.getBoundingClientRect();
        const c = clear('name').getBoundingClientRect();
        return i.right <= c.left + 1;
      })(),
      // The <input> must carry no box of its own, or there would be two.
      inputHasNoBox: (() => {
        const cs = getComputedStyle(cell('name').querySelector('.filter-input')!);
        return cs.borderTopWidth === '0px' && cs.paddingLeft === '0px';
      })(),
      rows: sr.querySelectorAll('.body .row').length,
    };

    clear('name').click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterClear = {
      nameValue: cell('name').querySelector<HTMLInputElement>('.filter-input')!.value,
      nameClearShown: shown(clear('name')),
      // The OTHER column's filter must survive.
      statusValue: cell('status').querySelector<HTMLInputElement>('.filter-input')!.value,
      rows: sr.querySelectorAll('.body .row').length,
    };

    return { empty, populated, afterClear };
  }, FILTER_CONFIG);

  // Hidden until there is something to clear.
  expect(r.empty.clearShown).toBe(false);
  expect(r.empty.flag).toBe(false);

  expect(r.populated.clearShown).toBe(true);
  expect(r.populated.flag).toBe(true);
  expect(r.populated.insideBorder).toBe(true);
  expect(r.populated.textStopsBeforeButton).toBe(true);
  expect(r.populated.inputHasNoBox).toBe(true);
  expect(r.populated.rows).toBe(2); // name "ar" AND status "trial"

  // Clearing empties ITS field only; the status filter still applies, so the two
  // trial rows remain rather than all four.
  expect(r.afterClear.nameValue).toBe('');
  expect(r.afterClear.nameClearShown).toBe(false);
  expect(r.afterClear.statusValue).toBe('trial');
  expect(r.afterClear.rows).toBe(2);
});

test('a filter matching nothing keeps the filter row usable', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="name"] .filter-input',
    )!;
    input.value = 'zzzzzz';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const shown = (sel: string): boolean => {
      const node = sr.querySelector(sel);
      return !!node && getComputedStyle(node).display !== 'none';
    };
    return {
      rows: sr.querySelectorAll('.body .row').length,
      // data-empty would hide the whole <table> and take the input with it.
      hostEmpty: el.hasAttribute('data-empty'),
      hostNoMatches: el.hasAttribute('data-no-matches'),
      tableShown: shown('.grid'),
      filterRowShown: shown('.filter-row'),
      noMatchesShown: shown('.no-matches'),
      emptyShown: shown('.empty'),
      // The field the user is typing in must still hold focus-worthy state.
      inputValue: input.value,
    };
  }, FILTER_CONFIG);

  expect(r.rows).toBe(0);
  // The distinction that matters: no-matches is NOT empty.
  expect(r.hostEmpty).toBe(false);
  expect(r.hostNoMatches).toBe(true);
  expect(r.tableShown).toBe(true);
  expect(r.filterRowShown).toBe(true);
  expect(r.noMatchesShown).toBe(true);
  expect(r.emptyShown).toBe(false);
  expect(r.inputValue).toBe('zzzzzz');
});

test('row-click resolves against the FILTERED list, not the full one', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="status"] .filter-input',
    )!;
    input.value = 'active'; // leaves Jane (index 2) and Nina (index 3) of the full list
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const clicks: unknown[] = [];
    el.addEventListener('row-click', (e) => clicks.push((e as CustomEvent).detail));
    // Click the FIRST visible row. Its data-index is 0, which in the UNFILTERED
    // list would be Marcus — the wrong record.
    (sr.querySelector('.body .row .cell') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { clicks };
  }, FILTER_CONFIG);

  expect(r.clicks).toHaveLength(1);
  const detail = r.clicks[0] as { index: number; row: Record<string, unknown> };
  expect(detail.index).toBe(0);
  expect(detail.row['name']).toBe('Jane Okafor');
});

test('re-populating clears stale filters', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async (config) => {
    const el = await window.__buildGrid(config);
    const sr = el.shadowRoot!;
    const input = sr.querySelector<HTMLInputElement>(
      '.filter-cell[data-field="name"] .filter-input',
    )!;
    input.value = 'marcus';
    input.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const filtered = sr.querySelectorAll('.body .row').length;

    // New data may not even have that column. Carrying the filter over would hide
    // rows against a filter the user can no longer see.
    el.populate({
      columns: [{ field: 'other', header: 'Other' }],
      rows: [{ other: 'x' }, { other: 'y' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      filtered,
      afterRepopulate: sr.querySelectorAll('.body .row').length,
      anyValueFlag: !!sr.querySelector('.filter-cell[data-has-value]'),
    };
  }, FILTER_CONFIG);

  expect(r.filtered).toBe(1);
  expect(r.afterRepopulate).toBe(2);
  expect(r.anyValueFlag).toBe(false);
});

test('data-group-field bunches the rows, hides that column, and folds', async ({ page }) => {
  // Figma Grid Cell `Type=group` (template 926:35309): a full-width 32-tall row
  // with a checkbox, a chevron toggle and the group's value as its label. The
  // grouped column drops out — its value IS the heading now.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'team', header: 'Team' },
      ],
      rows: [
        { name: 'Ana', team: 'Blue' },
        { name: 'Bo', team: 'Red' },
        { name: 'Cy', team: 'Blue' },
      ],
    });
    el.dataset['groupField'] = 'team';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const read = () => ({
      headers: Array.from(sr.querySelectorAll('.head-label')).map((h) => h.textContent),
      groups: Array.from(sr.querySelectorAll('.group-row')).map((g) => ({
        label: g.querySelector('.group-label')!.textContent,
        count: g.querySelector('.group-count')!.textContent,
        // +1 for the leading selection column, so the group row is exactly as
        // wide as the rows below it.
        colspan: g.querySelector<HTMLTableCellElement>('.group-cell')!.colSpan,
      })),
      /* The grouped column's cells are gone too — one column, not two. Counts
         the DOM children, so the two always-present pinned cells are in it:
         the leading select cell and the trailing actions cell both live in the
         template whether or not their attribute reveals them (CSS owns the
         reveal; JS never creates them). */
      cellsPerRow: sr.querySelector('.row')!.children.length,
      // Rows sharing a group value must be ADJACENT: that is what lets the render
      // find each group in one pass over the sorted rows.
      order: Array.from(sr.querySelectorAll('.row')).map((row) => row.children[1]!.textContent),
      visible: Array.from(sr.querySelectorAll('.row')).filter(
        (row) => getComputedStyle(row).display !== 'none',
      ).length,
    });
    const grouped = read();

    // Fold the first group shut.
    const first = sr.querySelector<HTMLElement>('.group-row')!;
    first.querySelector<HTMLElement>('.group-toggle')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const folded = {
      ...read(),
      collapsed: first.hasAttribute('data-collapsed'),
      expanded: first.querySelector('.group-toggle')!.getAttribute('aria-expanded'),
    };

    // A re-render (here: a sort) must KEEP the fold — the flag lives on the
    // component, not on the rows it just replaced.
    el.dataset['sortField'] = 'name';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const afterSort = { visible: read().visible, collapsed: sr.querySelector('.group-row')!.hasAttribute('data-collapsed') };

    // Un-grouping brings the column straight back, with no re-populate.
    delete el.dataset['groupField'];
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const ungrouped = { headers: read().headers, groups: read().groups.length };

    return { grouped, folded, afterSort, ungrouped };
  });

  // The grouped column is gone from the header.
  expect(r.grouped.headers).toEqual(['Name']);
  expect(r.grouped.cellsPerRow).toBe(3); // select + the one remaining column + actions
  expect(r.grouped.groups).toEqual([
    { label: 'Blue', count: '2', colspan: 2 },
    { label: 'Red', count: '1', colspan: 2 },
  ]);
  expect(r.grouped.order).toEqual(['Ana', 'Cy', 'Bo']); // Blue rows adjacent
  expect(r.grouped.visible).toBe(3);

  // Folded: the group's rows are hidden by CSS off the row flag.
  expect(r.folded.collapsed).toBe(true);
  expect(r.folded.expanded).toBe('false');
  expect(r.folded.visible).toBe(1); // only Red's single row

  // The fold survives a re-render.
  expect(r.afterSort.collapsed).toBe(true);
  expect(r.afterSort.visible).toBe(1);

  // Un-grouping restores the column without re-populating.
  expect(r.ungrouped.headers).toEqual(['Name', 'Team']);
  expect(r.ungrouped.groups).toBe(0);
});

test('sorting BY the grouped column turns the group order around', async ({ page }) => {
  // Group and sort on the SAME column and the two keys are one key: the direction
  // the user asked for is a direction for the GROUPS. Sorting by a DIFFERENT
  // column leaves the groups A-Z and only orders the rows inside each one.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'team', header: 'Team' },
      ],
      rows: [
        { name: 'Ana', team: 'Blue' },
        { name: 'Bo', team: 'Red' },
        { name: 'Cy', team: 'Blue' },
        { name: 'Di', team: 'Green' },
      ],
    });
    el.dataset['groupField'] = 'team';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const groups = () =>
      Array.from(sr.querySelectorAll('.group-label')).map((g) => g.textContent);
    // children[0] is the (CSS-hidden) selection cell, which is always in the DOM.
    const names = () =>
      Array.from(sr.querySelectorAll('.row')).map((row) => row.children[1]!.textContent?.trim());

    const plain = groups();

    // Sort by the grouped column, descending.
    el.dataset['sortField'] = 'team';
    el.dataset['sortDirection'] = 'desc';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const desc = { groups: groups(), names: names() };

    // ...and ascending again.
    el.dataset['sortDirection'] = 'asc';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const asc = groups();

    // A DIFFERENT sort column must not touch the group order.
    el.dataset['sortField'] = 'name';
    el.dataset['sortDirection'] = 'desc';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const other = { groups: groups(), names: names() };

    return { plain, desc, asc, other };
  });

  // No sort at all: groups run A-Z.
  expect(r.plain).toEqual(['Blue', 'Green', 'Red']);

  // Sorting by the grouped column descending reverses the GROUPS.
  expect(r.desc.groups).toEqual(['Red', 'Green', 'Blue']);
  // Every row still sits under its own group heading.
  expect(r.desc.names).toEqual(['Bo', 'Di', 'Ana', 'Cy']);

  expect(r.asc).toEqual(['Blue', 'Green', 'Red']);

  // Sorting by another column: groups stay A-Z, rows flip INSIDE their group.
  expect(r.other.groups).toEqual(['Blue', 'Green', 'Red']);
  expect(r.other.names).toEqual(['Cy', 'Ana', 'Di', 'Bo']);
});

test('a group checkbox selects every row in that group', async ({ page }) => {
  // The group row is a heading for its rows, so its box is their select-all.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name' }, { field: 'team', header: 'Team' }],
      rows: [
        { name: 'Ana', team: 'Blue' },
        { name: 'Bo', team: 'Red' },
        { name: 'Cy', team: 'Blue' },
      ],
    });
    el.dataset['groupField'] = 'team';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    let emitted: string[] = [];
    el.addEventListener('selection-change', (e) => {
      emitted = (e as CustomEvent).detail.selected;
    });

    const rowsIn = (key: string) =>
      Array.from(sr.querySelectorAll<HTMLElement>('.row')).filter((r) => r.dataset['groupKey'] === key);
    const checkedIn = (key: string) =>
      rowsIn(key).filter(
        (r) => r.querySelector<HTMLElement & { checked: boolean }>('.row-multi')!.checked,
      ).length;

    // Tick the Blue group's box. The CONTROL inside it, not the host — a click
    // on a custom element reaches no listener, because the listener lives on
    // the inner input inside its own shadow root.
    // TRAP T-a-test-must-click-what-the-listener-is-on.
    const blueBox = sr.querySelector<HTMLElement & { checked: boolean; indeterminate: boolean }>(
      '.group-row[data-group-key="Blue"] .group-select',
    )!;
    blueBox.shadowRoot!.querySelector<HTMLInputElement>('.control')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const selected = {
      blue: checkedIn('Blue'),
      blueTotal: rowsIn('Blue').length,
      // Only THAT group — a group box is not a select-all for the table.
      red: checkedIn('Red'),
      emitted: emitted.length,
    };

    // Untick one Blue row: the group box must go INDETERMINATE, not stay checked.
    rowsIn('Blue')[0]!
      .querySelector('.row-multi')!
      .shadowRoot!.querySelector<HTMLInputElement>('.control')!
      .click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const partial = { checked: blueBox.checked, indeterminate: blueBox.indeterminate };

    // Click the INDETERMINATE box: the browser resolves it to CHECKED (that is
    // native checkbox behaviour, not something to fight), so the group fills back
    // up. A second click then clears it.
    const clickBlue = (): void =>
      blueBox.shadowRoot!.querySelector<HTMLInputElement>('.control')!.click();
    clickBlue();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const refilled = { blue: checkedIn('Blue'), emitted: emitted.length };
    clickBlue();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const cleared = { blue: checkedIn('Blue'), emitted: emitted.length };

    // The header select-all fills every group box in.
    /* The header box is a `sherpa-select-checkbox` now, not a raw <input> —
       clicking the HOST does not toggle the control inside it, which is what a
       real user clicks. */
    sr.querySelector('.select-all')!.shadowRoot!
      .querySelector<HTMLInputElement>('.control')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const all = {
      groups: Array.from(
        sr.querySelectorAll<HTMLElement & { checked: boolean }>('.group-select'),
      ).map((b) => b.checked),
    };

    return { selected, partial, refilled, cleared, all };
  });

  expect(r.selected).toEqual({ blue: 2, blueTotal: 2, red: 0, emitted: 2 });
  // A part-selected group reads as indeterminate, so the box never lies about its rows.
  expect(r.partial).toEqual({ checked: false, indeterminate: true });
  expect(r.refilled).toEqual({ blue: 2, emitted: 2 });
  expect(r.cleared).toEqual({ blue: 0, emitted: 0 });
  expect(r.all.groups).toEqual([true, true]);
});


test('a numeric column right-aligns its HEADER with its digits', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    grid.setAttribute('data-filterable', '');
    document.getElementById('root')!.appendChild(grid);
    await grid.rendered;
    grid.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'seats', header: 'Seats', type: 'number' },
      ],
      rows: [{ name: 'Acme', seats: 42 }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = grid.shadowRoot!;
    const pick = (field: string) => {
      const th = sr.querySelector(`.head-cell[data-field="${field}"]`) as HTMLElement;
      const td = sr.querySelector(`.cell[data-type], .row .cell`) as HTMLElement;
      return {
        type: th.dataset['type'] ?? null,
        header: getComputedStyle(th.querySelector('.head-btn')!).justifyContent,
        filter: getComputedStyle(
          sr.querySelector(`.filter-cell[data-field="${field}"] .filter-input`)!,
        ).textAlign,
      };
    };
    const cell = sr.querySelector('.cell[data-type="number"]') as HTMLElement;
    return { name: pick('name'), seats: pick('seats'), cellAlign: getComputedStyle(cell).textAlign };
  });

  // The cells were already right-aligned; the HEADER was not, so a column of
  // digits sat under a left-aligned heading and read as a different column.
  expect(r.cellAlign).toBe('end');
  expect(r.seats.type).toBe('number');
  expect(r.seats.header).toBe('flex-end');
  // …and the filter input above them agrees, for the same reason.
  expect(r.seats.filter).toBe('end');

  // A text column is untouched.
  expect(r.name.type).toBe(null);
  expect(r.name.header).not.toBe('flex-end');
});

test('the scroller FILLS a sized host, and still scrolls inside it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const box = document.createElement('div');
    box.style.cssText = 'block-size:300px;inline-size:600px;display:flex;';
    const grid = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    box.appendChild(grid);
    document.getElementById('root')!.appendChild(box);
    await grid.rendered;
    grid.populate({
      columns: [{ field: 'name', header: 'Name' }],
      rows: Array.from({ length: 40 }, (_, i) => ({ name: `Row ${i}` })),
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sc = grid.shadowRoot!.querySelector('.scroller') as HTMLElement;
    const gridH = grid.getBoundingClientRect().height;
    const scH = sc.getBoundingClientRect().height;
    sc.scrollTop = 120;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      hostH: gridH,
      scrollerH: scH,
      // The only difference should be the host's own 0.5px border, top and bottom.
      shortfall: +(gridH - scH).toFixed(1),
      canScroll: sc.scrollHeight > sc.clientHeight,
      scrolled: sc.scrollTop,
    };
  });

  // FILLS. Without `flex: 1 1 auto` the scroller sized to its CONTENT, so in a
  // fixed-height panel the rows stopped short of the grid's own bottom edge and
  // left a white band under them.
  expect(r.hostH).toBeCloseTo(300, 0);
  expect(r.shortfall).toBeLessThanOrEqual(2);

  // …and still scrolls. `min-block-size: 0` is the other half: a flex child
  // floors at its content size, so without it the box would refuse to shrink
  // below the full row list and the scroll would never engage.
  expect(r.canScroll).toBe(true);
  expect(r.scrolled).toBe(120);
});

/**
 * Columns are a SET width, not a measured one.
 *
 * Under the old `table-layout: auto` the longest value in a column set that
 * column's size, so one long customer name pushed every other column out and the
 * grid scrolled sideways for a single row. The fix is a <colgroup> read under
 * `table-layout: fixed`, which makes the label truncate inside its column instead.
 */
test('a long value truncates inside its column instead of widening it', async ({ page }) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const el = await window.__buildGrid({
      columns: [{ field: 'name', header: 'Name' }, { field: 'note', header: 'Note' }],
      rows: [
        { name: 'Jo', note: 'short' },
        { name: 'A name far longer than any column should ever grow to fit', note: 'x' },
      ],
    });
    const sr = el.shadowRoot!;
    const heads = Array.from(sr.querySelectorAll('.head-cell')).map((h) =>
      Math.round(h.getBoundingClientRect().width),
    );
    const long = Array.from(sr.querySelectorAll<HTMLElement>('.row .cell')).find((c) =>
      (c.textContent ?? '').startsWith('A name far'),
    )!;
    return {
      heads,
      tableLayout: getComputedStyle(sr.querySelector('.grid')!).tableLayout,
      // The value overflows its box — which is exactly what an ellipsis means.
      clipped: long.scrollWidth > long.clientWidth,
      ellipsis: getComputedStyle(long).textOverflow,
      // `clip`, not `hidden`: the last pinned cell paints its scroll shadow as an
      // ::after standing OUTSIDE its trailing edge, and `hidden` clipped it away.
      overflow: getComputedStyle(long).overflow,
    };
  });

  expect(r.tableLayout).toBe('fixed');
  // Both columns are the default width — the long value changed nothing.
  expect(r.heads).toEqual([160, 160]);
  expect(r.clipped).toBe(true);
  expect(r.ellipsis).toBe('ellipsis');
  expect(r.overflow).toBe('clip');
});

/**
 * Dragging a header's trailing grip resizes that column, clamped to the 8px-grid
 * bounds — and does NOT sort it. The grip sits on top of the sort button, so the
 * browser synthesises a click on pointerup that the header would otherwise read
 * as a sort; #onGripUp swallows exactly one.
 */
test('the header grip resizes a column, clamps it, and does not sort', async ({ page }) => {
  await installBuilder(page);
  await page.evaluate(async () => {
    await window.__buildGrid({
      columns: [{ field: 'name', header: 'Name' }, { field: 'note', header: 'Note' }],
      rows: [{ name: 'Jo', note: 'x' }],
    });
  });

  const gripCentre = async (i: number): Promise<{ x: number; y: number }> =>
    page.evaluate((n) => {
      const th = Array.from(
        document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
      )[n]!;
      const r = th.querySelector('.resize-grip')!.getBoundingClientRect();
      return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
    }, i);

  const width = async (i: number): Promise<number> =>
    page.evaluate(
      (n) =>
        Math.round(
          Array.from(
            document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
          )[n]!.getBoundingClientRect().width,
        ),
      i,
    );

  const sortField = async (): Promise<string | null> =>
    page.evaluate(() => document.querySelector('sherpa-data-grid')!.getAttribute('data-sort-field'));

  const drag = async (i: number, dx: number): Promise<void> => {
    const g = await gripCentre(i);
    await page.mouse.move(g.x, g.y);
    await page.mouse.down();
    await page.mouse.move(g.x + dx, g.y, { steps: 10 });
    await page.mouse.up();
    await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());
  };

  expect(await width(0)).toBe(160);

  await drag(0, 80);
  expect(await width(0)).toBe(240);
  // The drag must NOT have sorted the column it grabbed.
  expect(await sortField()).toBeNull();

  // Clamped at both ends, on the 8px grid.
  await drag(0, -500);
  expect(await width(0)).toBe(96);
  await drag(0, 900);
  expect(await width(0)).toBe(480);

  // …and a REAL header click straight after a resize still sorts. The click
  // suppressor is `once`, so it eats the synthesised click and nothing more.
  await page.evaluate(() => {
    const th = Array.from(
      document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.head-cell'),
    )[0]!;
    th.querySelector<HTMLElement>('.head-btn')!.click();
  });
  await page.evaluate(() => (window as unknown as { __settled: () => Promise<void> }).__settled());
  expect(await sortField()).toBe('name');
});

/**
 * data-select="single" — the grid picks ONE row.
 *
 * Radios, not checkboxes: the native type buys the group behaviour, so the
 * browser unticks the previous row and arrow keys move the choice. And no
 * control in the header, because "select all" is meaningless where only one can
 * be chosen — a lone checkbox there would offer something the grid cannot do.
 */
test('data-select="single" draws radios, holds one row, and drops the select-all', async ({
  page,
}) => {
  await installBuilder(page);
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const run = async (single: boolean): Promise<Record<string, unknown>> => {
      const el = await window.__buildGrid({
        columns: [{ field: 'name', header: 'Name' }],
        rows: [{ name: 'A' }, { name: 'B' }, { name: 'C' }],
      });
      el.setAttribute('data-selectable', '');
      if (single) el.setAttribute('data-select', 'single');
      await settle();

      const sr = el.shadowRoot!;
      // The VISIBLE box only. Both a checkbox and a radio are stamped in every
      // row and CSS reveals one, so `.row-select` alone matches two elements
      // per row — T-compose-never-reimplement.
      const boxes = (): (HTMLElement & { checked: boolean })[] =>
        [...sr.querySelectorAll<HTMLElement & { checked: boolean }>(
          single ? '.row-one' : '.row-multi',
        )];
      const shown = (sel: string): boolean => {
        const n = sr.querySelector(sel);
        return !!n && getComputedStyle(n).display !== 'none';
      };

      const before = {
        type: boxes()[0]?.tagName.toLowerCase(),
        // One NAME per grid, so two grids on a page cannot share a group and
        // steal each other's selection.
        names: [...new Set(boxes().map((b) => b.getAttribute('name')))].length,
        selectAll: shown('.select-all'),
        // The CELL stays — it holds the column open so the radios line up.
        headCell: shown('.select-head'),
      };

      let detail: unknown = null;
      el.addEventListener('selection-change', (e) => {
        detail = (e as CustomEvent).detail;
      });

      // The CONTROL inside, not the host — TRAP
      // T-a-test-must-click-what-the-listener-is-on.
      const click = (i: number): void =>
        boxes()[i]!.shadowRoot!.querySelector<HTMLInputElement>('.control')!.click();
      click(0);
      await settle();
      click(2);
      await settle();

      return {
        ...before,
        ticked: boxes().filter((b) => b.checked).length,
        reported: (detail as { selected: string[] } | null)?.selected.length ?? null,
      };
    };

    return { multi: await run(false), single: await run(true) };
  });

  // MULTIPLE is unchanged: checkboxes, a select-all, and both picks held.
  // A REAL component now, not a bare <input> wearing an accent-color.
  expect(r.multi.type).toBe('sherpa-select-checkbox');
  expect(r.multi.selectAll).toBe(true);
  expect(r.multi.ticked).toBe(2);
  expect(r.multi.reported).toBe(2);

  // SINGLE: radios in one group, no select-all, one row held. A DIFFERENT
  // element, chosen by CSS — JS no longer rewrites a control's type.
  expect(r.single.type).toBe('sherpa-select-radio');
  expect(r.single.names).toBe(1);
  expect(r.single.selectAll).toBe(false);
  // …and the column is still open, so the radios line up under the header.
  expect(r.single.headCell).toBe(true);
  expect(r.single.ticked).toBe(1);
  expect(r.single.reported).toBe(1);
});

/**
 * COLUMN FILTERS — a filter button in each heading, left of the sort control.
 *
 * The button is an icon-only <sherpa-quick-filter>: a column filter is a button
 * that opens a value menu, which is what the chip already is. Reusing it means
 * one popover implementation, one cross-shadow placement measurement and one
 * Apply footer rather than a second set drifting from the toolbar's.
 */
test('a TEXT column heading offers a filter menu of DevExtreme conditions', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'spend', header: 'Spend', type: 'number' },
      ],
      rows: [{ name: 'Ada', spend: 10 }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const chip = (field: string): HTMLElement =>
      sr.querySelector(`.head-cell[data-field="${field}"] .head-filter`) as HTMLElement;

    const text = chip('name');
    const number = chip('spend');

    // LABEL, FILTER, SORT — the name leads, the two controls follow it, inside
    // the flex row. The row is an INNER wrapper, never the <th>: flexing a
    // table cell takes it out of table layout and the header stacks vertically
    // instead of running across.
    const cell = sr.querySelector('.head-cell[data-field="name"]')!;
    const row = cell.querySelector('.head-row-inner')!;
    const order = Array.from(row.children).map((c) => c.className.split(' ')[0]);
    // The CELL itself must still lay out as a table cell.
    const cellDisplay = getComputedStyle(cell).display;
    // …and the two controls must sit SIDE BY SIDE, not stacked. Order in the
    // DOM is not enough: the wrapper is a <span>, so until its flex rule lands
    // it is `display: inline` and the button drops onto its own line UNDER the
    // label. Measured, because that is the part a reader sees.
    const boxes = {
      label: cell.querySelector('.head-btn')!.getBoundingClientRect(),
      filter: cell.querySelector('.head-filter')!.getBoundingClientRect(),
      sort: cell.querySelector('.head-sort')!.getBoundingClientRect(),
    };
    const mid = (b: DOMRect): number => (b.top + b.bottom) / 2;
    const sideBySide = {
      rowDisplay: getComputedStyle(row).display,
      // All three on one line: their vertical centres agree within a pixel.
      sameLine: Math.abs(mid(boxes.label) - mid(boxes.filter)) < 1.5
        && Math.abs(mid(boxes.filter) - mid(boxes.sort)) < 1.5,
      // …and in order, left to right.
      inOrder: boxes.label.right <= boxes.filter.left + 1
        && boxes.filter.right <= boxes.sort.left + 1,
    };

    return {
      textShown: getComputedStyle(text).display,
      // A TEXT column has no Range switch: "between two strings" is not a
      // question a reader asks of a name.
      textRange: !!text.querySelector('.head-filter-range'),
      numberShown: getComputedStyle(number).display,
      numberRange: !!number.querySelector('.head-filter-range'),
      order,
      cellDisplay,
      sideBySide,
      // DevExtreme's binary operations, narrowed to the ones a text column can
      // answer. The <, <=, > and >= family is numeric and deliberately absent.
      conditions: Array.from(text.querySelectorAll('option')).map((o) => o.value),
      // The menu defers behind Apply: a condition and a value are two decisions,
      // and querying on the half-built pair is a query for "contains ''".
      commits: !!text.querySelector('sherpa-menu')?.hasAttribute('data-commit'),
      heading: text.querySelector('sherpa-menu')?.getAttribute('data-heading'),
      // Locked, because the chip derives its own on-state from ticked ROWS and
      // this menu has none — unlocked it switched itself off on every Apply.
      locked: text.hasAttribute('data-locked'),
    };
  });

  expect(r.textShown).not.toBe('none');
  expect(r.textRange).toBe(false);
  // A NUMBER column offers one too, and leads with the Range switch.
  expect(r.numberShown).not.toBe('none');
  expect(r.numberRange).toBe(true);
  expect(r.order).toEqual(['head-btn', 'head-filter', 'head-sort']);
  expect(r.cellDisplay).toBe('table-cell');
  expect(r.sideBySide.rowDisplay).toBe('flex');
  expect(r.sideBySide.sameLine).toBe(true);
  expect(r.sideBySide.inOrder).toBe(true);
  /* `eq` LEADS, so it is the default the menu opens on — the same default the
     filter CHIP menu opens on, because one field has one condition wherever a
     reader meets it. TRAP T-an-operator-decides-pick-or-type */
  expect(r.conditions).toEqual([
    'eq', 'ne', 'contains', 'notcontains', 'startswith', 'endswith',
  ]);
  expect(r.commits).toBe(true);
  expect(r.heading).toBe('Filter Name');
  expect(r.locked).toBe(true);
});

test('applying a column filter flags the column and reports a ready clause', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      clearColumnFilter(field?: string): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name' }, { field: 'team', header: 'Team' }],
      rows: [{ name: 'Ada', team: 'Blue' }, { name: 'Bob', team: 'Red' }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const events: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => events.push((e as CustomEvent).detail));

    const chip = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="name"] .head-filter') as HTMLElement;
    const head = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="name"]') as HTMLElement;
    // Apply and Clear are <sherpa-button>s in the menu's shadow root, so the
    // real <button> is one root deeper — click the component, which forwards.
    const footer = async (which: 'apply' | 'clear'): Promise<void> => {
      const menu = chip().querySelector('sherpa-menu')!;
      menu.shadowRoot!.querySelector<HTMLElement>(`.${which}`)!.click();
      await new Promise((res) => setTimeout(res, 40));
      await settle();
    };
    const fill = (op: string, value: string): void => {
      chip().querySelector<HTMLSelectElement>('.head-filter-op')!.value = op;
      chip().querySelector<HTMLInputElement>('.head-filter-value')!.value = value;
    };

    fill('startswith', 'Ad');
    await footer('apply');
    const applied = {
      status: head().dataset['status'] ?? null,
      chipOn: chip().hasAttribute('data-current'),
    };

    // A RE-POPULATE is what a host does when it re-queries off the clause the
    // grid just reported — so the filter must SURVIVE its own round trip. It
    // used to be wiped here, and the heading went dark the instant the rows it
    // had asked for arrived.
    el.populate({
      columns: [{ field: 'name', header: 'Name' }, { field: 'team', header: 'Team' }],
      rows: [{ name: 'Ada', team: 'Blue' }],
    });
    await settle();
    const afterRepopulate = {
      status: head().dataset['status'] ?? null,
      chipOn: chip().hasAttribute('data-current'),
      // The chip must read ACTIVE, not the amber "on but empty" warning: its
      // menu has no tickable rows, so "nothing ticked" says nothing about
      // whether it is filtering. data-locked is what tells it so.
      empty: chip().hasAttribute('data-empty'),
      value: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
    };

    // A SORT rebuilds the whole header row, so the menu is stamped fresh — the
    // pair the user set has to come back with it.
    el.dataset['sortField'] = 'team';
    await settle();
    const afterSort = {
      op: chip().querySelector<HTMLSelectElement>('.head-filter-op')!.value,
      value: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
      chipOn: chip().hasAttribute('data-current'),
      status: head().dataset['status'] ?? null,
    };

    // An EMPTY value is not a filter: "contains nothing" matches every row, so
    // applying it would light the column and change the view not at all.
    fill('contains', '   ');
    await footer('apply');
    const emptied = {
      status: head().dataset['status'] ?? null,
      chipOn: chip().hasAttribute('data-current'),
    };

    // Set one again, then clear it from OUTSIDE — what removing its toolbar
    // chip has to reach back and do.
    fill('eq', 'Ada');
    await footer('apply');
    const beforeExternal = head().dataset['status'] ?? null;
    el.clearColumnFilter('name');
    await settle();
    const external = {
      status: head().dataset['status'] ?? null,
      value: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
      // The external clear must NOT echo an event back at the caller.
      eventCount: events.length,
    };

    return { applied, afterRepopulate, afterSort, emptied, beforeExternal, external, events };
  });

  // Applied: the column lights, the button takes the chip's own on-state.
  expect(r.applied.status).toBe('active');
  expect(r.applied.chipOn).toBe(true);

  // The clause is READY for a DataSource — the <option> values ARE store ops.
  const first = r.events[0] as Record<string, unknown>;
  expect(first['field']).toBe('name');
  expect(first['header']).toBe('Name');
  expect(first['clause']).toEqual(['name', 'startswith', 'Ad']);
  // And the chip text a toolbar should show.
  expect(first['label']).toBe('Starts with: Ad');

  // It survives its OWN round trip — the re-populate the clause caused.
  expect(r.afterRepopulate.status).toBe('active');
  expect(r.afterRepopulate.chipOn).toBe(true);
  expect(r.afterRepopulate.empty).toBe(false);
  expect(r.afterRepopulate.value).toBe('Ad');

  // The pair survives the header rebuild a sort causes.
  expect(r.afterSort.op).toBe('startswith');
  expect(r.afterSort.value).toBe('Ad');
  expect(r.afterSort.chipOn).toBe(true);
  expect(r.afterSort.status).toBe('active');

  // A whitespace-only value clears rather than filtering on nothing.
  expect(r.emptied.status).toBe(null);
  expect(r.emptied.chipOn).toBe(false);
  const emptyEvent = r.events[1] as Record<string, unknown>;
  expect(emptyEvent['clause']).toBe(null);
  expect(emptyEvent['label']).toBe(null);

  // clearColumnFilter() unflags the column and empties the menu…
  expect(r.beforeExternal).toBe('active');
  expect(r.external.status).toBe(null);
  expect(r.external.value).toBe('');
  // …and stays silent: the caller already knows, and re-firing would make a
  // host that routes the event back into its query clear it twice.
  expect(r.external.eventCount).toBe(3);
});

test('a column filter button never sorts the column it sits in', async ({ page }) => {
  // The heading's click handler is delegated from the whole row, so without a
  // guard, opening a filter menu would also sort — the wrong answer to a
  // gesture that was not a sort.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({ columns: [{ field: 'name', header: 'Name' }], rows: [{ name: 'Ada' }] });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const sorts: unknown[] = [];
    el.addEventListener('sort-change', (e) => sorts.push((e as CustomEvent).detail));

    const chip = sr.querySelector('.head-cell[data-field="name"] .head-filter') as HTMLElement;
    chip.shadowRoot!.querySelector<HTMLElement>('.caret')!.click();
    await new Promise((res) => setTimeout(res, 40));
    await settle();

    return {
      sorts: sorts.length,
      sortField: el.dataset['sortField'] ?? null,
      // The menu really did open — the guard must not have blocked the click.
      menuOpen: chip.querySelector('sherpa-menu')!.hasAttribute('open'),
    };
  });

  expect(r.sorts).toBe(0);
  expect(r.sortField).toBe(null);
  expect(r.menuOpen).toBe(true);
});

test('a NUMBER column filters by condition, or by a RANGE, and coerces its ends', async ({ page }) => {
  // A number filter is "equals this" or "between these two" — one menu with a
  // mode, not two controls the reader must choose between before they know
  // which they want. The toolbar's own number chip works this way; this
  // follows it so a reader meets one control, not two that behave alike.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'spend', header: 'Spend', type: 'number' }],
      rows: [{ spend: 10 }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const events: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => events.push((e as CustomEvent).detail));
    const chip = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="spend"] .head-filter') as HTMLElement;
    const apply = async (): Promise<void> => {
      chip().querySelector('sherpa-menu')!.shadowRoot!
        .querySelector<HTMLElement>('.apply')!.click();
      await new Promise((res) => setTimeout(res, 40));
      await settle();
    };

    // DevExtreme's numeric binary operations. The string family (contains,
    // startswith…) is absent — "starts with" on a spend column is not a
    // question, and offering it invites a comparison with no meaning.
    const conditions = Array.from(chip().querySelectorAll('option')).map((o) => o.value);

    /* SINGLE first — and a number column now OPENS as a range, so the switch
       has to be turned OFF to get there. That default is the point of
       T-a-default-is-not-an-override; this test is about the two SHAPES, and
       it still walks both, starting from the other end. */
    const off = chip().querySelector('sherpa-switch') as HTMLElement & { checked: boolean };
    off.checked = false;
    off.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await settle();

    // SINGLE: a condition and one value.
    chip().querySelector<HTMLSelectElement>('.head-filter-op')!.value = 'gte';
    chip().querySelector<HTMLInputElement>('.head-filter-value')!.value = '100';
    await apply();

    // RANGE: the switch re-points the menu rather than rebuilding it, so what
    // was typed on the single side is still there on the way back.
    const sw = chip().querySelector('sherpa-switch') as HTMLElement & { checked: boolean };
    sw.checked = true;
    sw.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await settle();
    const ranged = {
      mode: chip().querySelector('sherpa-menu')!.hasAttribute('data-range'),
      // The condition picker goes: a range IS `between`, which the slider's two
      // thumbs say more plainly than a list could.
      opHidden: getComputedStyle(chip().querySelector<HTMLElement>('.head-filter-op')!).display,
      sliderShown: getComputedStyle(chip().querySelector<HTMLElement>('.head-filter-slider')!).display,
      // The single value survives the flip — both shapes are in the DOM, so
      // nothing is rebuilt and nothing typed is lost.
      kept: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
      // The slider spans the COLUMN's real values, not its own 0..100 default
      // — a spend column left at 0..100 would crush every row at the far left.
      bounds: [
        chip().querySelector('.head-filter-slider')!.getAttribute('min'),
        chip().querySelector('.head-filter-slider')!.getAttribute('max'),
      ],
    };

    // The slider keeps its ends in its own attributes, which is where the grid
    // reads them from.
    const slider = chip().querySelector('.head-filter-slider')!;
    slider.setAttribute('value-start', '5');
    slider.setAttribute('value-end', '50');
    await apply();

    return { conditions, ranged, events };
  });

  expect(r.conditions).toEqual(['eq', 'ne', 'gt', 'gte', 'lt', 'lte']);

  // The single clause carries a real NUMBER, not the typed string. The store
  // compares numerically only when BOTH sides are numbers; as a string, "100"
  // sorts below "9" and "at least 100" would miss every row above 99.
  const single = r.events[0] as Record<string, unknown>;
  expect(single['clause']).toEqual(['spend', 'gte', 100]);
  expect(single['label']).toBe('At least: 100');

  // Range mode swaps the shape without a rebuild.
  expect(r.ranged.mode).toBe(true);
  expect(r.ranged.opHidden).toBe('none');
  expect(r.ranged.sliderShown).not.toBe('none');
  expect(r.ranged.kept).toBe('100');
  // One row of 10, so the column's span is a single point — but it is the
  // COLUMN's, not the slider's default.
  expect(r.ranged.bounds).toEqual(['10', '10']);

  // A span: the store's own `between`, ends coerced.
  const both = r.events[r.events.length - 1] as Record<string, unknown>;
  expect(both['clause']).toEqual(['spend', 'between', [5, 50]]);
  expect(both['label']).toBe('Between: 5 - 50');
});

test('a DATE column filters with a calendar, one day or a span', async ({ page }) => {
  // A calendar answers "which day" by being clicked, so there is no condition
  // picker — a "greater than" over a date grid would be a second way of saying
  // "after", with nowhere to show it.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'created', header: 'Created', type: 'date' }],
      rows: [{ created: '2026-01-05' }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const events: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => events.push((e as CustomEvent).detail));
    const chip = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="created"] .head-filter') as HTMLElement;
    const cal = (): HTMLElement => chip().querySelector('.head-filter-calendar') as HTMLElement;
    const apply = async (): Promise<void> => {
      chip().querySelector('sherpa-menu')!.shadowRoot!
        .querySelector<HTMLElement>('.apply')!.click();
      await new Promise((res) => setTimeout(res, 40));
      await settle();
    };

    const shape = {
      hasCalendar: !!cal(),
      hasRange: !!chip().querySelector('.head-filter-range'),
      // No condition list — the grid IS the condition.
      conditions: chip().querySelectorAll('option').length,
      // Embedded, so it sits inside the menu card rather than floating as its
      // own popover.
      embedded: cal().hasAttribute('data-embedded'),
    };

    // ONE DAY. The calendar holds its pick in its own attributes rather than an
    // input, so the grid reads it from there.
    cal().dataset['value'] = '2026-01-05';
    await apply();

    // RANGE. The switch re-points the CALENDAR — it already owns both shapes,
    // so there is no second calendar to swap in.
    const sw = chip().querySelector('sherpa-switch') as HTMLElement & { checked: boolean };
    sw.checked = true;
    sw.dispatchEvent(new Event('change', { bubbles: true, composed: true }));
    await settle();
    const calType = cal().getAttribute('data-type');

    cal().dataset['valueStart'] = '2026-01-01';
    cal().dataset['valueEnd'] = '2026-01-31';
    await apply();

    return { shape, calType, events };
  });

  expect(r.shape.hasCalendar).toBe(true);
  expect(r.shape.hasRange).toBe(true);
  expect(r.shape.conditions).toBe(0);
  expect(r.shape.embedded).toBe(true);

  // One day: equality, because that is the only thing a clicked day can mean.
  const day = r.events[0] as Record<string, unknown>;
  expect(day['clause']).toEqual(['created', 'eq', '2026-01-05']);
  expect(day['label']).toBe('Equals: 2026-01-05');

  // The switch turns the calendar itself into its two-click mode.
  expect(r.calType).toBe('range');

  // A span: the store's own `between`. Dates stay STRINGS — ISO text compares
  // correctly date-wise, and coercing them would turn them into NaN.
  const span = r.events[r.events.length - 1] as Record<string, unknown>;
  expect(span['clause']).toEqual(['created', 'between', ['2026-01-01', '2026-01-31']]);
  expect(span['label']).toBe('Between: 2026-01-01 - 2026-01-31');
});

test('a TEXT column filter MARKS its matches; number and date cells stay plain', async ({ page }) => {
  // A filtered column says WHICH rows survived; the mark says why THIS one did,
  // so the reader does not scan a column of long names for the letters that
  // matched. Only the substring conditions leave something to point at, and
  // only in the column the filter is on.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'team', header: 'Team' },
        { field: 'spend', header: 'Spend', type: 'number' },
      ],
      rows: [
        { name: 'Marcus', team: 'Marketing', spend: 1042 },
        { name: 'Omar', team: 'Sales', spend: 204 },
      ],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const chip = (field: string): HTMLElement =>
      sr.querySelector(`.head-cell[data-field="${field}"] .head-filter`) as HTMLElement;
    const apply = async (field: string, op: string, value: string): Promise<void> => {
      chip(field).querySelector<HTMLSelectElement>('.head-filter-op')!.value = op;
      chip(field).querySelector<HTMLInputElement>('.head-filter-value')!.value = value;
      chip(field).querySelector('sherpa-menu')!.shadowRoot!
        .querySelector<HTMLElement>('.apply')!.click();
      await new Promise((res) => setTimeout(res, 40));
      await settle();
    };
    const marks = () =>
      Array.from(sr.querySelectorAll('.cell mark.match')).map((m) => ({
        text: m.textContent,
        column: (m.closest('.cell') as HTMLElement).dataset['type'] ?? 'text',
      }));

    await apply('name', 'contains', 'ar');
    // The cell's OWN casing, not the needle's — the reader typed "ar" and the
    // row says "Marcus"; the row is the truth.
    const contains = { marks: marks(), cells: sr.querySelectorAll('.cell').length };

    // `eq` matched the whole cell, so marking it would underline every
    // character. `ne` and `notcontains` matched by NOT being there.
    await apply('name', 'eq', 'Marcus');
    const equals = marks().length;
    await apply('name', 'notcontains', 'zz');
    const negated = marks().length;

    // A NUMBER column never marks: "greater than 20" does not match a
    // SUBSTRING of 204, and underlining the "20" would claim a precision the
    // filter does not have.
    await apply('name', 'contains', '');
    chip('spend').querySelector<HTMLSelectElement>('.head-filter-op')!.value = 'gt';
    chip('spend').querySelector<HTMLInputElement>('.head-filter-value')!.value = '20';
    chip('spend').querySelector('sherpa-menu')!.shadowRoot!
      .querySelector<HTMLElement>('.apply')!.click();
    await new Promise((res) => setTimeout(res, 40));
    await settle();
    const numeric = marks().length;

    return { contains, equals, negated, numeric };
  });

  // Only the FILTERED column marks — the Team cells hold "Mar" too and stay plain.
  expect(r.contains.marks).toEqual([
    { text: 'ar', column: 'text' },
    { text: 'ar', column: 'text' },
  ]);

  expect(r.equals).toBe(0);
  expect(r.negated).toBe(0);
  expect(r.numeric).toBe(0);
});

test('REMOVE FILTER ends a column filter outright; the menu never inherits a column tint', async ({ page }) => {
  // Clear empties the controls and leaves the menu open to type again. Remove
  // means "I am done with this column" — two intentions, two buttons.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      openColumnFilter(field: string, anchor?: HTMLElement): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name' }],
      rows: [{ name: 'Ada' }, { name: 'Bob' }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const events: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => events.push((e as CustomEvent).detail));
    const chip = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="name"] .head-filter') as HTMLElement;
    const menu = (): HTMLElement => chip().querySelector('sherpa-menu') as HTMLElement;
    const head = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="name"]') as HTMLElement;

    const removable = menu().hasAttribute('data-removable');

    chip().querySelector<HTMLSelectElement>('.head-filter-op')!.value = 'contains';
    chip().querySelector<HTMLInputElement>('.head-filter-value')!.value = 'Ad';
    menu().shadowRoot!.querySelector<HTMLElement>('.apply')!.click();
    await new Promise((res) => setTimeout(res, 40));
    await settle();
    const applied = head().dataset['status'] ?? null;

    // NOTHING THE BUTTON WEARS MAY REACH THE MENU. Both are custom properties
    // and the menu is a light-DOM child of the chip, so both inherit:
    //
    //   a column STATUS tint      — a tinted column painted its menu purple
    //   the button's QUIET look   — a transparent button made the menu's card
    //                               transparent, so the grid showed through it
    //
    // @scope does not help: it limits what a rule MATCHES, never how far a
    // value it sets then inherits. The --_status-* props are reset on the chip;
    // the quiet look is a real property on the caret, not a token re-point.
    //
    // The grid no longer tints an acting column itself, so the first leak is
    // only reachable when a HOST styles data-status. The reset and this guard
    // both stay: that door is public, and it used to paint the menu.
    const menuStyle = getComputedStyle(menu());
    const leaked = {
      status: menuStyle.getPropertyValue('--_status-surface').trim(),
      surface: menuStyle.getPropertyValue('--sherpa-style-surface-base').trim(),
      // The card must actually be PAINTED, which is what a reader sees.
      card: getComputedStyle(menu().shadowRoot!.querySelector('.menu')!).backgroundColor,
    };

    menu().shadowRoot!.querySelector<HTMLElement>('.remove')!.click();
    await new Promise((res) => setTimeout(res, 60));
    await settle();

    return {
      removable,
      applied,
      leaked,
      afterRemove: {
        status: head().dataset['status'] ?? null,
        chipOn: chip().hasAttribute('data-current'),
        value: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
      },
      events,
    };
  });

  expect(r.removable).toBe(true);
  expect(r.applied).toBe('active');

  // The heading is flagged and the button is quiet; the menu inherits neither.
  expect(r.leaked.status).toBe('');
  expect(r.leaked.surface).not.toBe('transparent');
  expect(r.leaked.card).toBe('rgb(255, 255, 255)');

  // Remove ends it: clause gone, heading unflagged, controls empty.
  expect(r.afterRemove.status).toBe(null);
  expect(r.afterRemove.chipOn).toBe(false);
  expect(r.afterRemove.value).toBe('');

  // It reports as a CLEAR, so a host has one path to handle, not two.
  const last = r.events[r.events.length - 1] as Record<string, unknown>;
  expect(last['clause']).toBe(null);
  expect(last['label']).toBe(null);
});

test('a column filter can be SUSPENDED and resumed without losing it', async ({ page }) => {
  // The filter shows on the toolbar as a chip, and a chip's body is a TOGGLE:
  // off means "stop applying this", not "delete it". Suspended, the clause is
  // still typed into the menu and still comes back from columnClause() — but
  // the heading stops reading active and its match marks come off, because the
  // column is narrowing nothing and a lit column that filters nothing is a lie.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      columnClause(field: string): unknown[] | null;
      suspendColumnFilter(field: string, suspended?: boolean): void;
      clearColumnFilter(field?: string): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [{ field: 'name', header: 'Name' }],
      rows: [{ name: 'Marcus' }, { name: 'Omar' }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const chip = (): HTMLElement =>
      sr.querySelector('.head-cell[data-field="name"] .head-filter') as HTMLElement;
    const snap = () => ({
      lit: (sr.querySelector('.head-cell[data-field="name"]') as HTMLElement)
        .dataset['status'] ?? null,
      marks: sr.querySelectorAll('.cell mark.match').length,
      clause: el.columnClause('name'),
      // The menu still holds what was typed, either way.
      value: chip().querySelector<HTMLInputElement>('.head-filter-value')!.value,
    });

    chip().querySelector<HTMLSelectElement>('.head-filter-op')!.value = 'contains';
    chip().querySelector<HTMLInputElement>('.head-filter-value')!.value = 'ar';
    chip().querySelector('sherpa-menu')!.shadowRoot!
      .querySelector<HTMLElement>('.apply')!.click();
    await new Promise((res) => setTimeout(res, 40));
    await settle();
    const applied = snap();

    el.suspendColumnFilter('name');
    await settle();
    const suspended = snap();

    el.suspendColumnFilter('name', false);
    await settle();
    const resumed = snap();

    // REMOVE is the other thing, and it really does delete.
    el.clearColumnFilter('name');
    await settle();
    const cleared = snap();

    return { applied, suspended, resumed, cleared };
  });

  // Applied: lit, marked, and the clause is live.
  expect(r.applied.lit).toBe('active');
  expect(r.applied.marks).toBe(2); // "Marcus" and "Omar" both hold "ar"
  expect(r.applied.clause).toEqual(['name', 'contains', 'ar']);

  // Suspended: the column stops CLAIMING to filter…
  expect(r.suspended.lit).toBe(null);
  expect(r.suspended.marks).toBe(0);
  // …but the clause and the typed value are both still there, which is what
  // makes resuming free.
  expect(r.suspended.clause).toEqual(['name', 'contains', 'ar']);
  expect(r.suspended.value).toBe('ar');

  expect(r.resumed.lit).toBe('active');
  expect(r.resumed.marks).toBe(2);

  // Cleared is the OTHER gesture — nothing survives it.
  expect(r.cleared.lit).toBe(null);
  expect(r.cleared.clause).toBe(null);
  expect(r.cleared.value).toBe('');
});

test('setColumnFilter restores a column from outside — the round trip a saved view needs', async ({ page }) => {
  // A value you can READ and not WRITE is half an API. Found by building the
  // reload-survival feature: the source restored the ROWS, the heading lit from
  // data-filter-fields, and the menu was empty — a lit column that lies about
  // why. What `column-filter-change` reports must be handable straight back.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      setColumnFilter(field: string, clause: unknown[] | null): void;
      columnClause(field: string): unknown[] | null;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'spend', header: 'Spend', type: 'number' },
      ],
      rows: [{ name: 'Marcus', spend: 10 }, { name: 'Omar', spend: 50 }],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const sr = el.shadowRoot!;
    const events: unknown[] = [];
    el.addEventListener('column-filter-change', (e) => events.push((e as CustomEvent).detail));

    const read = (field: string) => {
      const th = sr.querySelector(`.head-cell[data-field="${field}"]`) as HTMLElement;
      const chip = th.querySelector('.head-filter') as HTMLElement;
      return {
        lit: th.dataset['status'] ?? null,
        op: chip.querySelector<HTMLSelectElement>('.head-filter-op')?.value ?? null,
        value: chip.querySelector<HTMLInputElement>('.head-filter-value')?.value ?? null,
        clause: el.columnClause(field),
        marks: sr.querySelectorAll('.cell mark.match').length,
      };
    };

    // A TEXT clause, exactly as column-filter-change would report it.
    el.setColumnFilter('name', ['name', 'contains', 'ar']);
    await settle();
    const text = read('name');

    // A RANGE — `between` carries the two ends.
    el.setColumnFilter('spend', ['spend', 'between', [10, 50]]);
    await settle();
    const range = {
      lit: (sr.querySelector('.head-cell[data-field="spend"]') as HTMLElement).dataset['status'] ?? null,
      clause: el.columnClause('spend'),
    };

    // An EMPTY clause is not a filter — same rule the menu's own commit applies.
    el.setColumnFilter('name', ['name', 'contains', '']);
    await settle();
    const emptied = read('name');

    // …and null clears.
    el.setColumnFilter('spend', null);
    await settle();
    const cleared = el.columnClause('spend');

    return { text, range, emptied, cleared, events: events.length };
  });

  // The menu holds what was set, the column lights, and the cells mark.
  expect(r.text.lit).toBe('active');
  expect(r.text.op).toBe('contains');
  expect(r.text.value).toBe('ar');
  expect(r.text.marks).toBe(2);           // "Marcus" and "Omar" both hold "ar"
  // THE ROUND TRIP: what comes back out is what went in.
  expect(r.text.clause).toEqual(['name', 'contains', 'ar']);

  expect(r.range.lit).toBe('active');
  expect(r.range.clause).toEqual(['spend', 'between', [10, 50]]);

  expect(r.emptied.lit).toBe(null);
  expect(r.emptied.clause).toBe(null);
  expect(r.cleared).toBe(null);

  // SILENT — the caller is the one who asked, and echoing would make a host
  // that routes the event back into its query apply the same filter twice.
  expect(r.events).toBe(0);
});

test('selection has a programmatic door, and it is by KEY not position', async ({ page }) => {
  // `selection-change` reports row INDICES, which is what a live handler wants.
  // A saved view cannot use them: an index is a position in the currently
  // visible list, so it means something else after any sort or filter, and it
  // cannot name a selected row a filter is hiding.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      select(keys: readonly string[]): void;
      clearSelection(): void;
      selectedKeys: string[];
      selectedRecords: Record<string, unknown>[];
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.populate({
      key: 'email',
      columns: [{ field: 'name', header: 'Name' }],
      rows: [
        { email: 'a@x', name: 'Ada' },
        { email: 'b@x', name: 'Bob' },
        { email: 'c@x', name: 'Cy' },
      ],
    });
    const settle = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    await settle();

    const events: unknown[] = [];
    el.addEventListener('selection-change', (e) => events.push((e as CustomEvent).detail));
    // `.row-multi`, not `.row-select`: a checkbox AND a radio are stamped in
    // every row and CSS reveals one, so the broader selector counts each row
    // twice — T-compose-never-reimplement.
    const ticked = () =>
      Array.from(
        el.shadowRoot!.querySelectorAll<HTMLElement & { checked: boolean }>('.row-multi'),
      ).filter((b) => b.checked).length;

    el.select(['a@x', 'c@x']);
    await settle();
    const restored = {
      keys: el.selectedKeys,
      names: el.selectedRecords.map((x) => x['name']),
      ticked: ticked(),
    };

    // A saved view outlives the records it was made from. A key that matches
    // nothing must not stop the others being restored.
    el.select(['a@x', 'deleted@x']);
    await settle();
    const partial = el.selectedKeys;

    // THE POINT OF KEYS: a sort re-orders every row, and the selection holds.
    el.dataset['sortField'] = 'name';
    el.dataset['sortDirection'] = 'desc';
    await settle();
    const afterSort = { keys: el.selectedKeys, ticked: ticked() };

    el.clearSelection();
    await settle();

    return { restored, partial, afterSort, cleared: el.selectedKeys, events: events.length };
  });

  expect(r.restored.keys).toEqual(['a@x', 'c@x']);
  expect(r.restored.names).toEqual(['Ada', 'Cy']);
  expect(r.restored.ticked).toBe(2);

  expect(r.partial).toEqual(['a@x']);       // the missing key ignored, not thrown

  expect(r.afterSort.keys).toEqual(['a@x']); // survives a re-order
  expect(r.afterSort.ticked).toBe(1);

  expect(r.cleared).toEqual([]);

  // SILENT, like every other setter here.
  expect(r.events).toBe(0);
});

test('selectedKeys is EMPTY without a key — honest, not approximate', async ({ page }) => {
  // A selection saved by position would come back pointing at the wrong
  // records, which is worse than not offering to save it.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
      select(keys: readonly string[]): void;
      selectedKeys: string[];
      selectedRecords: Record<string, unknown>[];
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    // NO key in the config.
    el.populate({ columns: [{ field: 'name', header: 'Name' }], rows: [{ name: 'Ada' }] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    el.select(['anything']);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { keys: el.selectedKeys, records: el.selectedRecords.length };
  });

  expect(r.keys).toEqual([]);
  expect(r.records).toBe(0);
});

test('a SHUT group costs one slot of the page, not one per row', async ({ page }) => {
  // TRAP T-grid-collapsed-group-is-one-slot — a page is SCREEN LINES. Shutting
  // Gold used to leave a page holding one heading and 24 rows CSS was hiding,
  // and a pager insisting there were more pages like it.
  const r = await page.evaluate(async () => {
    const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    // Three groups of four, and a page of five LINES. Open, that is
    // heading+4 = 5 for one group alone, so ONE group fills page 1 exactly.
    // Groups sort A→Z (T-grid-group-drops-the-column), so the order on screen
    // is Bronze, Gold, Silver whatever order they are populated in.
    const rows = ['Gold', 'Silver', 'Bronze'].flatMap((tier) =>
      [1, 2, 3, 4].map((n) => ({ name: `${tier}-${n}`, tier })),
    );
    el.populate({ columns: [{ field: 'name' }, { field: 'tier' }], rows });
    el.dataset['groupField'] = 'tier';
    el.dataset['pageSize'] = '5';
    el.dataset['page'] = '1';

    const reports: Array<{ pages: number; page: number }> = [];
    el.addEventListener('grid-pages-change', (e) => {
      reports.push((e as CustomEvent).detail);
    });
    await settled();

    const sr = el.shadowRoot!;
    const read = () => ({
      groups: Array.from(sr.querySelectorAll('.group-row')).map((g) => ({
        label: g.querySelector('.group-label')!.textContent,
        count: g.querySelector('.group-count')!.textContent,
      })),
      // What is actually DRAWN, and what is drawn but folded away.
      drawn: sr.querySelectorAll('.row').length,
      shown: Array.from(sr.querySelectorAll<HTMLElement>('.row')).filter(
        (row) => !row.hasAttribute('data-hidden'),
      ).length,
      // data-index must stay an index into the FULL visible list, or a click on
      // page 2 resolves to a page-1 record.
      indices: Array.from(sr.querySelectorAll<HTMLElement>('.row')).map((row) => row.dataset['index']),
    });

    const page1 = read();

    // Shut the FIRST group (Bronze). One line now, so four slots come free and
    // the next rows must move UP onto this page rather than leaving a hole.
    const first = sr.querySelector<HTMLElement>('.group-row')!;
    first.querySelector<HTMLElement>('.group-toggle')!.click();
    await settled();
    const folded = read();

    // Page 2 of the folded view.
    el.dataset['page'] = '2';
    await settled();
    const page2 = read();

    return { page1, folded, page2, reports };
  });

  // PAGE 1, all open: Bronze's heading + its four rows is the whole page.
  expect(r.page1.groups.map((g) => g.label)).toEqual(['Bronze']);
  expect(r.page1.drawn).toBe(4);
  expect(r.page1.indices).toEqual(['0', '1', '2', '3']);

  // SHUT: Bronze is one line, so Gold's heading and its first three rows fill
  // the remaining four slots. This is the whole point of the trap.
  expect(r.folded.groups.map((g) => g.label)).toEqual(['Bronze', 'Gold']);
  // The count is the group's REAL size, not the part this page drew.
  expect(r.folded.groups.map((g) => g.count)).toEqual(['4', '4']);
  expect(r.folded.shown).toBe(3);        // three Gold rows are visible…
  expect(r.folded.drawn).toBe(7);        // …and Bronze's four are drawn but hidden
  // Indices still point into the full list — Gold starts at 4.
  expect(r.folded.indices).toEqual(['0', '1', '2', '3', '4', '5', '6']);

  // PAGE 2 redraws Gold's heading: a page that opened mid-group with no
  // heading would not say which group it was showing.
  expect(r.page2.groups.map((g) => g.label)).toEqual(['Gold', 'Silver']);
  expect(r.page2.indices![0]).toBe('7');

  // The grid REPORTED its page count; it never wrote data-page itself.
  expect(r.reports.length).toBeGreaterThan(0);
  expect(r.reports.at(-1)!.pages).toBeGreaterThanOrEqual(2);
});

test('row actions: a pinned trailing column, one shared menu, and a report', async ({ page }) => {
  /* TRAP T-one-actions-menu-for-every-row — one popover serves every row.
     TRAP T-grid-actions-are-declared-once-used-twice — the same list feeds the
     row menu and a host's bulk bar, so they cannot disagree. */
  const r = await page.evaluate(async () => {
    const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): Promise<void> | void;
      actionsFor(n: number): Array<{ id: string }>;
      select(keys: string[]): void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;

    const fired: unknown[] = [];
    el.addEventListener('row-action', (e) => fired.push((e as CustomEvent).detail));

    await el.populate({
      key: 'email',
      columns: [{ field: 'name', header: 'Name' }],
      rows: [
        { email: 'a@x', name: 'Ada' },
        { email: 'b@x', name: 'Bo' },
      ],
      actions: [
        { id: 'edit', label: 'Edit', icon: 'fa-regular fa-pen' },
        { id: 'delete', label: 'Delete', icon: 'fa-regular fa-trash', multi: true, danger: true },
      ],
    });
    await settled();

    const sr = el.shadowRoot!;
    const firstRow = sr.querySelector('.row')!;
    const cells = [...firstRow.children].map((c) => c.className.split(' ')[0]);

    // ONE menu in the whole grid, not one per row.
    const menus = sr.querySelectorAll('sherpa-menu.actions-menu').length;

    // Open the FIRST row's menu.
    const trigger = firstRow.querySelector<HTMLElement>('.actions-trigger')!;
    trigger.click();
    await settled();
    await new Promise((res) => setTimeout(res, 200));

    const menu = sr.querySelector('sherpa-menu.actions-menu')!;
    const items = [...menu.querySelectorAll('.action-item')].map((b) => ({
      value: b.getAttribute('value'),
      label: b.querySelector('.action-label')?.textContent,
      danger: b.hasAttribute('data-danger'),
    }));

    // Choose Delete. The grid REPORTS; it does not remove the row.
    menu.querySelector<HTMLElement>('[value="delete"]')!.click();
    await settled();
    await new Promise((res) => setTimeout(res, 200));

    return {
      // The actions cell is LAST, after the data cells.
      cells,
      revealed: el.hasAttribute('data-actions'),
      pinned: getComputedStyle(firstRow.querySelector('.actions-cell')!).position,
      menus,
      items,
      fired,
      // The row is still there — reporting is not acting.
      rowsAfter: sr.querySelectorAll('.row').length,
      // …and the bulk list narrows on a multi-row selection.
      forOne: el.actionsFor(1).map((a) => a.id),
      forMany: el.actionsFor(3).map((a) => a.id),
      forNone: el.actionsFor(0).map((a) => a.id),
    };
  });

  // The column is revealed by the DATA, not by an attribute the host must set.
  expect(r.revealed).toBe(true);
  expect(r.cells).toEqual(['select-cell', 'cell', 'actions-cell']);
  expect(r.pinned).toBe('sticky');

  // ONE menu, however many rows.
  expect(r.menus).toBe(1);
  expect(r.items).toEqual([
    { value: 'edit', label: 'Edit', danger: false },
    { value: 'delete', label: 'Delete', danger: true },
  ]);

  // It REPORTED, with the row it belongs to.
  expect(r.fired).toHaveLength(1);
  expect((r.fired[0] as { id: string }).id).toBe('delete');
  expect((r.fired[0] as { records: Array<{ email: string }> }).records[0]!.email).toBe('a@x');
  // …and did not act on it.
  expect(r.rowsAfter).toBe(2);

  // ONE declaration, TWO surfaces: `multi` is what survives a bulk selection.
  expect(r.forOne).toEqual(['edit', 'delete']);
  expect(r.forMany).toEqual(['delete']);
  expect(r.forNone).toEqual([]);
});

test('no actions declared: no column, no menu, no attribute', async ({ page }) => {
  // The column is opt-in through the DATA. A grid that never declares an action
  // must look exactly as it did before the feature existed.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): Promise<void> | void;
    };
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await el.populate({
      columns: [{ field: 'name', header: 'Name' }],
      rows: [{ name: 'Ada' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    return {
      attr: el.hasAttribute('data-actions'),
      // Present in the DOM — the template always holds it — but not drawn.
      display: getComputedStyle(sr.querySelector('.actions-cell')!).display,
      colDisplay: getComputedStyle(sr.querySelector('.actions-col')!).display,
    };
  });

  expect(r.attr).toBe(false);
  expect(r.display).toBe('none');
  // The <col> hides WITH its cells, or the browser matches the wrong <col> to
  // the first drawn column — see the note on `.select-col` in the CSS.
  expect(r.colDisplay).toBe('none');
});

test('the header checkbox is ADVANCED: a caret, three scenarios, and the grid acts', async ({ page }) => {
  /* Figma `Checkbox - Advanced` (1334:8173) composes the Checkbox atom and a
     Button with Type=icon — both of which already existed, so this is a VARIANT
     of sherpa-select-checkbox rather than a 59th component.
     TRAP T-advanced-checkbox-widens-the-select-column
     TRAP T-select-all-is-the-visible-rows */
  const r = await page.evaluate(async () => {
    const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): Promise<void> | void;
      selectedRecords: Array<Record<string, unknown>>;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await el.populate({
      key: 'email',
      columns: [{ field: 'name', header: 'Name' }],
      rows: [
        { email: 'a@x', name: 'Ada' },
        { email: 'b@x', name: 'Bo' },
        { email: 'c@x', name: 'Cy' },
      ],
    });
    await settled();

    const sr = el.shadowRoot!;
    const box = sr.querySelector('.select-all') as HTMLElement & { checked: boolean };
    const menu = box.querySelector('[slot="menu"]') as HTMLElement & { open?: boolean };

    // The VARIANT is on because there are rows, and the column widened for it.
    const advanced = box.hasAttribute('data-advanced');
    const hostFlag = el.hasAttribute('data-advanced-select');

    /* THE SNAPPED PAIR (Figma `Wrapper - Checkbox` + Button): rounded on the
       outer edges, square where they meet, gap 0.
       TRAP T-advanced-checkbox-is-a-snapped-pair */
    const corners = (el2: Element) => {
      const c = getComputedStyle(el2);
      return [c.borderStartStartRadius, c.borderStartEndRadius,
              c.borderEndEndRadius, c.borderEndStartRadius].join(' ');
    };
    const size = (el2: Element) => {
      const r = el2.getBoundingClientRect();
      return `${Math.round(r.width)}x${Math.round(r.height)}`;
    };
    const snap = {
      box: corners(box.shadowRoot!.querySelector('.box')!),
      caret: corners(box.shadowRoot!.querySelector('.caret')!),
      gap: getComputedStyle(box.shadowRoot!.querySelector('.group')!).gap,
      boxSize: size(box.shadowRoot!.querySelector('.box')!),
      caretSize: size(box.shadowRoot!.querySelector('.caret')!),
      // The CONTROL keeps its own rounding — the snap belongs to the wrapper.
      control: corners(box.shadowRoot!.querySelector('.control')!),
    };
    const colW = getComputedStyle(sr.querySelector('.select-col')!).width;
    const caretShown = getComputedStyle(box.shadowRoot!.querySelector('.caret')!).display;

    // Open it the way a person does — the inner trigger, not the host.
    (box.shadowRoot!.querySelector('.caret') as HTMLElement)
      .shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    await settled();
    await new Promise((res) => setTimeout(res, 250));

    const card = menu.shadowRoot!.querySelector('[popover]')!;
    const menuH = Math.round(card.getBoundingClientRect().height);
    const rows = [...menu.querySelectorAll('button')].map((b) => b.textContent!.trim());

    // Select all rows.
    menu.querySelector<HTMLElement>('[value="all"]')!.click();
    await settled();
    await new Promise((res) => setTimeout(res, 250));
    const afterAll = el.selectedRecords.length;

    // …then clear.
    (box.shadowRoot!.querySelector('.caret') as HTMLElement)
      .shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    await settled();
    await new Promise((res) => setTimeout(res, 250));
    menu.querySelector<HTMLElement>('[value="none"]')!.click();
    await settled();
    await new Promise((res) => setTimeout(res, 250));

    return {
      tag: box.tagName.toLowerCase(),
      advanced, hostFlag, colW, caretShown, menuH, rows, snap,
      afterAll,
      afterClear: el.selectedRecords.length,
    };
  });

  // It is the CHECKBOX COMPONENT, not a raw input — the variant, not a rewrite.
  expect(r.tag).toBe('sherpa-select-checkbox');
  expect(r.advanced).toBe(true);
  expect(r.caretShown).toBe('flex');

  // Two bordered boxes TOUCHING — not a box with a detached button beside it.
  expect(r.snap.box).toBe('4px 0px 0px 4px');
  expect(r.snap.caret).toBe('0px 4px 4px 0px');
  // FLUSH, never overlapped — the seam is two 0.25 weights, not a negative gap.
  expect(r.snap.gap).toBe('0px');
  // 24 SQUARE each, as Figma draws them.
  expect(r.snap.boxSize).toBe('24x24');
  expect(r.snap.caretSize).toBe('24x24');
  // The checkbox INSIDE keeps all four of its own corners. It takes a FLAT
  // `border/rounding/sm` (2), so it reads none of the group's inherited corner
  // variables and there is nothing left to square it —
  // T-checkbox-rounding-is-flat-sm.
  expect(r.snap.control).toBe('2px 2px 2px 2px');

  // The column widened for the caret, or it draws behind the next column.
  expect(r.hostFlag).toBe(true);
  expect(r.colW).toBe('56px');

  // The menu RENDERS. `display: none` on the slot left it open at 0 by 0.
  expect(r.menuH).toBeGreaterThan(80);
  expect(r.rows).toEqual(['Select all on page', 'Select all rows', 'Clear selection']);

  // …and the GRID carries the scenario out, because it owns the rows.
  expect(r.afterAll).toBe(3);
  expect(r.afterClear).toBe(0);
});

test('an EMPTY grid shows a plain checkbox, not the advanced one', async ({ page }) => {
  // "Select all" against nothing is a control that does nothing.
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): Promise<void> | void;
    };
    el.setAttribute('data-selectable', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await el.populate({ columns: [{ field: 'name' }], rows: [] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const box = sr.querySelector('.select-all')!;
    return {
      advanced: box.hasAttribute('data-advanced'),
      hostFlag: el.hasAttribute('data-advanced-select'),
      caret: getComputedStyle(box.shadowRoot!.querySelector('.caret')!).display,
      colW: getComputedStyle(sr.querySelector('.select-col')!).width,
    };
  });

  expect(r.advanced).toBe(false);
  expect(r.caret).toBe('none');
  expect(r.hostFlag).toBe(false);
  // …and the column goes back to the plain box's width.
  expect(r.colW).toBe('32px');
});

/**
 * AN EXTERNAL FILTER LIGHTS THE COLUMN'S CHIP.
 *
 * The heading is deliberately not tinted, so the chip is the ONLY thing a
 * reader can see — TRAP T-the-column-chip-is-the-only-signal.
 */
test('data-filter-fields lights the column CHIP, and survives a re-render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settle = (): Promise<void> =>
      (window as unknown as { __settled: () => Promise<void> }).__settled();

    const el = document.createElement('sherpa-data-grid') as HTMLElement & {
      rendered?: Promise<void>;
      populate(d: unknown): void;
    };
    el.setAttribute('data-column-filters', '');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    const config = {
      columns: [
        { field: 'name', header: 'Name' },
        { field: 'region', header: 'Region' },
      ],
      rows: [{ name: 'Marcus', region: 'EMEA' }, { name: 'Omar', region: 'APAC' }],
    };
    el.populate(config);
    await settle();

    const read = (): Record<string, unknown> => {
      const cell = (f: string): HTMLElement =>
        [...el.shadowRoot!.querySelectorAll<HTMLElement>('.head-cell')]
          .find((t) => t.dataset['field'] === f)!;
      const lit = (f: string): boolean =>
        !!cell(f).querySelector('.head-filter')?.hasAttribute('data-current');
      return {
        regionChip: lit('region'), nameChip: lit('name'),
        // The <th> flag is the system-wide door and stays either way.
        regionTh: cell('region').dataset['status'] ?? null,
      };
    };

    const before = read();

    // The SOURCE writes this, from the composed filter.
    el.dataset['filterFields'] = 'region';
    await settle();
    const filtered = read();

    /* A RE-POPULATE rebuilds the head row, so the chip is brand new. This is
       the half that hid the bug: the <th> flag survived and the chip came back
       blank, because #renderHead never ran the sync. */
    el.populate(config);
    await settle();
    const reRendered = read();

    el.removeAttribute('data-filter-fields');
    await settle();
    const cleared = read();

    return { before, filtered, reRendered, cleared };
  });

  expect(r.before).toEqual({ regionChip: false, nameChip: false, regionTh: null });

  // LIT: the chip, which is the only visible signal — and the flag with it.
  expect(r.filtered).toEqual({ regionChip: true, nameChip: false, regionTh: 'active' });

  // AND IT SURVIVES A REBUILD.
  expect(r.reRendered, 'a re-populate keeps the chip lit')
    .toEqual({ regionChip: true, nameChip: false, regionTh: 'active' });

  // Gone when the filter is.
  expect(r.cleared).toEqual({ regionChip: false, nameChip: false, regionTh: null });
});
