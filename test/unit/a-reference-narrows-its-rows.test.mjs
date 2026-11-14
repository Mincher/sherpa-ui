/**
 * A REFERENCE NARROWS ITS ROWS — TODO 995 (sherpa-demos-67, after Will's Customer type, 987). A `ref` field's `refWhere`
 * says which of the other type's rows it may name, in the one plain form: its choices are only those rows, read through
 * the store, which narrows them; a flow's step and an act's schema list the same; and a key outside it is refused in
 * words, by an app's act and by a type's own Add alike.
 *
 *   node --test test/unit/a-reference-narrows-its-rows.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

import {
  ArrayStore, actSchema, answerStep, refChoices, registerAct, registerEntityType, registerFlow, runAct, stepsOf, typeActs, typeFaults,
  typeStoreOptions,
} from '../../dist/data.js';

const ofSchema = schemaCheck('type.v1.json');
const NOT_US = { organisation: { ne: true } };
const CUSTOMER = { v: 1, id: 'customer', label: 'Customer', title: 'name', fields: { id: {}, name: { label: 'Name' }, organisation: { type: 'boolean' } } };
const ACCOUNT = {
  v: 1, id: 'account', label: 'Account', title: 'name',
  fields: { id: {}, name: { label: 'Name', required: true }, customer: { label: 'Customer', ref: 'customer', refWhere: NOT_US } },
};
// The MSP itself is a row of its type, and named so; a row that says nothing of it is a customer.
const ROWS = [{ id: 'org', name: 'Organisation', organisation: true }, { id: 'acme', name: 'Acme' }, { id: 'beta', name: 'Beta', organisation: false }];
const INVITE = {
  id: 'user.invite', label: 'Invite', changes: true,
  input: { customer: { label: 'Customer', ref: 'customer', refWhere: NOT_US }, owners: { label: 'Owners', ref: 'customer', many: true } },
  run: async () => ({ done: 'Invited.' }),
};

/** The customers, in a store that says what it was asked to load. */
function ctx() {
  const loads = [];
  const store = new ArrayStore(ROWS, typeStoreOptions(CUSTOMER));
  const load = store.load.bind(store);
  store.load = (options) => { loads.push(options?.filter); return load(options); };
  return { loads, stores: { clients: store, account: new ArrayStore([], typeStoreOptions(ACCOUNT)) } };
}

async function withTypes(run) {
  const offs = [registerEntityType(CUSTOMER), registerEntityType(ACCOUNT), ...[INVITE, ...typeActs(ACCOUNT)].map(registerAct)];
  offs.push(registerFlow({ v: 1, act: 'user.invite', steps: [{ field: 'customer' }] }));
  try {
    await run();
  } finally {
    for (const off of offs) off?.();
  }
}

test('a refWhere is a condition on the other type\'s rows, said with its ref: the schema and typeFaults agree', () => {
  assert.deepEqual([ofSchema(ACCOUNT), typeFaults(ACCOUNT)], [[], []]);
  const broken = (customer, words) => {
    const type = { ...ACCOUNT, fields: { ...ACCOUNT.fields, customer } };
    assert.ok(ofSchema(type).length, `the schema refuses ${words}`);
    assert.match(typeFaults(type).join('\n'), words);
  };
  broken({ label: 'Customer', refWhere: NOT_US }, /only a reference narrows its rows/);
  // The store's wire form is no definition's: one way to write a condition.
  broken({ ref: 'customer', refWhere: ['organisation', 'eq', false] }, /its refWhere is a condition on the other type's rows/);
});

test('its choices are the rows it allows, narrowed by the store; a flow step and an act\'s schema list the same', async () => {
  await withTypes(async () => {
    const c = ctx();
    const rest = [{ value: 'acme', label: 'Acme' }, { value: 'beta', label: 'Beta' }];
    assert.deepEqual(await refChoices('customer', c, NOT_US), rest);
    assert.deepEqual(c.loads.at(-1), ['organisation', 'ne', true], 'the store is asked for them, never every row');
    assert.deepEqual((await refChoices('customer', c)).map((r) => r.value), ['org', 'acme', 'beta'], 'none: every row');
    assert.deepEqual((await stepsOf({ v: 1, act: 'user.invite', steps: [{ field: 'customer' }] }, {}, c))[0].choices, rest);
    const input = (await actSchema(INVITE, c)).properties.input.properties;
    assert.deepEqual(input.customer.oneOf, [{ const: 'acme', title: 'Acme' }, { const: 'beta', title: 'Beta' }]);
    assert.equal(input.owners.items.oneOf.length, 3, 'a reference with no refWhere lists every row');
  });
});

test('a key outside it is refused in words, by the row\'s title: an act, a flow\'s answer and a type\'s own Add alike', async () => {
  await withTypes(async () => {
    const c = ctx();
    assert.deepEqual(await runAct('user.invite', { input: { customer: 'org' } }, c), { refused: 'Invite: "Organisation" is no Customer here.' });
    assert.match((await runAct('user.invite', { input: { customer: 'nope' } }, c)).refused, /"nope" is no Customer\./);
    assert.deepEqual(await runAct('user.invite', { input: { customer: 'acme', owners: ['org'] } }, c), { done: 'Invited.' });
    assert.match((await answerStep({ v: 1, act: 'user.invite', steps: [{ field: 'customer' }] }, {}, 'customer', 'org', c)).refused, /"Organisation" is no Customer here/);
    assert.match((await runAct('account.add', { input: { id: 'a1', name: 'Main', customer: 'org' } }, c)).refused, /"Organisation" is no Customer here/);
    assert.ok('done' in await runAct('account.add', { input: { id: 'a1', name: 'Main', customer: 'beta' } }, c));
  });
});
