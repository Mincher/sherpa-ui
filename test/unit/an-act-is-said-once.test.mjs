/**
 * AN ACT IS SAID ONCE — Will, plan 964 D1 A (docs/history/plan-964-n1-acts.md): every act an app can do is said once —
 * its id, words, target, input, whether it changes data, where a press offers it, its run — and runs through ONE door,
 * which checks a call by its type's rules and answers in words, never throwing. Every type gives its own acts (find,
 * read, add, change, remove) through its store; a reference names a row of another type.
 *
 *   node --test test/unit/an-act-is-said-once.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import {
  ArrayStore, actSchema, actsOf, entityStore, makeShelf, onReport, registerAct, registerEntityType, runAct, storeOfType,
  typeActs, typeFaults, typeStoreOptions,
} from '../../dist/data.js';
const { statusFields } = await import('../../dist/core/data/status-field.js');
const { START } = await import('../../dist/core/data/node-start.js');

const ROLE = { v: 1, id: 'role', label: 'Role', title: 'name', fields: { id: {}, name: { label: 'Name', required: true } } };
const USER = {
  v: 1, id: 'user', label: 'User', fields: {
    id: {}, name: { label: 'Name', required: true, min: 2 }, email: { label: 'Email', format: 'email' },
    status: { label: 'Status', values: ['active', 'invited', 'suspended'] }, roles: { label: 'Roles', ref: 'role', many: true },
  },
};
const rolesStore = () => new ArrayStore([{ id: 'admin', name: 'Admin' }, { id: 'reader', name: 'Reader' }], typeStoreOptions(ROLE));
const usersStore = () => new ArrayStore([
  { id: 'u1', name: 'Ana', email: 'ana@x.io', status: 'active', roles: ['reader'] },
  { id: 'u2', name: 'Bo', email: 'bo@x.io', status: 'invited', roles: [] },
], typeStoreOptions(USER));
const quiet = (said = []) => onReport((r) => said.push(r));

/** Each type registered, and the acts registered, for one test; all taken back after. */
async function withActs(acts, run) {
  const offs = [registerEntityType(ROLE), registerEntityType(USER), ...acts.map(registerAct)];
  try {
    await run();
  } finally {
    for (const off of offs) off?.();
  }
}

/** Assign a role: the app's own act on a user, its input a reference to a role. */
const assignRole = {
  id: 'user.assign-role', label: 'Assign role', type: 'user', many: true, changes: true,
  input: { role: { label: 'Role', ref: 'role', required: true } },
  async run(call, ctx) {
    const store = ctx.stores.user;
    const before = [];
    for (const key of call.keys) {
      const row = await store.byKey(key);
      before.push(row.roles);
      await store.update(key, { roles: [...new Set([...row.roles, call.input.role])] });
    }
    return { done: `Gave ${call.keys.length} the role.`, undo: async () => { for (const [i, key] of call.keys.entries()) await store.update(key, { roles: before[i] }); } };
  },
};

test('a type may name a row of another type: ref, many with ref or values, and a title that names a row', () => {
  assert.deepEqual(typeFaults(USER), []);
  assert.deepEqual(typeFaults(ROLE), []);
  const bad = (field) => typeFaults({ v: 1, id: 'x', label: 'X', fields: { id: {}, f: field } }).join('\n');
  assert.match(bad({ ref: 'Role X' }), /its ref is a type's id/);
  assert.match(bad({ ref: 'role', type: 'number' }), /a reference is text/);
  assert.match(bad({ many: true }), /only a reference or a set of values holds many/);
  assert.match(typeFaults({ ...ROLE, title: 'nope' }).join('\n'), /its title, "nope", is no field/);
});

test('an act is registered once, refused in words when it is none or its id is taken; acts are listed where they apply', async () => {
  const said = [];
  const stop = quiet(said);
  const offs = [];
  try {
    offs.push(registerAct(assignRole));
    assert.equal(registerAct(assignRole), undefined, 'its id is taken');
    assert.equal(registerAct({ id: 'Bad Id', label: 'X', changes: false, run: async () => ({ done: '' }) }), undefined);
    assert.equal(registerAct({ id: 'x.y', label: 'X', changes: false, input: { f: { many: true } }, run: async () => ({ done: '' }) }), undefined);
    const page = { id: 'devices.export', label: 'Export', changes: false, where: { contexts: ['devices'] }, run: async () => ({ done: 'ok' }) };
    offs.push(registerAct(page));
    assert.deepEqual(actsOf({ context: 'users', type: 'user' }).map((a) => a.id), ['user.assign-role']);
    assert.deepEqual(actsOf({ context: 'devices', type: 'device' }).map((a) => a.id), ['devices.export']);
    assert.deepEqual(actsOf({ type: 'user' }).map((a) => a.id), ['user.assign-role']);
    assert.ok(actsOf().length >= 2, 'asked with nothing, every act: the chat runs any');
  } finally {
    stop();
    for (const off of offs) off?.();
  }
  const words = said.map((r) => r.message).join('\n');
  assert.match(words, /its id, "user.assign-role", is another act's/);
  assert.match(words, /its id is `<type>.<verb>`/);
  assert.match(words, /its input f: only a reference or a set of values holds many/);
});

test('one door: a call is checked by its type\'s rules and its references, run, answered in words, and undone', async () => {
  await withActs([assignRole], async () => {
    const ctx = { stores: { user: usersStore(), role: rolesStore() } };
    assert.deepEqual(await runAct('user.nope', {}, ctx), { refused: 'There is no act "user.nope".' });
    assert.deepEqual(await runAct('user.assign-role', { keys: ['u9'], input: { role: 'admin' } }, ctx), { refused: 'There is no User "u9".' });
    assert.match((await runAct('user.assign-role', { keys: ['u1'], input: { role: 'owner' } }, ctx)).refused, /"owner" is no Role/);
    assert.match((await runAct('user.assign-role', { keys: ['u1'] }, ctx)).refused, /it needs Role/);
    assert.match((await runAct('user.assign-role', { keys: ['u1'], input: { role: 'admin', colour: 'red' } }, ctx)).refused, /it takes no "colour"/);
    const done = await runAct('user.assign-role', { keys: ['u1', 'u2'], input: { role: 'admin' } }, ctx);
    assert.equal(done.done, 'Gave 2 the role.');
    assert.deepEqual((await ctx.stores.user.byKey('u1')).roles, ['reader', 'admin']);
    await done.undo();
    assert.deepEqual((await ctx.stores.user.byKey('u1')).roles, ['reader']);
    const thrown = { id: 'user.boom', label: 'Boom', type: 'user', changes: false, run: async () => { throw new Error('It broke, in words.'); } };
    const off = registerAct(thrown);
    assert.deepEqual(await runAct('user.boom', { keys: ['u1'] }, ctx), { refused: 'It broke, in words.' });
    off();
  });
});

test('an act\'s call as JSON Schema: its keys, and its input by its fields, a reference\'s choices its type\'s rows by title', async () => {
  await withActs([assignRole], async () => {
    const schema = await actSchema(assignRole, { stores: { role: rolesStore() } });
    assert.deepEqual(schema.required, ['keys', 'input']);
    assert.equal(schema.properties.keys.maxItems, undefined, 'it takes many');
    assert.deepEqual(schema.properties.input.properties.role.oneOf, [{ const: 'admin', title: 'Admin' }, { const: 'reader', title: 'Reader' }]);
    const add = typeActs(USER).find((a) => a.id === 'user.add');
    const fields = (await actSchema(add, { stores: { role: rolesStore() } })).properties.input;
    assert.deepEqual(fields.required, ['id', 'name']);
    assert.deepEqual(fields.properties.status.enum, ['active', 'invited', 'suspended']);
    assert.equal(fields.properties.roles.type, 'array');
    assert.equal(fields.properties.email.format, 'email');
  });
});

test('a row type\'s own acts: find, read, add, change and remove through its store, each refused in its words and undone', async () => {
  await withActs(typeActs(USER), async () => {
    const ctx = { stores: { user: usersStore(), role: rolesStore() } };
    assert.deepEqual(actsOf({ type: 'user' }).map((a) => a.id), ['user.find', 'user.read', 'user.add', 'user.change', 'user.remove']);
    const found = await runAct('user.find', { input: { status: 'invited' } }, ctx);
    assert.deepEqual([found.done, found.result.rows.map((r) => r.id)], ['1 found.', ['u2']]);
    assert.equal((await runAct('user.read', { keys: ['u1'] }, ctx)).done, 'Read User "Ana".');
    assert.match((await runAct('user.add', { input: { id: 'u3', name: 'C' } }, ctx)).refused, /Name: Must be at least 2 characters/);
    const added = await runAct('user.add', { input: { id: 'u3', name: 'Cy', roles: ['admin'] } }, ctx);
    assert.equal(added.done, 'Added User "Cy".');
    await added.undo();
    assert.equal(await ctx.stores.user.byKey('u3'), undefined);
    assert.match((await runAct('user.change', { keys: ['u1'], input: { status: 'gone' } }, ctx)).refused, /Status: Must be one of/);
    const changed = await runAct('user.change', { keys: ['u1', 'u2'], input: { status: 'suspended' } }, ctx);
    assert.equal(changed.done, 'Changed 2 of User.');
    await changed.undo();
    assert.deepEqual([(await ctx.stores.user.byKey('u1')).status, (await ctx.stores.user.byKey('u2')).status], ['active', 'invited']);
    const removed = await runAct('user.remove', { keys: ['u2'] }, ctx);
    assert.equal(removed.done, 'Removed User "Bo".');
    await removed.undo();
    assert.equal((await ctx.stores.user.byKey('u2')).name, 'Bo');
  });
});

test('a graph type\'s own acts go through the shelf: an entity is never added as a row, and a removed one comes back', async () => {
  const TEAMMATE = { v: 1, id: 'teammate', label: 'Teammate', fields: { status: { label: 'Status', values: ['active', 'paused'] } }, graph: { runs: true, reusable: false } };
  const stop = quiet();
  const off = registerEntityType(TEAMMATE);
  try {
    let mine = {};
    const ears = new Set();
    const shelf = makeShelf({ presets: () => [], mine: () => mine, keep: (next) => { mine = next; for (const ear of ears) ear(); }, heard: (ear) => ears.add(ear) });
    await shelf.save({ v: 2, type: 'teammate', id: 'ana', label: 'Ana', graph: { nodes: [{ id: 'when', kind: 'trigger', x: 0, y: 0, values: { type: 'schedule' } }], connections: [{ from: 'when', to: START }] }, settings: { status: 'active' } });
    const ctx = { stores: { teammate: entityStore(shelf, TEAMMATE) }, entities: shelf };
    await withActs(typeActs(TEAMMATE), async () => {
      assert.match((await runAct('teammate.add', { input: { status: 'active' } }, ctx)).refused, /A Teammate is made in its editor, not as a row/);
      const changed = await runAct('teammate.change', { keys: ['ana'], input: { status: 'paused' } }, ctx);
      assert.equal(shelf.get('ana').settings.status, 'paused');
      await changed.undo();
      assert.equal(shelf.get('ana').settings.status, 'active');
      const removed = await runAct('teammate.remove', { keys: ['ana'] }, ctx);
      assert.equal(shelf.get('ana'), undefined);
      await removed.undo();
      assert.equal(shelf.get('ana').label, 'Ana');
    });
  } finally {
    off();
    stop();
  }
});

test('a type\'s acts find its store whatever the app names it: the one named by its id, else the one that holds its rows', async () => {
  await withActs([...typeActs(USER), assignRole], async () => {
    // The app names its stores as its pages do: 'people' and 'role-list', each made from its type.
    const people = usersStore();
    const ctx = { stores: { people, 'role-list': rolesStore() } };
    assert.equal(people.type, 'user', 'a store made from a type says its type');
    assert.equal(storeOfType(ctx.stores, 'user'), people);
    assert.equal((await runAct('user.read', { keys: ['u1'] }, ctx)).done, 'Read User "Ana".');
    // A reference is checked in its type's store too: a role that is none is refused as no Role, not as no store.
    assert.match((await runAct('user.assign-role', { keys: ['u2'], input: { role: 'owner' } }, ctx)).refused, /"owner" is no Role/);
    assert.deepEqual((await actSchema(assignRole, ctx)).properties.input.properties.role.oneOf.map((o) => o.const), ['admin', 'reader']);
    // A wrapper says its inner store's type: a status field is worked out over it.
    const wrapped = statusFields(usersStore(), { live: { type: 'status', values: [{ value: 'on', where: ['status', 'eq', 'active'] }] } });
    assert.equal(wrapped.type, 'user');
    // One named by its id wins; two that hold it, neither named by it: none, said in words.
    const own = usersStore();
    assert.equal(storeOfType({ people, user: own }, 'user'), own);
    const said = [];
    const stop = onReport((r) => said.push(r.message));
    try {
      assert.equal(storeOfType({ people, staff: usersStore() }, 'user'), undefined);
      assert.deepEqual(await runAct('user.read', { keys: ['u1'] }, { stores: { people, staff: usersStore() } }), { refused: 'There is no store of User.' });
    } finally {
      stop();
    }
    assert.match(said.join('\n'), /"people" and "staff" each hold "user": name one "user"/);
  });
});
