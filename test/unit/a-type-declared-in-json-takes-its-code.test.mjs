/**
 * A TYPE DECLARED IN JSON TAKES ITS CODE (plan 964 N3c): an app adds what JSON cannot say — a settings check, the settings
 * a new one starts with — to a type its entities file declares, before or after the type comes. The shelf's check runs it
 * on every Save, from any door. A shipped type, or a second code for one type, is refused; taken back, the check goes.
 *
 *   node --test test/unit/a-type-declared-in-json-takes-its-code.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { entityTypes, makeShelf, onReport, registerEntityType, registerTypeCode, runAct } from '../../dist/data.js';

const sockets = { inputs: [{ name: 'rows', label: 'Rows', type: 'object' }], outputs: [{ name: 'found', label: 'Found', type: 'object' }] };
/** A type as an entities file declares it: JSON, no code. */
const PLAYBOOK = { v: 1, id: 'playbook', label: 'Playbook', category: 'Runbooks', graph: sockets };
const body = { nodes: [{ id: 'sort', kind: 'organise', x: 0, y: 0, values: { sort: 'name' } }], connections: [{ from: '#in/rows', to: 'sort' }, { from: 'sort/rows', to: '#out/found' }] };
/** The app's code: a prompt's reference names a field it has, or a node of the entity's own graph. */
const CODE = {
  settingsFaults: (s, entity) => [...String(s.prompt ?? '').matchAll(/\{\{(field|node):([^}]+)\}\}/g)]
    .filter(([, kind, id]) => (kind === 'field' ? id !== 'health' : !entity.graph.nodes.some((n) => n.id === id)))
    .map(([ref]) => `its prompt names ${ref}, which names nothing`),
  defaults: { prompt: '' },
};

const shelfOf = () => {
  let mine = {};
  return makeShelf({ presets: () => [], mine: () => mine, keep: (next) => { mine = next; }, heard: () => {} });
};

/** An add of a playbook whose prompt names this field, and this node. */
const adding = (field, node = 'sort') => ({ input: { label: `Says ${field} ${node}`, settings: { prompt: `Check {{field:${field}}} after {{node:${node}}}.` }, graph: body } });

/** Every Save of this type checked by the app's code: one that names nothing refused in its words, one that names a field kept. */
async function checked() {
  const shelf = shelfOf();
  const ctx = { stores: {}, entities: shelf };
  const bad = await runAct('playbook.add', adding('helth'), ctx);
  assert.match(bad.refused ?? '', /^Add: .*its prompt names \{\{field:helth\}\}, which names nothing/);
  // The whole entity comes to the check: a reference is read against its own graph.
  assert.match((await runAct('playbook.add', adding('health', 'nope'), ctx)).refused ?? '', /its prompt names \{\{node:nope\}\}, which names nothing/);
  assert.deepEqual(shelf.list('playbook'), [], 'nothing kept');
  assert.equal((await runAct('playbook.add', adding('health'), ctx)).done, 'Added Playbook "Says health sort".');
  return shelf;
}

test('the code comes first, the JSON type after: merged, and every Save runs its check', async () => {
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  const offCode = registerTypeCode('playbook', CODE);
  const offType = registerEntityType(PLAYBOOK);
  try {
    assert.deepEqual([entityTypes().playbook.label, entityTypes().playbook.defaults], ['Playbook', { prompt: '' }]);
    assert.equal(entityTypes().playbook, entityTypes().playbook, 'one object, as a check reads it');
    await checked();
  } finally {
    offType?.();
    offCode?.();
    stop();
  }
  assert.equal(entityTypes().playbook, undefined);
});

test('the JSON type first, its code after; taken back, the check goes and the type is its JSON again', async () => {
  const stop = onReport(() => {});
  const offType = registerEntityType(PLAYBOOK);
  try {
    assert.equal(entityTypes().playbook, PLAYBOOK, 'no code: the type as it came');
    const offCode = registerTypeCode('playbook', CODE);
    await checked();
    offCode();
    assert.equal(entityTypes().playbook, PLAYBOOK);
    const shelf = shelfOf();
    assert.equal((await runAct('playbook.add', adding('helth'), { stores: {}, entities: shelf })).done, 'Added Playbook "Says helth sort".');
  } finally {
    offType?.();
    stop();
  }
});

test('a shipped type\'s code is its own, and a type takes one code: each refused and reported', () => {
  const said = [];
  const stop = onReport((r) => said.push(r.message));
  const off = registerTypeCode('playbook', CODE);
  try {
    assert.equal(registerTypeCode('node', CODE), undefined);
    assert.equal(registerTypeCode('playbook', { defaults: {} }), undefined);
    assert.equal(registerTypeCode('', CODE), undefined);
  } finally {
    off?.();
    stop();
  }
  assert.deepEqual(said, [
    'registerTypeCode: "node" is a type the library ships, whose code is its own.',
    'registerTypeCode: "playbook" has its code already: take that back first.',
    'registerTypeCode: give it the id of a type.',
  ]);
});
