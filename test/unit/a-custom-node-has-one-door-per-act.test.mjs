/**
 * A CUSTOM NODE HAS ONE DOOR PER ACT (Will, plan 942; D1 A, D2 A). A Custom Node is an entity; createNode, readNode,
 * updateNode and deleteNode are the one way to make, read, change and forget one, for the editor, an MCP tool and an app's
 * assistant alike. Each checks as Save checks and answers in words. A TYPE comes as JSON — an entities file's `types` — and
 * fixes its category and sockets; its category is read one way: the entity's own, its settings', its type's.
 *
 *   node --test test/unit/a-custom-node-has-one-door-per-act.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { createNode, readNode, updateNode, deleteNode } = await import(new URL('custom-nodes.js', core));
const { makeShelf } = await import(new URL('entity-shelf.js', core));
const { categoryOf } = await import(new URL('entity.js', core));
const { entityTypes } = await import(new URL('entity-types.js', core));
const { readEntities } = await import(new URL('../browser/entity-files.js', core));
const { onReport } = await import(new URL('report.js', core));

/** A shelf over memory: no presets but those given, the reader's own kept here. */
const shelfOf = (presets = []) => {
  let mine = {};
  return makeShelf({ presets: () => presets, mine: () => mine, keep: (next) => { mine = next; }, heard: () => {} });
};
const body = { nodes: [{ id: 'sort', kind: 'sort', x: 0, y: 0 }], connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: '#out/found' }] };
const sockets = { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'found', label: 'Found', type: 'object' }] };
const quiet = () => onReport(() => {});

test('createNode keeps a Custom Node from its JSON, a node when it names no type, its id from its name; refuses in words', async () => {
  const stop = quiet();
  try {
    const shelf = shelfOf();
    assert.deepEqual(await createNode(shelf, { label: 'Sorted users', graph: body, settings: sockets }), { id: 'sorted-users' });
    assert.equal(shelf.get('sorted-users').type, 'node');
    assert.deepEqual(await createNode(shelf, JSON.stringify({ label: 'Sorted users', graph: body, settings: sockets })), { id: 'sorted-users-2' }, 'a taken id gets a free one');
    assert.deepEqual(await createNode(shelf, '{ nope'), { faults: ['it is not JSON'] });
    assert.deepEqual(await createNode(shelf, { graph: body }), { faults: ['it has no name: give it a label'] });
    const bad = await createNode(shelf, { label: 'Loose', graph: { nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }] }, settings: { inputs: [], outputs: [] } });
    assert.ok('faults' in bad && bad.faults.some((f) => /nothing-like-it/.test(f)), JSON.stringify(bad));
    assert.equal(shelf.get('loose'), undefined, 'a refused node is not kept');
  } finally {
    stop();
  }
});

test('readNode gives the entity and the node it offers; updateNode changes the reader\'s own, never a preset; deleteNode forgets', async () => {
  const stop = quiet();
  try {
    const preset = { v: 2, type: 'node', id: 'shipped', label: 'Shipped', origin: 'preset', graph: body, settings: sockets };
    const shelf = shelfOf([preset]);
    await createNode(shelf, { id: 'mine', label: 'Mine', graph: body, settings: sockets });
    const read = readNode(shelf, 'mine');
    assert.deepEqual([read.entity.id, read.node.label, read.node.inputs.map((i) => i.name)], ['mine', 'Mine', ['rows']]);
    // A socket renamed alone leaves its graph's connection with nothing to come from: refused in words, nothing kept.
    const renamed = { inputs: [{ name: 'people', label: 'People', type: 'object' }] };
    assert.deepEqual(await updateNode(shelf, 'mine', renamed), { faults: ['Mine: a connection leaves "#in/rows", which is no output socket'] });
    assert.equal(shelf.get('mine').settings.inputs[0].name, 'rows');
    const graph = { ...body, connections: body.connections.map((c) => (c.from === '#in/rows' ? { ...c, from: '#in/people' } : c)) };
    assert.deepEqual(await updateNode(shelf, 'mine', { label: 'Mine, renamed', category: 'Runbooks', ...renamed, graph }), { id: 'mine' });
    assert.deepEqual([shelf.get('mine').label, shelf.get('mine').category, shelf.get('mine').settings.inputs[0].name], ['Mine, renamed', 'Runbooks', 'people']);
    assert.deepEqual(await updateNode(shelf, 'shipped', { label: 'No' }), { faults: ['"shipped" is a preset, which is read only: copy it to change it'] });
    assert.deepEqual(await updateNode(shelf, 'gone', { label: 'No' }), { faults: ['there is no "gone"'] });
    assert.deepEqual(deleteNode(shelf, 'shipped').faults[0], '"shipped" is a preset, which is read only.');
    assert.deepEqual(deleteNode(shelf, 'mine'), { id: 'mine' });
    assert.equal(shelf.get('mine'), undefined);
  } finally {
    stop();
  }
});

test('a type as JSON — an entities file\'s types — fixes its category and sockets; a node of it keeps them; its category reads one way', async () => {
  const stop = quiet();
  try {
    const file = {
      v: 2,
      types: { playbook: { label: 'Playbook', icon: 'book-open-lines', category: 'Runbooks', ...sockets } },
      entities: { triage: { v: 2, type: 'playbook', id: 'triage', label: 'Triage', graph: body } },
    };
    assert.deepEqual(schemaCheck('entities.v2.json')(file), []);
    const read = readEntities(file);
    assert.deepEqual(Object.keys(read.entities), ['triage']);
    assert.equal(entityTypes().playbook.category, 'Runbooks');
    const shelf = shelfOf(Object.values(read.entities).map((e) => ({ ...e, origin: 'preset' })));
    assert.equal(readNode(shelf, 'triage').node.category, 'Runbooks', 'its type\'s');
    assert.deepEqual(await createNode(shelf, { type: 'playbook', label: 'Mine', graph: body }), { id: 'mine' });
    assert.deepEqual(await updateNode(shelf, 'mine', { outputs: [] }), { faults: ['a playbook\'s sockets are its type\'s: they do not change'] });
    // One way: the entity's own, then its settings', then its type's.
    assert.deepEqual([categoryOf({ category: 'A', settings: { category: 'B' } }), categoryOf({ settings: { category: 'B' } }), categoryOf({})], ['A', 'B', undefined]);
  } finally {
    stop();
  }
});
