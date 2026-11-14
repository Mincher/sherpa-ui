/**
 * A REFERENCE READS ITS STORE — TODO 988, PRINCIPLES 25 ("Nothing should ever read a Data Source directly except a Data
 * Store", Will, 2026-11-14). `refFacts` reads what texts name, once: a row type's row from its store by its key, a graph
 * type's entity from the shelf. No app keeps a list of names beside the rows.
 *
 *   node --test test/unit/a-reference-reads-its-store.test.mjs
 *
 * TRAP T-only-a-store-reads-data
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, makeShelf, onReport, readRefs, refFacts, registerEntityType } from '../../dist/data.js';

const CUSTOMER = { v: 1, id: 'customer', label: 'Customer', key: 'id', title: 'name', fields: { id: { label: 'Id' }, name: { label: 'Name' } } };
const PLAYBOOK = { v: 1, id: 'playbook', label: 'Playbook', category: 'Runbooks', graph: { inputs: [], outputs: [] } };
const ROWS = [{ id: 'contoso', name: 'Contoso Ltd' }, { id: 7, name: 'Fabrikam' }];

/** A store of customers that counts what it is asked. */
function customers(fail = false) {
  const store = new ArrayStore(ROWS, { key: 'id' });
  const asked = { byKey: [], load: 0 };
  return {
    asked,
    store: Object.assign(Object.create(store), {
      byKey: async (key) => { asked.byKey.push(key); if (fail) throw new Error('offline'); return store.byKey(key); },
      load: async (...a) => { asked.load++; return store.load(...a); },
    }),
  };
}
const shelf = makeShelf({
  presets: () => [{ v: 3, type: 'playbook', id: 'morning', label: 'Morning check', graph: { nodes: [], connections: [] } }],
  mine: () => ({}), keep: () => {}, heard: () => {},
});
const TEXT = 'Ask {{customer:contoso}} and {{customer:7}}, not {{customer:nope}}; run {{playbook:morning}}, not {{playbook:contoso}}; '
  + 'read {{store:customer}}. Again {{customer:contoso}}.';

test('each thing named is read once, through its store or the shelf, and answered by its title', async () => {
  const back = [registerEntityType(CUSTOMER), registerEntityType(PLAYBOOK)];
  try {
    const { store, asked } = customers();
    const facts = await refFacts({ stores: { customer: store }, entities: shelf }, [TEXT, 42]);
    assert.deepEqual(readRefs(TEXT, facts).map((r) => [r.written, r.name ?? r.missing]), [
      ['{{customer:contoso}}', 'Contoso Ltd'],
      ['{{customer:7}}', 'Fabrikam'],
      ['{{customer:nope}}', 'there is no Customer "nope"'],
      ['{{playbook:morning}}', 'Morning check'],
      ['{{playbook:contoso}}', 'there is no Playbook "contoso"'],
      ['{{store:customer}}', 'customer'],
    ]);
    // Only what is named, once each — never every row.
    assert.deepEqual([[...new Set(asked.byKey.map(String))].sort(), asked.load], [['7', 'contoso', 'nope'], 0]);
  } finally {
    for (const off of back) off?.();
  }
});

test('a row its store could not read is reported, and reads as named: a check refuses only what is not there', async () => {
  const said = [];
  const stop = onReport((r) => said.push(r.code));
  const back = registerEntityType(CUSTOMER);
  try {
    const facts = await refFacts({ stores: { customer: customers(true).store } }, ['{{customer:contoso}}']);
    assert.deepEqual(readRefs('{{customer:contoso}}', facts).map((r) => r.name), ['contoso']);
    assert.deepEqual(said, ['ref-read']);
  } finally {
    back?.();
    stop();
  }
});
