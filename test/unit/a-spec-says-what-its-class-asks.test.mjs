/**
 * A SPEC SAYS WHAT ITS CLASS ASKS, TAKES, PRESENTS AND READS of the app's
 * settings — read from `static asks`, `takes`, `presents` and `settings`, never
 * written by hand, and each naming what exists. TODO 700 G0
 *
 *   node --test test/unit/a-spec-says-what-its-class-asks.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import ts from 'typescript';
import { parseDataDecls } from '../../scripts/lib/ts-facts.mjs';
import { SETTINGS } from '../../dist/core/data/settings.js';

const SCHEMA = JSON.parse(readFileSync('schemas/component.v1.json', 'utf8'));
const SPECS = readdirSync('src/components')
  .map((n) => JSON.parse(readFileSync(`src/components/${n}/${n}.component.json`, 'utf8')));

test('the four statics are read as JSON: a function in an ask is true', () => {
  const data = parseDataDecls(`
export class SherpaThing extends SherpaElement {
  static override asks: DataAsk = { shape: 'rows', keepEmpty: true, fields: (el) => [], picks: { event: 'thing-click', narrows: 'host' } };
  static takes: readonly Take[] = ['card'];
  static override presents = { kind: 'thing', accepts: ['rows'], is: { 'data-type': 'thing' } } as const;
  static override settings = { 'data-no-results': '!results' };
  static asked = { shape: 'all' };
}
customElements.define('sherpa-thing', SherpaThing);
`);
  assert.deepEqual(data, {
    asks: { shape: 'rows', keepEmpty: true, fields: true, picks: { event: 'thing-click', narrows: 'host' } },
    takes: ['card'],
    presents: { kind: 'thing', accepts: ['rows'], is: { 'data-type': 'thing' } },
    settings: { 'data-no-results': '!results' },
  });
  assert.throws(() => parseDataDecls('export class SherpaThing { static asks = ASK; }'), /`ASK` is not a literal/);
});

/** A union of string literals, as context.ts writes it. */
function union(name, member) {
  const sf = ts.createSourceFile('context.ts', readFileSync('src/core/ui/context.ts', 'utf8'), ts.ScriptTarget.Latest, true);
  const decl = sf.statements.find((s) => s.name?.text === name);
  const type = member ? decl.members.find((m) => m.name.text === member).type : decl.type;
  return type.types.map((t) => t.literal.text);
}

test('the schema\'s shapes and takes are the class\'s own types', () => {
  assert.deepEqual(SCHEMA.$defs.shape.enum, union('DataAsk', 'shape'));
  assert.deepEqual(SCHEMA.$defs.take.enum, union('Take'));
});

test('each names what exists: its props, slots and events, and the app\'s settings', () => {
  const wrong = SPECS.flatMap((s) => {
    const props = new Set((s.props ?? []).map((p) => p.name));
    const slots = new Set((s.slots ?? []).map((p) => p.name));
    const events = new Set((s.events ?? []).map((e) => e.name));
    return [
      ...Object.entries(s.settings ?? {}).flatMap(([attr, key]) => [
        ...(props.has(attr) ? [] : [`settings: ${attr} is no prop`]),
        ...(key.replace(/^!/, '') in SETTINGS ? [] : [`settings: ${key} is no setting`]),
      ]),
      ...(s.presents ?? []).flatMap((p) => [
        ...(p.slots ?? []).filter((n) => !slots.has(n)).map((n) => `presents ${p.kind}: ${n} is no slot`),
        ...Object.keys(p.is ?? {}).filter((n) => !props.has(n)).map((n) => `presents ${p.kind}: ${n} is no prop`),
      ]),
      ...(s.asks?.picks && !events.has(s.asks.picks.event) ? [`asks: ${s.asks.picks.event} is no event`] : []),
    ].map((w) => `${s.$name} ${w}`);
  });
  assert.deepEqual(wrong, []);
});
