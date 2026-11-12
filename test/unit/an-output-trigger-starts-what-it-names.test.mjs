/**
 * AN OUTPUT TRIGGER STARTS WHAT IT NAMES (Will, plan 949 D4 B, D5 A). The way out: an Output Trigger, in Output, makes an
 * event a Trigger hears — a UI event, a Task status, an AI message — or starts an entity an app's own type picks by an
 * entity row (Run Coworker). A ring of them across the shelf is a loop: each Output Trigger of the graph in one is blocked,
 * and warns; the graph still saves. And the way in, as Will asked: the Start stands in the first stage, and its line to each
 * Source is drawn, never kept.
 *
 *   node --test test/unit/an-output-trigger-starts-what-it-names.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { NODE_KINDS, OUTPUT_TRIGGER, nodeKinds, registerNodeTypes, rowChoices } = await import(new URL('node-kinds.js', core));
const { startLoops, startsOf } = await import(new URL('output-triggers.js', core));
const { START, withStart } = await import(new URL('node-start.js', core));
const { stageBands } = await import(new URL('node-stages.js', core));
const { nodeWidth, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { onReport } = await import(new URL('report.js', core));

const RUN = { coworker: { label: 'Run Coworker', icon: 'person', help: 'Run a Coworker', would: 'Would run the Coworker', rows: [{ name: 'coworker', label: 'Coworker', control: 'entity', of: 'coworker' }] } };
const out = (id, values) => ({ id, kind: OUTPUT_TRIGGER, x: 600, y: 0, values });
const heard = (id, values) => ({ id, kind: 'trigger', x: 0, y: 0, values });
const graph = (id, nodes) => ({ type: 'coworker', id, label: id[0].toUpperCase() + id.slice(1), graph: { nodes, connections: [] } });

test('the Output Trigger is in Output, its types the events a Trigger hears, each row named as the row it makes', () => {
  const kind = NODE_KINDS[OUTPUT_TRIGGER];
  assert.deepEqual([kind.heading, kind.category, kind.input, Object.keys(kind.types)], ['Output Trigger', 'Output', 'any', ['ui', 'status', 'message']]);
  for (const [type, rows] of Object.entries({ ui: ['event'], status: ['task', 'status'], message: ['from', 'says'] })) {
    assert.deepEqual(kind.types[type].rows.map((r) => r.name), rows, type);
    for (const name of rows) assert.ok(NODE_KINDS.trigger.types[type].rows.some((r) => r.name === name), `${type}: a Trigger hears ${name}`);
  }
});

test('an entity row picks one of the shelf\'s entities of its type; with none given, it is typed text', () => {
  const row = RUN.coworker.rows[0];
  assert.deepEqual(rowChoices(row, { entities: [{ value: 'ana', label: 'Ana' }] }), [{ value: '', label: 'Pick one' }, { value: 'ana', label: 'Ana' }]);
  assert.equal(rowChoices(row), undefined);
  const stop = onReport(() => {});
  const undo = registerNodeTypes(OUTPUT_TRIGGER, RUN);
  try {
    const shelf = [graph('ana', []), graph('bo', []), { ...graph('note', []), type: 'node' }];
    const g = workflowGraph({ v: 3, id: 'w', nodes: [out('run', { type: 'coworker' })], connections: [] }, { entities: () => shelf }, nodeKinds());
    assert.deepEqual(g.nodes.find((n) => n.id === 'run').rows.find((r) => r.name === 'coworker').choices.map((c) => c.value), ['', 'ana', 'bo']);
  } finally {
    undo?.();
    stop();
  }
});

test('what it starts: the entity its row picks, and each graph with a Trigger that hears its event (a blank row hears any)', () => {
  const stop = onReport(() => {});
  const undo = registerNodeTypes(OUTPUT_TRIGGER, RUN);
  try {
    const kinds = nodeKinds();
    const shelf = [
      graph('ana', []), graph('bo', [heard('t', { type: 'ui', event: 'patched' })]), graph('cy', [heard('t', { type: 'ui' })]),
      graph('di', [heard('t', { type: 'ui', event: 'other' })]), graph('ed', [heard('t', { type: 'status', task: 'patch' })]),
    ];
    const g = { nodes: [out('a', { type: 'coworker', coworker: 'ana' }), out('b', { type: 'ui', event: 'patched' }), out('c', { type: 'status', task: 'patch', status: 'failed' })] };
    assert.deepEqual(startsOf(g, shelf, kinds), [{ node: 'a', to: 'ana' }, { node: 'b', to: 'bo' }, { node: 'b', to: 'cy' }, { node: 'c', to: 'ed' }]);
  } finally {
    undo?.();
    stop();
  }
});

test('a loop across the shelf blocks each Output Trigger of the graph in it, and it warns; the graph still saves', () => {
  const stop = onReport(() => {});
  const undo = registerNodeTypes(OUTPUT_TRIGGER, RUN);
  try {
    const kinds = nodeKinds();
    // Ana runs Bo; Bo fires "done", which Ana's Trigger hears. And Ana runs itself.
    const bo = graph('bo', [heard('t', { type: 'ui', event: 'go' }), out('o', { type: 'ui', event: 'done' })]);
    const ana = { id: 'ana', label: 'Ana', graph: { nodes: [heard('t', { type: 'ui', event: 'done' }), out('run', { type: 'coworker', coworker: 'bo' }), out('self', { type: 'coworker', coworker: 'ana' }), out('safe', { type: 'ui', event: 'nobody' })] } };
    const loops = startLoops(ana, [bo], kinds);
    assert.deepEqual(Object.fromEntries(loops), { run: 'Ana › Bo › Ana', self: 'Ana › Ana' });
    const w = { v: 3, id: 'ana', label: 'Ana', nodes: ana.graph.nodes, connections: [] };
    const drawn = workflowGraph(w, { entities: () => [{ type: 'coworker', ...ana }, bo] }, kinds);
    const run = drawn.nodes.find((n) => n.id === 'run');
    assert.deepEqual([run.would, run.warnings.map((x) => x.words)], ['Blocked: it would start a loop', ['Blocked: it would start a loop, Ana › Bo › Ana']]);
    assert.equal(drawn.nodes.find((n) => n.id === 'safe').would, 'Would fire the event');
    assert.deepEqual(workflowFaults(w, kinds).filter((f) => /loop/.test(f)), [], 'a loop warns: it is no fault');
  } finally {
    undo?.();
    stop();
  }
});

test('the Start stands in the first stage, which holds it; a Trigger in a later stage does not pull it there', () => {
  const stages = [{ id: 'plan', label: 'Plan', x: 0 }, { id: 'run', label: 'Run', x: 1200 }];
  const w = { v: 3, id: 'w', stages, nodes: [{ ...heard('t', { type: 'schedule' }), x: 1300, stage: 'run' }, { id: 's', kind: 'source', x: 40, y: 0, stage: 'plan', values: { store: 'users' } }], connections: [{ from: 't', to: START }] };
  const placed = withStart(w, nodeWidth);
  const start = placed.nodes.find((n) => n.id === START);
  assert.deepEqual([start.stage, start.x], ['plan', 48]);
  const plan = stageBands(placed, nodeWidth).bands.find((b) => b.id === 'plan');
  assert.ok(plan.left <= start.x && start.x + nodeWidth(start) <= plan.right, JSON.stringify(plan));
  assert.deepEqual(workflowFaults(w), [], 'its stage is no fault');
});

test('the Start\'s line to each Source is drawn, never kept: a Source says the line reaches it; a kept one is refused', () => {
  const w = { v: 3, id: 'w', nodes: [{ id: 's', kind: 'source', x: 0, y: 0, values: { store: 'users' } }, { id: 'o', kind: 'result', x: 600, y: 0 }], connections: [{ from: 's/rows', to: 'o' }] };
  const drawn = workflowGraph(w);
  assert.deepEqual([drawn.nodes.find((n) => n.id === 's').started, drawn.nodes.find((n) => n.id === 'o').started], [true, undefined]);
  assert.equal(drawn.connections.some((r) => r.from === START), false, 'no line is kept');
  assert.ok(workflowFaults({ ...w, connections: [...w.connections, { from: START, to: 's' }] }).some((f) => /the Start's lines to the Sources are drawn, and none is kept/.test(f)));
});
