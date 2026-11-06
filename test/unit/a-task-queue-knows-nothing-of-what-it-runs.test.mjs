/**
 * The TASK QUEUE is generic: a task is { id, kind, requestedBy, state, history, outcome }; it is queued, running, then ok or
 * failed, and a run may say named states; tasks of one key are exclusive, the second BLOCKED; the queue is asked (get, list,
 * busy) and heard (task-change, task-blocked, task-notice, which sums what ends within a wait into ONE summary). It names
 * nothing it runs. Will, TODOs 843, 844 · TRAP T-a-task-queue-knows-nothing-of-what-it-runs
 *
 *   node --test test/unit/a-task-queue-knows-nothing-of-what-it-runs.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const core = new URL('../../dist/core/data/', import.meta.url);
const { TaskQueue } = await import(new URL('task-queue.js', core));

const later = (ms = 0) => new Promise((done) => setTimeout(done, ms));
const gate = () => { let open; const wait = new Promise((r) => { open = r; }); return { wait, open }; };
const heard = (q, type) => { const got = []; q.addEventListener(type, (e) => got.push(e.detail)); return got; };

test('a task is queued, running, then ok, with its history, its outcome and who asked; it can be asked for by id', async () => {
  const q = new TaskQueue({ wait: 5 });
  const { task, accepted } = q.submit({ kind: 'sum', requestedBy: 'a test', run: () => ({ words: 'Summed', value: 3 }) });
  assert.equal(accepted, true);
  assert.deepEqual([task.id, task.kind, task.requestedBy], ['task-1', 'sum', 'a test']);
  await later(1);
  const done = q.get('task-1');
  assert.deepEqual(done.history.map((h) => h.state), ['queued', 'running', 'ok']);
  assert.deepEqual([done.state, done.outcome.words, done.outcome.value], ['ok', 'Summed', 3]);
  assert.equal(q.get('nope'), undefined);
  // A copy: changing it changes nothing.
  done.history.length = 0;
  assert.equal(q.get('task-1').history.length, 3);
});

test('one runs at a time by default; the next waits queued, in order; list narrows by kind, state and who asked', async () => {
  const q = new TaskQueue({ wait: 5 });
  const a = gate();
  const order = [];
  q.submit({ kind: 'x', requestedBy: 'one', run: async () => { order.push('a'); await a.wait; } });
  q.submit({ kind: 'y', requestedBy: 'two', run: () => { order.push('b'); } });
  await later(1);
  assert.deepEqual(q.list().map((t) => t.state), ['running', 'queued']);
  assert.deepEqual(q.list({ state: 'queued' }).map((t) => t.kind), ['y']);
  assert.deepEqual(q.list({ kind: 'x' }).map((t) => t.id), ['task-1']);
  assert.deepEqual(q.list({ requestedBy: 'two' }).map((t) => t.id), ['task-2']);
  a.open();
  await later(5);
  assert.deepEqual(order, ['a', 'b']);
  assert.deepEqual(q.list().map((t) => t.state), ['ok', 'ok']);
  const wide = new TaskQueue({ limit: 2 });
  const g = gate();
  wide.submit({ kind: 'x', requestedBy: 'r', run: () => g.wait });
  wide.submit({ kind: 'x', requestedBy: 'r', run: () => g.wait });
  await later(1);
  assert.deepEqual(wide.list().map((t) => t.state), ['running', 'running']);
  g.open();
});

test('a run may say named states, kept in the history', async () => {
  const q = new TaskQueue({ wait: 5 });
  q.submit({ kind: 'x', requestedBy: 'r', run: async ({ state }) => { state('reading'); await later(1); state('joining'); } });
  await later(10);
  assert.deepEqual(q.get('task-1').history.map((h) => h.state), ['queued', 'running', 'reading', 'joining', 'ok']);
});

test('a second request of a key a task holds is BLOCKED, not queued: the one in its way comes back; a free key runs', async () => {
  const q = new TaskQueue({ wait: 5, limit: 4 });
  const g = gate();
  const blocked = heard(q, 'task-blocked');
  const first = q.submit({ kind: 'x', requestedBy: 'r', key: 'k', run: () => g.wait });
  const second = q.submit({ kind: 'x', requestedBy: 'r', key: 'k', run: () => { throw new Error('never'); } });
  assert.deepEqual([second.accepted, second.task.id], [false, first.task.id]);
  assert.equal(blocked.length, 1);
  assert.equal(q.list().length, 1);
  assert.equal(q.busy('k'), true);
  assert.equal(q.busy('other'), false);
  assert.equal(q.submit({ kind: 'x', requestedBy: 'r', key: 'other', run: () => undefined }).accepted, true);
  g.open();
  await later(5);
  assert.equal(q.busy(), false);
  // Free again once it ends.
  assert.equal(q.submit({ kind: 'x', requestedBy: 'r', key: 'k', run: () => undefined }).accepted, true);
});

test('a run that throws, or says it did not go well, fails, with its words', async () => {
  const q = new TaskQueue({ wait: 5 });
  q.submit({ kind: 'x', requestedBy: 'r', run: () => { throw new Error('it broke'); } });
  q.submit({ kind: 'y', requestedBy: 'r', run: () => ({ ok: false, words: 'Not all of it' }) });
  await later(10);
  const [a, b] = q.list();
  assert.deepEqual([a.state, a.error, a.outcome.ok], ['failed', 'it broke', false]);
  assert.deepEqual([b.state, b.outcome.words, b.error], ['failed', 'Not all of it', undefined]);
});

test('cancel: a queued task never runs; a running one is signalled and fails as Stopped', async () => {
  const q = new TaskQueue({ wait: 5 });
  const ran = [];
  q.submit({ kind: 'x', requestedBy: 'r', run: ({ signal }) => new Promise((_, no) => signal.addEventListener('abort', () => no(new Error('aborted')))) });
  q.submit({ kind: 'y', requestedBy: 'r', run: () => { ran.push('y'); } });
  await later(1);
  q.cancel('task-2');
  q.cancel('task-1');
  await later(10);
  assert.deepEqual(q.list().map((t) => [t.state, t.error]), [['failed', 'Stopped'], ['failed', 'Stopped']]);
  assert.deepEqual(ran, []);
});

test('notices are debounced into ONE summary: one task says its own words; several are counted, the failures too', async () => {
  const q = new TaskQueue({ wait: 20, limit: 3 });
  const notices = heard(q, 'task-notice');
  q.submit({ kind: 'x', requestedBy: 'r', run: () => ({ words: 'Done well' }) });
  await later(60);
  assert.deepEqual(notices.map((n) => n.words), ['Done well']);
  for (const fail of [false, false, true]) q.submit({ kind: 'y', requestedBy: 'r', run: () => { if (fail) throw new Error('no'); } });
  await later(80);
  assert.equal(notices.length, 2);
  assert.deepEqual([notices[1].words, notices[1].failed, notices[1].tasks.length], ['3 tasks finished, 1 failed', 1, 3]);
  const lone = heard(new TaskQueue({ wait: 5 }), 'task-notice');
  assert.deepEqual(lone, []);
});

test('a notice waits for quiet: tasks that end a little apart are summed in ONE, not told one by one', async () => {
  const q = new TaskQueue({ wait: 60, limit: 3 });
  const notices = heard(q, 'task-notice');
  for (const ms of [0, 35, 70]) q.submit({ kind: 'x', requestedBy: 'r', run: () => later(ms) });
  await later(220);
  assert.deepEqual(notices.map((n) => n.words), ['3 tasks finished']);
});

test('the history is light: only the latest finished tasks are kept', async () => {
  const q = new TaskQueue({ wait: 5, history: 2 });
  for (let i = 0; i < 5; i++) q.submit({ kind: 'x', requestedBy: 'r', run: () => undefined });
  await later(15);
  assert.deepEqual(q.list().map((t) => t.id), ['task-4', 'task-5']);
});

test('it names nothing it runs: no word of a fetch, a simulation, a graph or a store in its source', () => {
  const code = readFileSync(new URL('../../src/core/data/task-queue.ts', import.meta.url), 'utf8');
  assert.deepEqual(code.match(/\b(fetch\w*|simulat\w*|graph|stores?|rows?|sources?)\b/gi) ?? [], []);
});
