import { test, expect } from './fixture';

/**
 * A FILTER APPLIES DOWN ITS SCOPE ONLY, NEVER UP.
 *
 * Two scopes over one field, and before this they shared one slot: a legend
 * switching a series off called `select()` and OVERWROTE the View chip's own
 * picks — measured, the chip then re-drew showing the legend's answer as if the
 * reader had chosen it.
 *
 * A component binding writes its OWN scope instead, narrowing the one component
 * it names (`only`), ANDed under the View: it narrows further, it cannot widen
 * past the View, and the View's own state is untouched.
 *
 * TRAP T-a-filter-applies-down-its-scope
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

/** One source over four rows, plus a fake legend bound at the given scope. */
const SETUP = `
  const { ArrayStore, DataSource, bindSelection, bindSource } = await import('/dist/data.js');
  const store = new ArrayStore(
    [{ id: 1, os: 'mac' }, { id: 2, os: 'win' }, { id: 3, os: 'linux' }, { id: 4, os: 'mac' }],
    { key: 'id' },
  );
  const src = new DataSource({ store });
  await src.ready;
  const settle = () => new Promise((r) => setTimeout(r, 60));
  const seen = () => [...new Set(src.rows.map((r) => r.os))].sort().join('+') || '(none)';
`;

test('the default scope is VIEW, so nothing that ignores this changes', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const chip = new EventTarget();
    chip.picked = ['mac', 'win', 'linux'];
    bindSelection(chip, src, {
      field: 'os', values: ['mac', 'win', 'linux'],
      read: (l) => l.picked,
      draw: (l, picked) => { l.drawn = [...picked]; },
      event: 'change',
    });
    await settle();

    chip.picked = ['mac'];
    chip.dispatchEvent(new Event('change'));
    await settle();

    return {
      seen: seen(),
      // A view binding writes the FIELD, so the source reports it.
      fieldPicked: src.selection('os').values
        .filter((v) => v.state === 'picked').map((v) => v.value).join('+'),
      scopes: Object.keys(src.query.applied.scopes),
    };
  })()`) as { seen: string; fieldPicked: string; scopes: string[] };

  expect(r.seen).toBe('mac');
  expect(r.fieldPicked).toBe('mac');
  // No scope of its own — a view binding uses the field's own slot.
  expect(r.scopes).toEqual(['view']);
});

test('a component reach with no `only` is reported, and binds nothing', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const { onReport } = await import('/dist/data.js');
    const seenCodes = [];
    const undo = onReport((x) => seenCodes.push(x.code));
    const legend = new EventTarget();
    legend.picked = ['win'];
    bindSelection(legend, src, {
      field: 'os', values: ['mac', 'win', 'linux'], read: (l) => l.picked, draw: () => {},
      event: 'toggle', reach: 'component',
    });
    legend.dispatchEvent(new Event('toggle'));
    await src.load();
    undo();
    return { codes: seenCodes, seen: seen(), scopes: Object.keys(src.query.applied.scopes) };
  })()`) as { codes: string[]; seen: string; scopes: string[] };

  // Falling back to select() would be the exact clobber this scope prevents.
  expect(r.codes).toEqual(['component-reach-without-only']);
  expect(r.seen).toBe('linux+mac+win');
  expect(r.scopes).toEqual([]);
});

/**
 * OFF IS A STATE, NOT A DELETE.
 *
 * A chip switched off stops APPLYING its values; it does not forget them. The
 * records example passed the empty list from `values` — which is correct for
 * "what is this bar filtering by" and wrong as an instruction — so toggling a
 * chip off cleared the reader's picks and it could not even switch back on.
 *
 * TRAP T-grid-suspend-is-not-clear
 */
test('suspending a field keeps its values; clearing does not', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const { ArrayStore, DataSource, bindSource } = await import('/dist/data.js');
    const store = new ArrayStore(
      [{ id: 1, s: 'a' }, { id: 2, s: 'b' }, { id: 3, s: 'c' }],
      { key: 'id' },
    );
    const src = new DataSource({ store });
    await src.ready;
    src.declareValues('s', ['a', 'b', 'c']);
    const settle = () => new Promise((r) => setTimeout(r, 60));

    const snap = () => {
      const st = src.selection('s');
      return {
        rows: src.rows.length,
        state: st.fieldState,
        picked: st.values.filter((v) => v.state === 'picked').map((v) => v.value).join('+'),
      };
    };

    src.query.setReading('view', 's', { picked: ['a', 'b'] });
    await settle();
    const on = snap();

    // OFF: keep the picks, stop applying them.
    src.query.setReading('view', 's', { suspended: true, picked: ['a', 'b'] });
    await settle();
    const off = snap();

    // ON again, from the values it still holds.
    src.query.setReading('view', 's', { picked: ['a', 'b'] });
    await settle();
    const back = snap();

    // And a real CLEAR, which is a different instruction.
    src.query.setReading('view', 's', { picked: [] });
    await settle();
    const cleared = snap();

    return { on, off, back, cleared };
  })()`) as Record<string, { rows: number; state: string; picked: string }>;

  expect(r.on).toEqual({ rows: 2, state: 'active', picked: 'a+b' });
  // SUSPENDED: every row is back, and the picks are still there.
  expect(r.off).toEqual({ rows: 3, state: 'suspended', picked: 'a+b' });
  // One more click restores the same filter — nothing was re-picked.
  expect(r.back).toEqual({ rows: 2, state: 'active', picked: 'a+b' });
  // CLEAR is the other instruction: the values go.
  expect(r.cleared).toEqual({ rows: 3, state: 'off', picked: '' });
});

/**
 * A LEGEND NARROWS ITS OWN CHART, AND NOTHING ELSE. A `component` part on the
 * SHARED source narrowed every bound component — the grid too — which is the
 * View's reach under another name (Will, 2026-09-26: "They should only affect
 * their chart"). `only` keeps it out of the shared query and applies it to
 * that one component's rows. TRAP T-a-component-part-narrows-one-component
 */
test('a legend with `only` narrows its chart, never the grid beside it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const got = new Map();
    const bound = (name) => ({ id: name, populate: (rows) => got.set(name, rows.map((x) => x.os).sort().join('+')),
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
      hasAttribute: () => false, getAttribute: () => null, dataset: {} });
    const chart = bound('chart');
    const grid = bound('grid');
    bindSource(src, chart, { readonly: true, rows: 'all' });
    bindSource(src, grid, { readonly: true });
    const legend = new EventTarget();
    legend.off = [];
    bindSelection(legend, src, {
      field: 'os', values: ['mac', 'win', 'linux'],
      read: (l) => ['mac', 'win', 'linux'].filter((v) => !l.off.includes(v)),
      draw: () => {}, event: 'legend-item-click', reach: 'component', key: 'legend', only: chart,
    });
    await src.load();
    await settle();
    legend.off = ['mac'];
    legend.dispatchEvent(new Event('legend-item-click'));
    await settle();
    const d = src.debugState();
    return { chart: got.get('chart'), grid: got.get('grid'), total: d.total,
      shared: d.filter ?? null, legend: d.query.scopes.legend, own: Object.keys(d.only) };
  })()`) as Record<string, unknown>;
  expect(r['chart']).toBe('linux+win');
  expect(r['grid']).toBe('linux+mac+mac+win');
  expect(r['total']).toBe(4);
  expect(r['shared']).toBeNull();
  // A SCOPE in the Query, narrowing the chart alone. TRAP T-one-query-one-owner
  expect(r['legend']).toEqual({ holds: ['os'], readings: { os: { picked: ['win', 'linux'] } }, narrows: ['chart'] });
  expect(r['own']).toEqual(['chart']);
});

/* TWO legends over one field, each with `only`: each narrows its own chart, and
   neither fights the other or the View. TRAP T-a-component-part-narrows-one-component */
test('two legends with `only` each narrow their own chart', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const got = new Map();
    const bound = (name) => ({ id: name, populate: (rows) => got.set(name, rows.map((x) => x.os).sort().join('+')),
      addEventListener() {}, removeEventListener() {}, setAttribute() {}, removeAttribute() {},
      hasAttribute: () => false, getAttribute: () => null, dataset: {} });
    const one = bound('one');
    const two = bound('two');
    bindSource(src, one, { readonly: true, rows: 'all' });
    bindSource(src, two, { readonly: true, rows: 'all' });
    const legend = (only, key) => {
      const l = new EventTarget();
      l.off = [];
      bindSelection(l, src, {
        field: 'os', values: ['mac', 'win', 'linux'],
        read: (x) => ['mac', 'win', 'linux'].filter((v) => !x.off.includes(v)),
        draw: () => {}, event: 'legend-item-click', reach: 'component', key, only,
      });
      return l;
    };
    const a = legend(one, 'legend-one');
    const b = legend(two, 'legend-two');
    await src.load();
    a.off = ['mac'];
    a.dispatchEvent(new Event('legend-item-click'));
    b.off = ['win', 'linux'];
    b.dispatchEvent(new Event('legend-item-click'));
    await settle();
    return { one: got.get('one'), two: got.get('two'), total: src.debugState().total };
  })()`) as Record<string, unknown>;
  expect(r['one']).toBe('linux+win');
  expect(r['two']).toBe('mac+mac');
  expect(r['total']).toBe(4);
});
