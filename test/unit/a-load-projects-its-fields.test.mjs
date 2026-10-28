/**
 * A LOAD PROJECTS ITS FIELDS — 345 phase 7. A load may name `fields`; a store
 * that says `projects` sends each row's key and those fields alone, and checks
 * a projected row on what it was sent. A schema it cannot check field by
 * field means it does not project.
 * TRAP T-a-projected-row-is-checked-on-what-it-was-sent
 *
 *   node --test test/unit/a-load-projects-its-fields.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, RestStore, required, rules, fakeRemote } from '../../dist/data.js';

const ROWS = [{ id: 1, name: 'Ada', plan: 'Pro', seats: 5 }, { id: 2, name: 'Bob', plan: 'Free', seats: 9 }];

test('an ArrayStore sends the key and the fields named', async () => {
  const store = new ArrayStore(ROWS, { key: 'id' });
  assert.equal(store.projects, true);
  const { rows } = await store.load({ fields: ['plan'] });
  assert.deepEqual(rows, [{ id: 1, plan: 'Pro' }, { id: 2, plan: 'Free' }]);
  // A faked remote passes it on, and says so.
  const remote = fakeRemote(store, { delay: 0 });
  assert.equal(remote.projects, true);
  assert.deepEqual((await remote.load({ fields: ['seats'] })).rows, [{ id: 1, seats: 5 }, { id: 2, seats: 9 }]);
});

test('a store whose schema checks only a whole row does not project', () => {
  const whole = { '~standard': { version: 1, vendor: 'other', validate: async (v) => ({ value: v }) } };
  assert.equal(new ArrayStore(ROWS, { key: 'id', schema: whole }).projects, false);
  assert.equal(new ArrayStore(ROWS, { key: 'id', schema: rules({ name: required() }) }).projects, true);
});

test('a RestStore asks for the fields, and a row missing one it was not sent passes', async () => {
  const calls = [];
  const realFetch = globalThis.fetch;
  globalThis.fetch = async (url) => {
    calls.push(String(url));
    return {
      ok: true, status: 200, headers: new Headers({ 'content-type': 'application/json' }),
      // No `name`, though the schema requires it: it was not asked for.
      json: async () => [{ id: 1, plan: 'Pro' }],
    };
  };
  try {
    const store = new RestStore({ url: 'https://x.test/rows', key: 'id', schema: rules({ name: required() }) });
    const projected = await store.load({ fields: ['plan'] });
    assert.ok(calls[0].includes('fields=plan'), calls[0]);
    assert.deepEqual(projected.rows, [{ id: 1, plan: 'Pro' }]);
    // A whole read is checked whole: the row has no name, so it is dropped.
    const whole = await store.load({});
    assert.equal(whole.rows.length, 0);
    assert.equal(whole.dropped, 1);
  } finally {
    globalThis.fetch = realFetch;
  }
});
