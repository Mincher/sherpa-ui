#!/usr/bin/env node
/**
 * generate-defs.mjs — RETIRED (2026-09-02).
 *
 * This was the code → `*.thin.yaml` generator (parsed each component's .ts/.html/
 * .css into a thin def and wrote `<name>.thin.yaml`, thinned via thin-def.mjs).
 *
 * `*.thin.yaml` has been RETIRED. Its successor is the DTCG-dialect component spec:
 *
 *     node scripts/generate-component-spec.mjs --all
 *
 * generate-component-spec.mjs derives `*.component.yaml` from the same HTML/CSS/TS
 * sources (with richer output: enum values, anatomy, events, token bindings,
 * element, states) and preserves the Figma binding under `$extensions.sherpa`.
 * thin-def.mjs (the full-def ↔ thin converter this imported `thin` from) has been
 * deleted, so this script no longer has a code path.
 *
 * Kept as a stub (not deleted) so nothing that references the path errors.
 */
console.error(
  'generate-defs.mjs is RETIRED (thin.yaml is gone). Use:\n\n' +
  '    node scripts/generate-component-spec.mjs --all\n\n' +
  'to (re)generate the *.component.yaml specs. See the header of this file.',
);
process.exit(0);
