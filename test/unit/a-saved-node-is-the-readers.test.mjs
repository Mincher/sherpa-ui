/**
 * A SAVED NODE IS THE READER'S, APP-WIDE (D13): a preset is a file's, read only; the reader's own
 * Custom Nodes live in the page keeper's `nodes`, a NAMED part, so every tab sees them, and are
 * pushed to the app's server like a saved filter. A custom id never clashes with a preset or a
 * shipped kind, and a stored value of the wrong shape is dropped. The panel lists both.
 * Will, plan 713 §9.4, M12. TRAP T-only-a-named-part-crosses-tabs
 *
 *   node --test test/unit/a-saved-node-is-the-readers.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier, NODES_PAGE } = await import(new URL('browser/page-state.js', core));
const { joinLibrary } = await import(new URL('data/node-shelf.js', core));
const { readLibrary } = await import(new URL('browser/node-files.js', core));
const { NODE_KINDS, paletteOf } = await import(new URL('data/node-kinds.js', core));
const { kindsOf } = await import(new URL('data/node-library.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const HAS_ROLE = {
  v: 1, label: 'Has role', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'has-role', kind: 'condition', x: 0, y: 0, values: { field: 'role', op: 'eq' } }],
  routes: [{ from: '#in/users', to: 'has-role' }, { from: '#in/role', to: 'has-role/value' }, { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role', to: '#out' }],
};
const mine = (label) => ({ ...structuredClone(HAS_ROLE), label });
const heard = async (run) => {
  const reports = [];
  const off = onReport((r) => reports.push(r));
  try { return { result: await run(), reports }; } finally { off(); }
};

test('loading: a valid file is all presets; a bad one is reported in the checks\' words and the rest load', async () => {
  const { result, reports } = await heard(() => readLibrary({
    v: 1, nodes: {
      'no-name': { v: 1, label: '', inputs: [], outputs: [], nodes: [] },
      value: mine('Clash with a shipped kind'),
      'bad-body': { ...mine('Bad body'), nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }] },
      // Defined BEFORE the one it uses: it is tried again once that one is in.
      'after-it': { ...mine('Uses another'), nodes: [{ id: 'u', kind: 'has-role', x: 0, y: 0 }],
        routes: [{ from: '#in/users', to: 'u/users' }, { from: '#in/role', to: 'u/role' }, { from: 'u/allowed', to: '#out/allowed' }, { from: 'u', to: '#out' }] },
      'has-role': HAS_ROLE,
    },
  }, NODE_KINDS, { preset: true }));
  assert.deepEqual(Object.keys(result.nodes).sort(), ['after-it', 'has-role']);
  assert.ok(Object.values(result.nodes).every((d) => d.preset === true), 'each preset is read only');
  const said = reports.map((r) => r.message).join('\n');
  assert.match(said, /"no-name" is left out/);
  assert.match(said, /shipped/, 'a clash with a shipped kind is refused');
  assert.match(said, /"bad-body" is left out/);
  assert.ok(reports.every((r) => r.code === 'node-library'));
});

test('loading: a file that is no library answers an empty one, and says so', async () => {
  const { result, reports } = await heard(() => readLibrary([1, 2]));
  assert.deepEqual(result, { v: 1, nodes: {} });
  assert.equal(reports.length, 1);
});

test('the keeper keeps a saved node; a second tab sees it, and so does a reload', async () => {
  const local = memoryTier();
  const first = new PageKeeper({ tab: memoryTier(), local });
  assert.equal(await first.saveNode('mine', mine('Mine')), true);
  assert.ok(first.nodeLibrary().nodes['mine']);
  const second = new PageKeeper({ tab: memoryTier(), local });
  assert.equal(second.nodeLibrary().nodes['mine'].label, 'Mine', 'another tab: the same local tier');
  const reloaded = new PageKeeper({ tab: memoryTier(), local });
  assert.equal(reloaded.read(NODES_PAGE).nodes['mine'].label, 'Mine', 'a reload');
  // Named, so it is the local tier\'s, never the tab\'s.
  assert.deepEqual(Object.keys(first.read(NODES_PAGE)).sort(), ['nodes', 'v']);
});

test('a custom id may not clash with a preset or a shipped kind; a preset is never the reader\'s to remove', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  keeper.presets = readLibrary({ v: 1, nodes: { 'has-role': HAS_ROLE } }, NODE_KINDS, { preset: true });
  const { result, reports } = await heard(async () => [await keeper.saveNode('has-role', mine('Over it')), await keeper.saveNode('value', mine('Over Value')), keeper.removeNode('has-role')]);
  assert.deepEqual(result, [false, false, false]);
  assert.equal(reports.length >= 3, true);
  assert.deepEqual(Object.keys(keeper.read(NODES_PAGE).nodes ?? {}), []);
  // And the join leaves a stored clash out, so a custom node overrides nothing.
  const joined = joinLibrary(keeper.presets, { 'has-role': mine('Over it'), ok: mine('Ok') });
  assert.equal(joined.nodes['has-role'].label, 'Has role');
  assert.equal(joined.nodes['has-role'].preset, true);
  assert.equal(joined.nodes['ok'].label, 'Ok');
});

test('a fault in a saved node refuses it, and says why', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const { result, reports } = await heard(() => keeper.saveNode('bad', { ...mine('Bad'), nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }] }));
  assert.equal(result, false);
  assert.ok(reports.some((r) => r.code === 'node-library'));
  assert.equal(keeper.read(NODES_PAGE).nodes, undefined);
});

test('the persist guard drops a stored node of the wrong shape, and a preset smuggled in as the reader\'s', async () => {
  const local = memoryTier();
  local.write('sherpa:page:#app', { v: 3, nodes: { ok: mine('Ok'), wrong: { label: 'No lists' }, old: { ...mine('Old'), v: 2 }, sneaky: { ...mine('Sneaky'), preset: true } } });
  const keeper = new PageKeeper({ tab: memoryTier(), local });
  assert.deepEqual(Object.keys(keeper.read(NODES_PAGE).nodes), ['ok']);
});

test('removeNode forgets one, in every tab', async () => {
  const local = memoryTier();
  const a = new PageKeeper({ tab: memoryTier(), local });
  const b = new PageKeeper({ tab: memoryTier(), local });
  await a.saveNode('one', mine('One'));
  await a.saveNode('two', mine('Two'));
  assert.equal(a.removeNode('one'), true);
  assert.deepEqual(Object.keys(b.nodeLibrary().nodes), ['two']);
  assert.equal(a.removeNode('nope'), false);
});

test('the keeper pushes the reader\'s nodes to the server and takes them back, under the local ones', async () => {
  const pushes = [];
  const remote = {
    pull: async (page) => (page === NODES_PAGE ? { nodes: { far: mine('Far'), mine: mine('Server\'s mine'), junk: { label: 3 } } } : {}),
    push: async (page, named) => void pushes.push({ page, named }),
  };
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier(), remote, interval: 10 });
  await keeper.saveNode('mine', mine('Mine'));
  await keeper.flush();
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].page, NODES_PAGE);
  assert.deepEqual(Object.keys(pushes[0].named.nodes), ['mine']);
  const restored = await keeper.restore(NODES_PAGE);
  assert.deepEqual(Object.keys(restored.nodes).sort(), ['far', 'mine']);
  assert.equal(restored.nodes.mine.label, 'Mine', 'an unpushed local edit wins');
  assert.equal(keeper.nodeLibrary().nodes['far'].label, 'Far');
});

test('the shelf tells its watchers at once', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const seen = [];
  const stop = new AbortController();
  keeper.shelf.watch((library) => seen.push(Object.keys(library.nodes)), stop.signal);
  await keeper.shelf.save('one', mine('One'));
  stop.abort();
  await keeper.shelf.save('two', mine('Two'));
  assert.deepEqual(seen, [['one']]);
});

test('the panel lists presets read only, and the reader\'s own, in "Custom Nodes"; placing is by the id', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  keeper.presets = readLibrary({ v: 1, nodes: { 'has-role': HAS_ROLE } }, NODE_KINDS, { preset: true });
  await keeper.saveNode('mine', mine('Mine'));
  const group = paletteOf({ ...NODE_KINDS, ...kindsOf(keeper.nodeLibrary()) }).find((g) => g.items.some((i) => i.id === 'mine'));
  // Each node picks its category: both here say "Logic" (an app's own would say its own).
  assert.ok(group.items.find((i) => i.id === 'has-role').kind.preset);
  assert.ok(!group.items.find((i) => i.id === 'mine').kind.preset);
  const custom = paletteOf({ ...NODE_KINDS, ...kindsOf(joinLibrary(undefined, { bare: { ...mine('Bare'), category: undefined } })) }).find((g) => g.category === 'Custom Nodes');
  assert.deepEqual(custom.items.map((i) => i.id), ['bare']);
});
