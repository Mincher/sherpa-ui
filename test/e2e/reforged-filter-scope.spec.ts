import { test, expect } from '@playwright/test';

/**
 * A FILTER APPLIES DOWN ITS SCOPE ONLY, NEVER UP.
 *
 * Two scopes over one field, and before this they shared one slot: a legend
 * switching a series off called `select()` and OVERWROTE the View chip's own
 * picks — measured, the chip then re-drew showing the legend's answer as if the
 * reader had chosen it.
 *
 * A component binding contributes a NAMED PART instead. Parts are ANDed under
 * every field selection, which gives the whole rule for free: it narrows
 * further, it cannot widen past the View, and the View's own state is untouched.
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
  const { ArrayStore, DataSource, bindSelection } = await import('/dist/data.js');
  const store = new ArrayStore(
    [{ id: 1, os: 'mac' }, { id: 2, os: 'win' }, { id: 3, os: 'linux' }, { id: 4, os: 'mac' }],
    { key: 'id' },
  );
  const src = new DataSource({ store });
  await src.ready;
  const settle = () => new Promise((r) => setTimeout(r, 60));
  const seen = () => [...new Set(src.rows.map((r) => r.os))].sort().join('+') || '(none)';
`;

test('a component filter narrows further and leaves the view untouched', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const legend = new EventTarget();
    legend.picked = ['mac', 'win', 'linux'];
    const bound = bindSelection(legend, src, {
      field: 'os', values: ['mac', 'win', 'linux'],
      read: (l) => l.picked,
      draw: (l, picked) => { l.drawn = [...picked]; },
      event: 'toggle', scope: 'component', key: 'legend',
    });
    await settle();

    src.select('os', ['mac', 'win']);
    await settle();
    const view = seen();

    // The legend switches mac off. It must narrow, not replace.
    legend.picked = ['win'];
    legend.dispatchEvent(new Event('toggle'));
    await settle();

    const viewPicked = src.selection('os').values
      .filter((v) => v.state === 'picked').map((v) => v.value).sort().join('+');

    const narrowed = seen();
    bound.destroy();
    await settle();
    return { view, narrowed, viewPicked, afterDestroy: seen() };
  })()`) as { view: string; narrowed: string; viewPicked: string; afterDestroy: string };

  expect(r.view).toBe('mac+win');
  // NARROWED, not replaced.
  expect(r.narrowed).toBe('win');
  // The View still holds what the reader chose — this is the whole bug.
  expect(r.viewPicked).toBe('mac+win');
  // A part dies with its control; nothing else can name it.
  expect(r.afterDestroy).toBe('mac+win');
});

test('a component filter cannot widen past the view', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const legend = new EventTarget();
    legend.picked = ['mac', 'win', 'linux'];
    bindSelection(legend, src, {
      field: 'os', values: ['mac', 'win', 'linux'],
      read: (l) => l.picked,
      draw: (l, picked) => { l.drawn = [...picked]; },
      event: 'toggle', scope: 'component', key: 'legend',
    });
    await settle();

    // The View excludes linux for everyone.
    src.select('os', ['mac', 'win']);
    await settle();

    // The legend asks for ONLY linux — a value the View has already removed.
    legend.picked = ['linux'];
    legend.dispatchEvent(new Event('toggle'));
    await settle();

    return { rows: src.rows.length, seen: seen(), drawn: (legend.drawn ?? []).join('+') };
  })()`) as { rows: number; seen: string; drawn: string };

  // Nothing. A series the View filtered out cannot be switched back on.
  expect(r.rows).toBe(0);
  expect(r.seen).toBe('(none)');
  // It draws its OWN answer, not the View's — saying otherwise would claim the
  // reader picked something they did not.
  expect(r.drawn).toBe('linux');
});

test('two components over one field do not fight', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${SETUP}
    const make = (key, picked) => {
      const el = new EventTarget();
      el.picked = picked;
      bindSelection(el, src, {
        field: 'os', values: ['mac', 'win', 'linux'],
        read: (l) => l.picked,
        draw: () => {},
        event: 'toggle', scope: 'component', key,
      });
      return el;
    };
    const chart = make('chart', ['mac', 'win', 'linux']);
    const table = make('table', ['mac', 'win', 'linux']);
    await settle();

    chart.picked = ['mac', 'win'];
    chart.dispatchEvent(new Event('toggle'));
    await settle();
    const afterChart = seen();

    // A SECOND component narrows again. It must not replace the first.
    table.picked = ['win', 'linux'];
    table.dispatchEvent(new Event('toggle'));
    await settle();

    return { afterChart, afterBoth: seen(), parts: src.contributions.sort().join(',') };
  })()`) as { afterChart: string; afterBoth: string; parts: string };

  expect(r.afterChart).toBe('mac+win');
  // The intersection of the two, not the last writer's answer.
  expect(r.afterBoth).toBe('win');
  expect(r.parts).toBe('chart,table');
});

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
      parts: src.contributions.length,
    };
  })()`) as { seen: string; fieldPicked: string; parts: number };

  expect(r.seen).toBe('mac');
  expect(r.fieldPicked).toBe('mac');
  // No named part at all — a view binding uses the field's own slot.
  expect(r.parts).toBe(0);
});

test('a component scope REFUSES a source that cannot hold a part', async ({ page }) => {
  const message = await page.evaluate(`(async () => {
    const { bindSelection } = await import('/dist/data.js');
    // A bare Selector: select/selection/declareValues, no contribute.
    const thin = Object.assign(new EventTarget(), {
      select() {}, selection: () => ({ values: [] }), declareValues() {},
    });
    try {
      bindSelection(new EventTarget(), thin, {
        field: 'os', values: ['mac'], read: () => [], draw: () => {},
        event: 'toggle', scope: 'component',
      });
      return '(no throw)';
    } catch (e) { return String(e.message); }
  })()`) as string;

  // Falling back to select() would be the exact clobber this scope prevents.
  expect(message).toContain('needs a source with contribute()');
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
    const { ArrayStore, DataSource } = await import('/dist/data.js');
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

    src.select('s', ['a', 'b']);
    await settle();
    const on = snap();

    // OFF: keep the picks, stop applying them.
    src.select('s', ['a', 'b'], { suspended: true });
    await settle();
    const off = snap();

    // ON again, from the values it still holds.
    src.select('s', ['a', 'b']);
    await settle();
    const back = snap();

    // And a real CLEAR, which is a different instruction.
    src.select('s', []);
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
