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

// ── @layer style: the "lighten-darken" range (from Figma's Display Mode collection) ──
// A signed alpha-overlay ramp: negative = darken (near-black overlay), positive =
// lighten (near-white overlay), 0 = transparent. MODE-INVERTING: in dark mode the
// poles swap (darken overlays white, lighten overlays black) so the SAME index
// self-inverts — a darken step lightens on a dark ground. We project each step as
// TWO mode-aware pole tokens (`--sherpa-shade-N` solid + its alpha), then derive
// tints/shades by `color-mix`-ing a base with the pole. Values mirror Figma exactly.
//
// step → { pole rgb (light), alpha }  (dark mode swaps the pole, same alpha)
const LD_STEPS = {
  10: { r: 0.2, alpha: 0.1 },
  20: { r: 0.2, alpha: 0.2 },
  30: { r: 0.2, alpha: 0.3 },
  40: { r: 0.1333, alpha: 0.4 },
  50: { r: 0.1333, alpha: 0.5 },
  60: { r: 0.1333, alpha: 0.6 },
  70: { r: 0.0667, alpha: 0.7 },
  80: { r: 0.0667, alpha: 0.8 },
  90: { r: 0.0667, alpha: 0.9 },
};
const hx = (v) => Math.round(v * 255).toString(16).padStart(2, '0');
const grey = (v) => `#${hx(v)}${hx(v)}${hx(v)}`;
const LIGHT_POLE = 0.9804; // near-white overlay used by the range
// Emit shade (darken) + tint (lighten) solid pole tokens, light + dark, per step.
const ldLines = [];
const ldDarkLines = [];
for (const [n, s] of Object.entries(LD_STEPS)) {
  // light mode: shade overlays near-black, tint overlays near-white
  ldLines.push(`  --sherpa-shade-${n}: ${grey(s.r)};`);
  ldLines.push(`  --sherpa-tint-${n}: ${grey(LIGHT_POLE)};`);
  // dark mode: poles invert — shade overlays near-white, tint overlays near-black
  ldDarkLines.push(`  --sherpa-shade-${n}: ${grey(LIGHT_POLE)};`);
  ldDarkLines.push(`  --sherpa-tint-${n}: ${grey(s.r)};`);
}

// ── @layer style: Style (Sherpa), light + dark ─────────────────────────
// Interactive hover/down are DERIVED, not hand-picked ramp steps. Each state is the
// family's own `-base` seed overlaid with a "lighten-darken" SHADE step, via
// `color-mix(in srgb, <base>, var(--sherpa-shade-N) A%)`. Because the shade pole
// self-inverts by mode, one derivation is correct in both light and dark. This
// replicates the Figma lighten-darken range at runtime — one seed → its states, no
// per-hue token bookkeeping. Degrades to the seed colour on unsupporting engines.
// Tertiary is exempt — its base is transparent, so it keeps its alpha-overlay value.
//
// state → shade step + overlay strength (alpha of that step, as a %):
const STATE_SHADE = {
  hover: { step: 10, pct: 10 }, // hover = shade-10 @ 10%
  down: { step: 20, pct: 20 }, //  down  = shade-20 @ 20%
};
function interactiveState(name) {
  const m = name.match(
    /^--sherpa-(surface|border)-interactive-(primary|active|secondary)-(hover|down)$/
  );
  return m ? { kind: m[1], family: m[2], state: m[3] } : null;
}
function deriveState(name) {
  const s = interactiveState(name);
  if (!s) return null;
  // Surfaces name their seed `<family>-base`; borders name it bare `<family>`.
  const baseRole =
    s.kind === 'surface'
      ? `--sherpa-surface-interactive-${s.family}-base`
      : `--sherpa-border-interactive-${s.family}`;
  const { step, pct } = STATE_SHADE[s.state];
  return `color-mix(in srgb, var(${baseRole}) ${100 - pct}%, var(--sherpa-shade-${step}))`;
}

const styleLines = [];
const darkLines = [];
for (const leaf of leaves(doc['style-sherpa'] ?? {}, [])) {
  const derived = deriveState(leaf.name);
  if (derived) {
    // One derivation covers both modes — base + shade pole both re-point per mode.
    styleLines.push(`  ${leaf.name}: ${derived};`);
    continue;
  }
  styleLines.push(`  ${leaf.name}: ${leaf.value};`);
  if (leaf.dark) darkLines.push(`  ${leaf.name}: ${leaf.dark};`);
}
// The lighten-darken pole tokens live in the same style layer, light + dark.
styleLines.push(...ldLines);
darkLines.push(...ldDarkLines);

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

// ── @layer style: semantic typography (from the Figma `Typography` collection) ──
// Figma model (reworked 2026-08-27): `Typography` modes are SIZE (base, h1–h5,
// large, small, xs). A text node pins a size-mode (→ one shared `size` +
// `line-height` + `letter-spacing` var resolves per mode) and binds one of six
// `weight/*` vars. Hero/Mono are family extensions overriding the shared `family`.
// The CSS below stays a flat set of semantic atoms — components consume a stable
// name (`--sherpa-font-size-heading-h1`) instead of the raw `--sherpa-core-fonts-*`
// ramp, so the mode flip does not change any component's CSS contract. Roles are
// composed from these atoms by the `.sherpa-text-*` utility classes below.
//
// Atom → core-primitive map mirrors the Figma size-mode + weight values exactly:
const TYPO = {
  // families
  'font-family-brand': 'var(--sherpa-font-family-body, "Inter", system-ui, sans-serif)',
  'font-family-hero':  'var(--sherpa-font-family-body, "Inter", system-ui, sans-serif)',
  'font-family-mono':  'var(--sherpa-font-family-mono, ui-monospace, "JetBrains Mono", monospace)',
  // sizes — UI headings
  'font-size-heading-h1': 'var(--sherpa-core-fonts-scale-2xl, 24px)',
  'font-size-heading-h2': 'var(--sherpa-core-fonts-scale-xl, 20px)',
  'font-size-heading-h3': 'var(--sherpa-core-fonts-scale-lg, 16px)',
  'font-size-heading-h4': 'var(--sherpa-core-fonts-scale-base, 14px)',
  'font-size-heading-h5': 'var(--sherpa-core-fonts-scale-sm, 12px)',
  // sizes — hero (promo)
  'font-size-hero-h1': 'var(--sherpa-core-fonts-scale-13xl, 64px)',
  'font-size-hero-h2': 'var(--sherpa-core-fonts-scale-11xl, 52px)',
  'font-size-hero-h3': 'var(--sherpa-core-fonts-scale-9xl, 44px)',
  'font-size-hero-h4': 'var(--sherpa-core-fonts-scale-7xl, 40px)',
  'font-size-hero-h5': 'var(--sherpa-core-fonts-scale-5xl, 32px)',
  // sizes — body
  'font-size-body-large': 'var(--sherpa-core-fonts-scale-lg, 16px)',
  'font-size-body-base':  'var(--sherpa-core-fonts-scale-base, 14px)',
  'font-size-body-small': 'var(--sherpa-core-fonts-scale-sm, 12px)',
  'font-size-body-xs':    'var(--sherpa-core-fonts-scale-xs, 10px)',
  // weights
  'font-weight-light':    'var(--sherpa-core-fonts-weight-300, 300)',
  'font-weight-regular':  'var(--sherpa-core-fonts-weight-400, 400)',
  'font-weight-medium':   'var(--sherpa-core-fonts-weight-500, 500)',
  'font-weight-semibold': 'var(--sherpa-core-fonts-weight-600, 600)',
  'font-weight-bold':     'var(--sherpa-core-fonts-weight-700, 700)',
  'font-weight-black':    'var(--sherpa-core-fonts-weight-900, 900)',
  // line-heights (a length from the scale, ~1.4× the size)
  'line-height-heading-h1': 'var(--sherpa-core-fonts-scale-5xl, 32px)',
  'line-height-heading-h2': 'var(--sherpa-core-fonts-scale-3xl, 28px)',
  'line-height-heading-h3': 'var(--sherpa-core-fonts-scale-2xl, 24px)',
  'line-height-heading-h4': 'var(--sherpa-core-fonts-scale-xl, 20px)',
  'line-height-heading-h5': 'var(--sherpa-core-fonts-scale-lg, 16px)',
  'line-height-hero-h1': 'var(--sherpa-core-fonts-scale-14xl, 72px)',
  'line-height-hero-h2': 'var(--sherpa-core-fonts-scale-12xl, 56px)',
  'line-height-hero-h3': 'var(--sherpa-core-fonts-scale-10xl, 48px)',
  'line-height-hero-h4': 'var(--sherpa-core-fonts-scale-9xl, 44px)',
  'line-height-hero-h5': 'var(--sherpa-core-fonts-scale-6xl, 36px)',
  'line-height-body-large': 'var(--sherpa-core-fonts-scale-2xl, 24px)',
  'line-height-body-base':  'var(--sherpa-core-fonts-scale-xl, 20px)',
  'line-height-body-small': 'var(--sherpa-core-fonts-scale-lg, 16px)',
  'line-height-body-xs':    'var(--sherpa-core-fonts-scale-lg, 16px)',
  // letter-spacing (raw px)
  'letter-spacing-heading': '-0.2px',
  'letter-spacing-hero':    '-0.5px',
  'letter-spacing-body':    '0px',
  // paragraph spacing
  'paragraph-base': 'var(--sherpa-core-fonts-scale-2xs, 8px)',
};
const typoLines = Object.entries(TYPO).map(([name, val]) => `  --sherpa-${name}: ${val};`);

// Role utility classes — one per Figma text Style. Apply a role, get every atom;
// override any single --sherpa-font-* on the element to "detach" one atom (mirrors
// the Figma "apply Style → tweak an atom" flow). `.sherpa-text-*` sets the five
// text properties from the atoms above.
const TEXT_ROLES = {
  'heading-h1': { size: 'heading-h1', lh: 'heading-h1', wt: 'semibold', fam: 'brand', ls: 'heading' },
  'heading-h2': { size: 'heading-h2', lh: 'heading-h2', wt: 'semibold', fam: 'brand', ls: 'heading' },
  'heading-h3': { size: 'heading-h3', lh: 'heading-h3', wt: 'semibold', fam: 'brand', ls: 'heading' },
  'heading-h4': { size: 'heading-h4', lh: 'heading-h4', wt: 'semibold', fam: 'brand', ls: 'heading' },
  'heading-h5': { size: 'heading-h5', lh: 'heading-h5', wt: 'semibold', fam: 'brand', ls: 'heading' },
  'hero-h1': { size: 'hero-h1', lh: 'hero-h1', wt: 'bold', fam: 'hero', ls: 'hero' },
  'hero-h2': { size: 'hero-h2', lh: 'hero-h2', wt: 'bold', fam: 'hero', ls: 'hero' },
  'hero-h3': { size: 'hero-h3', lh: 'hero-h3', wt: 'bold', fam: 'hero', ls: 'hero' },
  'hero-h4': { size: 'hero-h4', lh: 'hero-h4', wt: 'bold', fam: 'hero', ls: 'hero' },
  'hero-h5': { size: 'hero-h5', lh: 'hero-h5', wt: 'bold', fam: 'hero', ls: 'hero' },
  'body-large': { size: 'body-large', lh: 'body-large', wt: 'regular', fam: 'brand', ls: 'body' },
  'body-base': { size: 'body-base', lh: 'body-base', wt: 'regular', fam: 'brand', ls: 'body' },
  'body-base-medium': { size: 'body-base', lh: 'body-base', wt: 'medium', fam: 'brand', ls: 'body' },
  'body-base-strong': { size: 'body-base', lh: 'body-base', wt: 'semibold', fam: 'brand', ls: 'body' },
  'body-small': { size: 'body-small', lh: 'body-small', wt: 'regular', fam: 'brand', ls: 'body' },
  'body-xs': { size: 'body-xs', lh: 'body-xs', wt: 'regular', fam: 'brand', ls: 'body' },
  'mono-base': { size: 'body-base', lh: 'body-base', wt: 'regular', fam: 'mono', ls: 'body' },
  'mono-small': { size: 'body-small', lh: 'body-small', wt: 'regular', fam: 'mono', ls: 'body' },
};
const textRoleBlocks = Object.entries(TEXT_ROLES).map(([role, r]) =>
  `  .sherpa-text-${role} {
    font-family: var(--sherpa-font-family-${r.fam});
    font-size: var(--sherpa-font-size-${r.size});
    font-weight: var(--sherpa-font-weight-${r.wt});
    line-height: var(--sherpa-line-height-${r.lh});
    letter-spacing: var(--sherpa-letter-spacing-${r.ls});
  }`
);

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
  }

  /* The grid adapts to its nearest inline-size container. Give the grid's parent
     (or a .sherpa-view body region) container-type:inline-size so these breakpoints
     fire; without a container ancestor the grid stays at the mobile base (4 columns). */
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

// ── @layer overrides: view frame (.sherpa-view) ────────────────────────
// The light-DOM application shell that renderView() wraps a view in: a two-column
// grid (nav rail + main column, header row over scrolling body). Regions are placed
// by their data-region attribute. A fixed structural utility (not Figma-var driven);
// replaced the former sherpa-app-shell custom element.
const viewFrameBlock = `  .sherpa-view {
    --sherpa-view-nav-width: 240px;

    display: grid;
    grid-template-columns: var(--sherpa-view-nav-width) 1fr;
    grid-template-rows: auto 1fr;
    grid-template-areas:
      'nav header'
      'nav body';
    block-size: 100%;
    min-block-size: 100vh;
    background: var(--sherpa-app-primary, #ffffff);
    color: var(--sherpa-content-primary-base, #2e2e33);
  }
  .sherpa-view[data-nav-collapsed] {
    --sherpa-view-nav-width: 56px;
  }
  .sherpa-view > [data-region='nav'] {
    grid-area: nav;
    min-inline-size: 0;
    border-inline-end: var(--sherpa-core-border-width-base, 1px) solid
      var(--sherpa-border-primary, #d5d5d5);
    background: var(--sherpa-surface-primary-base, #ffffff);
    overflow: hidden;
  }
  .sherpa-view > [data-region='header'] {
    grid-area: header;
    border-block-end: var(--sherpa-core-border-width-base, 1px) solid
      var(--sherpa-border-primary, #d5d5d5);
  }
  .sherpa-view > [data-region='body'] {
    grid-area: body;
    min-block-size: 0;
    overflow: auto;
    padding: var(--sherpa-core-space-lg, 20px);
  }
  /* A view with no header region lets the body span both rows. */
  .sherpa-view:not(:has(> [data-region='header'])) {
    grid-template-areas:
      'nav body'
      'nav body';
  }`;

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

    /* semantic typography atoms — flat, from the Figma \`Typography\` collection */
${typoLines.map((l) => '  ' + l).join('\n')}
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

  /* Text roles — one class per Figma text Style; composed from the atoms above. */
${textRoleBlocks.join('\n\n')}
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

  /* View frame utility — the light-DOM app shell renderView() wraps a view in. */
${viewFrameBlock}
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
  `✓ tokens.css: @layer core(${coreLines.length}) style(${styleLines.length},${darkLines.length} dark,` +
    `${typoLines.length} typo,${textRoleBlocks.length} roles) ` +
    `overrides(${overrideLines.length}+${aliasLines.length} aliases,${statusBlocks.length} status) → global\n` +
    `✓ ${wrote} component token partials written`,
);
