/**
 * A CELL WITH MANY VALUES IS MANY VALUES — Will, 2026-11-13: "The Customer chip's menu is now showing multiple values
 * against some menu items. We need to break down multi value cells so that we're only working with unique values." A
 * cell that holds a list (a Coworker's customers) gives each of its values: listed once each, filtered by any of them
 * (and its opposite by none), counted once under each, and grouped under each.
 *
 *   node --test test/unit/a-cell-with-many-values-is-many.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, cellValues, filterRows, groupRows } from '../../dist/data.js';
const { distinctOf } = await import('../../dist/core/data/store.js');
const { presentUnder } = await import('../../dist/core/data/source-counts.js');

const ROWS = [
  { id: 'patch-all', customers: ['Contoso', 'Fabrikam', 'Northwind'] },
  { id: 'backups', customers: ['Contoso'] },
  { id: 'triage', customers: ['Fabrikam'] },
  { id: 'none', customers: [] },
  { id: 'one', customers: 'Northwind' },
];
const ids = (rows) => rows.map((r) => r.id);

test('a cell\'s values: each item of a list, else the one value', () => {
  assert.deepEqual(cellValues(['a', 'b']), ['a', 'b']);
  assert.deepEqual(cellValues('a'), ['a']);
  assert.deepEqual(cellValues([]), []);
});

test('its values are listed once each, never the list as one value', async () => {
  assert.deepEqual(distinctOf(ROWS, ['customers']).customers, ['Contoso', 'Fabrikam', 'Northwind']);
  assert.deepEqual((await presentUnder(new ArrayStore(ROWS), ['customers'], ['id', 'ne', 'triage'])).customers, ['Contoso', 'Fabrikam', 'Northwind']);
});

test('a filter holds when any of its values holds it, and its opposite when none does', () => {
  assert.deepEqual(ids(filterRows(ROWS, ['customers', 'in', ['Contoso']])), ['patch-all', 'backups']);
  assert.deepEqual(ids(filterRows(ROWS, ['customers', 'eq', 'fabrikam'])), ['patch-all', 'triage'], 'loose, as ever');
  assert.deepEqual(ids(filterRows(ROWS, ['customers', 'notin', ['Contoso']])), ['triage', 'none', 'one']);
  assert.deepEqual(ids(filterRows(ROWS, ['customers', 'ne', 'Northwind'])), ['backups', 'triage', 'none']);
  assert.deepEqual(ids(filterRows(ROWS, ['customers', 'contains', 'wind'])), ['patch-all', 'one']);
});

test('a row is grouped under each of its values', () => {
  const groups = Object.fromEntries(groupRows(ROWS, 'customers').map((g) => [g.key, ids(g.rows)]));
  assert.deepEqual(groups.Contoso, ['patch-all', 'backups']);
  assert.deepEqual(groups.Fabrikam, ['patch-all', 'triage']);
  assert.deepEqual(groups.Northwind, ['patch-all', 'one']);
});

test('a chip\'s pick on a list field keeps each row that holds it', async () => {
  const source = new DataSource({ store: new ArrayStore(ROWS), pageSize: 50 });
  source.declareField('customers', { label: 'Customers', select: 'multiple' });
  await source.load();
  source.query.ask({ scope: 'view', field: 'customers', reading: { picked: ['Fabrikam'] } });
  await source.load();
  assert.equal(source.total, 2);
  source.dispose?.();
});

test('a type field may hold many of its values: a list checked value by value, its values listed', async () => {
  const { typeFaults, typeSchema, validate } = await import('../../dist/data.js');
  const USER = { v: 1, id: 'user', label: 'User', fields: { id: {}, customers: { label: 'Customers', values: ['Contoso', 'Fabrikam', 'Organisation'], many: true } } };
  assert.deepEqual(typeFaults(USER), []);
  const schema = typeSchema(USER);
  assert.equal((await validate(schema, { id: 'u1', customers: ['Contoso', 'Organisation'] })).issues, undefined);
  assert.match((await validate(schema, { id: 'u1', customers: ['Contoso', 'Initech'] })).issues[0].message, /Must be one of/);
  assert.deepEqual(schema.domains.customers.values, ['Contoso', 'Fabrikam', 'Organisation']);
  assert.match(typeFaults({ ...USER, fields: { id: {}, tags: { many: true } } }).join('\n'), /only a reference or a set of values holds many/);
});
