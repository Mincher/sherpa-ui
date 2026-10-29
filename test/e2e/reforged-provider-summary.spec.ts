import { test, expect } from './harness';

/**
 * A chart or tile DECLARES what it needs of the rows, and its provider answers
 * — no `as` adapter anywhere. A legend reads its chart's field, and its pick
 * narrows that chart alone. docs/PROVIDER-DESIGN.md §7 P2.
 * TRAP T-a-component-declares-its-summary
 */
const SETUP = `
  const { ArrayStore, DataSource, onReport } = await import('/dist/index.js');
  const reports = [];
  onReport((r) => reports.push(r.code));
  const PLANS = ['Free', 'Pro', 'Enterprise'];
  const rows = [
    { id: 1, plan: 'Pro', spend: 1200.5, day: 'Mon' },
    { id: 2, plan: 'Free', spend: 0, day: 'Tue' },
    { id: 3, plan: 'Pro', spend: 300, day: 'Wed' },
    { id: 4, plan: 'Enterprise', spend: 5000, day: 'Mon' },
  ];
  const make = () => {
    const s = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    s.declareValues('plan', PLANS);
    s.declareValues('day', ['Mon', 'Tue', 'Wed']);
    return s;
  };
  // Every element rendered and painted — never a fixed wait.
  const settle = () => window.__settled();
  const root = document.getElementById('root');
  root.innerHTML = '';
  const provider = document.createElement('sherpa-provider');
  root.append(provider);
`;

test('declared summaries fill with no bind; an undeclared chart waits', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="spend" data-label="Spend" data-aggregate="sum" data-field="spend"
        data-over-field="day" data-format='{"style":"currency","currency":"USD","maximumFractionDigits":0}'></sherpa-metric>
      <sherpa-barchart id="bar" data-segment-field="plan"></sherpa-barchart>
      <sherpa-gauge-chart id="gauge" data-aggregate="mean" data-field="spend"></sherpa-gauge-chart>
      <sherpa-line-chart id="line" data-over-field="day" data-segment-field="plan"></sherpa-line-chart>
      <sherpa-barchart id="bare"></sherpa-barchart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s);
    return {
      value: $('#spend').dataset.value,
      want: new Intl.NumberFormat(undefined, { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(6500.5),
      spark: $('#spend').hasAttribute('data-has-values'),
      gauge: Number($('#gauge').getAttribute('value')),
      bound: source.boundElements.map((el) => el.id).sort(),
      reports,
    };
  })()`) as Record<string, unknown>;
  // The platform formats it; the exact string is the engine's, so it is compared to Intl's own.
  expect(r['value']).toBe(r['want']);
  expect(r['spark']).toBe(true);
  expect(r['gauge']).toBeCloseTo(1625.125);
  // `bare` declares nothing, so the page populates it by hand.
  expect(r['bound']).toEqual(['bar', 'gauge', 'line', 'spend']);
  expect(r['reports']).toEqual([]);
});

test('a legend reads its chart\'s field; its pick narrows that chart alone', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="count" data-aggregate="count"></sherpa-metric>
      <sherpa-radial-chart id="donut" data-segment-field="plan">
        <sherpa-chart-legend slot="legend" id="legend"></sherpa-chart-legend>
      </sherpa-radial-chart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s);
    const before = $('#donut').slices.map((s) => s.label);
    const items = $('#legend').shadowRoot.querySelectorAll('.item').length;
    // The row's key chip: its BODY is the button. TODO 149
    $('#legend').shadowRoot.querySelector('.item .entry').shadowRoot.querySelector('.body').click();
    await settle();
    return { before, items, after: $('#donut').slices.map((s) => s.label), count: $('#count').dataset.value, reports };
  })()`) as Record<string, unknown>;
  expect(r['before']).toEqual(['Free', 'Pro', 'Enterprise']);
  expect(r['items']).toBe(3);
  expect(r['after']).toEqual(['Pro', 'Enterprise']);
  // The tile beside it is not the legend's: it still counts every row.
  expect(r['count']).toBe('4');
  expect(r['reports']).toEqual([]);
});

/* With "Highlight matches on hover", a rest on a legend row previews its
   value's matches, as a chip's value does — with no row toggled first, when
   the chart's own scope is not made yet. Will, TODOs 495, 513 */
test('a rest on a legend row previews its value while Highlight matches on hover is on', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-radial-chart id="donut" data-segment-field="plan">
        <sherpa-chart-legend slot="legend" id="legend"></sherpa-chart-legend>
      </sherpa-radial-chart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const legend = provider.querySelector('#legend');
    const item = () => legend.shadowRoot.querySelector('.item .label');
    const rest = async (type) => {
      (type === 'over' ? item() : legend.shadowRoot.querySelector('.legend'))
        .dispatchEvent(new PointerEvent(type === 'over' ? 'pointerover' : 'pointerleave', { bubbles: true, composed: true }));
      await new Promise((done) => setTimeout(done, 250));
      return source.query.previewed;
    };
    const off = await rest('over');
    await rest('leave');
    provider.highlightOnHover = true;
    const marked = legend.hasAttribute('data-highlight-hover');
    const on = await rest('over');
    // Its matches LIGHT, not only asked for: nothing was toggled. TODO 513
    const lit = source.highlight ? [...new Set(source.rows.filter((row) => source.highlight(row)).map((row) => row.plan))] : null;
    const left = await rest('leave');
    return { off, marked, on, lit, left, after: source.highlight };
  })()`) as Record<string, unknown>;
  expect(r['off']).toBeNull();
  expect(r['marked']).toBe(true);
  expect(r['on']).toMatchObject({ field: 'plan', value: 'Free' });
  expect(r['lit']).toEqual(['Free']);
  expect(r['left']).toBeNull();
  expect(r['after']).toBeNull();
});

test('a child uses the nearest data-source above it; a new declaration asks again; a bad one is loud', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <div data-source="b"><sherpa-metric id="nested" data-aggregate="count"></sherpa-metric></div>
      <sherpa-metric id="wrong" data-source="a" data-aggregate="median"></sherpa-metric>\`;
    const a = make();
    const b = new DataSource({ store: new ArrayStore(rows.slice(0, 1), { key: 'id' }) });
    provider.provide({ sources: { a, b } });
    await Promise.all([a.load(), b.load()]);
    await settle();
    const $ = (s) => provider.querySelector(s);
    const nested = $('#nested').dataset.value;
    // Declared again: it leaves, asks, and is answered in its new shape.
    $('#nested').setAttribute('data-aggregate', 'sum');
    $('#nested').setAttribute('data-field', 'spend');
    await settle();
    return { nested, resummed: $('#nested').dataset.value, bBound: b.boundElements.length, reports: [...new Set(reports)] };
  })()`) as Record<string, unknown>;
  expect(r['nested']).toBe('1');
  expect(r['resummed']).toBe((1200.5).toLocaleString(undefined, { maximumFractionDigits: 2 }));
  expect(r['bBound']).toBe(1);
  expect(r['reports']).toEqual(['provider-unknown-aggregate']);
});

/* ONLY THE VIEW TRICKLES DOWN. The grid's own scope narrows the grid; a tile
   beside it follows the View alone. Will, 2026-09-27.
   TRAP T-only-the-view-trickles-down */
test('a grid scope filter narrows the grid, never a tile; a View filter narrows both', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="count" data-aggregate="count"></sherpa-metric>
      <sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }];
    grid.key = 'id';
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const drawn = () => grid.shadowRoot.querySelectorAll('.body .row').length;
    const tile = () => provider.querySelector('#count').dataset.value;
    // The grid's scope HOLDS plan, so the answer is the grid's alone.
    source.query.hold('data', ['plan']);
    source.query.setReading('data', 'plan', { picked: ['Pro'] });
    await settle();
    const scoped = { grid: drawn(), tile: tile() };
    source.query.setReading('data', 'plan', null);
    source.query.hold('data', []);
    source.query.hold('view', ['plan']);
    source.query.setReading('view', 'plan', { picked: ['Enterprise', 'Pro'] });
    await settle();
    return { scoped, viewed: { grid: drawn(), tile: tile() }, reports };
  })()`) as Record<string, Record<string, unknown>>;
  expect(r['scoped']).toEqual({ grid: 2, tile: '4' });
  expect(r['viewed']).toEqual({ grid: 3, tile: '3' });
  expect(r['reports']).toEqual([]);
});

/* A TILE'S OWN FILTER narrows it alone, and a View pick keeps it.
   TRAP T-a-component-default-outlives-a-view */
test('data-where narrows its own tile, never a sibling, and outlives a View', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-metric id="all" data-aggregate="count"></sherpa-metric>
      <sherpa-metric id="pro" data-aggregate="count" data-where='{"plan":{"eq":"Pro"}}'></sherpa-metric>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s).dataset.value;
    const before = { all: $('#all'), pro: $('#pro') };
    await source.query.setQuery({ v: 1, scopes: { view: { holds: ['day'], where: { day: { eq: 'Mon' } } } } }, { holds: 'keep' });
    await settle();
    return { before, after: { all: $('#all'), pro: $('#pro') }, reports };
  })()`) as Record<string, Record<string, unknown>>;
  expect(r['before']).toEqual({ all: '4', pro: '2' });
  // Monday: two rows, one of them Pro.
  expect(r['after']).toEqual({ all: '2', pro: '1' });
  expect(r['reports']).toEqual([]);
});

/* A THRESHOLD IS A FACT OF THE FIELD — Will, TODO 150. Declared once, beside
   min and max: a gauge with no `data-zones` draws it, and its legend names
   each band; a bar chart over the field cuts at it.
   TRAP T-a-threshold-is-a-fact-of-the-field */
test('a gauge draws its field\'s thresholds, and a bar chart cuts at them', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-gauge-chart id="gauge" data-aggregate="mean" data-field="spend" min="0" max="6000">
        <sherpa-chart-legend slot="legend" id="key" data-readonly></sherpa-chart-legend>
      </sherpa-gauge-chart>
      <sherpa-barchart id="bars" data-segment-field="spend"></sherpa-barchart>\`;
    const source = make();
    source.declareField('spend', { type: 'number', min: 0, max: 6000, thresholds: [
      { to: 1000, label: 'Low', status: 'success' },
      { to: 4000, label: 'Mid', status: 'warning' },
      { to: 6000, label: 'High', status: 'critical' },
    ] });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const $ = (s) => provider.querySelector(s);
    const key = [...$('#key').shadowRoot.querySelectorAll('.item')].map((i) => i.querySelector('.label').textContent);
    return { value: $('#gauge').value, key, bars: $('#bars').data?.map?.((d) => [d.label, d.value]) ?? null, reports };
  })()`) as Record<string, unknown>;
  expect(r['value']).toBeCloseTo(1625.125);
  expect(r['key']).toEqual(['Low', 'Mid', 'High']);
  expect(r['reports']).toEqual([]);
  expect(r['bars']).toEqual([['Low', 2], ['Mid', 1], ['High', 1]]);
});

test('a chart in a SLOT draws what the slot\'s kept presentation says: its segments, parts, order and what it counts (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = make();
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bars = () => [...provider.querySelector('#slotted').shadowRoot.querySelectorAll('.bar-col')]
      .map((c) => c.getAttribute('aria-label'));
    const at = { first: bars() };
    source.query.present('by-plan', { group: 'day' });
    await settle();
    at.grouped = bars();
    source.query.present('by-plan', { group: undefined, sort: 'desc', primary: 'day' });
    await settle();
    at.counted = bars();
    source.query.present('by-plan', { sort: undefined, primary: undefined, secondary: 'day' });
    await settle();
    at.resegmented = bars();
    return at;
  })()`) as Record<string, string[]>;
  // As defined: one bar per plan, counting rows.
  expect(r['first']).toEqual(['Free: 1', 'Pro: 2', 'Enterprise: 1']);
  // Grouped by day: each bar's parts.
  expect(r['grouped']).toEqual(['Free: 1 (Tue 1)', 'Pro: 2 (Mon 1 · Wed 1)', 'Enterprise: 1 (Mon 1)']);
  // Counting each plan's distinct days, largest first.
  expect(r['counted']).toEqual(['Pro: 2', 'Free: 1', 'Enterprise: 1']);
  // Segmented by day instead.
  expect(r['resegmented']).toEqual(['Mon: 2', 'Tue: 1', 'Wed: 1']);
});

test('a chart\'s bar in its SLOT: Group splits its bars, Sort has no menu and cycles up, down, none — and no row is arranged (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-quick-filter-toolbar data-heading="By plan"></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const chip = (id) => bar.shadowRoot.querySelector('.organise-chip[data-id="' + id + '"]');
    const bars = () => [...provider.querySelector('#slotted').shadowRoot.querySelectorAll('.bar-col')]
      .map((c) => c.getAttribute('aria-label'));
    const at = {
      offered: [...chip('group').querySelectorAll('sherpa-menu input')].map((i) => i.value).filter(Boolean),
      sortMenu: !!chip('sort').querySelector('sherpa-menu'),
    };
    const input = [...chip('group').querySelectorAll('sherpa-menu input')].find((i) => i.value === 'day');
    input.checked = true;
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    at.grouped = { bars: bars(), on: chip('group').hasAttribute('data-current'), told: bar.dataset.groupField };
    const order = [];
    for (let i = 0; i < 3; i++) {
      chip('sort').shadowRoot.querySelector('.body').click();
      await settle();
      order.push({ first: bars()[0], dir: chip('sort').direction, kept: source.query.presentation('by-plan').sort ?? null });
    }
    at.order = order;
    at.rows = { group: source.state.group ?? null, sort: source.state.sort ?? [] };
    // Cleared, it still has its one way to sort: the next press is up.
    bar.clearAll();
    await settle();
    chip('sort').shadowRoot.querySelector('.body').click();
    await settle();
    at.again = { kept: source.query.presentation('by-plan'), first: bars()[0] };
    return at;
  })()`) as Record<string, unknown>;
  // Its Group offers the list fields, and its Sort has no field to pick.
  expect(r['offered']).toContain('day');
  expect(r['sortMenu']).toBe(false);
  // Grouped by day: each bar's parts, and the chip says so.
  expect(r['grouped']).toEqual({ bars: ['Free: 1 (Tue 1)', 'Pro: 2 (Mon 1 · Wed 1)', 'Enterprise: 1 (Mon 1)'], on: true, told: 'day' });
  // Up, down, none: the order the chart keeps.
  expect(r['order']).toEqual([
    { first: 'Free: 1 (Tue 1)', dir: 'asc', kept: 'asc' },
    { first: 'Pro: 2 (Mon 1 · Wed 1)', dir: 'desc', kept: 'desc' },
    { first: 'Free: 1 (Tue 1)', dir: null, kept: null },
  ]);
  // The ROWS are not arranged: a chart's Group and Sort are its own.
  expect(r['rows']).toEqual({ group: null, sort: [] });
  // Clear all ungroups it; its Sort still sorts.
  expect(r['again']).toEqual({ kept: { sort: 'asc' }, first: 'Free: 1' });
});

test('a chart\'s Primary picks what it counts and its Secondary what it splits by — its chart\'s own until picked, and off goes back (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = new DataSource({ store: new ArrayStore([...rows, { id: 5, plan: 'Pro', spend: 1, day: 'Mon' }], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const zone = () => [...bar.shadowRoot.querySelectorAll('.organise-zone > .organise-chip')];
    const chip = (id) => zone().find((c) => c.dataset.id === id);
    const said = (id) => ({ on: chip(id).hasAttribute('data-current'), field: chip(id).column });
    const bars = () => [...provider.querySelector('#slotted').shadowRoot.querySelectorAll('.bar-col')]
      .map((c) => c.getAttribute('aria-label'));
    const pick = async (id, value) => {
      const box = [...chip(id).querySelectorAll('sherpa-menu input')].find((i) => i.value === value);
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const groups = () => [...chip('group').querySelectorAll('sherpa-menu input')].map((i) => i.value).filter(Boolean);
    const at = { order: zone().map((c) => c.dataset.id), first: { primary: said('primary'), secondary: said('secondary'), groups: groups(), bars: bars() } };
    await pick('secondary', 'day');
    at.split = { secondary: said('secondary'), kept: source.query.presentation('by-plan'), bars: bars() };
    await pick('primary', 'plan');
    at.counted = { primary: said('primary'), kept: source.query.presentation('by-plan'), bars: bars() };
    // Its body OFF: back to counting rows.
    chip('primary').shadowRoot.querySelector('.body').click();
    await settle();
    at.off = { primary: said('primary').on, kept: source.query.presentation('by-plan'), bars: bars() };
    return at;
  })()`) as Record<string, unknown>;
  // Primary and Secondary lead, before Group and Sort.
  expect(r['order']).toEqual(['primary', 'secondary', 'group', 'sort']);
  // As its chart says: split by plan, counting rows; Group offers no plan.
  expect(r['first']).toEqual({ primary: { on: false, field: '' }, secondary: { on: true, field: 'plan' }, groups: ['day'], bars: ['Free: 1', 'Pro: 3', 'Enterprise: 1'] });
  // By day: one bar a day.
  expect(r['split']).toEqual({ secondary: { on: true, field: 'day' }, kept: { secondary: 'day' }, bars: ['Mon: 3', 'Tue: 1', 'Wed: 1'] });
  // Counting plans: each day's different plans.
  expect(r['counted']).toEqual({ primary: { on: true, field: 'plan' }, kept: { primary: 'plan', secondary: 'day' }, bars: ['Mon: 2', 'Tue: 1', 'Wed: 1'] });
  expect(r['off']).toEqual({ primary: false, kept: { secondary: 'day' }, bars: ['Mon: 3', 'Tue: 1', 'Wed: 1'] });
});

test('a card\'s Show as swaps its chart over the same data, keeps what it was arranged by, and Default goes back (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-data-viz-header slot="header" data-heading="By plan" data-presentation="default"></sherpa-data-viz-header>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const head = provider.querySelector('sherpa-data-viz-header');
    const pick = async (kind) => {
      const box = [...head.shadowRoot.querySelectorAll('.presentation-menu input')].find((i) => i.value === kind);
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      await settle();
    };
    const chart = () => provider.querySelector('#slotted');
    const said = () => {
      const el = chart();
      const marks = el.localName === 'sherpa-barchart' ? '.bar-col' : '.slice';
      return { tag: el.localName, type: el.getAttribute('data-type'), marks: [...el.shadowRoot.querySelectorAll(marks)].map((m) => m.getAttribute('aria-label')),
        shown: head.dataset.presentation, kept: source.query.presentation('by-plan') };
    };
    const at = { first: said() };
    source.query.present('by-plan', { group: 'day' });
    await settle();
    await pick('pie');
    at.pie = said();
    await pick('default');
    at.back = said();
    return at;
  })()`) as Record<string, Record<string, unknown>>;
  expect(r['first']).toEqual({ tag: 'sherpa-barchart', type: null, marks: ['Free: 1', 'Pro: 2', 'Enterprise: 1'], shown: 'default', kept: {} });
  // A pie, the same plans, still split by day.
  expect(r['pie']).toMatchObject({ tag: 'sherpa-radial-chart', type: 'pie', shown: 'pie', kept: { kind: 'pie', group: 'day' } });
  expect((r['pie']?.['marks'] as string[]).length).toBe(3);
  // Default: the bar its page drew, its group kept.
  expect(r['back']).toEqual({ tag: 'sherpa-barchart', type: null, marks: ['Free: 1 (Tue 1)', 'Pro: 2 (Mon 1 · Wed 1)', 'Enterprise: 1 (Mon 1)'], shown: 'default', kept: { group: 'day' } });
});

test('a grid card\'s Show as draws its slot as a chart — what its definition counts, split as it says — and Default puts back the very grid (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-toolbar slot="header" data-presentation="default"></sherpa-toolbar>
        <sherpa-data-grid id="grid" data-scope="data" data-grow></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }];
    grid.key = 'id';
    // A second Pro on Monday: three Pro rows, on two days.
    const source = new DataSource({ store: new ArrayStore([...rows, { id: 5, plan: 'Pro', spend: 1, day: 'Mon' }], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    // Its page's definition: count each plan's different days.
    source.query.declarePresentation('data', { primary: 'day', secondary: 'plan' });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-toolbar');
    const pick = async (kind) => {
      const box = [...bar.shadowRoot.querySelectorAll('.presentation-menu input')].find((i) => i.value === kind);
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
      await settle();
    };
    const card = () => provider.querySelector('sherpa-container > :not([slot])');
    const at = { first: { tag: card().localName, rows: grid.shadowRoot.querySelectorAll('.body .row').length } };
    await pick('bar');
    const chart = card();
    at.bar = { tag: chart.localName, scope: chart.dataset.scope, id: chart.id, shown: bar.dataset.presentation,
      marks: [...chart.shadowRoot.querySelectorAll('.bar-col')].map((c) => c.getAttribute('aria-label')),
      legend: [...chart.querySelector(':scope > sherpa-chart-legend[slot="legend"]')?.shadowRoot?.querySelectorAll('.item') ?? []].length };
    await pick('default');
    at.back = { same: card() === grid, shown: bar.dataset.presentation, rows: grid.shadowRoot.querySelectorAll('.body .row').length, reports };
    return at;
  })()`) as Record<string, Record<string, unknown>>;
  expect(r['first']).toEqual({ tag: 'sherpa-data-grid', rows: 5 });
  // Each plan's different days: three Pro rows, on Mon and Wed.
  expect(r['bar']).toEqual({ tag: 'sherpa-barchart', scope: 'data', id: '', shown: 'bar', marks: ['Free: 1', 'Pro: 2', 'Enterprise: 1'], legend: 3 });
  // The page's own grid, with its columns, and its rows again.
  expect(r['back']).toEqual({ same: true, shown: 'default', rows: 5, reports: [] });
});
