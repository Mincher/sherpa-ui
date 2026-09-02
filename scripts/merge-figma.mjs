#!/usr/bin/env node
/**
 * merge-figma.mjs — RETIRED (2026-09-02).
 *
 * This script belonged to the old def.json / thin.yaml flow: it read the raw
 * bridge dump `scripts/figma-data/figma-read.json` (last captured 2026-08-25,
 * before the token+component overhaul) plus `name-map.yaml`, and injected a rich
 * `figmaVerbatim` block (nodeType, variant axes, bool/text/instance props, mode
 * pins, events, behaviours) into each component's `*.thin.yaml`.
 *
 * `*.thin.yaml` has been RETIRED — `*.component.yaml` is now the single component
 * contract, and its Figma binding lives under `$extensions.sherpa` (only
 * figmaName / category / variantAxes / booleanProps / divergence). The live
 * drift-fix tool is now:
 *
 *     node scripts/resync-figma.mjs scripts/figma-data/live-components.json [--check]
 *
 * resync-figma reads a LIVE snapshot and reconciles `$extensions.sherpa` directly,
 * superseding this script's stale-dump merge. There is no `$extensions.sherpa`
 * shape for the extra fields merge-figma used to write (mode pins, instance props,
 * figma events, behaviours), so repointing it would only duplicate resync-figma
 * against out-of-date data.
 *
 * Kept as a stub (not deleted) so nothing that references the path errors; it does
 * no work and exits cleanly.
 */
console.error(
  'merge-figma.mjs is RETIRED. The Figma binding now lives in *.component.yaml under\n' +
  '$extensions.sherpa. Use:\n\n' +
  '    node scripts/resync-figma.mjs scripts/figma-data/live-components.json --check\n\n' +
  'to check drift, or without --check to reconcile it. See the header of this file.',
);
process.exit(0);
