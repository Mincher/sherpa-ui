/**
 * NO COMPONENT DRAWS A BARE `<input type="number">` — TODO 127.
 *
 * A number a reader types goes in `sherpa-input-text data-type="number"`:
 * right-aligned, "Enter a value", Sherpa's own steppers. A bare native input
 * came back once, so a template that holds one fails here.
 *
 *   node --test test/unit/a-number-input-is-sherpas.test.mjs
 *
 * TRAP T-a-number-input-wears-sherpas-steppers
 */

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

const COMPONENTS = join(import.meta.dirname, '../../src/components');

/** The ONE template that may hold one: the number field itself. Will,
 *  2026-09-30: "all numerical inputs should use Sherpa's style." */
const ALLOWED = { 'sherpa-input-text': 'the number field itself' };

test('a number is typed in a Sherpa number field, never a bare native input', () => {
  const bare = readdirSync(COMPONENTS).filter((name) => {
    if (name in ALLOWED) return false;
    try {
      return /<input\b[^>]*\btype="number"/.test(readFileSync(join(COMPONENTS, name, `${name}.html`), 'utf8'));
    } catch { return false; }
  });
  assert.deepEqual(bare, [], `these templates hold a bare <input type="number">; use <sherpa-input-text data-type="number">: ${bare.join(', ')}`);
});
