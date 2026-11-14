/**
 * "SAVE AS CUSTOM NODE" AND "UNGROUP": several nodes of a workflow become one definition and one
 * use, each connection over the edge a typed Group Input or Output row; Ungroup gives the same workflow
 * back (nodes, connections, places). A selection that cannot be saved is refused in words. A connection
 * let go on a use's header is a new input of its definition (763).
 * Will, TODO 719 · plan 713 M11, D9. TRAP T-a-custom-node-is-an-instance · TRAP T-a-custom-node-header-adds-an-input
 *
 *   node --test test/unit/a-custom-node-is-saved-from-nodes.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { groupNodes, headerInput, heldInputs, ungroupUse } = await import(new URL('node-group.js', core));
const lib = await import(new URL('node-library.js', core));
const { editWorkflow, readWorkflow, workflowFaults, workflowGraph } = await import(new URL('workflow.js', core));
const { NODE_KINDS } = await import(new URL('node-kinds.js', core));

const empty = () => ({ v: 1, nodes: {} });
/** Store → Condition (Value 'x' into its value row) → Output: the Condition is the one to save. */
const flow = () => ({
  v: 3, id: 'flow',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'cond', kind: 'condition', x: 360, y: 40, values: { type: 'eq' } },
    { id: 'end', kind: 'result', x: 720, y: 0 },
  ],
  connections: [
    { from: 'start/rows', to: 'cond' }, { from: 'val/value', to: 'cond/b' }, { from: 'cond/pass', to: 'end' },
  ],
});
const sorted = (w) => ({
  nodes: [...w.nodes].sort((a, b) => (a.id < b.id ? -1 : 1)),
  connections: [...(w.connections ?? [])].sort((a, b) => `${a.from}${a.to}` < `${b.from}${b.to}` ? -1 : 1),
});
const facts = { fields: { status: { label: 'Status' } } };

test('save then ungroup gives the same workflow: nodes, connections and places', () => {
  const was = flow();
  assert.deepEqual(workflowFaults(was, undefined, facts), []);
  const made = groupNodes(was, ['cond'], empty(), { label: 'Status check', category: 'Logic' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  assert.equal(made.workflow.nodes.filter((n) => n.kind === made.id).length, 1);
  assert.equal(made.workflow.nodes.some((n) => n.id === 'cond'), false);
  const back = ungroupUse(made.workflow, made.use, made.library);
  assert.ok(!back.fault, back.fault);
  assert.deepEqual(sorted(back.workflow), sorted(was));
});

test('each connection over the edge is a typed socket; the use is joined as the nodes were', () => {
  const made = groupNodes(flow(), ['cond'], empty(), { label: 'Status check' }, undefined, facts);
  const d = made.library.nodes[made.id];
  assert.deepEqual(d.inputs.map((i) => [i.name, i.type]), [['start-rows', 'object'], ['val-value', 'value']]);
  assert.deepEqual(d.outputs.map((o) => [o.name, o.type]), [['cond-pass', 'object']]);
  assert.deepEqual(made.workflow.connections.map((r) => `${r.from} → ${r.to}`).sort(), [
    `${made.use}/cond-pass → end`, `start/rows → ${made.use}/start-rows`, `val/value → ${made.use}/val-value`,
  ].sort());
  assert.deepEqual(lib.workflowFaultsDeep(made.workflow, made.library, undefined, facts), []);
  assert.equal(lib.checkNodeLibrary(made.library, undefined, facts), true);
  assert.deepEqual(lib.staleUses(made.workflow, made.library), []);
});

test('two nodes saved together keep the connection between them inside; one source feeding two rows is one socket', () => {
  const w = flow();
  const made = groupNodes(w, ['val', 'cond'], empty(), { label: 'Pair' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  const d = made.library.nodes[made.id];
  assert.deepEqual(d.inputs.map((i) => i.name), ['start-rows']);
  assert.ok(d.connections.some((r) => r.from === 'val/value' && r.to === 'cond/b'));
  assert.deepEqual(sorted(ungroupUse(made.workflow, made.use, made.library).workflow), sorted(w));
});

test('a name that is taken, an id a shipped kind owns: a free id', () => {
  const a = groupNodes(flow(), ['cond'], empty(), { label: 'Source' }, undefined, facts);
  assert.equal(a.id, 'source-2');
  const b = groupNodes(flow(), ['cond'], a.library, { label: 'Source' }, undefined, facts);
  assert.equal(b.id, 'source-3');
});

test('refused in words: nothing picked, no name, a Group node, a loop through outside; two types are one socket, typed by its source', () => {
  assert.match(groupNodes(flow(), [], empty(), { label: 'x' }).fault, /pick the nodes/);
  assert.match(groupNodes(flow(), ['cond'], empty(), { label: '  ' }).fault, /give the Custom Node a name/);
  assert.match(groupNodes(flow(), ['#in'], empty(), { label: 'x' }).fault, /nodes of a Custom Node|belong to a Custom Node/);
  // A loop: start → cond → sort → ... back into a picked node. Pick start and end, leave cond out.
  const loop = groupNodes(flow(), ['start', 'end'], empty(), { label: 'Ends' }, undefined, facts);
  assert.match(loop.fault, /would hold a loop through it/);
  assert.match(loop.fault, /Condition/);
  // Two types: a Store's rows (an object) into the Value row, beside the header it feeds. Any connection joins any
  // input (TODO 770): ONE socket, typed by what its source sends; inside, the Value reads null and warns, as outside.
  const bad = flow();
  bad.connections = [{ from: 'start/rows', to: 'cond' }, { from: 'start/rows', to: 'cond/b' }, { from: 'cond/pass', to: 'end' }];
  assert.deepEqual(workflowGraph(bad).nodes.find((n) => n.id === 'cond').warnings, [
    { words: 'Equals takes a field or a value; it was given rows: connect a Field in' }, { row: 'b', words: 'Value B takes a value; it was given rows' },
  ]);
  const mixed = groupNodes(bad, ['cond'], empty(), { label: 'Mixed' });
  assert.equal(mixed.fault, undefined);
  assert.deepEqual(mixed.library.nodes[mixed.id].inputs.map((i) => [i.label, i.type]), [['Source › Results', 'object']]);
  const inner = lib.innerOf(mixed.workflow.nodes.find((n) => n.id === mixed.use), mixed.library);
  // Inside, its header hears an object: data, which no comparison fits, so Equals warns too (TODO 940).
  assert.deepEqual(workflowGraph(inner.workflow, {}, inner.kinds).nodes.find((n) => n.id === 'cond').warnings, [
    { words: 'Equals takes text, a number, a date, or a boolean; it was given an object' }, { row: 'b', words: 'Value B takes a value; it was given an object' },
  ]);
});

/** Has status, as the Demos' preset: Records and a Status in, the matching rows out. */
const HAS = {
  v: 1, label: 'Has status',
  inputs: [{ name: 'records', label: 'Records', type: 'object' }, { name: 'status', label: 'Status', type: 'value' }],
  outputs: [{ name: 'matching', label: 'Matching', type: 'object' }],
  nodes: [{ id: 'has-status', kind: 'condition', x: 0, y: 0, values: { type: 'eq' } }],
  // The header out, made from the test's Pass (plan 971 §9).
  connections: [{ from: '#in/records', to: 'has-status' }, { from: '#in/status', to: 'has-status/b' }, { from: 'has-status/pass', to: '#out/matching' }, { from: 'has-status/pass', to: '#out' }],
};
const hasLib = (preset = false) => ({ v: 1, nodes: { 'has-status': { ...structuredClone(HAS), ...(preset ? { preset: true } : {}) } } });
/** A Store, a Value and a Condition beside two uses of Has status, its Matching on to the Output. */
const beside = (library = hasLib()) => ({
  v: 3, id: 'flow',
  nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
    { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
    { id: 'c', kind: 'condition', x: 0, y: 400, values: { type: 'eq' } },
    lib.useOf(library, 'has-status', { id: 'has', x: 360, y: 0 }),
    lib.useOf(library, 'has-status', { id: 'has2', x: 360, y: 400 }),
    { id: 'end', kind: 'result', x: 720, y: 0 },
  ],
  connections: [{ from: 'start/rows', to: 'c' }, { from: 'has/matching', to: 'end' }],
});
/** The same, with connections left on the HEADER of a use, as a file saved before kept them. */
const fedOnHeader = (library = hasLib()) => ({ ...beside(library), connections: [...beside(library).connections, { from: 'start/rows', to: 'has' }, { from: 'val/value', to: 'has' }] });
const said = (w) => (w.connections ?? []).map((r) => `${r.from} → ${r.to}`).sort();
const inputsOf = (l) => l.nodes['has-status'].inputs.map((i) => [i.name, i.label, i.type]);

test('a Custom Node\'s header takes anything: each connection let go on it adds a new input, a row on the use and on its Group Input', () => {
  const one = headerInput(beside(), { from: 'start/rows', to: 'has' }, hasLib());
  assert.ok(!one.fault, one.fault);
  assert.equal(one.id, 'has-status');
  // An object: never matched to Records, a free row of its type; a new row, named by its source.
  assert.deepEqual(said(one.workflow), ['has/matching → end', 'start/rows → c', 'start/rows → has/start-rows']);
  // A value, then a test's Pass, its rows (plan 971 §9): both taken, each its own row.
  const two = headerInput(one.workflow, { from: 'val/value', to: 'has' }, one.library);
  const three = headerInput(two.workflow, { from: 'c/pass', to: 'has' }, two.library);
  assert.ok(!three.fault, three.fault);
  assert.deepEqual(inputsOf(three.library), [
    ['records', 'Records', 'object'], ['status', 'Status', 'value'],
    ['start-rows', 'Source › Results', 'object'], ['val-value', 'Value › Value', 'value'], ['c-pass', 'Condition › Pass', 'object'],
  ]);
  assert.ok(said(three.workflow).includes('val/value → has/val-value') && said(three.workflow).includes('c/pass → has/c-pass'));
  // Inside, a Group Input row each, an output socket of the source's type, feeding nothing yet.
  const inner = lib.innerOf(three.workflow.nodes.find((n) => n.id === 'has'), three.library);
  assert.deepEqual(inner.kinds[lib.GROUP_INPUT].rows.map((r) => [r.name, r.output]), [['records', 'object'], ['status', 'value'], ['start-rows', 'object'], ['val-value', 'value'], ['c-pass', 'object']]);
  assert.deepEqual(inner.workflow.connections.filter((r) => ['#in/start-rows', '#in/val-value', '#in/c-pass'].includes(r.from)), []);
  // Nothing about it is a fault: the draft, and the library Save would check.
  assert.deepEqual(lib.workflowFaultsDeep(three.workflow, three.library, undefined, facts), []);
  assert.equal(lib.checkNodeLibrary(three.library, undefined, facts), true);
  // The edit is the DEFINITION's DRAFT: no use sees it (plan 972 D1 A). PUBLISHED, the use that took it has it already
  // (D2 A); the other use says Update available.
  assert.deepEqual(lib.staleUses(three.workflow, three.library), []);
  const published = { ...three.library, nodes: { ...three.library.nodes, 'has-status': { ...three.library.nodes['has-status'], version: 2 } } };
  assert.deepEqual(lib.staleUses(three.workflow, published), ['has2']);
  assert.deepEqual(lib.definitionDiff(three.workflow.nodes.find((n) => n.id === 'has2'), published).inputs.added, ['start-rows', 'val-value', 'c-pass']);
});

test('inside, a new row connections on to any inner socket, and Ungroup joins its source through it; a row that feeds nothing inside is dropped', () => {
  const one = headerInput(beside(), { from: 'start/rows', to: 'has' }, hasLib());
  const two = headerInput(one.workflow, { from: 'val/value', to: 'has' }, one.library);
  // The reader connections the Store's row on to the Condition's value inside; the Value's row stays unconnected.
  const inner = lib.innerOf(two.workflow.nodes.find((n) => n.id === 'has'), two.library);
  const connected = editWorkflow(inner.workflow, { connection: { from: '#in/start-rows', to: 'has-status/b' } }, inner.kinds);
  const library = lib.editDefinition(two.library, 'has-status', { connections: connected.connections });
  const back = ungroupUse(two.workflow, 'has', library);
  assert.ok(!back.fault, back.fault);
  assert.ok(said(back.workflow).includes('start/rows → has-status/b'));
  assert.ok(!said(back.workflow).some((r) => r.startsWith('val/value')));
});

test('a preset is read only: a connection on its header is refused in words, and nothing changes', () => {
  const library = hasLib(true);
  const w = beside(library);
  const done = headerInput(w, { from: 'start/rows', to: 'has' }, library);
  assert.match(done.fault, /a preset is read only: clone it to add an input/);
  assert.equal(library.nodes['has-status'].inputs.length, 2);
  // A refused drop (TODO 803): no workflow and no library to keep, so the line is not kept.
  assert.deepEqual(Object.keys(done), ['fault']);
  // A moved end let go there is the same refusal: the editor writes nothing, and the connection is back on its row.
  const fed = editWorkflow(w, { connection: { from: 'start/rows', to: 'has/records' } });
  const moved = headerInput(editWorkflow(fed, { cut: { from: 'start/rows', to: 'has/records' } }), { from: 'start/rows', to: 'has' }, library);
  assert.deepEqual(Object.keys(moved), ['fault']);
  assert.ok(said(fed).includes('start/rows → has/records'));
});

test('a connection held on a use\'s header from before reads once as its own new input row; a preset\'s stays; editWorkflow and readWorkflow alone never match one by type', () => {
  const kinds = { ...lib.kindsOf(hasLib()), ...NODE_KINDS };
  const read = heldInputs(fedOnHeader(), hasLib());
  assert.deepEqual(read.ids, ['has-status']);
  assert.deepEqual(said(read.workflow), ['has/matching → end', 'start/rows → c', 'start/rows → has/start-rows', 'val/value → has/val-value']);
  assert.deepEqual(inputsOf(read.library).map(([n]) => n), ['records', 'status', 'start-rows', 'val-value']);
  // Once: read again, nothing moves.
  const again = heldInputs(read.workflow, read.library);
  assert.deepEqual(again.ids, []);
  assert.equal(again.workflow, read.workflow);
  // A preset's cannot take an input: it stays where it was.
  const presets = heldInputs(fedOnHeader(hasLib(true)), hasLib(true));
  assert.deepEqual(presets.ids, []);
  assert.ok(said(presets.workflow).includes('start/rows → has'));
  // The workflow functions know no definition: a header connection stays on the header.
  assert.ok(said(readWorkflow(fedOnHeader(), kinds).workflow).includes('start/rows → has'));
  assert.ok(said(editWorkflow(beside(), { connection: { from: 'start/rows', to: 'has' } }, kinds)).includes('start/rows → has'));
});

test('the Group Input shows a row per connected input, each an output socket connected to the nodes it feeds', () => {
  // Store's rows into two Conditions, a Value into both their Value rows: two inputs, each joined to both.
  const w = {
    v: 3, id: 'flow',
    nodes: [
      { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'users' } },
      { id: 'val', kind: 'value', x: 0, y: 200, values: { value: 'active' } },
      { id: 'a', kind: 'condition', x: 360, y: 0, values: { type: 'eq' } },
      { id: 'b', kind: 'condition', x: 360, y: 300, values: { type: 'ne' } },
      { id: 'end', kind: 'result', x: 720, y: 0 },
    ],
    connections: [
      { from: 'start/rows', to: 'a' }, { from: 'start/rows', to: 'b' }, { from: 'val/value', to: 'a/b' }, { from: 'val/value', to: 'b/b' }, { from: 'a/pass', to: 'end' },
    ],
  };
  const made = groupNodes(w, ['a', 'b'], empty(), { label: 'Both' }, undefined, facts);
  assert.ok(!made.fault, made.fault);
  const inner = lib.innerOf(made.workflow.nodes.find((n) => n.id === made.use), made.library);
  const rows = inner.kinds[lib.GROUP_INPUT].rows;
  assert.deepEqual(rows.map((r) => [r.name, r.output]), [['start-rows', 'object'], ['val-value', 'value']]);
  for (const r of rows) assert.deepEqual(inner.workflow.connections.filter((x) => x.from === `#in/${r.name}`).map((x) => x.to).sort(), r.name === 'start-rows' ? ['a', 'b'] : ['a/b', 'b/b']);
  assert.deepEqual(sorted(ungroupUse(made.workflow, made.use, made.library).workflow), sorted(w));
  // Only its rows send: no header socket (Will, 765), so a connection from `#in` itself is a fault.
  assert.equal(inner.kinds[lib.GROUP_INPUT].output, undefined);
  const fromHeader = { ...inner.workflow, connections: [...inner.workflow.connections, { from: '#in', to: 'a' }] };
  assert.ok(workflowFaults(fromHeader, inner.kinds, facts).some((f) => f.includes('"#in"')), 'a connection from the Group Input header is a fault');
});

test('ungroup of what is no Custom Node is refused; a parameter nothing fed lands on its row', () => {
  assert.match(ungroupUse(flow(), 'cond', empty()).fault, /only a Custom Node/);
  const made = groupNodes(flow(), ['cond'], empty(), { label: 'Status check' }, undefined, facts);
  const loose = { ...made.workflow, connections: made.workflow.connections.filter((r) => r.from !== 'val/value') };
  const lib2 = structuredClone(made.library);
  lib2.nodes[made.id].inputs.find((i) => i.name === 'val-value').default = 'trial';
  const back = ungroupUse(loose, made.use, lib2);
  assert.equal(back.workflow.nodes.find((n) => n.id === 'cond').values.b, 'trial');
});
