/**
 * A GRAPH TYPE HAS ITS OWN ACTS — plan 964 N3c: every type with a graph part, the library's and the app's, has find,
 * read, add, change and remove through the shelf, beside publish and roll back (972). A write is a Save: checked by the
 * shelf's own check, refused in its words, kept as a DRAFT. A use in a graph it is given follows a version, each node
 * stands in a stage, and a graph that gains nodes is laid out by the editor the first time it shows it. A write under the
 * reader's unsaved draft in the editor is refused, as the draft would hide it; read says the draft beside the kept copy,
 * and the warnings its nodes show.
 *
 *   node --test test/unit/a-graph-type-has-its-own-acts.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { actSchema, actsOf, checkAct, makeShelf, onReport, publish, registerEntityType, runAct, typeActs } from '../../dist/data.js';
import { SessionStore } from '../../dist/app.js';
import { draftOf } from '../../dist/core/browser/graph-drafts.js';

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
    assert.deepEqual(verbs('playbook'), ['find', 'read', 'add', 'change', 'remove', 'publish', 'roll-back', 'clone']);
    assert.deepEqual(verbs('node'), ['find', 'read', 'add', 'change', 'remove', 'publish', 'roll-back', 'clone'], 'a Custom Node too');
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
    assert.equal(await added.undo(), undefined, 'undone: no why');
    assert.equal(shelf.get('night-check'), undefined);
  });
});

test('an undo that cannot run says why, and keeps the entity: one a graph now uses stays (1008c3)', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    const added = await runAct('playbook.add', { input: { label: 'Night check', graph: body } }, ctx);
    const use = { nodes: [{ id: 'nc', kind: 'playbook:night-check', x: 0, y: 0 }], connections: [{ from: '#in/rows', to: 'nc/rows' }, { from: 'nc/found', to: '#out/found' }] };
    const user = await runAct('playbook.add', { input: { label: 'Uses it', graph: use } }, ctx);
    assert.ok(user.done, user.refused);
    const why = await added.undo();
    assert.match(why, /Uses it/);
    assert.ok(shelf.get('night-check'), 'it stays');
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

test('checkAct: why an act would be refused, before the reader is asked, in the same words; nothing is written', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf([{ ...SORTER, id: 'shipped', label: 'Shipped', origin: 'preset' }]);
    const ctx = { stores: {}, entities: shelf };
    await shelf.save(SORTER);
    const uses = { ...body, nodes: [{ id: 'use', kind: 'sorter', x: 0, y: 0 }], connections: [{ from: '#in/rows', to: 'use/rows' }, { from: 'use/found', to: '#out/found' }] };
    await runAct('playbook.add', { input: { id: 'uses', label: 'Uses it', graph: uses } }, ctx);
    // A use keeps it: refused before, in the words its run would say.
    const kept = await checkAct('node.remove', { keys: ['sorter'] }, ctx);
    assert.match(kept.refused, /^Remove: "Sorter" is used by "Uses it"/);
    assert.equal((await runAct('node.remove', { keys: ['sorter'] }, ctx)).refused, kept.refused);
    assert.ok(shelf.get('sorter'), 'nothing removed');
    assert.match((await checkAct('node.change', { keys: ['shipped'], input: { label: 'Mine' } }, ctx)).refused, /preset, which is read only/);
    assert.match((await checkAct('playbook.change', { keys: ['uses'], input: {} }, ctx)).refused, /say what to change/);
    // A body its check refuses, and one it takes: nothing is written either way.
    const loose = await checkAct('playbook.add', { input: { label: 'Loose', graph: { nodes: [{ id: 'x', kind: 'nothing-like-it', x: 0, y: 0 }], connections: [] } } }, ctx);
    assert.match(loose.refused, /^Add: .*nothing-like-it/);
    assert.deepEqual(await checkAct('playbook.add', { input: { label: 'Fine', graph: body } }, ctx), {});
    assert.deepEqual([shelf.get('loose'), shelf.get('fine')], [undefined, undefined]);
    // The door's own checks come first: no act, may it, the input.
    assert.deepEqual(await checkAct('playbook.nope', {}, ctx), { refused: 'There is no act "playbook.nope".' });
    assert.deepEqual(await checkAct('playbook.remove', { keys: ['uses'] }, { ...ctx, may: () => 'Not yours to remove.' }), { refused: 'Not yours to remove.' });
    assert.match((await checkAct('playbook.find', { input: { take: 0 } }, ctx)).refused, /How many/);
    assert.deepEqual(await checkAct('playbook.remove', { keys: ['uses'] }, ctx), {});
  });
});

test('a write under the reader\'s unsaved draft is refused, in check and run; read says the draft; other acts run', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const session = new SessionStore({});
    const ctx = { stores: {}, entities: shelf, draftOf: (id) => draftOf(session, id) };
    await runAct('playbook.add', { input: { id: 'triage', label: 'Triage', graph: body } }, ctx);
    await publish(shelf, 'triage');
    // The editor drafts it: the draft wins over the kept copy, so a write under it would be hidden.
    session.set('/workflows/triage', { v: 3, id: 'triage', nodes: [...body.nodes, { id: 'more', kind: 'organise', x: 300, y: 0 }], connections: body.connections });
    const words = 'The reader has unsaved changes to "Triage" in the Node Editor (2 nodes), and they hide any save. Ask the reader to Save or discard them first.';
    const calls = {
      'playbook.change': { keys: ['triage'], input: { description: 'New.' } },
      'playbook.remove': { keys: ['triage'] },
      'playbook.publish': { keys: ['triage'] },
      'playbook.roll-back': { keys: ['triage'], input: { version: 1 } },
    };
    for (const [id, call] of Object.entries(calls)) {
      assert.deepEqual(await checkAct(id, call, ctx), { refused: words }, id);
      assert.deepEqual(await runAct(id, call, ctx), { refused: words }, id);
    }
    assert.equal(shelf.get('triage').description, undefined, 'nothing written');
    // Read says what the reader sees, beside the kept copy, each as text too; find, add and clone run.
    const read = (await runAct('playbook.read', { keys: ['triage'] }, ctx)).result;
    assert.deepEqual([read.graph.nodes.length, read.unsavedInTheEditor.nodes, read.unsavedInTheEditor.connections], [1, 2, 2]);
    assert.ok(read.text.length && read.unsavedInTheEditor.text.length > 0, JSON.stringify(read.text));
    assert.equal((await runAct('playbook.find', {}, ctx)).result.total, 1);
    assert.match((await runAct('playbook.clone', { keys: ['triage'] }, ctx)).done, /your own copy/);
    // Saved or discarded, the draft goes, and the write runs.
    session.set('/workflows/triage', undefined);
    assert.equal((await runAct('playbook.change', calls['playbook.change'], ctx)).done, 'Changed Playbook "Triage".');
    assert.equal('unsavedInTheEditor' in (await runAct('playbook.read', { keys: ['triage'] }, ctx)).result, false);
  });
});

test('read gives the warnings its nodes show, each by its node and row: soft, never a refusal; none, none', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    const graph = { ...body, nodes: [...body.nodes, { id: 'm', kind: 'model', x: 300, y: 0 }] };
    assert.equal((await runAct('playbook.add', { input: { id: 'asks', label: 'Asks', graph } }, ctx)).done, 'Added Playbook "Asks".');
    assert.deepEqual((await runAct('playbook.read', { keys: ['asks'] }, ctx)).result.warnings, [
      { node: 'm', row: 'provider', words: 'Pick a provider' },
      { node: 'm', row: 'model', words: 'Pick a model' },
    ]);
    await runAct('playbook.add', { input: { id: 'calm', label: 'Calm', graph: body } }, ctx);
    assert.deepEqual((await runAct('playbook.read', { keys: ['calm'] }, ctx)).result.warnings, []);
  });
});

test('a graph type\'s keys are read on the shelf, the truth, though a store made over it has not heard the change yet', async () => {
  await withPlaybook(async () => {
    const shelf = shelfOf();
    // A store of its type that hears the shelf a moment later: it holds nothing yet.
    const lagging = { type: 'playbook', byKey: async () => undefined };
    const ctx = { stores: { playbook: lagging }, entities: shelf };
    await runAct('playbook.add', { input: { id: 'fresh', label: 'Fresh', graph: body } }, ctx);
    assert.equal((await runAct('playbook.change', { keys: ['fresh'], input: { description: 'At once.' } }, ctx)).done, 'Changed Playbook "Fresh".');
    assert.deepEqual(await runAct('playbook.read', { keys: ['gone'] }, ctx), { refused: 'There is no Playbook "gone".' });
  });
});

test('read says a loop by each graph\'s name, as the editor draws it, never by its id', async () => {
  const stop = onReport(() => {});
  const off = registerEntityType({ v: 1, id: 'coworker', label: 'Coworker', graph: { runs: true } });
  try {
    const shelf = shelfOf();
    const ctx = { stores: {}, entities: shelf };
    // It makes the event its own Trigger hears: it starts itself.
    const graph = { nodes: [{ id: 't', kind: 'trigger', x: 0, y: 0, values: { type: 'ui', event: 'again' } }, { id: 'o', kind: 'output-trigger', x: 400, y: 0, values: { type: 'ui', event: 'again' } }], connections: [{ from: 't', to: '#start' }] };
    assert.equal((await runAct('coworker.add', { input: { id: 'loop', label: 'Loop it', graph } }, ctx)).done, 'Added Coworker "Loop it".', 'a loop still saves');
    assert.deepEqual((await runAct('coworker.read', { keys: ['loop'] }, ctx)).result.warnings, [{ node: 'o', words: 'Blocked: it would start a loop, Loop it › Loop it' }]);
  } finally {
    off?.();
    stop();
  }
});
