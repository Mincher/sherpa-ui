/**
 * project-tokens.mjs — project the canonical Figma DTCG export into Sherpa's CSS.
 *
 * Source of truth: src/styles/tokens/figma.tokens.json (figma_export_tokens,
 * format:dtcg, scope:file — the full 28-collection dump).
 *
 * The output mirrors Figma's aliasing tiers as CASCADE LAYERS. The global token
 * layer (src/styles/tokens/tokens.css) carries three layers:
 *
 *   @layer core      — Core, the first alias tier (--sherpa-core-*). Primitive
 *                      references are RESOLVED to their literal values, so the
 *                      Primitives collection is reference-only and never compiled.
 *   @layer style     — Style (Sherpa), the semantic tier (--sherpa-content-*,
 *                      --sherpa-surface-*, --sherpa-border-*, status/data-viz/…).
 *                      Light in :root; dark re-points in :root[data-mode="dark"]
 *                      and @media(prefers-color-scheme:dark):not([data-mode=light]).
 *   @layer overrides — the override tier: the [data-status] cascade (--_status-*),
 *                      the Color-Sets / Grouping / Elevation override collections,
 *                      and convenience aliases (font-family / shadow / categorical).
 *
 * Component-scoped collections (container-*, control-*, button-*, switch-*, …) are
 * NOT in the global file — each is written to its OWN component partial
 * (src/components/<comp>/<comp>.tokens.css) so the component owns its scoping. The
 * component's variant/size modes become [data-*] blocks in that partial.
 *
 *   node scripts/project-tokens.mjs
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SRC = join(ROOT, 'src/styles/tokens/figma.tokens.json');
const OUT = join(ROOT, 'src/styles/tokens/tokens.css');
const COMPONENTS = join(ROOT, 'src/components');
const PREFIX = 'sherpa-';

const doc = JSON.parse(readFileSync(SRC, 'utf8'));

// ── helpers ───────────────────────────────────────────────────────────

/** Normalise DTCG path segments into one CSS-identifier tail (names AND refs). */
function toIdent(segs) {
  return segs
    .filter((s) => s !== '@')
    .join('-')
    .replace(/->/g, '-')
    .replace(/[^a-zA-Z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
}

/** A ref's leading collection segment is redundant when the leaf path repeats it. */
const REF_STRIP = new Set(['style-sherpa']);
function refName(ref) {
  let segs = ref.slice(1, -1).split('.');
  if (REF_STRIP.has(segs[0]) || (segs[1] && segs[1].startsWith(segs[0] + '-'))) segs = segs.slice(1);
  return `--${PREFIX}${toIdent(segs)}`;
}
const isRef = (v) => typeof v === 'string' && v.startsWith('{') && v.endsWith('}');

/** literal → CSS value (px for dimensions, bare for unitless). */
function literal(value, type) {
  if (typeof value === 'number') {
    const unitless = type === 'number' || type === 'fontWeight';
    return unitless ? String(value) : `${value}px`;
  }
  return String(value);
}

// ── primitive resolution (so Primitives is reference-only) ──────────────
// Build dot-path → literal for every Primitives leaf, then resolve any ref that
// points into primitives down to its literal value.
const primLiteral = {};
(function walkPrim(node, path) {
  if (node && typeof node === 'object' && '$value' in node) {
    if (!isRef(node.$value)) primLiteral[path.join('.')] = literal(node.$value, node.$type);
    return;
  }
  for (const k of Object.keys(node ?? {})) {
    if (k.startsWith('$')) continue;
    walkPrim(node[k], [...path, k]);
  }
})(doc.primitives ?? {}, ['primitives']);

/** ref/literal → CSS value; primitive refs are inlined to their literal. */
function toCss(value, type) {
  if (isRef(value)) {
    const dotPath = value.slice(1, -1);
    if (dotPath.startsWith('primitives.') && primLiteral[dotPath] != null) return primLiteral[dotPath];
    // The Status collection's shadow-color role isn't projected as a flat var
    // (only its cascade roles are). Elevation refs it → resolve to the base tint.
    if (dotPath.startsWith('status.status-shadow')) return 'var(--sherpa-elevation-tint)';
    return `var(${refName(value)})`;
  }
  return literal(value, type);
}

/** Walk a collection subtree → { name, value, dark } leaves (dark = the dark-mode override). */
function* leaves(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    const darkRef = ext.modes?.dark;
    yield {
      name: `--${PREFIX}${toIdent(path)}`,
      value: toCss(node.$value, node.$type),
      dark: darkRef != null ? toCss(darkRef, node.$type) : null,
    };
    return;
  }
  for (const k of Object.keys(node ?? {})) {
    if (k.startsWith('$')) continue;
    yield* leaves(node[k], [...path, k]);
  }
}

/** Like leaves() but exposes the raw per-mode override map (for scoped collections). */
function* leavesWithModes(node, path = []) {
  if (node && typeof node === 'object' && '$value' in node) {
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    yield { name: `--${PREFIX}${toIdent(path)}`, rawPath: path.join('/'), primary: node.$value, modes: ext.modes ?? {}, type: node.$type };
    return;
  }
  for (const k of Object.keys(node ?? {})) {
    if (k.startsWith('$')) continue;
    yield* leavesWithModes(node[k], [...path, k]);
  }
}

// ── @layer core: Core, primitive refs inlined ──────────────────────────
const coreLines = [];
for (const leaf of leaves(doc.core ?? {}, ['core'])) coreLines.push(`  ${leaf.name}: ${leaf.value};`);

// ── @layer style: Style (Sherpa), light + dark ─────────────────────────
const styleLines = [];
const darkLines = [];
for (const leaf of leaves(doc['style-sherpa'] ?? {}, [])) {
  styleLines.push(`  ${leaf.name}: ${leaf.value};`);
  if (leaf.dark) darkLines.push(`  ${leaf.name}: ${leaf.dark};`);
}

// ── @layer overrides: status cascade ───────────────────────────────────
// Figma Status roles (verified): surface/default = box tint (color 1),
// border/default = border + strong accent ink (color 5/7/4), content/title =
// heading ink on the tint. border also feeds --_status-surface-strong (the badge).
const STATUS_MODES = ['info', 'critical', 'warning', 'urgent', 'success'];
const ROLE_MAP = {
  'status-surface-default': '_status-surface',
  'status-border-default': '_status-border',
  'status-content-title': '_status-text',
};
const ALSO = { 'status-border-default': '_status-surface-strong' };
const statusRoles = [];
(function collectStatus(node, path) {
  if (node && typeof node === 'object' && '$value' in node) {
    const ext = node.$extensions?.['figma-console-mcp'] ?? {};
    statusRoles.push({ role: toIdent(path), modes: ext.modes ?? {} });
    return;
  }
  for (const k of Object.keys(node ?? {})) {
    if (k.startsWith('$')) continue;
    collectStatus(node[k], [...path, k]);
  }
})(doc.status ?? {}, []);
const statusBlocks = [];
for (const mode of STATUS_MODES) {
  const lines = [];
  for (const r of statusRoles) {
    if (r.modes[mode] == null) continue;
    if (ROLE_MAP[r.role]) lines.push(`  --${ROLE_MAP[r.role]}: ${toCss(r.modes[mode])};`);
    if (ALSO[r.role]) lines.push(`  --${ALSO[r.role]}: ${toCss(r.modes[mode])};`);
  }
  if (lines.length) statusBlocks.push(`  [data-status="${mode}"] {\n${lines.map((l) => '  ' + l).join('\n')}\n  }`);
}

// ── @layer overrides: Override collections ─────────────────────────────
// Shared alias bases that MULTIPLE components consume (control geometry/colour is
// used by button/tag/switch/input; color-sets/grouping/elevation are override
// ramps). These stay global in the overrides layer — a single-component partial
// can't own a shared base. (Their variant modes, where used, are consumed by the
// component via its own [data-*]; the primary values live here.)
// Each override collection: its primary values go in :root; its MODE variants
// become attribute blocks keyed to `attr` (so a consumer opts into a hue / snap
// position / elevation by setting the attribute). `attr:null` = primary only
// (control/badge modes are consumed by components via their own [data-variant]).
const OVERRIDE_COLLECTIONS = {
  'color-sets': 'data-color-set', // 11 hues — a component takes a colour set
  grouping: 'data-snap', // seamless component groups (top/middle/bottom/… positions)
  elevation: 'data-elevation', // sm/md/lg shadow levels
  control: null,
  badge: null,
};
const overrideLines = [];
const overrideModeBlocks = [];
for (const [collKey, attr] of Object.entries(OVERRIDE_COLLECTIONS)) {
  const byMode = {};
  for (const leaf of leavesWithModes(doc[collKey] ?? {}, [])) {
    if (typeof leaf.primary === 'boolean') continue;
    overrideLines.push(`  ${leaf.name}: ${toCss(leaf.primary, leaf.type)};`);
    if (!attr) continue;
    for (const [mode, val] of Object.entries(leaf.modes)) {
      if (mode === 'passthrough') continue; // passthrough == the primary (neutral)
      (byMode[mode] ??= []).push(`    ${leaf.name}: ${toCss(val, leaf.type)};`);
    }
  }
  for (const [mode, lines] of Object.entries(byMode)) {
    overrideModeBlocks.push(`  [${attr}="${mode}"] {\n${lines.join('\n')}\n  }`);
  }
}

// ── @layer overrides: convenience aliases ──────────────────────────────
const aliasLines = [
  '  --sherpa-font-family-body: "Inter", system-ui, sans-serif;',
  '  --sherpa-font-family-mono: ui-monospace, "JetBrains Mono", monospace;',
  '  --sherpa-shadow-sm: var(--sherpa-elevation-offset-x-small, 0) var(--sherpa-elevation-offset-y-small, 1px) var(--sherpa-elevation-blur-small, 2px) var(--sherpa-elevation-spread-small, 0) var(--sherpa-elevation-tint, #372f4f33);',
  '  --sherpa-shadow-md: var(--sherpa-elevation-offset-x-base, 0) var(--sherpa-elevation-offset-y-base, 4px) var(--sherpa-elevation-blur-base, 12px) var(--sherpa-elevation-spread-base, 0) var(--sherpa-elevation-tint, #372f4f33);',
  '  --sherpa-shadow-lg: var(--sherpa-elevation-offset-x-large, 0) var(--sherpa-elevation-offset-y-large, 12px) var(--sherpa-elevation-blur-large, 32px) var(--sherpa-elevation-spread-large, 0) var(--sherpa-elevation-tint, #372f4f33);',
];
for (let i = 1; i <= 11; i++) aliasLines.push(`  --sherpa-categorical-${i}: var(--sherpa-data-viz-categorical-color-${i});`);

// ── @layer overrides: Layout Grid utility (.sherpa-layout-grid) ────────
// Figma layout-grid vars drive a real CSS Grid. Mobile is the primary (4 cols);
// tablet/desktop/wide re-point columns + max-width. Keyed to @container width via
// the mode max-widths, so a grid inside any container adapts. Vars are exposed so
// a consumer can override; the class wires them into grid-template-columns etc.
const grid = {};
for (const leaf of leavesWithModes(doc['layout-grid'] ?? {}, [])) {
  // `columns` is a COUNT (typed dimension in Figma but unitless in CSS grid).
  const unitless = leaf.name.endsWith('-columns');
  const val = unitless && typeof leaf.primary === 'number' ? String(leaf.primary) : toCss(leaf.primary, leaf.type);
  grid[leaf.name] = { primary: val, modes: leaf.modes, type: leaf.type };
}
const gv = (k) => grid[`--sherpa-layout-grid-${k}`];
const layoutGridBlock =
  Object.keys(grid).length === 0
    ? ''
    : `  .sherpa-layout-grid {
${Object.entries(grid)
  .map(([n, g]) => `    ${n}: ${g.primary};`)
  .join('\n')}

    display: grid;
    grid-template-columns: repeat(var(--sherpa-layout-grid-columns), minmax(0, 1fr));
    column-gap: var(--sherpa-layout-grid-gap-horizontal);
    row-gap: var(--sherpa-layout-grid-gap-vertical);
    grid-auto-rows: var(--sherpa-layout-grid-row-height);
    max-inline-size: var(--sherpa-layout-grid-max-width);
    padding-inline: var(--sherpa-layout-grid-padding);
    margin-inline: auto;
    container-type: inline-size;
  }
${['tablet', 'desktop', 'wide']
  .map((bp) => {
    const w = gv('max-width')?.modes?.[bp];
    const cols = gv('columns')?.modes?.[bp];
    if (w == null || cols == null) return '';
    return `  @container (min-width: ${literal(w, 'dimension')}) {
    .sherpa-layout-grid {
      --sherpa-layout-grid-columns: ${literal(cols, 'number')};
      --sherpa-layout-grid-max-width: ${literal(w, 'dimension')};
    }
  }`;
  })
  .filter(Boolean)
  .join('\n')}`;

// ── component-scoped partials (each component owns its scoping) ─────────
// collection → { comp: the component dir, attr: variant attribute, default: the
// mode equal to the primary (emitted once at :host, not repeated) }.
const SCOPED = {
  container: { comp: 'sherpa-container', attr: 'data-variant', default: 'default' },
  button: { comp: 'sherpa-button', attr: 'data-size', default: '2xs' },
  input: { comp: 'sherpa-input-text', attr: 'data-state', default: 'default' },
  navigation: { comp: 'sherpa-nav-item', attr: 'data-nav-state', default: 'default' },
  switch: { comp: 'sherpa-switch', attr: 'data-style', default: 'standard' },
};
const partials = []; // { comp, css }
for (const [collKey, cfg] of Object.entries(SCOPED)) {
  if (!cfg.comp || !doc[collKey]) continue;
  const rootVars = [];
  const byMode = {};
  for (const leaf of leavesWithModes(doc[collKey], [])) {
    // Boolean flags (hasValidation, hasLabel, …) are mode-driven VISIBILITY toggles,
    // not value tokens. Emit them as a --_<flag> display var (true→revert-layer =
    // visible, false→none = hidden) that flips per mode; the component consumes it
    // as `display: var(--_<flag>, …)`. Visibility stays in CSS, driven by the mode.
    const isBool = typeof leaf.primary === 'boolean';
    // Boolean flag → a private, camelCase-split visibility var: hasValidation →
    // --_has-validation. Value is a display keyword the component reads.
    const name = isBool
      ? '--_' + leaf.rawPath.replace(/([a-z])([A-Z])/g, '$1-$2').replace(/[^a-zA-Z0-9]+/g, '-').toLowerCase()
      : leaf.name;
    const vis = (b) => (b ? 'revert-layer' : 'none');
    const value = isBool ? vis(leaf.primary) : toCss(leaf.primary, leaf.type);
    rootVars.push(`  ${name}: ${value};`);
    for (const [mode, val] of Object.entries(leaf.modes)) {
      if (mode === cfg.default) continue;
      const mv = isBool ? vis(val) : toCss(val, leaf.type);
      (byMode[mode] ??= []).push(`  ${name}: ${mv};`);
    }
  }
  const modeBlocks = Object.entries(byMode).map(
    ([mode, lines]) => `:host([${cfg.attr}="${mode}"]) {\n${lines.join('\n')}\n}`,
  );
  const css = `/**
 * ${cfg.comp}.tokens.css — component-scoped token aliases, PROJECTED from Figma
 * (the "${collKey}" collection). DO NOT EDIT BY HAND — edit in Figma, re-project.
 * These alias up through overrides → style → core. The component's own [${cfg.attr}]
 * re-points them per variant. Import/adopt this alongside the component's CSS.
 */
@layer components {
  :host {
${rootVars.map((l) => '  ' + l).join('\n')}
  }

${modeBlocks.map((b) => b.replace(/^/gm, '  ')).join('\n\n')}
}
`;
  partials.push({ comp: cfg.comp, css });
}

// ── emit global tokens.css ─────────────────────────────────────────────
const header = `/**
 * tokens.css — Sherpa's global token layer, PROJECTED from Figma.
 *
 * Generated by scripts/project-tokens.mjs from figma.tokens.json. DO NOT EDIT BY
 * HAND — edit in Figma, re-export, re-project. Load once in the document; the
 * resolved --sherpa-* values inherit into every component shadow root.
 *
 * Layers mirror Figma's aliasing tiers (Primitives resolved away → reference-only):
 *   core → style → overrides.  Component-scoped collections live in each
 *   component's own <comp>.tokens.css partial (@layer components).
 */
@layer core, style, overrides, components;`;

const css = `${header}

@layer core {
  :root {
${coreLines.join('\n')}
  }
}

@layer style {
  :root {
${styleLines.join('\n')}
  }

  /* Dark mode: explicit choice wins. */
  :root[data-mode="dark"] {
${darkLines.map((l) => '  ' + l).join('\n')}
  }

  /* Dark mode: follow the OS unless an explicit light choice overrides it. */
  @media (prefers-color-scheme: dark) {
    :root:not([data-mode="light"]) {
${darkLines.map((l) => '    ' + l).join('\n')}
    }
  }
}

@layer overrides {
  :root {
${overrideLines.join('\n')}

    /* convenience aliases — stable public names (see project-tokens.mjs) */
${aliasLines.map((l) => '  ' + l).join('\n')}
  }

  /* Status cascade — an ancestor [data-status] emits --_status-* to shadow roots. */
${statusBlocks.join('\n\n')}

  /* Colour sets ([data-color-set]) · seamless groups ([data-snap]) · elevation ([data-elevation]) */
${overrideModeBlocks.join('\n\n')}

  /* Layout Grid utility — a real CSS Grid with responsive @container breakpoints. */
${layoutGridBlock}
}
`;

writeFileSync(OUT, css);

// ── write component partials ───────────────────────────────────────────
let wrote = 0;
for (const { comp, css } of partials) {
  const dir = join(COMPONENTS, comp);
  if (!existsSync(dir)) continue;
  writeFileSync(join(dir, `${comp}.tokens.css`), css);
  wrote++;
}

console.log(
  `✓ tokens.css: @layer core(${coreLines.length}) style(${styleLines.length},${darkLines.length} dark) ` +
    `overrides(${overrideLines.length}+${aliasLines.length} aliases,${statusBlocks.length} status) → global\n` +
    `✓ ${wrote} component token partials written`,
);
