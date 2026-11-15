/**
 * A GRAPH UNFURLS WHEN IT OPENS, unless a reader laid it out by hand — Will, TODO 1000, plan 1001 D4 A. The data half: a
 * move marks the graph `byHand`, a place edit says whether it is a hand layout (an Arrange) or not (an Unfurl, which
 * clears the mark), and the mark is a place: it saves itself, travels with the places and never lights Save.
 * TRAP T-a-graph-unfurls-when-it-opens
 *
 *   node --test test/unit/a-graph-unfurls-when-it-opens.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const core = new URL('../../dist/core/data/', import.meta.url);
const { editWorkflow } = await import(new URL('workflow.js', core));
const { placesOf, withPlaces, withoutPlaces, isGraphPlaces } = await import(new URL('graph-layout.js', core));

const flow = {
  v: 3, id: 'g',
  nodes: [{ id: 'a', kind: 'value', x: 0, y: 0 }, { id: 'b', kind: 'value', x: 300, y: 0 }],
  connections: [],
};

test('a node moved by hand marks the graph; a name set does not', () => {
  assert.equal(editWorkflow(flow, { node: 'a', set: { x: 40, y: 0 } }).byHand, true);
  assert.equal(editWorkflow(flow, { node: 'a', set: { heading: 'A' } }).byHand, undefined);
});

test('a bend and a zip tie are hand layout too: made, moved or cut, each marks the graph; only an Unfurl clears it (1001c)', () => {
  const joined = { ...flow, connections: [{ from: 'a/value', to: 'b/value' }] };
  const connection = joined.connections[0];
  const bent = editWorkflow(joined, { bend: { connection, at: 0, x: 150, y: 80, insert: true } });
  assert.equal(bent.connections[0].via?.length, 1);
  assert.equal(bent.byHand, true);
  assert.equal(editWorkflow({ ...bent, byHand: undefined }, { unbend: { connection: bent.connections[0], index: 0 } }).byHand, true);
  const tied = editWorkflow(joined, { tie: { id: 't', x: 150, y: 40, connections: [connection] } });
  assert.equal(tied.ties?.length, 1);
  assert.equal(tied.byHand, true);
  const bare = { ...tied, byHand: undefined };
  assert.equal(editWorkflow(bare, { moveTie: { id: 't', x: 170 } }).byHand, true);
  assert.equal(editWorkflow(bare, { untie: 't' }).byHand, true);
  // An Unfurl's place edit clears it.
  assert.equal(editWorkflow(bent, { place: { nodes: { a: { x: 0, y: 0 }, b: { x: 300, y: 0 } }, bends: 'reset', byHand: false } }).byHand, undefined);
});

test('a place edit marks it as it says: a group drag or an Arrange by hand; an Unfurl clears it; none, as it was', () => {
  const nodes = { a: { x: 10, y: 10 }, b: { x: 400, y: 10 } };
  const hand = editWorkflow(flow, { place: { nodes, byHand: true } });
  assert.equal(hand.byHand, true);
  assert.equal(editWorkflow(hand, { place: { nodes, byHand: false } }).byHand, undefined);
  assert.equal(editWorkflow(hand, { place: { nodes } }).byHand, true);
});

test('the mark is a place: read, put back and dropped with them, never what the graph does', () => {
  const hand = { ...flow, byHand: true };
  const places = placesOf(hand);
  assert.equal(places.byHand, true);
  assert.equal(isGraphPlaces(JSON.parse(JSON.stringify(places))), true);
  assert.equal(withPlaces(flow, places).byHand, true);
  assert.equal(withPlaces(hand, placesOf(flow)).byHand, undefined, 'places that say none clear it');
  assert.equal('byHand' in withoutPlaces(hand), false, 'no change to publish');
});
