/**
 * A DECISION IS SILENT. A BROKEN ASSUMPTION REPORTS.
 *
 * 82 guards in the filter family return early. Most express a decision — the
 * panel is desktop-only, a chip has no menu to open. A third express a broken
 * assumption: a host named a filter nothing offers, a clause was set on a chip
 * that cannot hold one, a field arrived with nothing to draw. Those returned
 * early too, so an app got an empty screen and no explanation.
 *
 *   node --test test/unit/a-broken-assumption-reports.test.mjs
 *
 * TRAP T-a-broken-assumption-reports
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { ArrayStore, DataSource, onReport, report } from '../../dist/data.js';

/** Collect every report for the length of one call. */
function caught(fn) {
  const seen = [];
  const undo = onReport((r) => seen.push(r));
  try { fn(); } finally { undo(); }
  return seen;
}

test('a report NAMES the thing: a code, a sentence, and where', () => {
  const seen = caught(() => report({
    code: 'unknown-field',
    message: 'No such field.',
    at: { field: 'owner', scope: 'data' },
  }));
  assert.deepEqual(seen, [{
    code: 'unknown-field',
    message: 'No such field.',
    at: { field: 'owner', scope: 'data' },
  }]);
});

test('the default is console.warn, and it is a DEFAULT — not the mechanism', () => {
  const real = console.warn;
  const lines = [];
  console.warn = (line) => lines.push(line);
  try {
    report({ code: 'unknown-field', message: 'No such field.', at: { field: 'owner' } });
  } finally {
    console.warn = real;
  }
  // The code is bracketed so an app can grep or route one kind.
  assert.equal(lines.length, 1);
  assert.match(lines[0], /^sherpa \[unknown-field\] No such field\. field=owner$/);
});

test('onReport RETURNS its undo, so a test restores the default', () => {
  const first = [];
  const undo = onReport((r) => first.push(r.code));
  report({ code: 'a', message: 'a' });
  undo();
  const real = console.warn;
  let warned = 0;
  console.warn = () => { warned += 1; };
  try { report({ code: 'b', message: 'b' }); } finally { console.warn = real; }
  assert.deepEqual(first, ['a']);
  assert.equal(warned, 1);
});

test('a BROKEN SINK does not break the page — the report still gets out', () => {
  const real = console.warn;
  const lines = [];
  console.warn = (line) => lines.push(line);
  const undo = onReport(() => { throw new Error('the app\'s handler is broken'); });
  try {
    // No throw reaches the caller…
    report({ code: 'c', message: 'Still said.' });
  } finally {
    undo();
    console.warn = real;
  }
  // …and the issue was still said.
  assert.equal(lines.length, 1);
  assert.match(lines[0], /Still said\./);
});

test('an EMPTY `at` value is left out, so the line stays readable', () => {
  const real = console.warn;
  const lines = [];
  console.warn = (line) => lines.push(line);
  try {
    report({ code: 'd', message: 'Named.', at: { id: 'plan', held: '', missing: undefined } });
  } finally {
    console.warn = real;
  }
  assert.match(lines[0], /^sherpa \[d\] Named\. id=plan$/);
});

/* ── The sites that use it ──────────────────────────────────────────── */

test('groups() asked before the first load SAYS SO, rather than answering none', async () => {
  const src = new DataSource({ store: new ArrayStore([{ id: 1, team: 'Blue' }], { key: 'id' }) });
  await src.ready;
  const seen = caught(() => src.groups('team'));
  assert.deepEqual(seen.map((r) => r.code), ['not-loaded']);
  assert.equal(seen[0].at.field, 'team');

  // …and once loaded it simply answers.
  await src.load();
  assert.deepEqual(caught(() => src.groups('team')), []);
});
