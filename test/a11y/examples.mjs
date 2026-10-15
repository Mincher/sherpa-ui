/**
 * examples.mjs — every component's shipped example, read for the tests.
 * TRAP T-a-component-ships-its-example
 *
 * Map:
 * - EXAMPLES — component → `{ html, fill?, show?, anchor? }`, its markup joined into one string
 */
import { readFileSync, readdirSync } from 'node:fs';

const COMPONENTS = new URL('../../src/components/', import.meta.url);

/** Component → its example, its markup joined into one string. */
export const EXAMPLES = Object.fromEntries(readdirSync(COMPONENTS)
  .filter((name) => name.startsWith('sherpa-'))
  .flatMap((name) => {
    let example;
    try {
      example = JSON.parse(readFileSync(new URL(`${name}/${name}.example.json`, COMPONENTS), 'utf8'));
    } catch {
      return [];
    }
    return [[name, { ...example, html: [example.html].flat().join('') }]];
  }));
