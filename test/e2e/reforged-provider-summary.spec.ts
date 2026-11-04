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
test('with its provider\'s Legend items as chips, a legend row is a value chip: its swatch, label and count; its press still picks (Will, TODO 586)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-barchart id="slotted" data-segment-field="plan">
        <sherpa-chart-legend slot="legend"></sherpa-chart-legend>
      </sherpa-barchart>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const legend = provider.querySelector('sherpa-chart-legend');
    const read = () => [...legend.shadowRoot.querySelectorAll('.entry')].map((c) => ({
      type: c.getAttribute('data-type'), label: c.getAttribute('data-label') ?? c.textContent.trim(), swatch: c.dataset.swatch, on: c.hasAttribute('data-current'), results: c.results ?? null,
    }));
    const value = () => legend.shadowRoot.querySelector('.value').textContent;
    const at = { key: read()[0], keyValue: value() };
    provider.settings.set('legendChips', true);
    await settle();
    at.chips = read();
    at.value = value();
    legend.shadowRoot.querySelector('.entry').shadowRoot.querySelector('.body').click();
    await settle();
    at.picked = { on: read().map((c) => c.on), off: legend.off };
    provider.settings.set('legendChips', false);
    await settle();
    at.back = read()[0];
    return at;
  })()`) as Record<string, unknown>;
  expect(r['key']).toEqual({ type: 'key', label: 'Free', swatch: '1', on: true, results: null });
  expect(r['keyValue']).toBe('1');
  expect(r['chips']).toEqual([
    { type: null, label: 'Free', swatch: '1', on: true, results: 1 },
    { type: null, label: 'Pro', swatch: '2', on: true, results: 2 },
    { type: null, label: 'Enterprise', swatch: '3', on: true, results: 1 },
  ]);
  // Its number is in its count, not beside it.
  expect(r['value']).toBe('');
  expect(r['picked']).toEqual({ on: [false, true, true], off: ['Free'] });
  // Off again: the key row, and what was picked stays picked.
  expect(r['back']).toEqual({ type: 'key', label: 'Free', swatch: '1', on: false, results: null });
});

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
      return provider.hovered;
    };
    const off = await rest('over');
    await rest('leave');
    provider.settings.set('highlightOnHover', true);
    const marked = legend.hasAttribute('data-highlight-hover');
    const on = await rest('over');
    // Its matches LIGHT, not only asked for: nothing was toggled. TODO 513
    // The chart marks them from its own rows: the hover is the page's. TODO 655
    const donut = provider.querySelector('#donut');
    const lit = donut.slices.filter((s) => s.matched > 0).map((s) => s.label);
    const left = await rest('leave');
    return { off, marked, on, lit, left, after: donut.slices.some((s) => s.matched != null) };
  })()`) as Record<string, unknown>;
  expect(r['off']).toBeNull();
  expect(r['marked']).toBe(true);
  expect(r['on']).toMatchObject({ field: 'plan', value: 'Free' });
  expect(r['lit']).toEqual(['Free']);
  expect(r['left']).toBeNull();
  expect(r['after']).toBe(false);
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
    source.query.ask({ scope: 'data', hold: ['plan'] });
    source.query.ask({ scope: 'data', field: 'plan', reading: { picked: ['Pro'] } });
    await settle();
    const scoped = { grid: drawn(), tile: tile() };
    source.query.ask({ scope: 'data', field: 'plan', reading: null });
    source.query.ask({ scope: 'data', hold: [] });
    source.query.ask({ scope: 'view', hold: ['plan'] });
    source.query.ask({ scope: 'view', field: 'plan', reading: { picked: ['Enterprise', 'Pro'] } });
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

/* A NUMBER'S ZONES COME FROM A STATUS FIELD — Will, plan 683. Its values are
   ranges of the number: a gauge over the number draws them, its legend names
   each, and a bar chart over the status counts its rows.
   TRAP T-a-status-is-worked-out-by-the-data */
test('a gauge draws the zones of the status field over its number, and a bar chart counts that field', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { statusFields } = await import('/dist/index.js');
    provider.innerHTML = \`
      <sherpa-gauge-chart id="gauge" data-aggregate="mean" data-field="spend" min="0" max="6000">
        <sherpa-chart-legend slot="legend" id="key" data-readonly></sherpa-chart-legend>
      </sherpa-gauge-chart>
      <sherpa-barchart id="bars" data-segment-field="level"></sherpa-barchart>\`;
    const source = new DataSource({ store: statusFields(new ArrayStore(rows, { key: 'id' }), { level: {
      type: 'status', label: 'Level', values: [
        { value: 'Low', status: 'success', when: [{ spend: { lt: 1000 } }] },
        { value: 'Mid', status: 'warning', when: [{ spend: { lt: 4000 } }] },
        { value: 'High', status: 'critical' },
      ] } }) });
    source.declareField('spend', { type: 'number', min: 0, max: 6000 });
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

test('a chart in a SLOT draws what the slot\'s kept presentation says: its bars, its stack, its parts and its order (Will, TODO 548)', async ({ page }) => {
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
    source.query.ask({ scope: 'by-plan', presentation: { group: 'day' } });
    await settle();
    at.grouped = bars();
    source.query.ask({ scope: 'by-plan', presentation: { group: undefined, sort: 'desc', secondary: 'day' } });
    await settle();
    at.counted = bars();
    source.query.ask({ scope: 'by-plan', presentation: { sort: undefined, secondary: undefined, primary: 'day' } });
    await settle();
    at.resegmented = bars();
    return at;
  })()`) as Record<string, string[]>;
  // As defined: one bar per plan, counting rows.
  expect(r['first']).toEqual(['Free: 1', 'Pro: 2', 'Enterprise: 1']);
  // Grouped by day: each bar's parts.
  expect(r['grouped']).toEqual(['Free: 1 (Tue 1)', 'Pro: 2 (Mon 1 · Wed 1)', 'Enterprise: 1 (Mon 1)']);
  // Its Secondary, a bar chart's stack: each plan's rows by day, largest first.
  expect(r['counted']).toEqual(['Pro: 2 (Mon 1 · Wed 1)', 'Free: 1 (Tue 1)', 'Enterprise: 1 (Mon 1)']);
  // Its Primary: a bar a day instead.
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

test('a chart\'s Primary is its bars and its Secondary their stack — its chart\'s own until picked; Primary has no None or toggle, and its default says so; a held Secondary neither (Will, TODOs 548, 572, 663, 667)', async ({ page }) => {
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
    const menu = chip('primary').querySelector('sherpa-menu');
    at.menu = { none: menu.hasAttribute('data-none'), rows: [...menu.querySelectorAll('input')].map((i) => i.closest('label, .menu-row').textContent.trim()),
      face: chip('primary').shadowRoot.querySelector('.caret-label').textContent.trim() };
    const persistent = () => ['primary', 'secondary'].map((id) => chip(id).hasAttribute('data-persistent'));
    at.persistent = persistent();
    await pick('primary', 'day');
    at.split = { primary: said('primary'), kept: source.query.presentation('by-plan'), bars: bars() };
    // Its default picked again: no pick kept, so the definition rules.
    await pick('primary', 'plan');
    at.back = { primary: said('primary'), kept: source.query.presentation('by-plan'), bars: bars() };
    await pick('primary', 'day');
    await pick('secondary', 'plan');
    at.counted = { secondary: said('secondary'), kept: source.query.presentation('by-plan'), bars: bars(), persistent: persistent() };
    // Its body: a chart's Secondary is never unset, so it opens its menu and changes nothing. TODO 667
    chip('secondary').shadowRoot.querySelector('.body').click();
    await settle();
    at.pressed = { secondary: said('secondary'), open: chip('secondary').hasAttribute('data-open'), kept: source.query.presentation('by-plan'), bars: bars() };
    return at;
  })()`) as Record<string, unknown>;
  // Primary and Secondary lead, before Group and Sort.
  expect(r['order']).toEqual(['primary', 'secondary', 'group', 'sort']);
  // As its chart says: a bar a plan on its X axis, counting rows; Group lists plan, greyed (TODO 581).
  expect(r['first']).toEqual({ primary: { on: true, field: 'plan' }, secondary: { on: false, field: '' }, groups: ['plan', 'day'], bars: ['Free: 1', 'Pro: 3', 'Enterprise: 1'] });
  // Primary day: a bar a day, named by it.
  expect(r['split']).toEqual({ primary: { on: true, field: 'day' }, kept: { primary: 'day' }, bars: ['Mon: 3', 'Tue: 1', 'Wed: 1'] });
  // Primary never lets go, so it has no toggle; a Secondary has one until it holds a field. TODO 667
  expect(r['persistent']).toEqual([true, false]);
  // Secondary plan: each day's bar stacked by plan — and now no toggle either (663, 667).
  expect(r['counted']).toEqual({ secondary: { on: true, field: 'plan' }, kept: { primary: 'day', secondary: 'plan' }, bars: ['Mon: 3 (Pro 2 · Enterprise 1)', 'Tue: 1 (Free 1)', 'Wed: 1 (Pro 1)'], persistent: [true, true] });
  expect(r['pressed']).toEqual({ secondary: { on: true, field: 'plan' }, open: true, kept: { primary: 'day', secondary: 'plan' }, bars: ['Mon: 3 (Pro 2 · Enterprise 1)', 'Tue: 1 (Free 1)', 'Wed: 1 (Pro 1)'] });
  // Primary is always set: no None, and its chart's own field reads as the Default.
  // …its menu says which is the Default; its face names the field alone. Will, TODO 684
  expect(r['menu']).toEqual({ none: false, rows: ['plan (Default)', 'day'], face: 'plan' });
  expect(r['back']).toEqual({ primary: { on: true, field: 'plan' }, kept: {}, bars: ['Free: 1', 'Pro: 3', 'Enterprise: 1'] });
});

test('Primary, Secondary and Group are a chain: a field one holds is gone from the others, and refused, whatever Hide says (Will, TODOs 581, 658)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = new DataSource({ store: new ArrayStore(rows.map((row, i) => ({ ...row, region: i % 2 ? 'EU' : 'US' })), { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    source.declareValues('region', ['EU', 'US']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const chip = (id) => bar.shadowRoot.querySelector('.organise-chip[data-id="' + id + '"]');
    const boxes = (id) => [...chip(id).querySelectorAll('sherpa-menu input')].filter((i) => i.value);
    const rowOf = (box) => box.closest('.menu-row');
    const read = () => Object.fromEntries(['primary', 'secondary', 'group'].map((id) => [id, {
      out: boxes(id).filter((b) => rowOf(b).hasAttribute('data-unavailable')).map((b) => b.value),
      gone: boxes(id).filter((b) => rowOf(b).hasAttribute('data-removed')).map((b) => b.value),
    }]));
    const pick = async (id, value) => {
      const box = boxes(id).find((i) => i.value === value);
      box.checked = true;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await settle();
    };
    const at = { first: read() };
    await pick('secondary', 'day');
    at.stacked = read();
    await pick('group', 'region');
    at.grouped = { ...read(), refused: boxes('primary').find((b) => b.value === 'region').disabled };
    bar.setAttribute('data-limit-options', 'on');
    bar.setAttribute('data-hide-unmatched', 'on');
    await settle();
    at.hidden = read();
    return at;
  })()`) as Record<string, unknown>;
  // Primary holds plan: Secondary and Group have no row for it.
  expect(r['first']).toEqual({ primary: { out: [], gone: [] }, secondary: { out: ['plan'], gone: ['plan'] }, group: { out: ['plan'], gone: ['plan'] } });
  // Secondary takes day: Primary loses it, and Group both.
  expect(r['stacked']).toEqual({ primary: { out: ['day'], gone: ['day'] }, secondary: { out: ['plan'], gone: ['plan'] }, group: { out: ['plan', 'day'], gone: ['plan', 'day'] } });
  // Group takes region: Primary and Secondary lose it too, and refuse a tick on it.
  const grouped = {
    primary: { out: ['day', 'region'], gone: ['day', 'region'] }, secondary: { out: ['plan', 'region'], gone: ['plan', 'region'] },
    group: { out: ['plan', 'day'], gone: ['plan', 'day'] },
  };
  expect(r['grouped']).toEqual({ ...grouped, refused: true });
  // Hide on changes nothing: they were gone already.
  expect(r['hidden']).toEqual(grouped);
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
    source.query.ask({ scope: 'by-plan', presentation: { group: 'day' } });
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

test('a chart card\'s title follows what the reader set: Primary by Secondary, grouped by Group; set nothing, its page\'s own (Will, TODO 567)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-data-viz-header slot="header" data-heading="Sales by plan" data-presentation="default"></sherpa-data-viz-header>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = new DataSource({ store: new ArrayStore(rows.map((row, i) => ({ ...row, region: i % 2 ? 'EU' : 'US' })), { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    source.declareValues('region', ['EU', 'US']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const head = provider.querySelector('sherpa-data-viz-header');
    const set = async (patch) => { source.query.ask({ scope: 'by-plan', presentation: patch }); await settle(); await settle(); return head.dataset.heading; };
    const at = { first: head.dataset.heading };
    at.primary = await set({ primary: 'day' });
    at.secondary = await set({ secondary: 'plan' });
    at.group = await set({ group: 'region' });
    at.lessPrimary = await set({ primary: undefined, secondary: 'day' });
    at.back = await set({ secondary: undefined, group: undefined });
    return at;
  })()`) as Record<string, unknown>;
  expect(r).toEqual({
    first: 'Sales by plan',
    primary: 'day',
    secondary: 'day by plan',
    group: 'day by plan, grouped by region',
    // Its Primary back to its page's: still named, for the rest is set.
    lessPrimary: 'plan by day, grouped by region',
    back: 'Sales by plan',
  });
});

test('a chart that splits by two fields titles itself "Primary by Secondary" on load (Will, TODO 711)', async ({ page }) => {
  const heading = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-data-viz-header slot="header" data-heading="By plan" data-presentation="default"></sherpa-data-viz-header>
        <sherpa-barchart data-segment-field="day" data-stack-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    return provider.querySelector('sherpa-data-viz-header').dataset.heading;
  })()`);
  expect(heading).toBe('day by plan');
});

test('the app may turn Show as off: no card offers it, and a kept pick is set aside, not lost (Will, TODO 582)', async ({ page }) => {
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
    const said = () => ({ tag: provider.querySelector('#slotted').localName, shown: head.dataset.presentation,
      offered: getComputedStyle(head.shadowRoot.querySelector('.show-as')).display !== 'none', kept: source.query.presentation('by-plan') });
    const box = [...head.shadowRoot.querySelectorAll('.presentation-menu input')].find((i) => i.value === 'pie');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    await settle();
    const at = { pie: said() };
    provider.settings.set('showAs', false);
    await settle();
    await settle();
    at.off = said();
    provider.settings.set('showAs', true);
    await settle();
    await settle();
    at.on = said();
    return at;
  })()`) as Record<string, unknown>;
  expect(r['pie']).toEqual({ tag: 'sherpa-radial-chart', shown: 'pie', offered: true, kept: { kind: 'pie' } });
  // Off: the bar its page drew, no Show as — and the pie kept.
  expect(r['off']).toEqual({ tag: 'sherpa-barchart', shown: 'off', offered: false, kept: { kind: 'pie' } });
  expect(r['on']).toEqual({ tag: 'sherpa-radial-chart', shown: 'pie', offered: true, kept: { kind: 'pie' } });
});

test('the app may turn the Primary and Secondary chips off: no bar offers them, a kept pick is set aside, and Group still leaves out the Primary (Will, TODOs 583, 658)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const chip = (id) => bar.shadowRoot.querySelector('.organise-chip[data-id="' + id + '"]');
    const said = () => ({
      chips: [...bar.shadowRoot.querySelectorAll('.organise-zone > .organise-chip')].map((c) => c.dataset.id),
      bars: [...provider.querySelector('#slotted').shadowRoot.querySelectorAll('.bar-col')].map((c) => c.getAttribute('aria-label')),
      gone: [...chip('group').querySelectorAll('sherpa-menu input')].filter((i) => i.value && i.closest('.menu-row').hasAttribute('data-removed')).map((i) => i.value),
      kept: source.query.presentation('by-plan'),
    });
    const box = [...chip('primary').querySelectorAll('sherpa-menu input')].find((i) => i.value === 'day');
    box.checked = true;
    box.dispatchEvent(new Event('change', { bubbles: true }));
    await settle();
    const at = { day: said() };
    provider.settings.set('axisChips', false);
    await settle();
    at.off = said();
    provider.settings.set('axisChips', true);
    await settle();
    at.on = said();
    return at;
  })()`) as Record<string, unknown>;
  expect(r['day']).toEqual({ chips: ['primary', 'secondary', 'group', 'sort'], bars: ['Mon: 2', 'Tue: 1', 'Wed: 1'], gone: ['day'], kept: { primary: 'day' } });
  // Off: no Primary or Secondary, the bars its page drew — and day kept. Group leaves out the page's Primary.
  expect(r['off']).toEqual({ chips: ['group', 'sort'], bars: ['Free: 1', 'Pro: 2', 'Enterprise: 1'], gone: ['plan'], kept: { primary: 'day' } });
  expect(r['on']).toEqual(r['day']);
});

test('a grid card\'s Show as draws its slot as a chart — bars and stack as its definition says — and Default puts back the very grid (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-container-header slot="header" data-presentation="default"></sherpa-container-header>
        <sherpa-data-grid id="grid" data-scope="data" data-grow></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }];
    grid.key = 'id';
    // A second Pro on Monday: three Pro rows, on two days.
    const source = new DataSource({ store: new ArrayStore([...rows, { id: 5, plan: 'Pro', spend: 1, day: 'Mon' }], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    // Its page's definition: its Primary, plan. No Secondary: a grid would pivot.
    source.query.declarePresentation('data', { primary: 'plan' });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-container-header');
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
  // A bar a plan, its row count; its legend lists the plans. It sits where the grid sat, its id too.
  expect(r['bar']).toEqual({ tag: 'sherpa-barchart', scope: 'data', id: 'grid', shown: 'bar', marks: ['Free: 1', 'Pro: 3', 'Enterprise: 1'], legend: 3 });
  // The page's own grid, with its columns, and its rows again.
  expect(r['back']).toEqual({ same: true, shown: 'default', rows: 5, reports: [] });
});

// TRAP T-a-kind-is-registered-never-a-tag
test('each kind is registered by its own component: who draws it, what Show as offers over it, and a radial\'s two (Will, TODO 548)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { offered, presenter, presentsOf } = await import('/dist/index.js');
    const radial = document.createElement('sherpa-radial-chart');
    const kinds = { donut: presentsOf(radial)?.kind };
    radial.setAttribute('data-type', 'pie');
    kinds.pie = presentsOf(radial)?.kind;
    const by = (kind) => presenter(kind)?.ctor === customElements.get(({ bar: 'sherpa-barchart', donut: 'sherpa-radial-chart', grid: 'sherpa-data-grid', gauge: 'sherpa-gauge-chart', line: 'sherpa-line-chart' })[kind]);
    return {
      kinds, drawn: ['bar', 'donut', 'grid', 'gauge', 'line'].every(by), shape: presenter('pie')?.shape, none: presenter('scatter') ?? null,
      offers: Object.fromEntries(['bar', 'donut', 'grid', 'gauge', 'line'].map((k) => [k, offered(k)])),
    };
  })()`);
  expect(r).toEqual({
    kinds: { donut: 'donut', pie: 'pie' }, drawn: true, shape: 'segments', none: null,
    offers: {
      bar: ['donut', 'pie', 'grid'], donut: ['bar', 'pie', 'grid'], grid: ['bar', 'donut', 'pie'],
      // One number splits nothing: a grid of its rows, never a chart. A line, any.
      gauge: ['grid'], line: ['bar', 'donut', 'pie', 'grid'],
    },
  });
});

// TRAP T-a-swap-is-a-view-transition
test('Show as swaps in a view transition where the engine has one, at once where it has none or the reader asks for less motion (Will, TODO 548)', async ({ page }) => {
  const run = (): Promise<Record<string, unknown>> => page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-data-viz-header slot="header" data-heading="By plan" data-presentation="default"></sherpa-data-viz-header>
        <sherpa-barchart id="slotted" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const has = typeof document.startViewTransition === 'function';
    let calls = 0;
    if (has) {
      const own = document.startViewTransition;
      document.startViewTransition = function (update) { calls++; return own.call(this, update); };
    }
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const tag = () => provider.querySelector('#slotted').localName;
    source.query.ask({ scope: 'by-plan', presentation: { kind: 'pie' } });
    await settle(); await settle();
    const at = { has, pie: tag(), calls };
    // None to be had: a plain swap.
    document.startViewTransition = undefined;
    source.query.ask({ scope: 'by-plan', presentation: { kind: undefined } });
    await settle(); await settle();
    delete document.startViewTransition;
    return { ...at, back: tag(), after: calls, reports };
  })()`);
  const r = await run();
  test.info().annotations.push({ type: 'startViewTransition', description: String(r['has']) });
  expect(r).toEqual({ has: r['has'], pie: 'sherpa-radial-chart', calls: r['has'] ? 1 : 0, back: 'sherpa-barchart', after: r['has'] ? 1 : 0, reports: [] });
  // Less motion: no transition.
  await page.emulateMedia({ reducedMotion: 'reduce' });
  expect(await run()).toMatchObject({ pie: 'sherpa-radial-chart', calls: 0, back: 'sherpa-barchart' });
});

test('a chart\'s grid reads its chart\'s very answer: a row a bar, a column a piece of its stack, the bar its Total — a line\'s, a row a point (Will, TODOs 548, 622)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="by-plan">
        <sherpa-container-header slot="header" data-presentation="default"></sherpa-container-header>
        <sherpa-barchart id="bar" data-segment-field="plan" data-stack-field="day"></sherpa-barchart>
      </sherpa-container>
      <sherpa-container data-scope="over-day">
        <sherpa-container-header slot="header" data-presentation="default"></sherpa-container-header>
        <sherpa-line-chart id="line" data-over-field="day" data-segment-field="plan"></sherpa-line-chart>
      </sherpa-container>\`;
    const source = make();
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const card = (scope) => provider.querySelector('[data-scope="' + scope + '"] > :not([slot])');
    const drawn = (bar) => [...bar.shadowRoot.querySelectorAll('.bar-col')].map((c) => c.getAttribute('aria-label'));
    const table = (grid) => [...grid.shadowRoot.querySelectorAll('.body > .row')].map((row) => [...row.querySelectorAll('td')].map((td) => td.textContent.trim()).filter(Boolean).join('|'));
    const heads = (grid) => [...grid.shadowRoot.querySelectorAll('.head-cell .head-label')].map((h) => h.textContent.trim());
    const at = { bars: drawn(card('by-plan')) };
    for (const scope of ['by-plan', 'over-day']) source.query.ask({ scope, presentation: { kind: 'grid' } });
    await settle(); await settle(); await settle();
    at.grid = { tag: card('by-plan').localName, id: card('by-plan').id, heads: heads(card('by-plan')), rows: table(card('by-plan')) };
    at.line = { heads: heads(card('over-day')), rows: table(card('over-day')) };
    return { ...at, reports };
  })()`) as Record<string, unknown>;
  // The bars: each plan, stacked by day.
  expect(r['bars']).toEqual(['Free: 1 (Tue 1)', 'Pro: 2 (Mon 1 · Wed 1)', 'Enterprise: 1 (Mon 1)']);
  // Its grid: the same plans, a column a day it holds, each bar its Total.
  expect(r['grid']).toEqual({ tag: 'sherpa-data-grid', id: 'bar', heads: ['plan', 'Mon', 'Tue', 'Wed', 'Total'],
    rows: ['Free|0|1|0|1', 'Pro|1|0|1|2', 'Enterprise|1|0|0|1'] });
  // A line's: a row a day it runs over, a column a line.
  expect(r['line']).toEqual({ heads: ['day', 'Free', 'Pro', 'Enterprise', 'Total'], rows: ['Mon|0|1|1|2', 'Tue|1|0|0|1', 'Wed|0|1|0|1'] });
  expect(r['reports']).toEqual([]);
});

test('a grid in a slot: its Primary leads its columns; a Secondary makes it a PIVOT whose rows OPEN on their own rows; Group groups those — a chain (Will, TODOs 548, 570, 574)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }, { field: 'day', header: 'Day' }, { field: 'region', header: 'Region' }];
    grid.key = 'id';
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, plan: 'Pro', day: 'Mon', region: 'EU' }, { id: 2, plan: 'Free', day: 'Tue', region: 'EU' },
      { id: 3, plan: 'Pro', day: 'Wed', region: 'US' }, { id: 4, plan: 'Enterprise', day: 'Mon', region: 'US' },
    ], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    for (const [f, label] of [['plan', 'Plan'], ['day', 'Day'], ['region', 'Region']]) source.declareField(f, { label });
    source.query.offer('data', ['plan', 'day', 'region']);
    source.query.ask({ scope: 'data', hold: ['plan', 'day', 'region'] });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const cells = (row) => [...row.querySelectorAll('td')].map((td) => td.textContent.trim()).filter(Boolean).join('|');
    const read = () => ({
      chips: [...bar.shadowRoot.querySelectorAll('.organise-zone > .organise-chip')].map((c) => c.dataset.id + (c.hasAttribute('data-current') ? ':' + c.column : '')),
      heads: [...grid.shadowRoot.querySelectorAll('.head-cell .head-label')].map((h) => h.textContent.trim()),
      rows: [...grid.shadowRoot.querySelectorAll('.body > .row')].map(cells),
      groups: [...grid.shadowRoot.querySelectorAll('.body > .group-row .group-label')].map((g) => g.textContent.trim()),
      sub: [...grid.shadowRoot.querySelectorAll('.detail-grid')].map((g) => [...g.shadowRoot.querySelectorAll('.body > .row')].map(cells)),
      subGroups: [...grid.shadowRoot.querySelectorAll('.detail-grid')].map((g) => [...g.shadowRoot.querySelectorAll('.body > .group-row .group-label')].map((l) => l.textContent.trim())),
    });
    const at = { first: read() };
    source.query.ask({ scope: 'data', presentation: { primary: 'day' } });
    await settle(); await settle();
    at.led = read();
    source.query.ask({ scope: 'data', presentation: { secondary: 'plan' } });
    await settle(); await settle();
    at.pivot = read();
    grid.shadowRoot.querySelector('.row-open').click();
    await settle(); await settle();
    at.opened = read();
    source.query.ask({ scope: 'data', group: 'region' });
    await settle(); await settle();
    at.grouped = read();
    source.query.ask({ scope: 'data', group: null });
    source.query.ask({ scope: 'data', presentation: { secondary: undefined } });
    await settle(); await settle();
    at.back = read();
    return at;
  })()`) as Record<string, { chips: string[]; heads: string[]; rows: string[]; groups: string[]; sub: string[][]; subGroups: string[][] }>;
  // Its first column is its Primary, on — small until picked; Secondary waits for a picked Primary.
  expect(r['first']!.chips).toEqual(['primary:plan', 'secondary', 'group', 'sort']);
  expect(r['first']!.heads).toEqual(['Plan', 'Day', 'Region']);
  // Primary day: that column leads, and Secondary is offered.
  expect(r['led']!.heads).toEqual(['Day', 'Plan', 'Region']);
  expect(r['led']!.chips).toEqual(['primary:day', 'secondary', 'group', 'sort']);
  // Secondary plan: a row a day, a column a plan, row counts, and their total — its scope a grid's still.
  expect(r['pivot']!.chips).toEqual(['primary:day', 'secondary:plan', 'group', 'sort']);
  expect(r['pivot']!.heads).toEqual(['Day', 'Free', 'Pro', 'Enterprise', 'Total']);
  expect(r['pivot']!.rows).toEqual(['Mon|0|1|1|2', 'Tue|1|0|0|1', 'Wed|0|1|0|1']);
  // Its Monday row opens on Monday's own rows, under the grid's own columns but its Primary. TODO 578
  expect(r['opened']!.sub).toEqual([['Pro|EU', 'Enterprise|US']]);
  // Group by region groups each row's own rows, not the pivot: Primary, Secondary, Group are a chain.
  expect(r['grouped']!.chips).toEqual(['primary:day', 'secondary:plan', 'group:region', 'sort']);
  expect(r['grouped']!.groups).toEqual([]);
  expect(r['grouped']!.rows).toEqual(['Mon|0|1|1|2', 'Tue|1|0|0|1', 'Wed|0|1|0|1']);
  expect(r['grouped']!.sub).toEqual([['Pro', 'Enterprise']]);
  expect(r['grouped']!.subGroups).toEqual([['EU', 'US']]);
  // Let go: its own columns and its rows again.
  expect(r['back']!.heads).toEqual(['Day', 'Plan', 'Region']);
  expect(r['back']!.rows.length).toBe(4);
});

test('a grid\'s headings offer Group as its page\'s `axes` say: a field the app makes unavailable has no Group button (Will, TODO 662)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = '<sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>';
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }, { field: 'day', header: 'Day' }];
    grid.key = 'id';
    const source = make();
    for (const [f, label] of [['plan', 'Plan'], ['day', 'Day']]) source.declareField(f, { label });
    source.query.offer('data', ['plan', 'day']);
    source.query.declareAxes({ grid: { group: { unavailable: ['day'] } } });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle(); await settle();
    const off = (f) => grid.shadowRoot.querySelector('.head-cell[data-field="' + f + '"] .head-group').hasAttribute('data-unsupported');
    return { plan: off('plan'), day: off('day') };
  })()`);
  expect(r).toEqual({ plan: false, day: true });
});

test('a grid\'s Secondary switched off keeps its field: the pivot goes, the chip still names it, and on again brings it back (Will, TODO 666)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-data-grid id="grid" data-scope="data"></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'day', header: 'Day' }, { field: 'plan', header: 'Plan' }];
    grid.key = 'id';
    const source = make();
    for (const [f, label] of [['plan', 'Plan'], ['day', 'Day']]) source.declareField(f, { label });
    source.query.offer('data', ['plan', 'day']);
    provider.provide({ sources: { sales: source } });
    await source.load();
    source.query.ask({ scope: 'data', presentation: { secondary: 'plan' } });
    await settle(); await settle();
    const bar = provider.querySelector('sherpa-quick-filter-toolbar');
    const chip = () => bar.shadowRoot.querySelector('.organise-chip[data-id="secondary"]');
    const read = () => ({
      column: chip().column, on: chip().hasAttribute('data-current'),
      heads: [...grid.shadowRoot.querySelectorAll('.head-cell .head-label')].map((h) => h.textContent.trim()),
      kept: source.query.presentation('data'),
    });
    const press = async () => {
      chip().shadowRoot.querySelector('.body').click();
      await settle(); await settle();
    };
    const at = { pivot: read() };
    await press();
    at.off = read();
    await press();
    at.on = read();
    return at;
  })()`) as Record<string, { column: string; on: boolean; heads: string[]; kept: Record<string, string> }>;
  expect(r['pivot']).toEqual({ column: 'plan', on: true, heads: ['Day', 'Free', 'Pro', 'Enterprise', 'Total'], kept: { secondary: 'plan' } });
  // Off: a plain grid, and the chip and the Query keep Plan.
  expect(r['off']).toEqual({ column: 'plan', on: false, heads: ['Day', 'Plan'], kept: { secondary: 'plan', off: 'secondary' } });
  expect(r['on']).toEqual(r['pivot']);
});

test('a pivot\'s tags go where their columns are: down to its rows\' sub-grids, never its Primary\'s or its Group\'s, and back up when it goes (Will, TODOs 579, 580)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-data-grid id="grid" data-scope="data" data-multi-field></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'name', header: 'Name', tags: ['plan', 'day', 'region'] },
      { field: 'plan', header: 'Plan' }, { field: 'day', header: 'Day' }, { field: 'region', header: 'Region' }];
    grid.key = 'id';
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, name: 'a', plan: 'Pro', day: 'Mon', region: 'EU' }, { id: 2, name: 'b', plan: 'Free', day: 'Tue', region: 'EU' },
      { id: 3, name: 'c', plan: 'Pro', day: 'Wed', region: 'US' }, { id: 4, name: 'd', plan: 'Enterprise', day: 'Mon', region: 'US' },
    ], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    for (const [f, label] of [['name', 'Name'], ['plan', 'Plan'], ['day', 'Day'], ['region', 'Region']]) source.declareField(f, { label });
    source.query.offer('data', ['name', 'plan', 'day', 'region']);
    source.query.ask({ scope: 'data', hold: ['plan', 'day', 'region'] });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    // Each row's cells that draw tags: the column, then its tags' fields.
    const tags = (g) => [...g.shadowRoot.querySelectorAll('.body > .row')].map((tr) => [...tr.querySelectorAll('td')]
      .filter((td) => td.querySelector('.cell-tag'))
      .map((td) => td.dataset.field + '>' + [...td.querySelectorAll('.cell-tag')].map((t) => t.dataset.field).join(',')).join(' '));
    const read = () => ({ main: tags(grid), sub: [...grid.shadowRoot.querySelectorAll('.detail-grid')].map(tags) });
    const settled = async () => { await settle(); await settle(); };
    const at = { first: read() };
    source.query.ask({ scope: 'data', presentation: { primary: 'day', secondary: 'plan' } });
    await settled();
    grid.shadowRoot.querySelector('.row-open').click();
    await settled();
    at.byDay = read();
    source.query.ask({ scope: 'data', presentation: { primary: 'name' } });
    await settled();
    grid.shadowRoot.querySelector('.row-open').click();
    await settled();
    at.byName = read();
    source.query.ask({ scope: 'data', group: 'region' });
    await settled();
    at.grouped = read();
    source.query.ask({ scope: 'data', group: null });
    source.query.ask({ scope: 'data', presentation: { secondary: undefined } });
    await settled();
    at.back = read();
    return at;
  })()`) as Record<string, { main: string[]; sub: string[][] }>;
  // Its own: Name's tags on every row.
  expect(r['first']!.main[0]).toBe('name>plan,day,region');
  // A pivot by day: its rows hold counts, no tags; Monday's rows keep Name's, but not the day's.
  expect(r['byDay']).toEqual({ main: ['', '', ''], sub: [['name>plan,region', 'name>plan,region']] });
  // By name: Name is the pivot's, so its tags go down to the sub-grid's first column.
  expect(r['byName']).toEqual({ main: ['', '', '', ''], sub: [['plan>day,region']] });
  // Grouped by region: no Region tag where its heading says it. TODO 579
  expect(r['grouped']!.sub).toEqual([['plan>day']]);
  // Let go: back up on Name.
  expect(r['back']!.main[0]).toBe('name>plan,day,region');
});

test('a pivot filters as its grid does: its Primary heading and cells, and its rows\' sub-grids\' — the same rows, organised (Will, TODO 571)', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="data">
        <sherpa-quick-filter-toolbar></sherpa-quick-filter-toolbar>
        <sherpa-data-grid id="grid" data-scope="data" data-column-filters></sherpa-data-grid>
      </sherpa-container>\`;
    const grid = provider.querySelector('#grid');
    grid.columns = [{ field: 'plan', header: 'Plan' }, { field: 'day', header: 'Day' }, { field: 'region', header: 'Region' }];
    grid.key = 'id';
    const source = new DataSource({ store: new ArrayStore([
      { id: 1, plan: 'Pro', day: 'Mon', region: 'EU' }, { id: 2, plan: 'Free', day: 'Tue', region: 'EU' },
      { id: 3, plan: 'Pro', day: 'Wed', region: 'US' }, { id: 4, plan: 'Enterprise', day: 'Mon', region: 'US' },
    ], { key: 'id' }) });
    source.declareValues('plan', PLANS);
    source.declareValues('day', ['Mon', 'Tue', 'Wed']);
    for (const [f, label] of [['plan', 'Plan'], ['day', 'Day'], ['region', 'Region']]) source.declareField(f, { label });
    source.query.offer('data', ['plan', 'day', 'region']);
    source.query.ask({ scope: 'data', hold: ['plan', 'day', 'region'] });
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    source.query.ask({ scope: 'data', presentation: { primary: 'day', secondary: 'plan' } });
    await settle(); await settle();
    let leaked = 0;
    grid.addEventListener('context-request', () => leaked++);
    grid.shadowRoot.querySelector('.row-open').click();
    await settle(); await settle();
    const cells = (row) => [...row.querySelectorAll('td')].map((td) => td.textContent.trim()).filter(Boolean).join('|');
    const sub = () => grid.shadowRoot.querySelector('.detail-grid');
    // A cell's chip, pressed as a reader does: over its cell, then its body.
    const press = async (el, field, text) => {
      const td = [...el.shadowRoot.querySelectorAll('.body > .row > td[data-field="' + field + '"]')].find((c) => c.textContent.trim() === text);
      td.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, composed: true }));
      const chip = el.shadowRoot.querySelector('.cell-filter');
      if (chip.parentElement !== td) return false;
      chip.shadowRoot.querySelector('.body').click();
      await settle(); await settle();
      return true;
    };
    const read = () => ({
      region: source.query.reading('data', 'region')?.picked ?? null,
      day: source.query.reading('data', 'day')?.picked ?? null,
      heads: [...grid.shadowRoot.querySelectorAll('.head-cell')].map((h) => h.querySelector('.head-label').textContent.trim()
        + (h.querySelector('.head-filter')?.hasAttribute('data-unsupported') ? '' : '*')),
      rows: [...grid.shadowRoot.querySelectorAll('.body > .row')].map(cells),
      sub: sub() ? [...sub().shadowRoot.querySelectorAll('.body > .row')].map(cells) : null,
      subRegion: sub()?.shadowRoot.querySelector('.head-cell[data-field="region"] .head-filter')?.hasAttribute('data-current') ?? null,
    });
    const at = { first: read() };
    // Monday's sub-grid: its EU cell filters the grid's Region.
    at.pressed = await press(sub(), 'region', 'EU');
    at.region = read();
    // A count is not a field: its cell offers nothing.
    at.count = await press(grid, 'pivot:Pro', '1');
    // The pivot's own Primary cell: Tuesday.
    at.day = await press(grid, 'day', 'Tue');
    at.tue = read();
    at.leaked = leaked;
    return at;
  })()`) as Record<string, unknown> & Record<'first' | 'region' | 'tue', { region: string[] | null; day: string[] | null; heads: string[]; rows: string[]; sub: string[] | null; subRegion: boolean | null }>;
  // Its Primary filters; its counts do not.
  expect(r['first']!.heads).toEqual(['Day*', 'Free', 'Pro', 'Enterprise', 'Total']);
  expect(r['first']!.sub).toEqual(['Pro|EU', 'Enterprise|US']);
  // A sub-grid's cell filters the grid's rows: EU only, its row still open, its heading on.
  expect(r['pressed']).toBe(true);
  expect(r['region']).toMatchObject({ region: ['EU'], rows: ['Mon|0|1|1', 'Tue|1|0|1'], sub: ['Pro|EU'], subRegion: true });
  expect(r['count']).toBe(false);
  // The pivot's own Day cell: Tuesday, over EU.
  expect(r['day']).toBe(true);
  expect(r['tue']).toMatchObject({ region: ['EU'], day: ['Tue'], rows: ['Tue|1|1'] });
  // A sub-grid never asks the provider.
  expect(r['leaked']).toBe(0);
});

// A card's header toggles its filter toolbar: the provider answers. Will, TODO 629
// TRAP T-a-card-toggles-its-own-toolbar
test('a card\'s header shows and shuts its own filter toolbar, and the other card\'s stays', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    provider.innerHTML = \`
      <sherpa-container data-scope="one">
        <sherpa-container-header id="h1" slot="header" data-heading="One" data-filter-toolbar="shut"></sherpa-container-header>
        <sherpa-quick-filter-toolbar id="b1" hidden data-no-actions data-no-saves></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="c1" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>
      <sherpa-container data-scope="two">
        <sherpa-container-header id="h2" slot="header" data-heading="Two" data-filter-toolbar="shown"></sherpa-container-header>
        <sherpa-quick-filter-toolbar id="b2" data-no-actions data-no-saves></sherpa-quick-filter-toolbar>
        <sherpa-barchart id="c2" data-segment-field="plan"></sherpa-barchart>
      </sherpa-container>\`;
    const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
    source.declareValues('plan', PLANS);
    provider.provide({ sources: { sales: source } });
    await source.load();
    await settle();
    const read = () => ({
      h1: provider.querySelector('#h1').dataset.filterToolbar, b1: provider.querySelector('#b1').hidden,
      h2: provider.querySelector('#h2').dataset.filterToolbar, b2: provider.querySelector('#b2').hidden,
      pressed: provider.querySelector('#h1').shadowRoot.querySelector('.toolbar-toggle').getAttribute('aria-pressed'),
    });
    const first = read();
    provider.querySelector('#h1').shadowRoot.querySelector('.toolbar-toggle').shadowRoot.querySelector('button').click();
    await settle();
    const opened = read();
    provider.querySelector('#h1').shadowRoot.querySelector('.toolbar-toggle').shadowRoot.querySelector('button').click();
    await settle();
    return { first, opened, shut: read() };
  })()`);
  expect(r).toEqual({
    first: { h1: 'shut', b1: true, h2: 'shown', b2: false, pressed: 'false' },
    opened: { h1: 'shown', b1: false, h2: 'shown', b2: false, pressed: 'true' },
    shut: { h1: 'shut', b1: true, h2: 'shown', b2: false, pressed: 'false' },
  });
});

// Sort goes by count at every level: segments, then what is inside each. Will, TODO 651
test('a chart\'s Sort orders its segments, their pieces and their sections by count', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { summarise } = await import('/dist/data.js');
    const rows = [
      ...Array(1).fill({ s: 'a', p: 'x', g: 'm' }), ...Array(3).fill({ s: 'a', p: 'y', g: 'm' }), ...Array(2).fill({ s: 'a', p: 'y', g: 'n' }),
      ...Array(1).fill({ s: 'b', p: 'x', g: 'n' }),
    ];
    const names = (list) => list.map((d) => d.label + d.value);
    const of = (sort) => summarise(rows, { shape: 'segments', segment: 's', stack: 'p', group: 'g', sort });
    const asc = of('asc');
    const desc = of('desc');
    return { asc: names(asc), desc: names(desc), pieces: names(desc[0].stack), parts: names(desc[0].stack[0].parts), piecesUp: names(asc[1].stack) };
  })()`);
  expect(r).toEqual({ asc: ['b1', 'a6'], desc: ['a6', 'b1'], pieces: ['y5', 'x1'], parts: ['m3', 'n2'], piecesUp: ['x1', 'y5'] });
});
