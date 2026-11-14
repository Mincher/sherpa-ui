/**
 * A RETRY IS A SETTING — plan 992 O7 A (Will, 2026-11-14: where a Runbook retries the same step, it becomes that step's Retry
 * setting; its prompt's RETRIES AND ERRORS reads it; a different step on failure stays wired). Each step that can fail, an
 * AI step or an Output (not the Run result, which ends the run), has Retries: a setting, in its Settings tab, never a row on the canvas, with no socket.
 * TRAP T-a-retry-is-a-setting
 *
 *   node --test test/unit/a-retry-is-a-setting.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { editWorkflow, graphText, workflowFaults, workflowGraph } from '../../dist/data.js';
import { NODE_KINDS, resolveKind, socketType } from '../../dist/core/data/node-kinds.js';

// The Run result ends the run: it acts on nothing outside it.
const CAN_FAIL = ['prompt', 'runbook', 'skill', 'notify', 'content', 'response', 'request', 'output-trigger'];

test('each step that can fail has Retries, a setting: a number from 0, optional, with no socket', () => {
  for (const id of CAN_FAIL) {
    const row = resolveKind(NODE_KINDS[id]).rows.find((r) => r.name === 'retries');
    assert.deepEqual([row?.label, row?.control, row?.min, row?.step, row?.optional, row?.setting], ['Retries', 'number', 0, 1, true, true], id);
    assert.deepEqual([socketType(resolveKind(NODE_KINDS[id]), 'retries', 'input'), socketType(resolveKind(NODE_KINDS[id]), 'retries', 'output')], [undefined, undefined], id);
  }
  // Only those: no other kind has a setting.
  const others = Object.entries(NODE_KINDS).filter(([id]) => !CAN_FAIL.includes(id));
  assert.deepEqual(others.filter(([, k]) => [k, ...Object.values(k.types ?? {})].some((t) => (t.rows ?? []).some((r) => r.setting))).map(([id]) => id), []);
});

/** A Runbook step that installs, Retries `times`, then a Run result. */
const flow = (times) => ({
  v: 3, id: 'patch',
  nodes: [
    { id: 'm', kind: 'model', x: 0, y: 200, values: { provider: 'anthropic', model: 'sonnet' } },
    { id: 'r', kind: 'runbook', x: 300, y: 0, heading: 'Install patches', values: { instructions: 'Install the patches.', ...(times === undefined ? {} : { retries: times }) } },
    { id: 'o', kind: 'result', x: 600, y: 0 },
  ],
  connections: [{ from: 'm/model', to: 'r/model' }, { from: 'r/answer', to: 'o' }],
});

test('a drawn step carries its Retries as a setting; empty, nothing warns; an edit types it a number', () => {
  const r = workflowGraph(flow()).nodes.find((n) => n.id === 'r');
  assert.deepEqual([r.rows.find((x) => x.name === 'retries').setting, r.warnings, workflowFaults(flow())], [true, undefined, []]);
  assert.equal(editWorkflow(flow(), { node: 'r', row: 'retries', value: '2' }).nodes.find((n) => n.id === 'r').values.retries, 2);
});

test('the prompt\'s RETRIES AND ERRORS reads each step\'s Retries; none, no retry', () => {
  assert.deepEqual(graphText(flow(2)).errors.filter((e) => e.startsWith('- A retry')), [`- A retry: {{step:1.2}} Install patches, up to 2 more times.`].map((e) => e.replace('{{step:1.2}}', graphText(flow(2)).errors[0].match(/\{\{step:[^}]+\}\}/)?.[0] ?? '')));
  assert.match(graphText(flow(1)).errors[0], /^- A retry: .* Install patches, up to 1 more time\.$/);
  assert.deepEqual([graphText(flow()).errors, graphText(flow(0)).errors], [[], []]);
});
