/**
 * A NEW STAGE TAKES THE NEXT COLOUR (Will, TODO 957: "Generated graph stages should iterate through the available
 * colours"): one rule for the editor and an app alike. A new stage takes the palette's first colour no stage wears; all
 * worn, the next in turn. Stages made from nothing wear colour 1, 2, 3 in order; a stage keeps the colour it has.
 *
 *   node --test test/unit/a-new-stage-takes-the-next-colour.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

const { nextStageColour, colourStages } = await import(new URL('../../dist/core/data/node-stages.js', import.meta.url));
const PALETTE = ['c1', 'c2', 'c3'];

test('a new stage takes the first colour no stage wears; all worn, the next in turn; no palette, none', () => {
  assert.equal(nextStageColour([], PALETTE), 'c1');
  assert.equal(nextStageColour([{}, { colour: 'c1' }], PALETTE), 'c2');
  assert.equal(nextStageColour([{ colour: 'c2' }, { colour: 'c1' }], PALETTE), 'c3');
  assert.equal(nextStageColour([{ colour: 'c1' }, { colour: 'c2' }, { colour: 'c3' }, { colour: 'x' }], PALETTE), 'c2');
  assert.equal(nextStageColour([{}], []), undefined);
});

test('stages made from nothing wear the palette in order; one with its own keeps it, and the rest skip it', () => {
  assert.deepEqual(colourStages([{ id: 'a' }, { id: 'b' }, { id: 'c' }, { id: 'd' }], PALETTE).map((s) => s.colour), ['c1', 'c2', 'c3', 'c1']);
  assert.deepEqual(colourStages([{ id: 'a' }, { id: 'b', colour: 'c1' }, { id: 'c' }], PALETTE).map((s) => s.colour), ['c2', 'c1', 'c3']);
  const given = [{ id: 'a', colour: 'mine' }];
  assert.equal(colourStages(given, PALETTE)[0], given[0], 'kept as it is');
});
