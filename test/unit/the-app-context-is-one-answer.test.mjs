/**
 * THE APP CONTEXT IS ONE ANSWER — Will, TODO 453. While the app shares it, the
 * View's fields and answers are laid over every page's Query; a page writes
 * them back on a reader's act, and keeps what it has not for the pages that do.
 *
 *   node --test test/unit/the-app-context-is-one-answer.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { layShared, sharedOf } from '../../dist/core/data/query-edits.js';
import { VIEW } from '../../dist/data.js';

const RECORDS = ['customer', 'region', 'created', 'plan'];
const DASHBOARD = ['customer', 'region', 'severity'];
const has = (fields) => (f) => fields.includes(f);
const face = (f) => ({ label: f[0].toUpperCase() + f.slice(1) });

test('laid over a page: its answers win; a field the page has not is left out; the page keeps its own the answer lacks', () => {
  const shared = {
    holds: ['region', 'customer', 'created'],
    readings: { region: { picked: ['EMEA'] }, created: { picked: ['2026-01-01'] } },
    faces: { region: { label: 'Region' }, customer: { label: 'Customer' }, created: { label: 'Created' } },
  };
  const query = { v: 1, scopes: {
    [VIEW]: { holds: ['customer', 'region', 'severity'], readings: { customer: { picked: ['Contoso'] }, severity: { picked: ['high'] } } },
    data: { holds: ['os'], readings: { os: { picked: ['mac'] } } },
  } };
  layShared(query, shared, has(DASHBOARD));
  assert.deepEqual(query.scopes[VIEW].holds, ['region', 'customer', 'severity']);
  assert.deepEqual(query.scopes[VIEW].readings, { region: { picked: ['EMEA'] }, severity: { picked: ['high'] } }, 'Contoso was the page\'s own: the answer has none');
  assert.deepEqual(query.scopes.data.readings, { os: { picked: ['mac'] } }, 'a lower scope is untouched');
});

test('written back: the View\'s fields and answers, then what the answer held that this page has not, as it was', () => {
  const was = {
    holds: ['customer', 'region', 'created'],
    readings: { created: { picked: ['2026-01-01'] }, region: { picked: ['APAC'] } },
    faces: { customer: { label: 'Customer' }, region: { label: 'Region' }, created: { label: 'Created', icon: 'calendar' } },
  };
  const query = { v: 1, scopes: { [VIEW]: { holds: ['customer', 'region'], readings: { region: { picked: ['EMEA'] } } } } };
  const out = sharedOf(query, was, has(DASHBOARD), face);
  assert.deepEqual(out.holds, ['customer', 'region', 'created']);
  assert.deepEqual(out.readings, { region: { picked: ['EMEA'] }, created: { picked: ['2026-01-01'] } });
  assert.deepEqual(out.faces.created, { label: 'Created', icon: 'calendar' }, 'its face kept, for the next page that has it');
  // A field this page HAS but no longer holds is let go.
  const dropped = sharedOf({ v: 1, scopes: { [VIEW]: { holds: ['customer'], readings: {} } } }, was, has(RECORDS), face);
  assert.deepEqual(dropped.holds, ['customer']);
  // With none yet, the page's own View is the answer.
  assert.deepEqual(sharedOf(query, null, has(DASHBOARD), face).holds, ['customer', 'region']);
});
