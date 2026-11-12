/**
 * A SAVED NODE IS THE READER'S, APP-WIDE (D13): a preset is a file's, read only; the reader's own
 * Custom Nodes live in the page keeper's `entities`, a NAMED part, so every tab sees them, and are
 * pushed to the app's server like a saved filter. A custom id never clashes with a preset or a
 * shipped kind, and a stored value of the wrong shape is dropped. The panel lists both. Each is kept through the doors
 * (`keepNode`, `deleteNode`; plan 942 step 2: A). Will, plan 713 §9.4, M12. TRAP T-only-a-named-part-crosses-tabs
 *
 *   node --test test/unit/a-saved-node-is-the-readers.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier, NODES_PAGE } = await import(new URL('browser/page-state.js', core));
const { deleteNode, keepNode } = await import(new URL('data/custom-nodes.js', core));
const { nodeEntityOf } = await import(new URL('data/entity.js', core));
const { NODE_KINDS, paletteOf } = await import(new URL('data/node-kinds.js', core));
const { kindsOf } = await import(new URL('data/node-library.js', core));
const { onReport } = await import(new URL('data/report.js', core));

const HAS_ROLE = {
  v: 1, label: 'Has role', category: 'Logic',
  inputs: [{ name: 'users', label: 'Users', type: 'object' }, { name: 'role', label: 'Role', type: 'value' }],
  outputs: [{ name: 'allowed', label: 'Allowed', type: 'object' }],
  nodes: [{ id: 'has-role', kind: 'condition', x: 200, y: 0, values: { type: 'eq' } }, { id: 'role', kind: 'field', x: 0, y: 0, values: { field: 'role' } }],
  // An output made from the test's True property (plan 944).
  connections: [
    { from: '#in/users', to: 'role' }, { from: 'role/field', to: 'has-role' }, { from: '#in/role', to: 'has-role/b' }, { from: 'has-role/rows', to: '#out/allowed' }, { from: 'has-role/true', to: '#out' },
  ],
};
const mine = (label) => ({ ...structuredClone(HAS_ROLE), label });
const heard = async (run) => {
  const reports = [];
  const off = onReport((r) => reports.push(r));
  try { return { result: await run(), reports }; } finally { off(); }
};

test('the keeper keeps a saved node; a second tab sees it, and so does a reload', async () => {
  const local = memoryTier();
  const first = new PageKeeper({ tab: memoryTier(), local });
  assert.deepEqual(await keepNode(first.entities, 'mine', mine('Mine')), { id: 'mine' });
  assert.ok(first.entities.library().nodes['mine']);
  const second = new PageKeeper({ tab: memoryTier(), local });
  assert.equal(second.entities.library().nodes['mine'].label, 'Mine', 'another tab: the same local tier');
  const reloaded = new PageKeeper({ tab: memoryTier(), local });
  assert.equal(reloaded.read(NODES_PAGE).entities['mine'].label, 'Mine', 'a reload');
  // Named, so it is the local tier\'s, never the tab\'s.
  assert.deepEqual(Object.keys(first.read(NODES_PAGE)).sort(), ['entities', 'v']);
});

test('a custom id may not clash with a preset or a shipped kind; a preset is never the reader\'s to remove', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  keeper.entityPresets = [nodeEntityOf('has-role', HAS_ROLE)];
  const { result } = await heard(async () => [await keepNode(keeper.entities, 'has-role', mine('Over it')), await keepNode(keeper.entities, 'value', mine('Over Value')), deleteNode(keeper.entities, 'has-role')]);
  assert.ok(result.every((r) => 'faults' in r), JSON.stringify(result));
  assert.match(result[0].faults[0], /preset, which is read only/);
  assert.deepEqual(Object.keys(keeper.read(NODES_PAGE).entities ?? {}), []);
  assert.equal(keeper.entities.library().nodes['has-role'].label, 'Has role', 'the preset, as it was');
});

test('a fault in a saved node refuses it, and says why', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const { result } = await heard(() => keepNode(keeper.entities, 'bad', { ...mine('Bad'), nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }] }));
  assert.ok(result.faults.some((f) => /nothing-like-it/.test(f)), JSON.stringify(result));
  assert.equal(keeper.read(NODES_PAGE).entities, undefined);
});

test('a stored `nodes`, the old part, is no longer read: the reader\'s nodes are its entities', async () => {
  const local = memoryTier();
  local.write('sherpa:page:#app', { v: 3, nodes: { ok: mine('Ok') }, entities: { kept: nodeEntityOf('kept', mine('Kept')) } });
  const keeper = new PageKeeper({ tab: memoryTier(), local });
  assert.deepEqual(Object.keys(keeper.read(NODES_PAGE).entities), ['kept']);
  assert.deepEqual(Object.keys(keeper.entities.library().nodes), ['kept']);
});

test('deleteNode forgets one, in every tab', async () => {
  const local = memoryTier();
  const a = new PageKeeper({ tab: memoryTier(), local });
  const b = new PageKeeper({ tab: memoryTier(), local });
  await keepNode(a.entities, 'one', mine('One'));
  await keepNode(a.entities, 'two', mine('Two'));
  assert.deepEqual(deleteNode(a.entities, 'one'), { id: 'one' });
  assert.deepEqual(Object.keys(b.entities.library().nodes), ['two']);
  assert.deepEqual(deleteNode(a.entities, 'nope'), { faults: ['there is no "nope"'] });
});

test('the keeper pushes the reader\'s nodes to the server and takes them back, under the local ones', async () => {
  const pushes = [];
  const remote = {
    pull: async (page) => (page === NODES_PAGE ? { entities: { far: nodeEntityOf('far', mine('Far')), mine: nodeEntityOf('mine', mine('Server\'s mine')), junk: { label: 3 } }, nodes: { old: mine('Old') } } : {}),
    push: async (page, named) => void pushes.push({ page, named }),
  };
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier(), remote, interval: 10 });
  await keepNode(keeper.entities, 'mine', mine('Mine'));
  await keeper.flush();
  assert.equal(pushes.length, 1);
  assert.equal(pushes[0].page, NODES_PAGE);
  assert.deepEqual(Object.keys(pushes[0].named.entities), ['mine']);
  const restored = await keeper.restore(NODES_PAGE);
  assert.deepEqual(Object.keys(restored.entities).sort(), ['far', 'mine']);
  assert.equal('nodes' in restored, false, 'a server\'s `nodes` is not read');
  assert.equal(restored.entities.mine.label, 'Mine', 'an unpushed local edit wins');
  assert.equal(keeper.entities.library().nodes['far'].label, 'Far');
});

test('the shelf tells its watchers at once', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const seen = [];
  const stop = new AbortController();
  keeper.entities.watch(() => seen.push(Object.keys(keeper.entities.library().nodes)), stop.signal);
  await keepNode(keeper.entities, 'one', mine('One'));
  stop.abort();
  await keepNode(keeper.entities, 'two', mine('Two'));
  assert.deepEqual(seen, [['one']]);
});

test('the panel lists presets read only, and the reader\'s own, in "Custom Nodes"; placing is by the id', async () => {
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  keeper.entityPresets = [nodeEntityOf('has-role', HAS_ROLE)];
  await keepNode(keeper.entities, 'mine', mine('Mine'));
  const group = paletteOf({ ...NODE_KINDS, ...kindsOf(keeper.entities.library()) }).find((g) => g.items.some((i) => i.id === 'mine'));
  // Each node picks its category: both here say "Logic" (an app's own would say its own).
  assert.ok(group.items.find((i) => i.id === 'has-role').kind.preset);
  assert.ok(!group.items.find((i) => i.id === 'mine').kind.preset);
  const custom = paletteOf({ ...NODE_KINDS, ...kindsOf({ v: 1, nodes: { bare: { ...mine('Bare'), category: undefined } } }) }).find((g) => g.category === 'Custom Nodes');
  assert.deepEqual(custom.items.map((i) => i.id), ['bare']);
});
