/**
 * A SAVED CUSTOM NODE IS RETAGGED IN PLACE: its inspector's Tags field edits the DEFINITION's tags,
 * as every use shares the definition. Tidied; no part of its version, so no use goes stale; a
 * preset's are refused, and no change is no edit. Will, TODO 819.
 *
 *   node --test test/unit/a-saved-custom-node-is-retagged.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/', import.meta.url);
const { PageKeeper, memoryTier } = await import(new URL('browser/page-state.js', core));
const { nodesView } = await import(new URL('data/entity-shelf.js', core));
const { definitionDiff, kindsOf, staleUses, tagDefinition, useOf, versionOf } = await import(new URL('data/node-library.js', core));

const ORG = {
  v: 1, label: 'Org permissions', tags: ['permissions'],
  inputs: [{ name: 'rows', type: 'object' }], outputs: [{ name: 'active', type: 'object' }],
  nodes: [{ id: 'active', kind: 'condition', x: 200, y: 0, values: { type: 'eq', b: 'active' } }, { id: 'status', kind: 'field', x: 0, y: 0, values: { field: 'status' } }],
  connections: [{ from: '#in/rows', to: 'status' }, { from: 'status/field', to: 'active' }, { from: 'active/rows', to: '#out/active' }],
};
const library = () => ({ v: 1, nodes: { org: structuredClone(ORG), shipped: { ...structuredClone(ORG), label: 'Shipped', tags: ['checks'], preset: true } } });
/** Two uses of one definition, and a preset's. */
const flowOf = (lib) => ({
  v: 3, id: 'g', nodes: [useOf(lib, 'org', { id: 'perm', x: 0, y: 0 }), useOf(lib, 'org', { id: 'perm2', x: 0, y: 300 }), useOf(lib, 'shipped', { id: 'own', x: 400, y: 0 })],
});

test('an edit of one use\'s tags edits its definition: every use of it shows them, and the workflow is untouched', () => {
  const lib = library();
  const flow = flowOf(lib);
  const before = JSON.stringify(flow);
  const kind = flow.nodes.find((n) => n.id === 'perm').kind;
  const next = tagDefinition(lib, kind, [' permissions', 'billing', 'Billing', '']);
  assert.deepEqual(next.nodes.org.tags, ['permissions', 'billing']);
  // Both uses are one kind: the panel lists that kind under each tag.
  assert.deepEqual(kindsOf(next).org.tags, ['permissions', 'billing']);
  assert.equal(JSON.stringify(flow), before);
  // The library given is not changed: the editor's Undo holds it.
  assert.deepEqual(lib.nodes.org.tags, ['permissions']);
});

test('tags are no part of the version: no use goes stale for one, and no diff is offered', () => {
  const lib = library();
  const flow = flowOf(lib);
  const next = tagDefinition(lib, 'org', ['billing']);
  assert.equal(versionOf(next.nodes.org), versionOf(lib.nodes.org));
  assert.deepEqual(staleUses(flow, next), []);
  assert.equal(definitionDiff(flow.nodes[0], next)?.stale, false);
});

test('a preset refuses; so does a definition that is not there, and no change: the same library comes back', () => {
  const lib = library();
  assert.equal(tagDefinition(lib, 'shipped', ['mine']), lib);
  assert.deepEqual(lib.nodes.shipped.tags, ['checks']);
  assert.equal(tagDefinition(lib, 'nowhere', ['x']), lib);
  assert.equal(tagDefinition(lib, 'org', ['permissions', ' Permissions ']), lib);
});

test('the last tag taken off leaves no list, and Save through the shelf keeps the tags on the entity', async () => {
  const cleared = tagDefinition(library(), 'org', []);
  assert.equal('tags' in cleared.nodes.org, false);
  const keeper = new PageKeeper({ tab: memoryTier(), local: memoryTier() });
  const shelf = nodesView(keeper.entities);
  assert.equal(await shelf.save('org', structuredClone(ORG)), true);
  const retagged = tagDefinition(shelf.library(), 'org', ['permissions', 'billing']);
  assert.equal(await shelf.save('org', retagged.nodes.org), true);
  assert.deepEqual(keeper.entities.get('org').tags, ['permissions', 'billing']);
  assert.deepEqual(shelf.library().nodes.org.tags, ['permissions', 'billing']);
});
