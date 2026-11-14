/**
 * A FLOW ASKS AN ACT STEP BY STEP — Will, plan 964 N4 D3 A (Invite a user first): a UX flow is a definition over one act,
 * keyed by it and said in its words — its steps each a field of its input, a step asked only when its `when` holds over
 * the answers before it, then a confirm. A dialog shows every step that holds (stepsOf); the chat asks one at a time
 * (nextStep, answerStep); each answer is checked as the act checks it.
 *
 *   node --test test/unit/a-flow-asks-an-act-step-by-step.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

import {
  ArrayStore, answerStep, flowFaults, flowOf, flowsOf, nextStep, onReport, registerAct, registerEntityType, registerFlow,
  runAct, stepsOf, typeStoreOptions,
} from '../../dist/data.js';

const ofSchema = schemaCheck('flow.v1.json');
const ROLE = { v: 1, id: 'role', label: 'Role', title: 'name', fields: { id: {}, name: { label: 'Name', required: true } } };
const CUSTOMER = { v: 1, id: 'customer', label: 'Customer', title: 'name', fields: { id: {}, name: { label: 'Name', required: true } } };
const USER = { v: 1, id: 'user', label: 'User', title: 'name', fields: { id: {}, name: { label: 'Name', required: true } } };
// The app names its stores as it likes: each is found by its type.
const ctx = () => ({
  stores: {
    'role-list': new ArrayStore([{ id: 'admin', name: 'Admin' }, { id: 'reader', name: 'Reader' }], typeStoreOptions(ROLE)),
    clients: new ArrayStore([{ id: 'acme', name: 'Acme' }], typeStoreOptions(CUSTOMER)),
    people: new ArrayStore([{ id: 'u1', name: 'Ana' }, { id: 'u2', name: 'Bo' }], typeStoreOptions(USER)),
  },
});
let invited;
const INVITE = {
  id: 'user.invite', label: 'Invite', type: 'user', changes: true,
  input: {
    name: { label: 'Name', required: true, min: 2 },
    email: { label: 'Email', required: true, format: 'email' },
    scope: { label: 'Scope', required: true, values: ['internal', 'customer'], labels: { internal: 'Internal', customer: 'Customer' } },
    customer: { label: 'Customer', ref: 'customer' },
    roles: { label: 'Roles', ref: 'role', many: true },
  },
  async run(call) {
    invited = call.input;
    return { done: `Invited ${call.input.name}.` };
  },
};
const FLOW = {
  v: 1, act: 'user.invite', confirm: true,
  steps: [{ field: 'name' }, { field: 'email' }, { field: 'scope' }, { field: 'customer', when: { scope: { eq: 'customer' } } }, { field: 'roles' }],
};

/** The types, the act and the flow registered for one test; all taken back after. */
async function withInvite(run, { flow = FLOW, acts = [INVITE] } = {}) {
  const offs = [ROLE, CUSTOMER, USER].map(registerEntityType);
  offs.push(...acts.map(registerAct));
  if (flow) offs.push(registerFlow(flow));
  try {
    await run();
  } finally {
    for (const off of offs) off?.();
  }
}

test('a flow is JSON, keyed by its act; one that is not one, or a second for its act, is refused in words', async () => {
  await withInvite(async () => {
    assert.deepEqual([ofSchema(FLOW), flowFaults(FLOW)], [[], []]);
    assert.equal(flowOf('user.invite'), FLOW);
    assert.deepEqual(flowsOf({ type: 'user' }), [FLOW]);
    const bad = (change) => flowFaults(change(structuredClone(FLOW))).join('\n');
    assert.match(bad((f) => ({ ...f, label: 'Invite a user' })), /it has "label", which a flow does not/);
    assert.match(bad((f) => ({ ...f, steps: [...f.steps, { field: 'colour' }] })), /its step "colour" is no input of user.invite/);
    assert.match(bad((f) => ({ ...f, steps: f.steps.filter((s) => s.field !== 'email') })), /it does not ask "email", which user.invite needs/);
    assert.match(bad((f) => ({ ...f, steps: [f.steps[3], ...f.steps] })), /its step "customer": its when reads "scope", which no step before it asks/);
    assert.match(bad((f) => ({ ...f, steps: [...f.steps, { field: 'name' }] })), /its step "name" is asked twice/);
    const said = [];
    const stop = onReport((r) => said.push(r.message));
    try {
      assert.equal(registerFlow(structuredClone(FLOW)), undefined);
    } finally {
      stop();
    }
    assert.match(said.join('\n'), /user.invite has a flow already/);
  });
});

test('the dialog: every step that holds, each said in its field\'s words, a step hidden while its when does not hold', async () => {
  await withInvite(async () => {
    const asks = await stepsOf(FLOW, {}, ctx());
    assert.deepEqual(asks.map((a) => a.field), ['name', 'email', 'scope', 'roles']);
    assert.deepEqual(asks[1], { field: 'email', label: 'Email', required: true, format: 'email', kind: 'text' });
    assert.deepEqual(asks[2].choices, [{ value: 'internal', label: 'Internal' }, { value: 'customer', label: 'Customer' }]);
    assert.deepEqual([asks[3].kind, asks[3].choices], ['many', [{ value: 'admin', label: 'Admin' }, { value: 'reader', label: 'Reader' }]]);
    const customer = (await stepsOf(FLOW, { scope: 'customer' }, ctx())).find((a) => a.field === 'customer');
    assert.deepEqual([customer.kind, customer.choices], ['one', [{ value: 'acme', label: 'Acme' }]], 'a reference\'s rows, from its type\'s store');
  });
});

test('the chat: one step at a time, each answer checked as the act checks it, then the confirm in words; the act runs it', async () => {
  await withInvite(async () => {
    const c = ctx();
    let answers = {};
    const answer = async (field, value) => {
      const got = await answerStep(FLOW, answers, field, value, c);
      if ('answers' in got) answers = got.answers;
      return got;
    };
    assert.equal((await nextStep(FLOW, answers, c)).step.field, 'name');
    assert.match((await answer('name', 'A')).refused, /Invite: Name: Must be at least 2 characters/);
    await answer('name', 'Ana');
    const email = await answer('email', 'ana');
    assert.match(email.refused, /Invite: Email: /);
    assert.equal(email.field, 'email');
    assert.ok(email.error && !email.error.startsWith('Email:'), 'under its field, the field\'s own words');
    await answer('email', 'ana@x.io');
    assert.match((await answer('customer', 'acme')).refused, /Invite does not ask "customer" now/);
    // A name it never asks says the names it does.
    assert.deepEqual(await answer('where', 'customer'), { refused: 'Invite asks no "where": it asks "name", "email", "scope", "customer", and "roles".' });
    await answer('scope', 'customer');
    assert.equal((await nextStep(FLOW, answers, c)).step.field, 'customer');
    assert.match((await answer('customer', 'nope')).refused, /"nope" is no Customer/);
    await answer('customer', 'acme');
    assert.deepEqual(await answer('scope', ''), { refused: 'Invite: it needs Scope.', field: 'scope', error: 'It needs Scope' });
    await answer('roles', ['admin', 'reader']);
    assert.deepEqual(await nextStep(FLOW, answers, c), {
      confirm: 'Invite: Name Ana, Email ana@x.io, Scope Customer, Customer Acme, Roles Admin and Reader.',
      input: { name: 'Ana', email: 'ana@x.io', scope: 'customer', customer: 'acme', roles: ['admin', 'reader'] },
    });
    // The scope moves back: its Customer is asked no more, so it is not sent; Roles skipped is not sent either.
    await answer('scope', 'internal');
    await answer('roles', null);
    const { input } = await nextStep(FLOW, answers, c);
    assert.deepEqual(input, { name: 'Ana', email: 'ana@x.io', scope: 'internal' });
    assert.equal((await runAct('user.invite', { input }, c)).done, 'Invited Ana.');
    assert.deepEqual(invited, input);
  });
});

test('an act with no flow has one made from its input; one that changes nothing runs with no confirm; a confirm names its rows', async () => {
  const note = {
    id: 'user.note', label: 'Note', type: 'user', many: true, changes: false, input: { text: { label: 'Text', required: true } },
    async run() { return { done: 'Noted.' }; },
  };
  const suspend = { ...note, id: 'user.suspend', label: 'Suspend', changes: true, input: { reason: { label: 'Reason' } } };
  await withInvite(async () => {
    const made = flowOf('user.note');
    assert.deepEqual(made, { v: 1, act: 'user.note', steps: [{ field: 'text' }], confirm: false });
    assert.equal(flowOf('user.nope'), undefined);
    assert.deepEqual(await nextStep(made, { text: 'Hi' }, ctx()), { run: { text: 'Hi' } });
    assert.deepEqual(await nextStep(flowOf('user.suspend'), { reason: 'Late' }, { ...ctx(), keys: ['u1', 'u2'] }), {
      confirm: 'Suspend: User "Ana" and "Bo", Reason Late.', input: { reason: 'Late' },
    });
    assert.deepEqual(await nextStep({ v: 1, act: 'user.gone', steps: [{ field: 'x' }] }, {}, ctx()), { refused: 'There is no act "user.gone".' });
  }, { flow: null, acts: [note, suspend] });
});

test('a flow with no steps and confirm only asks first: its confirm names what goes with its rows; with no confirm it is refused (plan 963)', async () => {
  const remove = {
    id: 'user.remove', label: 'Remove', type: 'user', many: true, changes: true,
    async run() { return { done: 'Removed.' }; },
    async also(call) { return call.keys.includes('u1') ? ['2 of Account'] : []; },
  };
  const ASK = { v: 1, act: 'user.remove', steps: [], confirm: true };
  await withInvite(async () => {
    assert.deepEqual([ofSchema(ASK), flowFaults(ASK)], [[], []]);
    assert.equal(flowOf('user.remove'), ASK);
    assert.deepEqual(await nextStep(ASK, {}, { ...ctx(), keys: ['u1'] }), { confirm: 'Remove: User "Ana" and 2 of Account.', input: {} });
    assert.deepEqual(await nextStep(ASK, {}, { ...ctx(), keys: ['u2'] }), { confirm: 'Remove: User "Bo".', input: {} });
    const none = { v: 1, act: 'user.remove', steps: [] };
    assert.notDeepEqual(ofSchema(none), []);
    assert.deepEqual(flowFaults(none), ['it has no steps, and no confirm']);
  }, { flow: ASK, acts: [remove] });
});

test('an object is no step: a made flow leaves it out, and a flow that asks one is refused', async () => {
  const save = {
    id: 'user.save-view', label: 'Save view', type: 'user', changes: true,
    input: { name: { label: 'Name', required: true }, layout: { type: 'object', label: 'Layout', required: true } },
    async run() { return { done: 'Saved.' }; },
  };
  await withInvite(async () => {
    assert.deepEqual(flowOf('user.save-view').steps, [{ field: 'name' }]);
    const asked = { v: 1, act: 'user.save-view', steps: [{ field: 'name' }, { field: 'layout' }] };
    assert.match(flowFaults(asked).join('\n'), /its step "layout" is an object, which no step asks/);
    assert.deepEqual(await nextStep(asked, {}, ctx()), { refused: 'Save view: layout is an object, which no step asks.' });
  }, { flow: null, acts: [save] });
});
