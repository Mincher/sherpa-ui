/**
 * THE NODE PANEL'S LIST: each workflow kind has a category, and paletteOf() gives the kinds
 * in category order — never a Query-only kind: ONE item per family, ten (plan 749 P3, D4). A
 * search finds a family by its name or a type's. A socket of a type is offered the kinds that
 * could join it, a Value first, a family as the first type of it that fits. Will, plan 713 M7, D16.
 *
 *   node --test test/unit/the-node-panel-lists-the-workflow-kinds.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { NODE_KINDS, NODE_CATEGORIES, paletteOf, paletteFor, paletteMatch, fitOf } = await import(new URL('../../dist/core/data/node-kinds.js', import.meta.url));

const ids = (palette) => palette.flatMap((g) => g.items.map((i) => i.id));

test('the list is each category with a kind, in order, and Custom Nodes empty', () => {
  const palette = paletteOf(NODE_KINDS);
  assert.deepEqual(palette.map((g) => g.category), ['Triggers', 'Sources', 'Custom Nodes', 'Variables', 'Math', 'Logic', 'AI', 'Time', 'Organise', 'Utils', 'Output']);
  assert.deepEqual(palette.map((g) => g.items.map((i) => i.id)), [['trigger'], ['source'], [], ['value', 'field'], ['math'], ['condition', 'boolean'], ['model', 'prompt', 'runbook', 'skill'], ['time'], ['organise'], ['text', 'portal'], ['notify', 'content', 'response', 'result', 'output-trigger']]);
  // Twenty-one items, in the plan's order: the Trigger first, in Triggers (plan 941 D1 B); the Portal is a Utils (TODO 779); Notify, an
  // Output of type Notification (plan 891); the AI nodes after Logic (plan 926); no Branch, a Boolean after Condition (plan 971 §9); one
  // Organise, for sorting and grouping (plan 960 U4.2).
  assert.deepEqual(palette.flatMap((g) => g.items.map((i) => i.heading ?? i.kind.heading)), ['Trigger', 'Source', 'Value', 'Field', 'Math', 'Condition', 'Boolean', 'Model', 'Prompt', 'Runbook', 'Skill', 'Time', 'Organise', 'Text', 'Portal', 'Notification', 'Content', 'Response', 'Run result', 'Output Trigger']);
  // The order is the list's: each category is where NODE_CATEGORIES puts it.
  const at = palette.map((g) => NODE_CATEGORIES.indexOf(g.category));
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test('no Query-only kind is in it, and each workflow kind is', () => {
  const all = ids(paletteOf(NODE_KINDS));
  for (const [id, kind] of Object.entries(NODE_KINDS)) {
    // A family with no type of its own, as Request, is not listed till an app adds one (plan 917).
    const typeless = !!kind.types && !Object.keys(kind.types).length;
    assert.equal(all.includes(id), kind.graphs.includes('workflow') && !typeless, id);
    if (kind.graphs.includes('workflow')) assert.ok(kind.category, `${id} has a category`);
  }
  for (const query of ['status', 'scope', 'preset', 'arrange', 'presentation', 'component']) assert.ok(!all.includes(query), query);
});

test('a search finds a family by its name, or by a type\'s: "round" finds Math, as Round', () => {
  // An alias (Notify) answers by its own name, not its family's types.
  const items = paletteOf(NODE_KINDS).flatMap((g) => g.items).filter((i) => !i.type);
  const found = (q) => items.flatMap((i) => { const hit = paletteMatch(i.kind, q); return hit ? [[i.id, hit.type]] : []; });
  assert.deepEqual(found('round'), [['math', 'round']]);
  assert.deepEqual(found('ROUND '), [['math', 'round']], 'any case, trimmed');
  assert.deepEqual(found('organ'), [['organise', undefined]]);
  // What it does finds it too, by its keywords: "sort" and "group" find Organise (plan 960 U4.2).
  assert.deepEqual(found('sort'), [['organise', undefined]]);
  assert.deepEqual(found('group').map(([id]) => id), ['organise']);
  // Logic's Between takes two ends of a value; Time's, of a date.
  assert.deepEqual(found('between'), [['condition', 'between'], ['time', 'between']]);
  // Text's Format: a type found by its name (Append and Prepend are a Format, plan 992 O2).
  assert.deepEqual(found('format'), [['text', 'format']]);
  // A name that matches places the family as its default; a type's name places that type.
  assert.deepEqual(found('math'), [['math', undefined]]);
  // An AI node's Expects is a type too: Text finds each, as Text (plan 926).
  assert.deepEqual(found('text'), [['value', 'text'], ['prompt', 'text'], ['runbook', 'text'], ['skill', 'text'], ['text', undefined]]);
  // Math's Count counts rows (plan 944).
  assert.deepEqual(found('count'), [['math', 'count']]);
  assert.deepEqual(found('zzz'), []);
  assert.equal(found('').length, 20, 'nothing typed finds all');
});

test("an app's own kind goes after the known categories; one with none is Other", () => {
  const mine = { heading: 'Mine', icon: 'x', rows: [], model: 'mine', graphs: ['workflow'], category: 'Agents' };
  const bare = { heading: 'Bare', icon: 'x', rows: [], model: 'bare', graphs: ['workflow'] };
  const palette = paletteOf({ ...NODE_KINDS, mine, bare });
  assert.deepEqual(palette.slice(-2).map((g) => g.category), ['Agents', 'Other']);
});

test('the kinds placed last come first, newest first; one that does not fit is left out; then a Value (TODO 968)', () => {
  const palette = paletteOf(NODE_KINDS);
  const into = paletteFor(palette, 'value', 'in', [{ kind: 'organise' }, { kind: 'math' }, { kind: 'prompt' }]).map((i) => i.id);
  assert.deepEqual(into.slice(0, 3), ['math', 'prompt', 'value']);
  assert.ok(!into.includes('organise'));
  assert.deepEqual(paletteFor(palette, 'value', 'in', []).map((i) => i.id), paletteFor(palette, 'value', 'in').map((i) => i.id));
});

test('a use with its picks is its own choice; its kind is offered plain too, in its place (TODO 968)', () => {
  const palette = paletteOf(NODE_KINDS);
  const status = { kind: 'field', values: { field: 'status' }, label: 'Status' };
  const out = paletteFor(palette, 'object', 'out', [status, { kind: 'math' }]);
  // Rows take no Value; the plain Field is still there for another field, first of the rest, as the palette has it.
  assert.deepEqual(out.slice(0, 3).map((c) => [c.id, c.values?.field, c.label]), [['field', 'status', 'Status'], ['math', undefined, undefined], ['field', undefined, undefined]]);
  assert.equal(out.filter((c) => c.id === 'math').length, 1);
  // The Field kind keeps a pick of its field.
  assert.equal(NODE_KINDS.field.rows.find((r) => r.name === 'field').recalls, true);
});

test('a socket is offered the kinds that could join it, a Value first', () => {
  const palette = paletteOf(NODE_KINDS);
  // A value output goes into a header or row that takes a value or anything.
  const fromValue = paletteFor(palette, 'value', 'out').map((i) => i.id);
  assert.ok(fromValue.includes('condition') && fromValue.includes('result') && !fromValue.includes('value'));
  assert.ok(fromValue.includes('math') && fromValue.includes('time'));
  // An input that takes a value is fed by a kind that gives one: a Value first; a Math its Result, an AI node its Answer.
  // No Organise: it has no Count row (plan 944), and sends rows alone. No Condition: it has no True (plan 971 §9).
  const into = paletteFor(palette, 'value', 'in').map((i) => i.id);
  assert.equal(into[0], 'value');
  assert.ok(into.includes('prompt') && into.includes('math') && !into.includes('organise') && !into.includes('condition'));
  assert.deepEqual(fitOf(NODE_KINDS['prompt'], 'value', 'in'), { row: 'answer' });
  assert.equal(fitOf(NODE_KINDS['condition'], 'value', 'in'), undefined);
  assert.equal(fitOf(NODE_KINDS['organise'], 'value', 'in'), undefined);
  assert.deepEqual(fitOf(NODE_KINDS['organise'], 'object', 'out'), {}, 'an Organise takes the rows on its header');
  // A list into a Math's own type: Min takes it, in its Values row.
  assert.deepEqual(fitOf(NODE_KINDS['math'], 'object', 'out'), { row: 'values', type: 'min' });
  assert.deepEqual(fitOf(NODE_KINDS['text'], 'object', 'in'), { row: 'result', type: 'split' });
  // A boolean comes from a header's Out, a Time's or a Tag's (plan 944); a Value gives none.
  assert.ok(!paletteFor(palette, 'boolean', 'in').some((i) => i.id === 'value'));
  assert.deepEqual(fitOf(NODE_KINDS['value'], 'value', 'in'), { row: 'value' });
  assert.deepEqual(fitOf(NODE_KINDS['result'], 'object', 'out'), {});
  assert.equal(fitOf(NODE_KINDS['value'], 'value', 'out'), undefined);
});

test('"Add a node" from what an output gives lists only the kinds that can use it: a Field\'s column, a Store\'s rows (plan 783 F6)', async () => {
  const { takesGiven } = await import(new URL('../../dist/core/data/node-input.js', import.meta.url));
  const palette = paletteOf(NODE_KINDS);
  const offered = (given) => paletteFor(palette, 'object', 'out').filter((i) => takesGiven(i.kind, given)).map((i) => i.id);
  // A column fits what takes a field, rows, an object or a list; a number's a Math's list, a date's a Time.
  // A portal's In takes anything (TODO 779).
  // An AI node's header reads anything: the data it asks about (plan 926).
  // A Condition's Data takes anything (plan 971 §9).
  assert.deepEqual(offered('field'), ['field', 'math', 'condition', 'boolean', 'prompt', 'runbook', 'skill', 'time', 'organise', 'text', 'portal', 'notify', 'content', 'response', 'result', 'output-trigger']);
  // Rows fit no Tag (it takes a Field) and no Time: their inputs never read rows. Math does, as Count (plan 944), and an
  // Organise, on its header (plan 960 U4.2).
  // A Text's Format reads rows too (plan 991a).
  assert.deepEqual(offered('rows'), ['field', 'math', 'condition', 'boolean', 'prompt', 'runbook', 'skill', 'organise', 'text', 'portal', 'notify', 'content', 'response', 'result', 'output-trigger']);
  assert.deepEqual([takesGiven(NODE_KINDS.math, 'rows'), takesGiven(NODE_KINDS.math, 'field'), takesGiven(NODE_KINDS.value, 'field')], [true, true, false]);
});
