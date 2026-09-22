/**
 * A LEGEND TOGGLE IS A FILTER.
 *
 * Turning a row off used to hide one bar in one chart. It now writes `notin`
 * into the source, so every bound component re-reads — and a chip over the
 * same field is the same state wearing a menu.
 *
 * TRAP T-a-legend-toggle-is-a-filter
 *
 *   node --test test/unit/legend-filter.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { hiddenFilter, bindLegendFilter, DataSource, ArrayStore } =
  await import(new URL('../../dist/data.js', import.meta.url));

const STATES = ['active', 'trial', 'suspended', 'churned'];

/** A legend, reduced to what the rule reads: an off-set and a click event. */
const legendStub = () => {
  const el = new EventTarget();
  el.off = [];
  el.click = (label, active) => {
    el.off = active ? el.off.filter((l) => l !== label) : [...el.off, label];
    el.dispatchEvent(new CustomEvent('legend-item-click', { detail: { label, active } }));
  };
  return el;
};

const chipStub = () => {
  const el = new EventTarget();
  el.values = {};
  /* ONE chip at a time — the toolbar's `values` setter is a WHOLE MAP, and a
     binding that owns one field must not clobber the others.
     TRAP T-one-field-does-not-own-the-whole-map */
  el.setChipValues = (id, picks) => { if (picks !== undefined) el.values[id] = picks; };
  el.off = (id) => !el.values[id]?.length;
  el.pick = (id, picks) => {
    el.dispatchEvent(new CustomEvent('quick-filter-change', { detail: { values: { [id]: picks } } }));
  };
  return el;
};

/* ── The filter itself ──────────────────────────────────────────────── */

test('hiddenFilter: nothing hidden is NO clause, not an empty one', () => {
  assert.equal(hiddenFilter('status', new Set()), undefined,
    'undefined REMOVES the part; a clause nothing fails would still be a clause');
  assert.deepEqual(hiddenFilter('status', new Set(['churned'])), ['status', 'ne', 'churned']);
  assert.deepEqual(hiddenFilter('status', new Set(['churned', 'trial'])),
    ['status', 'notin', ['churned', 'trial']]);
});

/* ── Legend → source ────────────────────────────────────────────────── */

test('a legend click writes the NOT filter into the source', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  assert.deepEqual(parts.get('legend:status'), ['status', 'ne', 'churned']);

  legend.click('trial', false);
  assert.deepEqual(parts.get('legend:status'), ['status', 'notin', ['churned', 'trial']]);

  // Turning it back ON removes the part entirely, rather than leaving a clause.
  legend.click('churned', true);
  legend.click('trial', true);
  assert.equal(parts.has('legend:status'), false);
});

test('two legends over different fields do not overwrite each other', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const a = legendStub(); const b = legendStub();
  bindLegendFilter(a, source, { field: 'status', values: STATES });
  bindLegendFilter(b, source, { field: 'plan', values: ['Free', 'Pro'] });

  a.click('churned', false);
  b.click('Free', false);
  assert.deepEqual([...parts.keys()].sort(), ['legend:plan', 'legend:status']);
});

/* ── Legend ⇄ chip ──────────────────────────────────────────────────── */

/**
 * EVERYTHING ON is no constraint, so the chip CLEARS rather than showing every
 * value ticked. Same outcome, different claim: a chip reading "3 Plan" looks
 * like a filter is running when none is.
 * TRAP T-everything-on-is-no-filter
 */
test('all rows on clears the chip, rather than ticking every value', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub(); const chip = chipStub();
  bindLegendFilter(legend, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });

  legend.click('churned', false);
  assert.deepEqual(chip.values['status'], ['active', 'trial', 'suspended']);

  legend.click('churned', true);
  assert.deepEqual(chip.values['status'], [], 'cleared, not all four ticked');
  assert.equal(parts.has('legend:status'), false, 'and no filter part either');
});

/**
 * At least one row stays on. Hiding the last leaves an empty chart beside an
 * empty grid and no obvious way back.
 * TRAP T-a-legend-keeps-one-row-on
 */
test('the LAST active row cannot be switched off', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  for (const s of ['active', 'trial', 'suspended']) legend.click(s, false);
  assert.deepEqual(parts.get('legend:status'),
    ['status', 'notin', ['active', 'trial', 'suspended']]);

  // The fourth is REFUSED, and the legend is put back as it was.
  legend.click('churned', false);
  assert.deepEqual(parts.get('legend:status'),
    ['status', 'notin', ['active', 'trial', 'suspended']], 'unchanged');
  assert.deepEqual([...legend.off].sort(), ['active', 'suspended', 'trial'],
    'churned is back ON in the legend, not left dimmed');
});

test('an empty menu pick cannot hide everything either', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub(); const chip = chipStub();
  bindLegendFilter(legend, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });
  chip.pick('status', []);
  assert.equal(parts.has('legend:status'), false);
  assert.deepEqual(legend.off, []);
});

test('the chip shows what is still ON — a filter names what it KEEPS', () => {
  const source = { contribute: () => {} };
  const legend = legendStub(); const chip = chipStub();
  bindLegendFilter(legend, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });

  legend.click('churned', false);
  assert.deepEqual(chip.values['status'], ['active', 'trial', 'suspended'],
    'churned is unticked in the menu, the other three stay ticked');
});

test('changing the menu moves the legend in kind', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub(); const chip = chipStub();
  bindLegendFilter(legend, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });

  chip.pick('status', ['active', 'trial']);
  assert.deepEqual(legend.off, ['suspended', 'churned'], 'the legend dims the two unticked rows');
  assert.deepEqual(parts.get('legend:status'), ['status', 'notin', ['suspended', 'churned']]);
});

test('an EMPTY menu is no constraint, not "hide everything"', () => {
  const parts = new Map();
  const source = { contribute: (k, f) => (f ? parts.set(k, f) : parts.delete(k)) };
  const legend = legendStub(); const chip = chipStub();
  bindLegendFilter(legend, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });

  chip.pick('status', ['active']);
  assert.equal(parts.has('legend:status'), true);
  chip.pick('status', []);
  assert.equal(parts.has('legend:status'), false, 'nothing ticked === no filter');
  assert.deepEqual(legend.off, []);
});

/* ── Against a real source ──────────────────────────────────────────── */

test('the rest of the view sees it: the ROW COUNT changes', async () => {
  const rows = STATES.flatMap((status, i) =>
    Array.from({ length: 10 + i }, (_, n) => ({ id: `${status}-${n}`, status })));
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  await source.load({ force: true });
  assert.equal(source.total, 46, '10 + 11 + 12 + 13');

  legend.click('churned', false);           // 13 rows
  await source.load({ force: true });
  assert.equal(source.total, 33, 'the GRID and its pager narrow too, not just a chart');

  legend.click('churned', true);
  await source.load({ force: true });
  assert.equal(source.total, 46);
});

test('a legend filter ANDs with the rest, and survives their changes', async () => {
  const rows = STATES.flatMap((status) =>
    ['Free', 'Pro'].map((plan) => ({ id: `${status}-${plan}`, status, plan })));
  const source = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });
  const legend = legendStub();
  bindLegendFilter(legend, source, { field: 'status', values: STATES });

  legend.click('churned', false);
  source.contribute('chips', ['plan', 'eq', 'Pro']);
  await source.load({ force: true });
  assert.equal(source.total, 3, 'three statuses x one plan');

  // A chip change must not clear the legend's part — that is what `contribute` is for.
  source.contribute('chips', undefined);
  await source.load({ force: true });
  assert.equal(source.total, 6, 'the legend part is still there');
});

/**
 * A binding owns ONE field, so it must write one chip.
 *
 * The toolbar's `values` setter is a WHOLE MAP: a chip it does not name is
 * switched off. Writing `{ plan: [...] }` from the plan legend therefore
 * switched off the Status chip beside it — measured in the app as a chip going
 * ON, then off again the moment an unrelated legend moved.
 * TRAP T-one-field-does-not-own-the-whole-map
 */
test('one legend does not switch off another field\'s chip', () => {
  const source = { contribute: () => {} };
  const chip = chipStub();
  const status = legendStub(); const plan = legendStub();
  bindLegendFilter(status, source, {
    field: 'status', values: STATES, chip: { el: chip, id: 'status' },
  });
  bindLegendFilter(plan, source, {
    field: 'plan', values: ['Free', 'Pro'], chip: { el: chip, id: 'plan' },
  });

  plan.click('Pro', false);
  assert.deepEqual(chip.values['plan'], ['Free']);

  // Now move the OTHER legend. The plan chip must keep what it holds.
  status.click('churned', false);
  assert.deepEqual(chip.values['plan'], ['Free'], 'plan survived a status change');
  assert.deepEqual(chip.values['status'], ['active', 'trial', 'suspended']);
});
