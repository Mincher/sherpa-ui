/**
 * A CUSTOM NODE HAS TAGS: an entity's `tags`, a list of words, in the envelope (entity.v2) and in a
 * Custom Node's definition. Set by Save as Custom Node, New graph and Save graph as; tidied
 * (trimmed, one of each); kept through the shelf and its Custom Node view both ways; checked in words;
 * and read by the node panel, whose search finds a node by one. Will, TODO 784.
 * TRAP T-a-node-panel-lists-under-sticky-headings
 *
 *   node --test test/unit/a-custom-node-has-tags.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { schemaCheck } from '../../scripts/lib/schema-check.mjs';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const { definitionOf, nodeEntityOf } = await import(new URL('data/entity.js', core));
const { tidyTags } = await import(new URL('data/tags.js', core));
const { entityFaults } = await import(new URL('data/entity-check.js', core));
const { keepNode } = await import(new URL('data/custom-nodes.js', core));
const { newGraph, saveGraphAs } = await import(new URL('data/graph-views.js', core));
const { kindsOf, nodeLibraryFaults, versionOf } = await import(new URL('data/node-library.js', core));
const { groupNodes } = await import(new URL('data/node-group.js', core));
const { NODE_KINDS, paletteMatch, paletteOf } = await import(new URL('data/node-kinds.js', core));

/** A Custom Node entity: rows in, the active ones out. */
const node = (id, extra = {}) => ({
  v: 2, type: 'node', id, label: 'Org permissions',
  graph: {
    nodes: [{ id: 'active', kind: 'condition', x: 200, y: 0, values: { type: 'eq', b: 'active' } }, { id: 'status', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
    connections: [{ from: '#in/rows', to: 'status' }, { from: 'status/field', to: 'active' }, { from: 'active/pass', to: '#out/active' }],
  },
  settings: { inputs: [{ name: 'rows', type: 'object' }], outputs: [{ name: 'active', type: 'object' }] },
  ...extra,
});
const keeper = () => new PageKeeper({ tab: memoryTier(), local: memoryTier() });

test('tags are words: trimmed, an empty one or no text dropped, a repeat in any case kept once', () => {
  assert.deepEqual(tidyTags([' permissions ', 'Users', '', 'users', 3, 'PERMISSIONS', 'dates']), ['permissions', 'Users', 'dates']);
  assert.deepEqual(tidyTags(undefined), []);
  assert.deepEqual(tidyTags('a,b'), []);
});

test('the envelope and a definition say tags the same way: the schema, the check, and their faults in words', () => {
  const tagged = node('org', { tags: ['permissions', 'users'] });
  assert.deepEqual(schemaCheck('entity.v2.json')(tagged), []);
  assert.deepEqual(entityFaults(tagged), []);
  const definition = definitionOf(tagged);
  assert.deepEqual(definition.tags, ['permissions', 'users']);
  assert.deepEqual(schemaCheck('defs.v1.json#/$defs/nodeDefinition')(definition), []);
  for (const tags of [['permissions', 'permissions'], ['', 'users'], 'permissions', [3]]) {
    assert.notDeepEqual(schemaCheck('entity.v2.json')(node('org', { tags })), [], JSON.stringify(tags));
    assert.equal(entityFaults(node('org', { tags })).length, 1, JSON.stringify(tags));
  }
  assert.match(entityFaults(node('org', { tags: ['Users', 'users'] }))[0], /the Custom Node "org" has a tag twice/);
  assert.match(entityFaults(node('org', { tags: [3] }))[0], /has tags that are not a list of words/);
  assert.deepEqual(nodeLibraryFaults({ v: 1, nodes: { org: { ...definition, tags: 'users' } } }), ['the Custom Node "org" has tags that are not a list of words']);
});

test('tags are no part of a definition\'s version: a use does not go stale for a tag', () => {
  const plain = definitionOf(node('org'));
  assert.equal(versionOf({ ...plain, tags: ['permissions'] }), versionOf(plain));
});

test('the shelf keeps tags, and its library and the door hand them back both ways; an empty list is not kept', async () => {
  const k = keeper();
  assert.equal(await k.entities.save(node('org', { tags: ['permissions'] })), true);
  assert.deepEqual(k.entities.get('org').tags, ['permissions']);
  assert.deepEqual(k.entities.library().nodes.org.tags, ['permissions']);
  assert.deepEqual(await keepNode(k.entities, 'org', { ...k.entities.library().nodes.org, tags: ['permissions', 'users'] }), { id: 'org' });
  assert.deepEqual(k.entities.get('org').tags, ['permissions', 'users']);
  assert.deepEqual(nodeEntityOf('org', k.entities.library().nodes.org).tags, ['permissions', 'users']);
  assert.equal(await k.entities.save({ ...k.entities.get('org'), tags: [] }), true);
  assert.equal('tags' in k.entities.get('org'), false);
});

test('New graph and Save graph as take tags, tidied; a copy given none keeps the ones it was copied from', async () => {
  const k = keeper();
  const type = { id: 'node', label: 'Custom Node', defaults: { inputs: [], outputs: [] } };
  const id = await newGraph(k.entities, type, { label: 'Dates', tags: [' dates ', 'Dates', 'time'] });
  assert.deepEqual(k.entities.get(id).tags, ['dates', 'time']);
  const graph = k.entities.get(id).graph;
  const copy = await saveGraphAs(k.entities, id, { graph }, { label: 'Dates two' });
  assert.deepEqual(k.entities.get(copy).tags, ['dates', 'time']);
  const retagged = await saveGraphAs(k.entities, id, { graph }, { label: 'Dates three', tags: ['calendar'] });
  assert.deepEqual(k.entities.get(retagged).tags, ['calendar']);
  const untagged = await saveGraphAs(k.entities, id, { graph }, { label: 'Dates four', tags: [] });
  assert.equal('tags' in k.entities.get(untagged), false);
});

test('Save as Custom Node tags the definition it makes', () => {
  const flow = { v: 3, id: 'g', nodes: [
    { id: 'start', kind: 'source', x: 0, y: 0, values: { store: 'customers' } },
    { id: 'a', kind: 'condition', x: 300, y: 0, values: { type: 'eq', b: 'active' } },
    { id: 'b', kind: 'condition', x: 600, y: 0, values: { type: 'eq', b: 'pro' } },
  ], connections: [{ from: 'start/rows', to: 'a' }, { from: 'a/pass', to: 'b' }] };
  const made = groupNodes(flow, ['a', 'b'], { v: 1, nodes: {} }, { label: 'Active pro', tags: ['plans', ' plans', ''] });
  assert.ok(!('fault' in made), made.fault);
  assert.deepEqual(made.library.nodes[made.id].tags, ['plans']);
});

test('the panel reads a Custom Node\'s tags, and its search finds it by one', () => {
  const kinds = { ...NODE_KINDS, ...kindsOf({ v: 1, nodes: { org: definitionOf(node('org', { tags: ['permissions'] })) } }) };
  assert.deepEqual(kinds.org.tags, ['permissions']);
  // A bad file breaks nothing: its tags are tidied as it is read.
  assert.deepEqual(kindsOf({ v: 1, nodes: { org: { ...definitionOf(node('org')), tags: ['  ', 'x', 7] } } }).org.tags, ['x']);
  const custom = paletteOf(kinds).find((g) => g.category === 'Custom Nodes');
  assert.deepEqual(custom.items.map((i) => i.id), ['org']);
  assert.deepEqual(paletteMatch(kinds.org, 'PERM'), {});
  assert.deepEqual(paletteMatch(kinds.org, 'org'), {});
  assert.equal(paletteMatch(kinds.org, 'zzz'), undefined);
  assert.equal(paletteMatch(NODE_KINDS.value, 'perm'), undefined);
});
