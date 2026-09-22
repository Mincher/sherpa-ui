/**
 * COMPONENT EXTENDS VIEW, NEVER ALTERS IT.
 *
 * A view filter narrows the charts, the tiles and the grid. A component filter
 * narrows one component — a reader hunting through the table does not want the
 * charts beside it to move.
 *
 * Nothing here knows what a "view" or a "component" is: they are two sources,
 * one following the other. A card extending a dashboard is the same shape.
 *
 * TRAP T-component-extends-view-never-alters-it
 *
 *   node --test test/unit/filter-scope.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { DataSource, ArrayStore, followView, offerable, promotions, fieldState } =
  await import(new URL('../../dist/data.js', import.meta.url));

const ROWS = [
  { id: 1, tier: 'Gold', region: 'EMEA' },
  { id: 2, tier: 'Gold', region: 'APAC' },
  { id: 3, tier: 'Silver', region: 'EMEA' },
  { id: 4, tier: 'Silver', region: 'APAC' },
];

/** Two sources over ONE store — the shape a view and its grid take. */
const sources = () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  return { view: new DataSource({ store }), component: new DataSource({ store }) };
};

test('a component draws the VIEW rows, narrowed by its own', async () => {
  const { view, component } = sources();
  followView(view, component);

  await view.load({ force: true });
  await component.load({ force: true });
  assert.equal(view.total, 4);
  assert.equal(component.total, 4, 'no filters anywhere');

  // A VIEW filter reaches both.
  view.contribute('header', ['region', 'eq', 'EMEA']);
  await view.load({ force: true });
  await component.load({ force: true });
  assert.equal(view.total, 2);
  assert.equal(component.total, 2, 'the view narrowed the component too');

  // A COMPONENT filter reaches ONLY the component. This is the whole point:
  // a grid search must not move the charts beside it.
  component.contribute('grid', ['tier', 'eq', 'Gold']);
  await component.load({ force: true });
  await view.load({ force: true });
  assert.equal(component.total, 1, 'EMEA AND Gold');
  assert.equal(view.total, 2, 'the VIEW did not move');
});

test('a view change never clears the component own parts', async () => {
  const { view, component } = sources();
  followView(view, component);
  component.contribute('grid', ['tier', 'eq', 'Gold']);
  await component.load({ force: true });
  assert.equal(component.total, 2);

  view.contribute('header', ['region', 'eq', 'APAC']);
  await view.load({ force: true });
  await component.load({ force: true });
  // Still Gold, now also APAC — the view arrived as its OWN named part, so it
  // cannot overwrite what the component holds.
  assert.equal(component.total, 1);

  view.contribute('header', undefined);
  await view.load({ force: true });
  await component.load({ force: true });
  assert.equal(component.total, 2, 'the component filter survived the view being cleared');
});

test('the teardown stops the following', async () => {
  const { view, component } = sources();
  const off = followView(view, component);
  off();
  view.contribute('header', ['region', 'eq', 'EMEA']);
  await view.load({ force: true });
  await component.load({ force: true });
  assert.equal(component.total, 4, 'no longer listening');
});

/* ── Which toolbar may OFFER what ───────────────────────────────────── */

/* A scoped filter IS a `FieldFacts` — the shape the rest of the data layer
   already uses for "a field a reader may filter on". One idea, one name.
   TRAP T-one-state-per-filtered-field */
const ALL = [
  { field: 'tier', label: 'Tier' },
  { field: 'region', label: 'Region' },
  { field: 'owner', label: 'Owner' },
];

test('a field already in the VIEW is offered nowhere', () => {
  const o = offerable(ALL, { view: ['region'], component: [] });
  assert.deepEqual(o.view.map((f) => f.field), ['tier', 'owner']);
  assert.deepEqual(o.component.map((f) => f.field), ['tier', 'owner']);
});

test('a field in the COMPONENT is still offered to the view — that is promotion', () => {
  const o = offerable(ALL, { view: [], component: ['tier'] });
  assert.deepEqual(
    o.view.map((f) => f.field), ['tier', 'region', 'owner'],
    'the view may take one the component holds, which is how a filter moves UP',
  );
  assert.deepEqual(
    o.component.map((f) => f.field), ['region', 'owner'],
    'but the component does not offer it twice',
  );
});

test('one field, one home', () => {
  const o = offerable(ALL, { view: ['region'], component: ['tier'] });
  assert.deepEqual(o.view.map((f) => f.field), ['tier', 'owner']);
  assert.deepEqual(o.component.map((f) => f.field), ['owner']);
});

/* ── What moves ─────────────────────────────────────────────────────── */

/** One field's state, as the component holds it. */
const held = (field, picked, extra = {}) =>
  fieldState({ field, values: ['gold', 'silver', 'Ravi'] }, { picked, ...extra });

test('promoting carries the WHOLE state, not just the picks', () => {
  const states = { tier: held('tier', ['gold']), owner: held('owner', ['Ravi']) };
  const moved = promotions(['tier'], states);

  assert.equal(moved.length, 1);
  assert.equal(moved[0].field, 'tier');
  /* The state, not a `{ id, values }` summary: a promoted field that had
     "Starts with Go" must arrive in the view still saying that. */
  assert.deepEqual(
    moved[0].values.filter((v) => v.state === 'picked').map((v) => v.value),
    ['gold'],
  );
});

test('a TYPED condition survives the promotion', () => {
  const states = { tier: held('tier', [], { op: 'startswith', text: 'Go' }) };
  const [moved] = promotions(['tier'], states);
  assert.equal(moved.op, 'startswith');
  assert.equal(moved.text, 'Go', 'the shape that carries it, which {id,values} could not');
  assert.equal(moved.fieldState, 'active', 'and it is still filtering');
});

test('adding a field the component never held moves nothing', () => {
  assert.deepEqual(promotions(['region'], { tier: held('tier', ['gold']) }), []);
});

test('several at once, and an empty value still counts as held', () => {
  const states = { tier: held('tier', ['gold']), owner: held('owner', []) };
  const moved = promotions(['tier', 'owner'], states);
  assert.deepEqual(moved.map((s) => s.field), ['tier', 'owner']);
  // Held with nothing picked is still HELD: the chip is on that bar, and
  // promoting it must take the chip even though there is no value to carry.
  assert.equal(moved[1].fieldState, 'off');
});
