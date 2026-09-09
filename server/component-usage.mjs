/**
 * component-usage.mjs — derive a component's DEFAULT usage tag from its real
 * Public API.
 *
 * This is source #1 of the two template sources the example server exposes. The
 * ready-to-paste `<sherpa-x data-…>` tag is DERIVED from the component's own
 * `Public API:` comment (read from dist/components/<name>/<name>.html), so it can
 * never drift from the implementation — change the component, the derived tag
 * changes with it. It is NOT the shadow-DOM template file itself.
 *
 * Uses the shared, dependency-free parser (public-api-parser.mjs), the same one
 * the browser sandbox uses.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { parseComponentSpec } from './public-api-parser.mjs';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// Best-effort default slot text so a derived tag renders something visible.
const DEFAULT_SLOT_TEXT = {
  'sherpa-button': 'Click me',
  'sherpa-tag': 'Label',
  'sherpa-chip': 'Label',
  'sherpa-callout': 'This is a callout message.',
  'sherpa-code-block': 'const x = 42;',
  'sherpa-tooltip': 'Hover target',
  'sherpa-container': 'Card body content',
  'sherpa-chat-message': 'Hello there!',
  'sherpa-empty-state': 'Nothing here yet.',
};

// Optional modifiers whose baseline is "attribute absent". If the Public API
// documents the attribute as omitted-by-default, the derived default usage tag
// should NOT force a value on it (a plain button is not a critical, icon-only,
// saturated button). Detected from an "omitted" signal in the default/description.
function isOptionalModifier(prop) {
  if (prop.optional) return true; // explicit "(default omitted|none|unset)"
  const d = String(prop.default ?? '');
  return /\bomitted\b/i.test(d) || /\bomitted\b/i.test(String(prop.description ?? ''));
}

// Recognised content-bearing text attributes — for these, an untyped string prop
// gets a representative placeholder. Any OTHER untyped string prop is skipped
// (its Public API text is prose, not a value), keeping the default tag clean.
const TEXT_PLACEHOLDERS = {
  label: 'Label', heading: 'Label', title: 'Label',
  description: 'A short description.', placeholder: 'Type here…',
  value: 'Value', name: 'field', caption: 'Caption', sublabel: 'sublabel',
};

/**
 * Pick a representative value for a single parsed prop, or null to skip it.
 */
function representativeValue(prop) {
  if (isOptionalModifier(prop)) return null; // optional → leave it off the default tag
  if (prop.default !== undefined && !/\bomitted\b/i.test(String(prop.default))) return prop.default;
  if (prop.type === 'enum' && Array.isArray(prop.values) && prop.values.length) return prop.values[0];
  if (prop.type === 'boolean') return null; // booleans render as bare attrs, handled by caller
  // Untyped string attr: only fill recognised content attrs; skip prose-only ones.
  const short = prop.name.replace(/^data-/, '');
  return TEXT_PLACEHOLDERS[short] ?? null;
}

function escapeAttr(v) {
  return String(v).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

/**
 * Build the default usage tag string for `sherpa-<name>` from its Public API.
 * Returns { name, tag, spec }.
 */
export async function componentUsage(name) {
  const file = join(ROOT, 'dist', 'components', name, `${name}.html`);
  const html = await readFile(file, 'utf8');
  const spec = parseComponentSpec(name, html);

  const attrs = [];
  for (const prop of Object.values(spec.props)) {
    if (prop.type === 'boolean') {
      // Only emit a bare boolean attr when it defaults to true; otherwise leave it off.
      if (prop.default === true) attrs.push(prop.name);
      continue;
    }
    const val = representativeValue(prop);
    if (val == null || val === '') continue;
    attrs.push(`${prop.name}="${escapeAttr(val)}"`);
  }

  const slotText = DEFAULT_SLOT_TEXT[name];
  const attrStr = attrs.length ? ' ' + attrs.join(' ') : '';
  const tag = slotText
    ? `<${name}${attrStr}>${slotText}</${name}>`
    : `<${name}${attrStr}></${name}>`;

  return { name, tag, spec };
}
