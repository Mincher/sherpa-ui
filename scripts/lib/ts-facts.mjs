/**
 * ts-facts.mjs — read the facts a spec DETERMINES out of a component's TypeScript.
 *
 * Today that is the `observed` list. It lives here rather than in the spec
 * generator because two things need it and only one had the fixes: the generator
 * and `roundtrip-component.mjs` each had their own reader, and the fork's was the
 * naive `/static override observed = \[([^\]]*)\]/` regex. Both of the bugs
 * below had been found and fixed in the generator; neither reached the copy, so
 * the two disagreed on 5 of 58 components — one reporting all green while the
 * other failed five.
 */

/**
 * The `static override observed` list, as names.
 *
 * COMMENTS ARE STRIPPED FIRST. This used to be a bare `split(',')`, so a
 * component that explained an entry inline —
 *
 *   static override observed = [
 *     'data-select',
 *     // SINGLE vs multiple changes the CONTROL each row draws.
 *     'data-filter-fields',
 *   ];
 *
 * — produced observed names like "// SINGLE vs multiple changes the CONTROL
 * each row draws" and failed its own round-trip. The spec then looked "flaky"
 * when the only thing that had changed was a comment.
 *
 * Comments in this array are not unusual: `observed` is where a component says
 * WHY an attribute is reactive, which is exactly the kind of thing worth
 * writing down next to it.
 */
export function parseObserved(ts) {
  const src = ts ?? '';
  const m = /static override observed\s*=\s*\[([\s\S]*?)\]/.exec(src);
  if (!m) return [];
  const out = [];
  for (const raw of m[1]
    .replace(/\/\*[\s\S]*?\*\//g, '')   // block comments
    .replace(/\/\/[^\n]*/g, '')           // line comments
    .split(',')) {
    const tok = raw.trim().replace(/^['"]|['"]$/g, '');
    if (!tok) continue;
    /* `...MIRRORED` spreads a const array declared above — the select controls
       share one list of native attributes they copy onto the inner <input>.
       Read as a literal it became an attribute called `...MIRRORED`, so both
       components failed the round-trip for ever. Expand it from the file. */
    const spread = /^\.\.\.\s*([A-Za-z_$][\w$]*)$/.exec(tok);
    if (spread) {
      out.push(...expandArrayConst(src, spread[1]));
      continue;
    }
    out.push(tok);
  }
  return out;
}

/**
 * Read a module-level `const NAME = ['a', 'b'] as const;` back into its strings.
 *
 * Returns `[]` when the name is not a plain array of literals here — an import,
 * a computed value, a call. An honest gap beats a guessed one, the same ruling
 * that leaves an un-inferable event detail as `unknown`.
 */
export function expandArrayConst(src, name) {
  const re = new RegExp(`const\\s+${name}\\s*=\\s*\\[([\\s\\S]*?)\\]`);
  const m = re.exec(src);
  if (!m) return [];
  return m[1]
    .split(',')
    .map((x) => x.trim())
    .filter((x) => /^(['"]).*\1$/.test(x))
    .map((x) => x.slice(1, -1));
}

