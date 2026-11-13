/**
 * A GRAPH TYPE HAS ITS OWN ACTS — plan 964 N3c: every type with a graph part, the library's and the app's, has find,
 * read, add, change and remove through the shelf, beside publish and roll back (972). A write is a Save: checked by the
 * shelf's own check, refused in its words, kept as a DRAFT. A use in a graph it is given follows a version, each node
 * stands in a stage, and a graph that gains nodes is laid out by the editor the first time it shows it.
 *
 *   node --test test/unit/a-graph-type-has-its-own-acts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { actSchema, actsOf, makeShelf, onReport, publish, registerEntityType, runAct, typeActs } from '../../dist/data.js';

const sockets = { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'found', label: 'Found', type: 'object' }] };
const PLAYBOOK = { v: 1, id: 'playbook', label: 'Playbook', category: 'Runbooks', graph: sockets };
const body = { nodes: [{ id: 'sort', kind: 'organise', x: 0, y: 0, values: { sort: 'name' } }], connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: '#out/found' }] };
/** A Custom Node the playbooks place: rows in, rows out. */
const SORTER = { v: 3, type: 'node', id: 'sorter', label: 'Sorter', graph: body, settings: sockets };

/** A shelf over memory: no presets but those given, the reader's own kept here. */
const shelfOf = (presets = []) => {
  let mine = {};
  return makeShelf({ presets: () => presets, mine: () => mine, keep: (next) => { mine = next; }, heard: () => {} });
};

/** The type registered for one test, its reports kept; both taken back after. */
async function withPlaybook(run) {
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  const off = registerEntityType(PLAYBOOK);
  try {
    await run(said);
  } finally {
    off?.();
    stop();
  }
}

test('every graph type has its own acts, made from the registry: the library\'s and the app\'s', async () => {
  await withPlaybook(async () => {
    const verbs = (type) => actsOf({ type }).map((a) => a.id.slice(type.length + 1));
    assert.deepEqual(verbs('playbook'), ['find', 'read', 'add', 'change', 'remove', 'publish', 'roll-back']);
    assert.deepEqual(verbs('node'), ['find', 'read', 'add', 'change', 'remove', 'publish', 'roll-back'], 'a Custom Node too');
    assert.deepEqual(typeActs(PLAYBOOK).map((a) => a.id), actsOf({ type: 'playbook' }).map((a) => a.id), 'typeActs gives a graph type the same');
    const add = actsOf({ type: 'playbook' }).find((a) => a.id === 'playbook.add');
    const input = (await actSchema(add)).properties.input;
    assert.deepEqual([input.properties.graph.type, input.properties.settings.type, input.required], ['object', 'object', ['label']]);
  });
});

test('add: checked by the shelf\'s own check and refused in its words; kept as a draft at version 1, laid out when shown', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    const loose = await runAct('playbook.add', { input: { label: 'Loose', graph: { nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }], connections: [] } } }, ctx);
    assert.match(loose.refused, /^Add: .*nothing-like-it/);
    assert.equal(shelf.get('loose'), undefined, 'nothing kept');
    const added = await runAct('playbook.add', { input: { label: 'Night check', tags: 'ops, nightly', graph: body } }, ctx);
    assert.deepEqual([added.done, added.result], ['Added Playbook "Night check".', { id: 'night-check' }]);
    const kept = shelf.get('night-check');
    assert.deepEqual([kept.tags, kept.versions.map((v) => v.number), kept.graph.unfurl], [['ops', 'nightly'], [1], true]);
    await added.undo();
    assert.equal(shelf.get('night-check'), undefined);
  });
});

test('change: a draft, its versions kept; a use follows a version; nodes staged; its undo puts it back', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    assert.equal(await shelf.save(SORTER), true);
    await runAct('playbook.add', { input: { id: 'triage', label: 'Triage', graph: body } }, ctx);
    const stages = [{ id: 'one', label: 'One', x: 0 }, { id: 'two', label: 'Two', x: 600 }];
    const graph = {
      nodes: [{ id: 'sort', kind: 'organise', x: 0, y: 0, values: { sort: 'name' } }, { id: 'use', kind: 'sorter', x: 700, y: 0 }],
      connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: 'use/rows' }, { from: 'use/found', to: '#out/found' }],
      stages,
    };
    const changed = await runAct('playbook.change', { keys: ['triage'], input: { graph, description: 'Sort, then sort again.' } }, ctx);
    assert.equal(changed.done, 'Changed Playbook "Triage".', changed.refused);
    const now = shelf.get('triage');
    const use = now.graph.nodes.find((n) => n.id === 'use');
    assert.deepEqual([use.version, use.stage, now.graph.nodes[0].stage], [1, 'two', 'one'], 'the use follows version 1; each node in its stage');
    assert.equal(now.graph.unfurl, true, 'it gained a node');
    assert.deepEqual(now.versions.map((v) => v.number), [1], 'a change is a draft: no version made');
    const read = await runAct('playbook.read', { keys: ['triage'] }, ctx);
    assert.deepEqual([read.result.description, read.result.versions.map((v) => v.number), 'definition' in read.result.versions[0]], ['Sort, then sort again.', [1], false]);
    assert.equal((await publish(shelf, 'triage')).number, 2);
    await changed.undo();
    assert.deepEqual([shelf.get('triage').description, shelf.get('triage').versions.map((v) => v.number)], [undefined, [2, 1]], 'its draft back, its versions kept');
    assert.match((await runAct('playbook.change', { keys: ['triage'], input: {} }, ctx)).refused, /say what to change/);
  });
});

test('find by search and tag; remove refused while another uses it, then removed and put back with its versions', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    await shelf.save(SORTER);
    await runAct('playbook.add', { input: { id: 'uses', label: 'Uses it', tags: ['ops'], graph: { ...body, nodes: [{ id: 'use', kind: 'sorter', x: 0, y: 0 }], connections: [{ from: '#in/rows', to: 'use/rows' }, { from: 'use/found', to: '#out/found' }] } } }, ctx);
    await runAct('playbook.add', { input: { label: 'Other', graph: body } }, ctx);
    const found = await runAct('playbook.find', { input: { tag: 'ops' } }, ctx);
    assert.deepEqual(found.result.rows.map((r) => [r.id, r.version, r.changed, r.origin]), [['uses', 1, false, 'mine']]);
    assert.equal((await runAct('playbook.find', { input: { search: 'other' } }, ctx)).result.total, 1);
    assert.match((await runAct('node.remove', { keys: ['sorter'] }, ctx)).refused, /^Remove: "Sorter" is used by "Uses it"/);
    const removed = await runAct('playbook.remove', { keys: ['uses', 'other'] }, ctx);
    assert.equal(removed.done, 'Removed 2 of Playbook.');
    assert.deepEqual(shelf.list('playbook'), []);
    await removed.undo();
    assert.deepEqual(shelf.list('playbook').map((s) => s.id), ['uses', 'other']);
    assert.deepEqual(shelf.get('uses').versions.map((v) => v.number), [1]);
  });
});
