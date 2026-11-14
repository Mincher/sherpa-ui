/**
 * A TEXT NAMES WHAT IT MEANS, one way, `{{kind:id}}` (Will, TODO 956: "A"; plan 956): a node's message and an agent's
 * prompt read by one reader. Each reference once, read to its name or to why it names nothing; the kinds registered, the
 * entity types among them; a node's value is `{{value:<node>.<name>}}`, and the old `{node.name}` is plain text.
 * TRAP T-a-text-names-what-it-means
 *
 *   node --test test/unit/a-text-names-what-it-means.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { filled, readRefs, ref, refKinds, refsIn, refsOf, registerEntityType, registerRefKinds, valuesIn } from '../../dist/data.js';

test('a reference is written {{kind:id}}; each where it stands, and each once, in order', () => {
  const text = `Ask ${ref('filter', 'open')} about {{ field:health }}, then ${ref('filter', 'open')} again.`;
  assert.deepEqual(refsIn(text).map((r) => [r.kind, r.id, text.slice(r.at, r.end) === r.written]), [['filter', 'open', true], ['field', 'health', true], ['filter', 'open', true]]);
  assert.deepEqual(refsOf(text).map((r) => r.written), ['{{filter:open}}', '{{ field:health }}']);
  assert.deepEqual(refsIn(undefined), []);
});

test('each reference read: its name, or why it names nothing, in words; a field by its last part', () => {
  const facts = {
    fields: { health: 'Health', building: 'Building' }, steps: { '2.3': 'Retry once' }, outputs: ['found'], stores: { devices: 'Devices' },
    entity: (type, id) => (type === 'filter' && id === 'open' ? 'Open items' : undefined),
  };
  const read = readRefs('{{field:health}} {{field:location.building}} {{step:2.3}} {{output:found}} {{store:devices}} {{filter:open}} {{filter:shut}} {{store:alerts}} {{nope:x}}', facts);
  assert.deepEqual(read.map((r) => r.name ?? r.missing), [
    'Health', 'Building', 'Retry once', 'found', 'Devices', 'Open items',
    'there is no Filter "shut"', 'there is no store of rows "alerts"', read.at(-1).missing,
  ]);
  assert.match(read.at(-1).missing, /^"nope" is no kind a reference names: value, store, field/);
});

test('an app registers its own kinds, read from the facts\' <kind>s; a type it registers is a kind too', () => {
  const back = registerRefKinds(() => ({ customer: { what: 'a customer' } }));
  const type = registerEntityType({ id: 'playbook', label: 'Playbook', graph: { runs: true } });
  try {
    assert.ok('customer' in refKinds() && 'playbook' in refKinds() && 'filter' in refKinds());
    const read = readRefs('{{customer:acme}} {{customer:zed}} {{playbook:p1}}', { customers: { acme: 'Acme Ltd' }, entity: (t, id) => (t === 'playbook' ? id.toUpperCase() : undefined) });
    assert.deepEqual(read.map((r) => r.name ?? r.missing), ['Acme Ltd', 'there is no customer "zed"', 'P1']);
  } finally {
    back();
    type?.();
  }
  assert.ok(!('customer' in refKinds()) && !('playbook' in refKinds()), 'taken back');
});

test('a node\'s value is {{value:<node>.<name>}}: a message reads and fills it; the old {node.name} is plain text', () => {
  const text = 'Hi {{value:s1.name}}, {{value:n.result}} and {s1.name}';
  assert.deepEqual(valuesIn(text).map((p) => [p.node, p.name, p.key]), [['s1', 'name', '{{value:s1.name}}'], ['n', 'result', '{{value:n.result}}']]);
  assert.equal(filled(text, (key) => ({ '{{value:s1.name}}': 'Ada', '{{value:n.result}}': ['a', 'b'] })[key]), 'Hi Ada, a, b and {s1.name}');
  // A value with no node or no name is no value.
  assert.deepEqual(valuesIn('{{value:alone}} {{value:.x}}'), []);
});
