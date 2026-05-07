/**
 * Playground curation layer
 * ─────────────────────────
 * Decides how the controls panel in index.html surfaces each component's
 * attributes, presets, and nested controls. This file is the single
 * tweak-point for "what should the sandbox highlight?" — schemas stay pure
 * for MCP/tooling.
 *
 * Three things drive the panel UI:
 *
 *   1. Attribute groups — every attribute is bucketed into one of:
 *        variant | layout | data | state | other
 *      `other` is rendered collapsed by default; the rest are open. Each
 *      attribute may also be `featured: true` so it sorts to the top of
 *      its group AND qualifies for the compact nested view.
 *
 *   2. Preset chips — small `sherpa-button` chips above the Attributes
 *      section. Each preset's `attrs` object is applied via the same
 *      applyAttr path the controls use, so preview + control inputs
 *      stay in sync.
 *
 *   3. Nested controls — opt-in per parent. When `nested.expose === true`,
 *      child sherpa-* elements get their own collapsed `<details>` row
 *      showing only featured attributes.
 *
 * Components without an entry rely on `autoClassifyAttr()` heuristics —
 * they still get sensible groups, just no presets or nested exposure.
 */

// ─── Group ordering & labels ──────────────────────────────────────────
// `other` is intentionally last and rendered collapsed by default.
export const GROUPS = [
  { id: "variant", label: "Variant" },
  { id: "layout",  label: "Layout" },
  { id: "data",    label: "Data" },
  { id: "state",   label: "State" },
  { id: "other",   label: "Other" },
];

const VALID_GROUP_IDS = new Set(GROUPS.map((g) => g.id));

// ─── Auto-classification heuristics ───────────────────────────────────
// Used when an attribute has no explicit override. The order matters —
// first match wins.
const CLASSIFIERS = [
  { group: "variant", re: /^(data-variant|data-size|data-status|data-elevation|data-type|data-tone|data-shape|data-emphasis)$/ },
  { group: "layout",  re: /^(data-layout|data-direction|data-align|data-justify|data-gap|data-columns|data-density|data-position|data-fill|data-pad|data-stretch|data-template|data-divider)$/ },
  { group: "data",    re: /^(data-label|data-description|data-helper|data-placeholder|data-icon|data-icon-start|data-icon-end|data-illustration|data-src|data-href|data-value|data-min|data-max|data-step|name|value|placeholder|min|max|step|href|src)$/ },
  { group: "state",   re: /^(data-active|data-selected|data-open|data-pinned|data-loading|data-expanded|data-collapsed|disabled|checked|readonly|required|hidden|open)$/ },
];

export function autoClassifyAttr(attrName) {
  for (const c of CLASSIFIERS) {
    if (c.re.test(attrName)) return c.group;
  }
  return "other";
}

// ─── Curation registry ────────────────────────────────────────────────
// Each entry may include:
//   attrs:   { "<attr-name>": { group?, hidden?, featured? } }
//   presets: [ { id, label, iconStart?, attrs: {…} } ]
//   nested:  { expose: boolean }
// All keys are optional; missing entries fall back to auto-classification.
export const CURATION = {
  "sherpa-button": {
    attrs: {
      "data-variant":    { group: "variant", featured: true },
      "data-size":       { group: "variant", featured: true },
      "data-type":       { group: "variant" },
      "data-label":      { group: "data",    featured: true },
      "data-icon-start": { group: "data" },
      "data-icon-end":   { group: "data" },
      "data-active":     { group: "state",   featured: true },
      "disabled":        { group: "state",   featured: true },
    },
    presets: [
      { id: "primary",   label: "Primary",      attrs: { "data-variant": "primary",   "data-size": "medium", "data-label": "Save changes" } },
      { id: "secondary", label: "Secondary",    attrs: { "data-variant": "secondary", "data-size": "medium", "data-label": "Cancel" } },
      { id: "icon-end",  label: "With trailing icon", attrs: { "data-variant": "primary", "data-label": "Continue", "data-icon-end": "\uf054" } },
      { id: "ghost-sm",  label: "Ghost · small", attrs: { "data-variant": "ghost",     "data-size": "small",  "data-label": "Edit" } },
      { id: "disabled",  label: "Disabled",      attrs: { "data-variant": "primary",   "data-label": "Submit", "disabled": "" } },
    ],
  },

  "sherpa-tag": {
    attrs: {
      "data-variant": { group: "variant", featured: true },
      "data-size":    { group: "variant", featured: true },
      "data-status":  { group: "variant" },
      "data-label":   { group: "data",    featured: true },
      "data-icon-start": { group: "data" },
    },
    presets: [
      { id: "neutral",  label: "Neutral",  attrs: { "data-label": "Beta",      "data-variant": "primary" } },
      { id: "success",  label: "Success",  attrs: { "data-label": "Active",    "data-status": "success" } },
      { id: "critical", label: "Critical", attrs: { "data-label": "Failed",    "data-status": "critical" } },
      { id: "small",    label: "Small",    attrs: { "data-label": "v2.4.0",    "data-size": "small" } },
    ],
  },

  "sherpa-callout": {
    attrs: {
      "data-status":      { group: "variant", featured: true },
      "data-variant":     { group: "variant" },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data",    featured: true },
      "data-icon":        { group: "data" },
    },
    presets: [
      { id: "info",     label: "Info",     attrs: { "data-status": "info",     "data-label": "Heads up",     "data-description": "This action will be logged for audit." } },
      { id: "warning",  label: "Warning",  attrs: { "data-status": "warning",  "data-label": "Review needed", "data-description": "Some fields require your attention." } },
      { id: "critical", label: "Critical", attrs: { "data-status": "critical", "data-label": "Cannot continue", "data-description": "Resolve the errors below to proceed." } },
      { id: "success",  label: "Success",  attrs: { "data-status": "success",  "data-label": "All set",      "data-description": "Your changes have been saved." } },
    ],
    nested: { expose: false },
  },

  "sherpa-input-text": {
    attrs: {
      "data-size":        { group: "variant", featured: true },
      "data-layout":      { group: "layout" },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data",    featured: true },
      "data-helper":      { group: "data" },
      "placeholder":      { group: "data",    featured: true },
      "value":            { group: "data" },
      "disabled":         { group: "state",   featured: true },
      "readonly":         { group: "state" },
      "required":         { group: "state" },
    },
    presets: [
      { id: "basic",    label: "Basic",        attrs: { "data-label": "First name",   "placeholder": "e.g. Alex" } },
      { id: "helper",   label: "With helper",  attrs: { "data-label": "Username",     "data-helper": "3–20 letters or numbers." } },
      { id: "required", label: "Required",     attrs: { "data-label": "Email",        "placeholder": "you@example.com", "required": "" } },
      { id: "disabled", label: "Disabled",     attrs: { "data-label": "Plan",         "value": "Pro tier", "disabled": "" } },
    ],
  },

  "sherpa-input-select": {
    attrs: {
      "data-size":        { group: "variant", featured: true },
      "data-layout":      { group: "layout" },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data" },
      "disabled":         { group: "state",   featured: true },
      "required":         { group: "state" },
    },
    presets: [
      { id: "basic",    label: "Basic",    attrs: { "data-label": "Region" } },
      { id: "inline",   label: "Inline",   attrs: { "data-label": "Sort by", "data-layout": "inline", "data-size": "small" } },
      { id: "required", label: "Required", attrs: { "data-label": "Country", "required": "" } },
    ],
  },

  "sherpa-input-checkbox": {
    attrs: {
      "data-size":        { group: "variant", featured: true },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data" },
      "checked":          { group: "state",   featured: true },
      "disabled":         { group: "state",   featured: true },
    },
    presets: [
      { id: "basic",    label: "Basic",    attrs: { "data-label": "Subscribe to newsletter" } },
      { id: "checked",  label: "Checked",  attrs: { "data-label": "I agree to terms", "checked": "" } },
      { id: "describe", label: "Described", attrs: { "data-label": "Auto-renew", "data-description": "Renews on the 1st of each month." } },
      { id: "disabled", label: "Disabled", attrs: { "data-label": "Locked option",   "disabled": "", "checked": "" } },
    ],
  },

  "sherpa-card": {
    attrs: {
      "data-variant":   { group: "variant", featured: true },
      "data-elevation": { group: "variant", featured: true },
      "data-pad":       { group: "layout" },
    },
    presets: [
      { id: "default",  label: "Default",   attrs: { "data-elevation": "sm" } },
      { id: "elevated", label: "Elevated",  attrs: { "data-elevation": "lg" } },
      { id: "flat",     label: "Flat",      attrs: { "data-elevation": "none" } },
    ],
    nested: { expose: true },
  },

  "sherpa-dialog": {
    attrs: {
      "data-size":        { group: "variant", featured: true },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data" },
      "data-open":        { group: "state",   featured: true },
    },
    nested: { expose: true },
  },

  "sherpa-container-header": {
    attrs: {
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data",    featured: true },
      "data-icon":        { group: "data" },
      "data-divider":     { group: "layout" },
    },
    nested: { expose: true },
  },

  "sherpa-list-panel": {
    attrs: {
      "data-match":       { group: "data",    featured: true },
      "data-empty":       { group: "data" },
      "data-heading":     { group: "data",    featured: true },
    },
    nested: { expose: true },
  },

  "sherpa-list-item": {
    attrs: {
      "data-variant":     { group: "variant", featured: true },
      "data-size":        { group: "variant" },
      "data-label":       { group: "data",    featured: true },
      "data-description": { group: "data",    featured: true },
      "data-icon":        { group: "data" },
      "data-selected":    { group: "state",   featured: true },
      "disabled":         { group: "state" },
    },
    presets: [
      { id: "basic",    label: "Basic",    attrs: { "data-label": "Acme Corp",       "data-description": "12 active devices" } },
      { id: "icon",     label: "With icon", attrs: { "data-label": "Settings",       "data-icon": "fa-solid fa-gear" } },
      { id: "selected", label: "Selected", attrs: { "data-label": "Current page",   "data-selected": "true" } },
    ],
  },
};

// ─── Public helpers ───────────────────────────────────────────────────
function explicitForAttr(tag, attrName) {
  const entry = CURATION[tag];
  if (!entry || !entry.attrs) return null;
  return entry.attrs[attrName] || null;
}

/**
 * Returns { group, hidden, featured } for an attribute.
 * Honours explicit curation; falls back to autoClassifyAttr.
 */
export function getAttrCuration(tag, attrName) {
  const explicit = explicitForAttr(tag, attrName);
  const group =
    explicit && VALID_GROUP_IDS.has(explicit.group)
      ? explicit.group
      : autoClassifyAttr(attrName);
  return {
    group,
    hidden:   !!(explicit && explicit.hidden),
    featured: !!(explicit && explicit.featured),
    // `toggleable` is tri-state: true forces the toggle wrapper, false
    // forces a plain input even when the attr name matches the auto-detect
    // pattern. Undefined means "use the auto-detect heuristic".
    toggleable: explicit && typeof explicit.toggleable === "boolean"
      ? explicit.toggleable
      : undefined,
  };
}

/** Returns the curated presets array for a tag (empty array when none). */
export function getPresets(tag) {
  const entry = CURATION[tag];
  return Array.isArray(entry?.presets) ? entry.presets : [];
}

/**
 * Returns nested-controls config for a parent tag.
 * Default: not exposed; featured-only when exposed.
 */
export function getNestedConfig(tag) {
  const entry = CURATION[tag];
  return {
    expose:       !!(entry?.nested?.expose),
    featuredOnly: entry?.nested?.featuredOnly !== false, // default true
  };
}
