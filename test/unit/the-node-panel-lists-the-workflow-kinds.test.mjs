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
  assert.deepEqual(palette.map((g) => g.category), ['Sources', 'Custom Nodes', 'Variables', 'Math', 'Logic', 'AI', 'Time', 'Organise', 'Utils', 'Output']);
  assert.deepEqual(palette.map((g) => g.items.map((i) => i.id)), [['source'], [], ['value', 'field'], ['math'], ['condition'], ['provider', 'model', 'prompt', 'runbook', 'skill'], ['time'], ['sort', 'group'], ['text', 'tag', 'portal'], ['output', 'output']]);
  // Eighteen items, in the plan's order: the Portal is a Utils (TODO 779); Notify, an Output of type Notification (plan 891);
  // the AI nodes after Logic (plan 926).
  assert.deepEqual(palette.flatMap((g) => g.items.map((i) => i.heading ?? i.kind.heading)), ['Source', 'Value', 'Field', 'Math', 'Condition', 'Provider', 'Model', 'Prompt', 'Runbook', 'Skill', 'Time', 'Sort', 'Group', 'Text', 'Tag', 'Portal', 'Output', 'Notify']);
  // The order is the list's: each category is where NODE_CATEGORIES puts it.
  const at = palette.map((g) => NODE_CATEGORIES.indexOf(g.category));
  assert.deepEqual(at, [...at].sort((a, b) => a - b));
});

test('no Query-only kind is in it, and each workflow kind is', () => {
  const all = ids(paletteOf(NODE_KINDS));
  for (const [id, kind] of Object.entries(NODE_KINDS)) {
    assert.equal(all.includes(id), kind.graphs.includes('workflow'), id);
    if (kind.graphs.includes('workflow')) assert.ok(kind.category, `${id} has a category`);
  }
  for (const query of ['status', 'scope', 'preset', 'saved', 'arrange', 'presentation', 'component']) assert.ok(!all.includes(query), query);
});

test('a search finds a family by its name, or by a type\'s: "round" finds Math, as Round', () => {
  // An alias (Notify) answers by its own name, not its family's types.
  const items = paletteOf(NODE_KINDS).flatMap((g) => g.items).filter((i) => !i.type);
  const found = (q) => items.flatMap((i) => { const hit = paletteMatch(i.kind, q); return hit ? [[i.id, hit.type]] : []; });
  assert.deepEqual(found('round'), [['math', 'round']]);
  assert.deepEqual(found('ROUND '), [['math', 'round']], 'any case, trimmed');
  assert.deepEqual(found('sor'), [['sort', undefined]]);
  // Logic's Between takes two ends of a value; Time's, of a date.
  assert.deepEqual(found('between'), [['condition', 'between'], ['time', 'between']]);
  assert.deepEqual(found('includes'), [['tag', 'includes']]);
  // A name that matches places the family as its default; a type's name places that type.
  assert.deepEqual(found('math'), [['math', undefined]]);
  // An AI node's Expects is a type too: Text finds each, as Text (plan 926).
  assert.deepEqual(found('text'), [['value', 'text'], ['prompt', 'text'], ['runbook', 'text'], ['skill', 'text'], ['text', undefined]]);
  assert.deepEqual(found('zzz'), []);
  assert.equal(found('').length, 17, 'nothing typed finds all');
});

test("an app's own kind goes after the known categories; one with none is Other", () => {
  const mine = { heading: 'Mine', icon: 'x', rows: [], model: 'mine', graphs: ['workflow'], category: 'Agents' };
  const bare = { heading: 'Bare', icon: 'x', rows: [], model: 'bare', graphs: ['workflow'] };
  const palette = paletteOf({ ...NODE_KINDS, mine, bare });
  assert.deepEqual(palette.slice(-2).map((g) => g.category), ['Agents', 'Other']);
});

test('a socket is offered the kinds that could join it, a Value first', () => {
  const palette = paletteOf(NODE_KINDS);
  // A value output goes into a header or row that takes a value or anything.
  const fromValue = paletteFor(palette, 'value', 'out').map((i) => i.id);
  assert.ok(fromValue.includes('condition') && fromValue.includes('output') && !fromValue.includes('value'));
  assert.ok(fromValue.includes('math') && fromValue.includes('time'));
  // An input that takes a value is fed by a kind that gives one: a Value first; a Source, a Field, a Group and a Condition, as their Count property row.
  const into = paletteFor(palette, 'value', 'in').map((i) => i.id);
  assert.equal(into[0], 'value');
  assert.ok(into.includes('group') && into.includes('math'));
  assert.deepEqual(fitOf(NODE_KINDS['group'], 'value', 'in'), { row: 'count' });
  assert.deepEqual(fitOf(NODE_KINDS['sort'], 'object', 'out'), {}, 'a Sort takes the rows on its header');
  // A list into a Math's own type: Floor takes it, in its Values row.
  assert.deepEqual(fitOf(NODE_KINDS['math'], 'object', 'out'), { row: 'values', type: 'floor' });
  assert.deepEqual(fitOf(NODE_KINDS['text'], 'object', 'in'), { row: 'result', type: 'split' });
  // Nothing is fed a boolean but a True, and a Value gives none.
  assert.ok(!paletteFor(palette, 'boolean', 'in').some((i) => i.id === 'value'));
  assert.deepEqual(fitOf(NODE_KINDS['value'], 'value', 'in'), { row: 'value' });
  assert.deepEqual(fitOf(NODE_KINDS['output'], 'object', 'out'), {});
  assert.equal(fitOf(NODE_KINDS['value'], 'value', 'out'), undefined);
});

test('"Add a node" from what an output gives lists only the kinds that can use it: a Field\'s column, a Store\'s rows (plan 783 F6)', async () => {
  const { takesGiven } = await import(new URL('../../dist/core/data/node-input.js', import.meta.url));
  const palette = paletteOf(NODE_KINDS);
  const offered = (given) => paletteFor(palette, 'object', 'out').filter((i) => takesGiven(i.kind, given)).map((i) => i.id);
  // A column fits what takes a field, rows, an object or a list; a number's a Math's list, a date's a Time.
  // A portal's In takes anything (TODO 779).
  // An AI node's header reads anything: the data it asks about (plan 926).
  assert.deepEqual(offered('field'), ['field', 'math', 'condition', 'prompt', 'runbook', 'skill', 'time', 'sort', 'group', 'text', 'tag', 'portal', 'output']);
  // Rows fit no Tag (it takes a Field), no Math and no Time: their inputs never read rows.
  assert.deepEqual(offered('rows'), ['field', 'condition', 'prompt', 'runbook', 'skill', 'portal', 'output']);
  assert.deepEqual([takesGiven(NODE_KINDS.math, 'rows'), takesGiven(NODE_KINDS.math, 'field'), takesGiven(NODE_KINDS.value, 'field')], [false, true, false]);
});
