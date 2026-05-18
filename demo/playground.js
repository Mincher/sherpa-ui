// ── Eagerly load sherpa components used in the playground chrome ──
import "../components/sherpa-view-header/sherpa-view-header.js";
import "../components/sherpa-content-section/sherpa-content-section.js";
import "../components/sherpa-list-panel/sherpa-list-panel.js";
import "../components/sherpa-list/sherpa-list.js";
import "../components/sherpa-list-item/sherpa-list-item.js";
import "../components/sherpa-empty-state/sherpa-empty-state.js";
import "../components/sherpa-card/sherpa-card.js";
import "../components/sherpa-section-header/sherpa-section-header.js";
import "../components/sherpa-input-text/sherpa-input-text.js";
import "../components/sherpa-input-number/sherpa-input-number.js";
import "../components/sherpa-input-select/sherpa-input-select.js";
import "../components/sherpa-toolbar/sherpa-toolbar.js";
import "../components/sherpa-layout-grid/sherpa-layout-grid.js";
import "../components/sherpa-layout-view/sherpa-layout-view.js";
import "../components/sherpa-input-checkbox/sherpa-input-checkbox.js";
import "../components/sherpa-switch/sherpa-switch.js";
import "../components/sherpa-button/sherpa-button.js";
import "../components/sherpa-message/sherpa-message.js";
import "../components/sherpa-callout/sherpa-callout.js";
import "../components/sherpa-tag/sherpa-tag.js";

import { ThemeManager } from "../components/utilities/theme-manager.js";
import { COMPONENT_CATEGORIES, COMPONENT_TIERS, getTier } from "../components/utilities/component-categories.js";
import { DUMMY_DATA } from "./playground-dummy-data.js";
import {
  GROUPS,
  getAttrCuration,
  getPresets,
  getNestedConfig,
} from "./playground-curation.js";

// ═══════════════════════════════════════════════════════════
// APPEARANCE (Theme / Mode / Density via ThemeManager)
// ═══════════════════════════════════════════════════════════

ThemeManager.init();

// Selectable themes. All themes are bundled into `css/styles/index.css` via
// sherpa-themes-extended.css — always loaded at zero cost. Selecting a theme
// sets <html data-theme="…"> which activates its [data-theme="..."] selectors.
// Never list `apex-2-core` here — it is the implicit baseline (no data-theme
// attribute required) and has no selectable slot.
const THEMES = [
  { value: "apex-2-purple", label: "Apex 2 (Purple)" },
  { value: "apex-2-teal",   label: "Apex 2 (Teal)" },
  { value: "apex-2-blue",   label: "Apex 2 (Blue)" },
  { value: "classic",       label: "Classic" },
];

// Discard any stale persisted theme that isn't a real selectable theme.
const ALLOWED_THEMES = new Set(THEMES.map((t) => t.value));
const persisted = localStorage.getItem("sherpa-theme");
if (persisted && !ALLOWED_THEMES.has(persisted)) {
  localStorage.removeItem("sherpa-theme");
}

ThemeManager.restore();
const MODES = [
  { value: "auto",  label: "Auto" },
  { value: "light", label: "Light" },
  { value: "dark",  label: "Dark" },
  { value: "hc",    label: "High Contrast" },
];
const DENSITIES = [
  { value: "compact",     label: "Compact" },
  { value: "base",        label: "Base" },
  { value: "comfortable", label: "Comfortable" },
];

// Status overrides applied per-component via [data-status] on the
// previewed instance. The empty value clears the override.
const STATUS_OVERRIDES = [
  { value: "",         label: "None (default)" },
  { value: "critical", label: "Critical" },
  { value: "warning",  label: "Warning" },
  { value: "success",  label: "Success" },
  { value: "info",     label: "Info" },
  { value: "urgent",   label: "Urgent" },
];

// ═══════════════════════════════════════════════════════════
// COMPONENT LIST — categories curated locally; tags pulled from
// schemas/components/index.json (the same source the MCP server
// reads), so the playground can never drift from MCP.
// ═══════════════════════════════════════════════════════════

// Category display order for the sidebar.
const CATEGORY_ORDER = [
  "Layout & Navigation",
  "Data Visualization",
  "Controls",
  "Inputs",
  "Feedback & Overlays",
  "Content",
  "Uncategorised",
];

// Curated tag → category mapping. Friendlier than the schema's
// coarse `category` field (most components are tagged "core").
const CATEGORY_MAP = {
  "sherpa-footer":                "Layout & Navigation",
  "sherpa-nav":                   "Layout & Navigation",
  "sherpa-nav-item":              "Layout & Navigation",
  "sherpa-nav-promo":             "Layout & Navigation",
  "sherpa-view-header":           "Layout & Navigation",
  "sherpa-section-header":        "Layout & Navigation",
  "sherpa-container":             "Layout & Navigation",
  "sherpa-container-header":      "Layout & Navigation",
  "sherpa-container-pdf-exporter":"Layout & Navigation",
  "sherpa-layout-grid":           "Layout & Navigation",
  "sherpa-layout-view":           "Layout & Navigation",
  "sherpa-toolbar":               "Layout & Navigation",
  "sherpa-breadcrumbs":           "Layout & Navigation",

  "sherpa-data-grid":             "Data Visualization",
  "sherpa-barchart":              "Data Visualization",
  "sherpa-donut-chart":           "Data Visualization",
  "sherpa-gauge-chart":           "Data Visualization",
  "sherpa-line-chart":            "Data Visualization",
  "sherpa-metric":                "Data Visualization",
  "sherpa-sparkline":             "Data Visualization",
  "sherpa-chart-legend":          "Data Visualization",
  "sherpa-key-value-list":        "Data Visualization",

  "sherpa-button":                "Controls",
  "sherpa-switch":                "Controls",
  "sherpa-stepper":               "Controls",
  "sherpa-tag":                   "Controls",
  "sherpa-pagination":            "Controls",
  "sherpa-slider":                "Controls",
  "sherpa-progress-bar":          "Controls",
  "sherpa-progress-tracker":      "Controls",

  "sherpa-input-text":            "Inputs",
  "sherpa-input-number":          "Inputs",
  "sherpa-input-password":        "Inputs",
  "sherpa-input-search":          "Inputs",
  "sherpa-input-select":          "Inputs",
  "sherpa-input-date":            "Inputs",
  "sherpa-input-date-range":      "Inputs",
  "sherpa-input-time":            "Inputs",
  "sherpa-input-checkbox":        "Inputs",
  "sherpa-input-checkbox-group":  "Inputs",
  "sherpa-input-radio":           "Inputs",
  "sherpa-input-radio-group":     "Inputs",
  "sherpa-input-tag":             "Inputs",
  "sherpa-file-upload":           "Inputs",

  "sherpa-dialog":                "Feedback & Overlays",
  "sherpa-toast":                 "Feedback & Overlays",
  "sherpa-tooltip":               "Feedback & Overlays",
  "sherpa-message":               "Feedback & Overlays",
  "sherpa-empty-state":           "Feedback & Overlays",
  "sherpa-menu":                  "Feedback & Overlays",
  "sherpa-menu-item":             "Feedback & Overlays",
  "sherpa-popover":               "Feedback & Overlays",
  "sherpa-callout":               "Feedback & Overlays",
  "sherpa-accordion":             "Feedback & Overlays",
  "sherpa-tabs":                  "Feedback & Overlays",
  "sherpa-list":                  "Feedback & Overlays",
  "sherpa-list-item":             "Feedback & Overlays",
  "sherpa-list-panel":            "Feedback & Overlays",
  "sherpa-loader":                "Feedback & Overlays",

  "sherpa-card":                  "Content",
  "sherpa-icon":                  "Content",
  "sherpa-filter-bar":            "Content",
  "sherpa-section-nav":           "Content",
  "sherpa-transfer-list":         "Content",
  "sherpa-product-bar":           "Content",
  "sherpa-product-bar-v2":        "Content",
  "sherpa-ai-panel":              "Content",
  "sherpa-chat-message":          "Content",
  "sherpa-prompt-composer":       "Content",
  "sherpa-content-section":       "Content",
  "sherpa-node":                  "Content",
  "sherpa-node-canvas":           "Content",
  "sherpa-node-header":           "Content",
  "sherpa-node-row":              "Content",
  "sherpa-node-socket":           "Content",
  "sherpa-scheduler":             "Content",
  "sherpa-panel":                 "Content",
  "sherpa-proposal-op":           "Content",
  "sherpa-proposal-preview":      "Content",
};

function prettyLabel(tag) {
  return tag
    .replace(/^sherpa-/, "")
    .split("-")
    .map((p) => p[0].toUpperCase() + p.slice(1))
    .join(" ");
}

// Build the COMPONENTS list from the schema index, sorted A→Z within
// each category. Warn at dev time if CATEGORY_MAP and the schema
// index drift apart — this keeps the playground aligned with MCP.
let COMPONENTS = [];
async function loadComponentList() {
  const res = await fetch("schemas/components/index.json");
  if (!res.ok) throw new Error("Failed to load schemas/components/index.json");
  const tags = await res.json();

  // Drift detection (alignment with MCP server's source of truth).
  const mapped = new Set(Object.keys(CATEGORY_MAP));
  const indexed = new Set(tags);
  const missingFromMap = [...indexed].filter((t) => !mapped.has(t));
  const extraInMap     = [...mapped].filter((t) => !indexed.has(t));
  if (missingFromMap.length) {
    console.warn(
      "[playground] Components in schemas/components/index.json missing from CATEGORY_MAP:",
      missingFromMap,
    );
  }
  if (extraInMap.length) {
    console.warn(
      "[playground] CATEGORY_MAP has tags absent from schemas/components/index.json:",
      extraInMap,
    );
  }

  COMPONENTS = tags
    .map((tag) => ({
      tag,
      label: prettyLabel(tag),
      category: CATEGORY_MAP[tag] || "Uncategorised",
    }))
    .sort((a, b) => a.label.localeCompare(b.label));
}

// ═══════════════════════════════════════════════════════════
// METADATA — read directly from schemas/components/<tag>.json
// (the same data the MCP server consumes). Replaces the old
// JSDoc-regex parser so enum values, types, and event details
// arrive as structured data with no parsing risk.
// ═══════════════════════════════════════════════════════════

const metadataCache = new Map();

async function getComponentMetadata(tag) {
  if (metadataCache.has(tag)) return metadataCache.get(tag);
  try {
    const res = await fetch(`schemas/components/${tag}.json`);
    if (!res.ok) throw new Error(`Failed to fetch schema for ${tag}`);
    const schema = await res.json();
    const metadata = {
      attributes: (schema.attributes || []).map((a) => ({
        name: a.name,
        type: a.type,
        description: a.description || "",
        enumValues: a.enumValues || null,
      })),
      slots: (schema.slots || []).map((s) => ({
        name: s.name || "",
        description: s.description || "",
        accepts: Array.isArray(s.accepts) ? s.accepts.slice() : null,
      })),
      events: (schema.events || []).map((e) => ({
        name: e.name,
        description: e.description || "",
      })),
      methods: schema.methods || [],
    };
    metadataCache.set(tag, metadata);
    return metadata;
  } catch (error) {
    console.warn(`Could not load metadata for ${tag}:`, error);
    return { attributes: [], slots: [], events: [], methods: [] };
  }
}

// ═══════════════════════════════════════════════════════════
// UI INITIALIZATION
// ═══════════════════════════════════════════════════════════

const componentListPanel = document.getElementById("component-list-panel");
const emptyState         = document.getElementById("empty-state");
const contentArea        = null; // legacy hook — preview header + card now toggle individually
const previewTitleHeader = document.getElementById("preview-title-header");
const previewContainer   = document.getElementById("preview-container");
const previewCard        = document.getElementById("preview-card");
const controlsContent    = document.getElementById("controls-content");

// Per-component controls live directly in the right rail.
// Appearance (Theme/Mode/Density/Status) is now in the global toolbar.
const componentControls = document.createElement("div");
controlsContent.appendChild(componentControls);

let currentComponent = null;
let currentInstance  = null;
let currentMetadata  = null;
let triggerHost      = null; // optional <div> sibling holding overlay triggers
let dummyNote        = null; // optional note element under the preview
let eventLog         = [];
const MAX_EVENTS     = 50;
const eventHandlers  = []; // [{ target, type, handler }] for cleanup

// Manual attribute overrides applied via the controls panel. Cleared on
// component switch. Used to rebuild the preview when an attribute change
// targets an attr the component does not include in observedAttributes —
// many components rely on attribute selectors in CSS for visual state but
// also have JS-driven text/structure that only updates on (re)render.
const currentOverrides = new Map();
let rebuildTimer = null;

// Attributes that don't need a rebuild because they are picked up by CSS
// attribute selectors (visual state only). Keep this list conservative;
// if a component reads one of these in JS at render time, force-rebuild
// is still safe — it just costs an extra render.
const CSS_DRIVEN_ATTR_RE = /^(?:data-(?:variant|size|status|theme|mode|density|state|expanded|open|active|loading|disabled|selected|checked|orientation|align|position|placement|tone|emphasis|layout|density|width|height))$/;

// ─── Sidebar list ───────────────────────────────────────────
function populateSidebar() {
  componentListPanel.innerHTML = "";

  // Group by category, render each in CATEGORY_ORDER order.
  const byCategory = new Map();
  for (const cat of CATEGORY_ORDER) byCategory.set(cat, []);
  for (const comp of COMPONENTS) {
    if (!byCategory.has(comp.category)) byCategory.set(comp.category, []);
    byCategory.get(comp.category).push(comp);
  }

  for (const [category, items] of byCategory) {
    if (!items.length) continue;
    const header = document.createElement("sherpa-section-header");
    header.dataset.label = category;
    header.dataset.headingLevel = "tertiary";
    componentListPanel.appendChild(header);

    const list = document.createElement("sherpa-list");
    list.dataset.variant = "divided";

    // Already alphabetised by COMPONENTS order, but be explicit.
    items.sort((a, b) => a.label.localeCompare(b.label));
    for (const comp of items) {
      const item = document.createElement("sherpa-list-item");
      item.dataset.label       = comp.label;
      item.dataset.description = `<${comp.tag}>`;
      item.dataset.interactive = "";
      item.dataset.tag         = comp.tag;
      list.appendChild(item);
    }
    componentListPanel.appendChild(list);
  }
}

// ─── Global appearance toolbar (Theme / Mode / Density) ──────────
// Wires the three sandbox-level selects to ThemeManager + <html>
// attribute mutations so every component on the page picks up the
// change instantly. Status overrides are applied per-component from
// the controls panel (see renderControls()) — not globally — so a
// component's [data-status] only affects that component's preview
// and does not bleed into other UI like the toolbar.
function initGlobalToolbar() {
  wireToolbarSelect(
    "global-theme-select",
    THEMES,
    ThemeManager.getTheme(),
    (v) => ThemeManager.setTheme(v),
  );
  wireToolbarSelect(
    "global-mode-select",
    MODES,
    ThemeManager.getMode(),
    (v) => {
      ThemeManager.setMode(v);
      document.documentElement.dataset.mode = v;
    },
  );
  wireToolbarSelect(
    "global-density-select",
    DENSITIES,
    ThemeManager.getDensity(),
    (v) => {
      ThemeManager.setDensity(v);
      document.documentElement.dataset.density = v;
    },
  );

  // Reflect persisted appearance on <html> so density-aware page
  // CSS matches storage on load.
  document.documentElement.dataset.density = ThemeManager.getDensity();
  document.documentElement.dataset.mode    = ThemeManager.getMode();
}

function wireToolbarSelect(id, options, currentValue, onChange) {
  const select = document.getElementById(id);
  if (!select) return;
  select.innerHTML = "";
  for (const opt of options) {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === currentValue) o.selected = true;
    select.appendChild(o);
  }
  if (currentValue !== undefined && currentValue !== null) {
    select.setAttribute("value", currentValue);
  }
  select.addEventListener("change", (e) => {
    const value = e?.detail?.value ?? select.value ?? "";
    onChange(value);
  });
}

// ─── Sidebar click → component selection ────────────────────
componentListPanel.addEventListener("list-item-click", (e) => {
  const itemEl = e.composedPath().find(
    (n) => n instanceof HTMLElement && n.tagName === "SHERPA-LIST-ITEM"
  );
  if (itemEl?.dataset.tag) selectComponent(itemEl.dataset.tag);
});

// ═══════════════════════════════════════════════════════════
// COMPONENT SELECTION & PREVIEW
// ═══════════════════════════════════════════════════════════

async function selectComponent(tag) {
  currentComponent = tag;
  eventLog = [];
  currentOverrides.clear();
  if (rebuildTimer) { clearTimeout(rebuildTimer); rebuildTimer = null; }

  // Remove any stale event listeners attached to the previous instance.
  for (const { target, type, handler } of eventHandlers) {
    target.removeEventListener(type, handler);
  }
  eventHandlers.length = 0;

  componentListPanel.querySelectorAll("sherpa-list-item").forEach((item) => {
    item.toggleAttribute("data-active", item.dataset.tag === tag);
  });

  emptyState.hidden          = true;
  previewTitleHeader.hidden  = false;
  previewCard.hidden         = false;

  const component = COMPONENTS.find((c) => c.tag === tag);
  previewTitleHeader.dataset.label = `${component.label}  <${tag}>`;

  const metadata = await getComponentMetadata(tag);
  currentMetadata = metadata;
  await createComponentPreview(tag, metadata);
  renderControls(metadata);

  sessionStorage.setItem("selectedComponent", tag);
}

async function createComponentPreview(tag, metadata) {
  previewContainer.innerHTML = "";
  triggerHost = null;
  if (dummyNote) { dummyNote.remove(); dummyNote = null; }

  const preset = DUMMY_DATA[tag] || {};

  try {
    await import(`../components/${tag}/${tag}.js`);
    currentInstance = document.createElement(tag);

    // 1. Heuristic attribute pre-population (from JSDoc-style metadata).
    metadata.attributes.forEach((attr) => {
      if (attr.type === "boolean") return;
      const sample = sampleValueFor(attr, tag);
      if (sample !== null && sample !== "") {
        setHostAttr(attr.name, sample, currentInstance);
      }
    });

    // 2. Preset attribute overrides — wins over heuristic defaults.
    if (preset.attrs) {
      for (const [name, value] of Object.entries(preset.attrs)) {
        setHostAttr(name, value, currentInstance);
      }
    }

    // 2b. Manual overrides from the controls panel — wins over presets.
    //     Removed (null) overrides explicitly delete the attribute.
    for (const [name, value] of currentOverrides) {
      if (value === null) {
        if (name.startsWith("data-")) {
          delete currentInstance.dataset[dataKey(name)];
        } else {
          currentInstance.removeAttribute(name);
        }
      } else {
        setHostAttr(name, value, currentInstance);
      }
    }

    // 3. Slot / light-DOM content.
    if (preset.html) {
      currentInstance.innerHTML = preset.html;
    } else if (metadata.slots.some((s) => !s.name) && !currentInstance.textContent) {
      currentInstance.textContent = "Sample content";
    }

    previewContainer.appendChild(currentInstance);

    // 4. Optional setup hook for programmatic init (setData, setOptions,
    //    show(), wiring trigger buttons, etc.). Runs after the element
    //    is connected so methods are available.
    if (typeof preset.setup === "function") {
      try {
        const result = preset.setup({
          instance: currentInstance,
          container: previewContainer,
          addTrigger: addTriggerButton,
        });
        if (result instanceof Promise) await result;
      } catch (err) {
        console.error(`[playground] setup() failed for ${tag}:`, err);
      }
    }

    // 5. Optional dummy-data note ("loaded with N rows of sample data…").
    if (preset.note) {
      dummyNote = document.createElement("sherpa-message");
      dummyNote.dataset.status = "info";
      dummyNote.dataset.label  = preset.note.replace(/<[^>]*>/g, "");
      previewCard.appendChild(dummyNote);
    }
  } catch (error) {
    console.error(`Failed to create component ${tag}:`, error);
    const msg = document.createElement("sherpa-message");
    msg.dataset.status = "critical";
    msg.dataset.label  = `Error loading component: ${error.message}`;
    previewContainer.appendChild(msg);
  }
}

// Helper passed to preset.setup() — appends a trigger button
// (e.g. "Open dialog") to a sherpa-toolbar action row beneath the component.
function addTriggerButton({ label, iconStart, onClick }) {
  if (!triggerHost) {
    triggerHost = document.createElement("sherpa-toolbar");
    triggerHost.dataset.template = "actions";
    previewContainer.appendChild(triggerHost);
  }
  const btn = document.createElement("sherpa-button");
  btn.slot            = "actions";
  btn.dataset.label   = label;
  btn.dataset.variant = "primary";
  btn.dataset.size    = "small";
  if (iconStart) btn.dataset.iconStart = iconStart;
  btn.addEventListener("button-click", onClick);
  triggerHost.appendChild(btn);
  return btn;
}

// ── Sample value heuristic per attribute ──
// Some attributes are intentionally NOT seeded:
//   • data-status — components default to no status ("none"); the
//     user opts into a status via the per-component Status control.
//   • Optional visual elements (data-icon*, data-description,
//     data-helper, data-badge, data-close-button) — these render as
//     toggleable rows so users can flip them on. Seeding them would
//     defeat the toggle.
const NO_SEED_ATTRS = /^(data-status|data-icon|data-icon-start|data-icon-end|data-icon-svg|data-svg-icon|data-avatar-icon|data-illustration|data-description|data-helper|data-badge|data-badge-status|data-close-button|data-count)$/;

function sampleValueFor(attr, tag) {
  if (NO_SEED_ATTRS.test(attr.name)) return null;
  const name = attr.name.replace(/^data-/, "");

  if (attr.type === "enum") {
    if (Array.isArray(attr.enumValues) && attr.enumValues.length) {
      return attr.enumValues[0];
    }
    return "";
  }
  if (attr.type === "number") {
    if (/min/.test(name)) return "0";
    if (/max/.test(name)) return "100";
    if (/step/.test(name)) return "1";
    if (/count|span|page-size/.test(name)) return "3";
    if (/total/.test(name)) return "120";
    return "42";
  }
  if (attr.type === "json") return "";

  // string
  // Most components expect a Font Awesome unicode codepoint for icon
  // attrs, not a class string. \uf005 is fa-star.
  if (/^icon/.test(name) || name === "icon") return "\uf005";
  if (/illustration/.test(name)) return "empty";
  if (/heading|title/.test(name)) return "Sample heading";
  if (/description|helper|placeholder|small-print|empty/.test(name)) {
    return "Sample descriptive text.";
  }
  if (/label/.test(name)) return `Sample ${tag.replace(/^sherpa-/, "")}`;
  if (/value/.test(name)) return "Sample value";
  if (/name/.test(name)) return tag.replace(/^sherpa-/, "") + "-field";
  return `Sample ${name}`;
}

// ═══════════════════════════════════════════════════════════
// CONTROLS PANEL RENDERING
// ═══════════════════════════════════════════════════════════

function dataKey(attrName) {
  return toCamelCase(attrName.replace(/^data-/, ""));
}

function setHostAttr(attr, rawValue, target = currentInstance) {
  if (!target) return;
  if (attr.startsWith("data-")) {
    target.dataset[dataKey(attr)] = rawValue;
  } else {
    target.setAttribute(attr, rawValue);
  }
}

// Apply a control-driven attribute change. Records the change in
// currentOverrides so subsequent rebuilds preserve user intent, mutates
// the live instance for immediate visual feedback, and schedules a
// preview rebuild when the target component does not observe the
// attribute (so JS-driven text/structure picks it up).
function applyAttrChange(attrName, value) {
  const isRemoval = value === null || value === undefined || value === "";
  if (isRemoval) {
    currentOverrides.set(attrName, null);
    if (currentInstance) {
      if (attrName.startsWith("data-")) {
        delete currentInstance.dataset[dataKey(attrName)];
      } else {
        currentInstance.removeAttribute(attrName);
      }
    }
  } else {
    currentOverrides.set(attrName, value);
    setHostAttr(attrName, value);
  }
  sessionStorage.setItem(`${currentComponent}_${attrName}`, value ?? "");
  scheduleRebuildIfNeeded(attrName);
}

function scheduleRebuildIfNeeded(attrName) {
  if (!currentComponent) return;
  const ctor = customElements.get(currentComponent);
  const observed = ctor?.observedAttributes ?? [];
  if (observed.includes(attrName)) return;
  if (CSS_DRIVEN_ATTR_RE.test(attrName)) return;
  // Debounce so rapid keystrokes don't thrash the preview.
  if (rebuildTimer) clearTimeout(rebuildTimer);
  rebuildTimer = setTimeout(async () => {
    rebuildTimer = null;
    if (!currentComponent || !currentMetadata) return;
    await createComponentPreview(currentComponent, currentMetadata);
  }, 80);
}

function makeSectionHeader(label) {
  const header = document.createElement("sherpa-section-header");
  header.dataset.label        = label;
  header.dataset.headingLevel = "tertiary";
  header.dataset.divider      = "";
  return header;
}

// ─── Slot editor ────────────────────────────────────────────
// Renders one editable slot row per declared slot:
//   • Header: slot name + accepted-roles chips
//   • List of currently slotted children with × remove
//   • Picker (component select + Add button) filtered to allowed roles
//   • If the slot is unconstrained, also exposes a free-HTML text input
function buildSlotControl(slot) {
  const slotName = slot.name || "";
  const labelText = slotName ? `Slot: ${slotName}` : "Default slot";
  const accepts = Array.isArray(slot.accepts) ? slot.accepts.slice() : null;
  const allowHtml = !accepts || accepts.includes("html");

  const wrap = document.createElement("div");
  wrap.style.cssText =
    "display:flex;flex-direction:column;gap:var(--sherpa-space-xs,8px);" +
    "padding:var(--sherpa-space-sm,12px) 0;" +
    "border-top:1px solid var(--sherpa-border-container-subtle,#eee);";

  // Header row: slot label + accepts chips
  const head = document.createElement("div");
  head.style.cssText =
    "display:flex;flex-wrap:wrap;align-items:center;gap:var(--sherpa-space-xs,8px);";
  const title = document.createElement("strong");
  title.textContent = labelText;
  title.style.cssText = "font: var(--sherpa-text-label-md);";
  head.appendChild(title);

  if (accepts && accepts.length) {
    accepts.forEach((role) => {
      const chip = document.createElement("sherpa-tag");
      chip.dataset.label = role;
      chip.dataset.size = "small";
      head.appendChild(chip);
    });
  } else {
    const chip = document.createElement("sherpa-tag");
    chip.dataset.label = "any";
    chip.dataset.size = "small";
    head.appendChild(chip);
  }
  wrap.appendChild(head);

  if (slot.description) {
    const desc = document.createElement("div");
    desc.textContent = slot.description;
    desc.style.cssText =
      "font: var(--sherpa-text-body-sm);color: var(--sherpa-text-default-subtle);";
    wrap.appendChild(desc);
  }

  // Current contents list
  const list = document.createElement("div");
  list.style.cssText =
    "display:flex;flex-direction:column;gap:var(--sherpa-space-2xs,4px);";
  wrap.appendChild(list);

  const renderList = () => {
    list.innerHTML = "";
    if (!currentInstance) return;
    const children = slotName
      ? currentInstance.querySelectorAll(`:scope > [slot="${slotName}"]`)
      : Array.from(currentInstance.children).filter((c) => !c.hasAttribute("slot"));
    if (!children || (children.length === 0 && !(!slotName && currentInstance.childNodes.length))) {
      const empty = document.createElement("div");
      empty.textContent = "(empty)";
      empty.style.cssText =
        "font: var(--sherpa-text-body-sm);color: var(--sherpa-text-default-subtle);" +
        "padding: var(--sherpa-space-2xs,4px) 0;";
      list.appendChild(empty);
    }
    Array.from(children).forEach((child) => {
      const row = document.createElement("div");
      row.style.cssText =
        "display:flex;align-items:center;gap:var(--sherpa-space-xs,8px);" +
        "padding:var(--sherpa-space-2xs,4px) var(--sherpa-space-xs,8px);" +
        "background: var(--sherpa-surface-app-background-subtle,#f5f5f5);" +
        "border-radius: var(--sherpa-border-rounding-base,4px);";
      const tagName = document.createElement("code");
      tagName.textContent = `<${child.localName}>`;
      tagName.style.cssText = "flex:1;font: var(--sherpa-text-code-sm);";
      const label = child.dataset?.label || child.textContent?.trim();
      if (label) {
        const labelSpan = document.createElement("span");
        labelSpan.textContent = label.length > 24 ? label.slice(0, 24) + "…" : label;
        labelSpan.style.cssText =
          "font: var(--sherpa-text-body-sm);color: var(--sherpa-text-default-subtle);";
        row.appendChild(tagName);
        row.appendChild(labelSpan);
      } else {
        row.appendChild(tagName);
      }
      const removeBtn = document.createElement("sherpa-button");
      removeBtn.dataset.type = "icon";
      removeBtn.dataset.iconStart = "fa-solid fa-xmark";
      removeBtn.dataset.variant = "tertiary";
      removeBtn.dataset.size = "small";
      removeBtn.setAttribute("aria-label", `Remove ${child.localName}`);
      removeBtn.addEventListener("button-click", () => {
        child.remove();
        renderList();
      });
      row.appendChild(removeBtn);
      list.appendChild(row);
    });
  };

  // Picker: select + add button
  const hostTier = currentComponent ? getTier(currentComponent) : null;
  const allowedComponents = COMPONENTS.filter((c) => {
    const cat = COMPONENT_CATEGORIES[c.tag];
    const tier = COMPONENT_TIERS[c.tag];
    // Tier rule: child tier must be >= host tier (same or deeper).
    if (hostTier != null && tier != null && tier < hostTier) return false;
    // Allowlist rule: when slot has accepts, child role must match.
    if (accepts && !(cat && accepts.includes(cat))) return false;
    return true;
  });

  if (allowedComponents.length > 0) {
    const picker = document.createElement("div");
    picker.style.cssText =
      "display:flex;align-items:flex-end;gap:var(--sherpa-space-xs,8px);";

    const select = document.createElement("sherpa-input-select");
    select.dataset.label = "Add component";
    select.style.flex = "1";
    const optionList = allowedComponents.map((c) => ({
      value: c.tag,
      label: `${c.label} (${COMPONENT_CATEGORIES[c.tag] || "?"})`,
    }));
    // setOptions() may not exist yet if the element hasn't upgraded;
    // sherpa-input-select queues calls until its inner <select> renders.
    customElements.whenDefined("sherpa-input-select").then(() => {
      if (typeof select.setOptions === "function") select.setOptions(optionList);
    });

    let selectedTag = "";
    select.addEventListener("change", (e) => {
      selectedTag = e?.detail?.value ?? select.getAttribute("value") ?? "";
    });

    const addBtn = document.createElement("sherpa-button");
    addBtn.dataset.label = "Add";
    addBtn.dataset.iconStart = "fa-solid fa-plus";
    addBtn.dataset.variant = "secondary";
    addBtn.dataset.size = "small";
    addBtn.addEventListener("button-click", () => {
      if (!currentInstance) return;
      const tag = selectedTag || select.getAttribute("value") || allowedComponents[0]?.tag;
      if (!tag) return;
      const el = document.createElement(tag);
      if (slotName) el.setAttribute("slot", slotName);
      // Seed with a minimal sensible default so the new child is visible.
      el.dataset.label = prettyLabel(tag);
      currentInstance.appendChild(el);
      renderList();
    });

    picker.appendChild(select);
    picker.appendChild(addBtn);
    wrap.appendChild(picker);
  } else if (accepts && accepts.length) {
    const note = document.createElement("div");
    note.textContent = "No registered components match the allowed roles.";
    note.style.cssText =
      "font: var(--sherpa-text-body-sm);color: var(--sherpa-text-default-subtle);";
    wrap.appendChild(note);
  }

  // Free-HTML fallback for unconstrained slots (or those allowing `html`).
  if (allowHtml) {
    const html = document.createElement("sherpa-input-text");
    html.dataset.label = "Or set raw HTML/text";
    html.setAttribute("placeholder", "<span>Hello</span> or plain text");
    html.addEventListener("change", (e) => {
      const value = e?.detail?.value ?? html.getAttribute("value") ?? "";
      if (!currentInstance || !value) return;
      const div = document.createElement("div");
      if (slotName) div.setAttribute("slot", slotName);
      div.innerHTML = value;
      currentInstance.appendChild(div);
      html.setAttribute("value", "");
      renderList();
    });
    wrap.appendChild(html);
  }

  // Defer first list render until preview instance is in place.
  queueMicrotask(renderList);

  return wrap;
}

function readHostAttr(attrName, target = currentInstance) {
  if (!target) return "";
  if (attrName.startsWith("data-")) {
    return target.dataset[dataKey(attrName)] ?? "";
  }
  return target.getAttribute(attrName) ?? "";
}

// Decorate a control element with the row's label/description using
// the input components' native data-label / data-description attributes.
// No wrapper, no class names — pure component composition.
function makeControlRow(labelText, descriptionText, controlEl) {
  if (controlEl && labelText) controlEl.dataset.label = labelText;
  if (controlEl && descriptionText) controlEl.dataset.description = descriptionText;
  return controlEl;
}

// Build a single attribute control row bound to `target`. The
// applyChange callback owns persistence + rebuild semantics — the
// host instance tracks overrides and may trigger a debounced
// rebuild, while nested instances just mutate the attr directly.
function buildAttrControl(attr, target, applyChange) {
  // Toggleable optional visual elements (icons, helper text, badge,
  // close button) get a switch wrapper so users can flip them on/off
  // without clearing the value field. Booleans are already toggles
  // — they fall through to the standard checkbox control below.
  if (attr.type !== "boolean" && isToggleableAttr(attr.name)) {
    return buildToggleableAttrControl(attr, target, applyChange);
  }

  const currentValue = readHostAttr(attr.name, target);

  if (attr.type === "boolean") {
    // sherpa-input-checkbox supports data-label/data-description natively;
    // sherpa-switch does not, so we use checkbox here for label parity.
    const cb = document.createElement("sherpa-input-checkbox");
    if (target?.hasAttribute(attr.name)) cb.setAttribute("checked", "");
    cb.addEventListener("change", (e) => {
      const checked = !!(e.detail?.checked ?? cb.hasAttribute("checked"));
      applyChange(attr.name, checked ? "" : null, { boolean: true, checked });
    });
    return makeControlRow(attr.name, attr.description, cb);
  }

  if (attr.type === "enum") {
    const select = document.createElement("sherpa-input-select");
    const opts = Array.isArray(attr.enumValues) ? attr.enumValues : [];
    const blank = document.createElement("option");
    blank.value = "";
    blank.textContent = "(unset)";
    select.appendChild(blank);
    opts.forEach((opt) => {
      const o = document.createElement("option");
      o.value = opt;
      o.textContent = opt;
      if (opt === currentValue) o.selected = true;
      select.appendChild(o);
    });
    if (currentValue) select.setAttribute("value", currentValue);
    select.addEventListener("change", (e) => {
      applyChange(attr.name, e?.detail?.value ?? select.value ?? "");
    });
    return makeControlRow(attr.name, attr.description, select);
  }

  if (attr.type === "number") {
    const input = document.createElement("sherpa-input-number");
    if (attr.description) input.setAttribute("placeholder", attr.description);
    if (currentValue) input.setAttribute("value", currentValue);
    const onChange = (e) => applyChange(attr.name, e?.detail?.value ?? input.value ?? "");
    input.addEventListener("input", onChange);
    input.addEventListener("change", onChange);
    return makeControlRow(attr.name, attr.description, input);
  }

  if (attr.type === "json") {
    const input = document.createElement("sherpa-input-text");
    input.setAttribute("placeholder", "JSON array or object");
    if (currentValue) input.setAttribute("value", currentValue);
    input.addEventListener("change", (e) => {
      const value = e?.detail?.value ?? input.value ?? "";
      if (value === "") { applyChange(attr.name, ""); return; }
      try {
        JSON.parse(value);
        applyChange(attr.name, value);
      } catch (err) {
        alert("Invalid JSON: " + err.message);
      }
    });
    return makeControlRow(attr.name, attr.description, input);
  }

  // string (default)
  const input = document.createElement("sherpa-input-text");
  if (attr.description) input.setAttribute("placeholder", attr.description);
  if (currentValue) input.setAttribute("value", currentValue);
  const onChange = (e) => applyChange(attr.name, e?.detail?.value ?? input.value ?? "");
  input.addEventListener("input", onChange);
  input.addEventListener("change", onChange);
  return makeControlRow(attr.name, attr.description, input);
}

// Auto-detect attributes that represent optional visual elements.
// These render as a switch + value input pair so users can toggle
// the element on/off independently of the value text. Curation can
// opt attrs in/out via { toggleable: true } / { toggleable: false }.
const TOGGLEABLE_AUTO_RE = /^(data-icon|data-icon-start|data-icon-end|data-icon-svg|data-svg-icon|data-avatar-icon|data-illustration|data-description|data-helper|data-badge|data-badge-status|data-close-button|data-count)$/;
function isToggleableAttr(attrName) {
  // Explicit curation override (currently only on a per-attr basis
  // via the `toggleable` field in CURATION) wins. Default to the
  // automatic detection list above.
  const cur = currentComponent ? getAttrCuration(currentComponent, attrName) : null;
  if (cur && typeof cur.toggleable === "boolean") return cur.toggleable;
  return TOGGLEABLE_AUTO_RE.test(attrName);
}

// Sample value to fill a toggleable input when the user flips it ON
// and the attribute has no current value. Falls back to a generic
// string sample for unknown attrs.
function sampleForToggleable(attrName) {
  if (/^data-icon|^data-svg-icon|^data-icon-svg|^data-avatar-icon/.test(attrName)) return "fa-solid fa-star";
  if (attrName === "data-illustration") return "empty";
  if (attrName === "data-description") return "Sample descriptive text.";
  if (attrName === "data-helper") return "Helper hint shown beneath the field.";
  if (attrName === "data-badge") return "3";
  if (attrName === "data-badge-status") return "info";
  if (attrName === "data-close-button") return "";          // boolean-ish presence
  if (attrName === "data-count") return "5";
  return "";
}

// Render a switch + value input. Switch presence drives the attribute
// on the target; the value input is only visible when switched on.
function buildToggleableAttrControl(attr, target, applyChange) {
  const currentValue = readHostAttr(attr.name, target);
  const present      = target?.hasAttribute(attr.name) ?? false;

  const wrap = document.createElement("div");
  wrap.className = "toggleable-attr";

  // Header row: explicit attr-name label + on/off switch.
  const header = document.createElement("div");
  header.className = "toggleable-attr-header";
  const labelEl = document.createElement("span");
  labelEl.className = "toggleable-attr-label";
  labelEl.textContent = attr.name;
  const sw = document.createElement("sherpa-switch");
  if (present) sw.setAttribute("checked", "");
  header.appendChild(labelEl);
  header.appendChild(sw);

  // Value input — reuse the standard string/number control by
  // delegating to a tiny inline builder. We always render a text
  // input here because toggleable attrs are string-shaped (icons,
  // helper text, badge content). data-close-button is a boolean-ish
  // presence flag so we hide its value input entirely.
  const isPresenceOnly = attr.name === "data-close-button";
  const valueInput = isPresenceOnly
    ? null
    : document.createElement("sherpa-input-text");
  if (valueInput) {
    if (attr.description) valueInput.setAttribute("placeholder", attr.description);
    if (currentValue) valueInput.setAttribute("value", currentValue);
    valueInput.dataset.size = "small";
    if (!present) valueInput.hidden = true;
    const onChange = (e) => {
      const v = e?.detail?.value ?? valueInput.value ?? "";
      applyChange(attr.name, v);
    };
    valueInput.addEventListener("input", onChange);
    valueInput.addEventListener("change", onChange);
  }

  sw.addEventListener("change", (e) => {
    const checked = !!(e.detail?.checked ?? sw.hasAttribute("checked"));
    if (checked) {
      const existing = readHostAttr(attr.name, target);
      const next = existing || (valueInput?.getAttribute("value") ?? "") || sampleForToggleable(attr.name);
      applyChange(attr.name, next);
      if (valueInput) {
        valueInput.hidden = false;
        if (!valueInput.getAttribute("value") && next) {
          valueInput.setAttribute("value", next);
        }
      }
    } else {
      applyChange(attr.name, null);
      if (valueInput) valueInput.hidden = true;
    }
  });

  wrap.appendChild(header);
  if (valueInput) wrap.appendChild(valueInput);
  return wrap;
}

// ── Host applyChange — records override + may rebuild preview.
function hostApplyChange(attrName, value, opts = {}) {
  if (opts.boolean) {
    if (!currentInstance) return;
    currentOverrides.set(attrName, opts.checked ? "" : null);
    currentInstance.toggleAttribute(attrName, opts.checked);
    sessionStorage.setItem(`${currentComponent}_${attrName}`, opts.checked);
    scheduleRebuildIfNeeded(attrName);
    return;
  }
  applyAttrChange(attrName, value);
}

// ── Nested applyChange — direct mutation on nested instance.
function makeNestedApplyChange(target) {
  return (attrName, value, opts = {}) => {
    if (!target) return;
    if (opts.boolean) {
      target.toggleAttribute(attrName, opts.checked);
      return;
    }
    const isRemoval = value === null || value === undefined || value === "";
    if (isRemoval) {
      if (attrName.startsWith("data-")) {
        delete target.dataset[dataKey(attrName)];
      } else {
        target.removeAttribute(attrName);
      }
    } else {
      setHostAttr(attrName, value, target);
    }
  };
}

// Build a "Status" override row that writes [data-status] on `target`.
// This replaces the old global toolbar status select — each previewed
// component (and each of its nested children) gets its own status
// override scoped to that instance, so you can compare e.g. a
// critical button next to a success toast on the same canvas.
function buildStatusControl(target, applyChange) {
  const select = document.createElement("sherpa-input-select");
  const current = readHostAttr("data-status", target);
  STATUS_OVERRIDES.forEach((opt) => {
    const o = document.createElement("option");
    o.value = opt.value;
    o.textContent = opt.label;
    if (opt.value === current) o.selected = true;
    select.appendChild(o);
  });
  if (current) select.setAttribute("value", current);
  select.addEventListener("change", (e) => {
    applyChange("data-status", e?.detail?.value ?? select.value ?? "");
  });
  return makeControlRow(
    "data-status",
    "Drive --_status-* tokens for this component only.",
    select,
  );
}

function renderControls(metadata) {
  componentControls.innerHTML = "";

  // ── Presets (curated variant chips) ──────────────────
  const presets = getPresets(currentComponent);
  if (presets.length > 0) {
    const presetSection = document.createElement("div");
    presetSection.className = "preset-section";
    presetSection.appendChild(makeSectionHeader("Presets"));
    const chips = document.createElement("div");
    chips.className = "preset-chips";
    presets.forEach((preset) => {
      const chip = document.createElement("sherpa-button");
      chip.dataset.variant = "secondary";
      chip.dataset.size    = "small";
      chip.dataset.label   = preset.label;
      if (preset.iconStart) chip.dataset.iconStart = preset.iconStart;
      chip.addEventListener("button-click", () => applyPreset(preset, metadata));
      chips.appendChild(chip);
    });
    presetSection.appendChild(chips);
    componentControls.appendChild(presetSection);
  }

  // ── Attributes (grouped) ──────────────────────────────
  // Bucket attrs into curated groups (variant/layout/data/state/other),
  // drop hidden ones, sort featured first within group, and render
  // each non-empty group as a collapsible <details>. `other` collapses
  // by default so noisy attrs (aria-*, pdf-mode, etc.) stay tucked away.
  // The per-component Status override always lives at the top of the
  // "variant" group, so the group renders even when the component
  // declares no other variant attrs.
  {
    const buckets = new Map(GROUPS.map((g) => [g.id, []]));
    metadata.attributes.forEach((attr) => {
      if (attr.name === "data-status") return; // rendered via buildStatusControl
      const cur = getAttrCuration(currentComponent, attr.name);
      if (cur.hidden) return;
      const bucket = buckets.get(cur.group) || buckets.get("other");
      bucket.push({ attr, featured: cur.featured });
    });

    GROUPS.forEach((g) => {
      const items = buckets.get(g.id) || [];
      const isVariant = g.id === "variant";
      if (items.length === 0 && !isVariant) return;
      items.sort((a, b) => Number(b.featured) - Number(a.featured));

      const details = document.createElement("details");
      details.className = "attr-group";
      if (g.id !== "other") details.open = true;
      const summary = document.createElement("summary");
      summary.textContent = g.label;
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "attr-group-body";
      if (isVariant) {
        body.appendChild(buildStatusControl(currentInstance, hostApplyChange));
      }
      items.forEach(({ attr }) => {
        body.appendChild(buildAttrControl(attr, currentInstance, hostApplyChange));
      });
      details.appendChild(body);
      componentControls.appendChild(details);
    });
  }

  // ── Slots ─────────────────────────────────────────────
  if (metadata.slots.length > 0) {
    const section = document.createElement("div");
    section.appendChild(makeSectionHeader("Slots"));

    metadata.slots.forEach((slot) => {
      section.appendChild(buildSlotControl(slot));
    });

    componentControls.appendChild(section);
  }

  // ── Events ────────────────────────────────────────────
  if (metadata.events.length > 0) {
    const section = document.createElement("div");
    section.appendChild(makeSectionHeader("Event Log"));

    metadata.events.forEach((event) => {
      if (!currentInstance) return;
      const handler = (e) => logEvent(event.name, e.detail);
      currentInstance.addEventListener(event.name, handler);
      eventHandlers.push({ target: currentInstance, type: event.name, handler });
    });

    const clearBtn = document.createElement("sherpa-button");
    clearBtn.dataset.label     = "Clear log";
    clearBtn.dataset.variant   = "tertiary";
    clearBtn.dataset.size      = "small";
    clearBtn.dataset.iconStart = "\uf2ed"; // fa-trash
    clearBtn.addEventListener("button-click", () => {
      eventLog = [];
      updateEventLog();
    });
    section.appendChild(clearBtn);

    const logList = document.createElement("sherpa-list");
    logList.id              = "event-log-list";
    logList.dataset.variant = "divided";
    logList.dataset.density = "compact";
    logList.dataset.empty   = "No events yet";
    section.appendChild(logList);

    componentControls.appendChild(section);
    updateEventLog();
  }

  // ── Nested components ─────────────────────────────────
  // When a preset injects nested sherpa-* elements (e.g. a
  // <sherpa-list> with <sherpa-list-item> children, or a card
  // composing a header + button), expose each nested instance's
  // attributes + status in its own controls section. Edits target
  // the nested element directly — no host rebuild — so changes
  // survive until the user picks a different component.
  renderNestedControls();
}

async function renderNestedControls() {
  if (!currentInstance) return;

  // Nested controls are opt-in per parent — most components don't
  // benefit from exposing every internal child. Curation registry
  // lists the parents (sherpa-card, sherpa-callout, sherpa-dialog,
  // sherpa-container-header, sherpa-list-panel) that do.
  const cfg = getNestedConfig(currentComponent);
  if (!cfg.expose) return;

  const nested = Array.from(
    currentInstance.querySelectorAll("*")
  ).filter((el) => el.tagName.toLowerCase().startsWith("sherpa-"));
  if (!nested.length) return;

  // Group by tag so we can fetch metadata once per type, then
  // render one collapsed <details> per individual instance.
  const byTag = new Map();
  for (const el of nested) {
    const tag = el.tagName.toLowerCase();
    if (!byTag.has(tag)) byTag.set(tag, []);
    byTag.get(tag).push(el);
  }

  for (const [tag, instances] of byTag) {
    let meta;
    try {
      meta = await getComponentMetadata(tag);
    } catch {
      continue;
    }
    if (!meta) continue;

    // When featuredOnly is on, prefer explicitly-featured attrs.
    // Fallback for uncurated children: variant + state groups only,
    // so the nested view stays compact even without curation.
    const visibleAttrs = (meta.attributes || []).filter((attr) => {
      const cur = getAttrCuration(tag, attr.name);
      if (cur.hidden) return false;
      if (!cfg.featuredOnly) return true;
      if (cur.featured) return true;
      // Heuristic fallback when no explicit featured flag exists.
      return cur.group === "variant" || cur.group === "state";
    });

    instances.forEach((target, idx) => {
      const details = document.createElement("details");
      details.className = "nested-group";
      const suffix = instances.length > 1 ? ` #${idx + 1}` : "";
      const summary = document.createElement("summary");
      summary.textContent = `<${tag}>${suffix}`;
      details.appendChild(summary);

      const body = document.createElement("div");
      body.className = "nested-group-body";
      const apply = makeNestedApplyChange(target);

      // Status row first — most useful nested override.
      body.appendChild(buildStatusControl(target, apply));

      visibleAttrs.forEach((attr) => {
        body.appendChild(buildAttrControl(attr, target, apply));
      });

      details.appendChild(body);
      componentControls.appendChild(details);
    });
  }
}

// Apply a curated preset: writes each attr through the same
// hostApplyChange path the controls use, so currentOverrides + the
// session storage cache stay in sync. Then re-render the controls
// panel so dropdowns / text fields reflect the new values.
function applyPreset(preset, metadata) {
  if (!currentInstance || !preset?.attrs) return;
  for (const [name, value] of Object.entries(preset.attrs)) {
    // Boolean attrs in the schema get applied as toggles so that
    // checkbox controls re-render in the right state.
    const attrMeta = metadata.attributes.find((a) => a.name === name);
    if (attrMeta?.type === "boolean") {
      const checked = value !== null && value !== undefined && value !== false;
      hostApplyChange(name, checked ? "" : null, { boolean: true, checked });
    } else {
      hostApplyChange(name, value);
    }
  }
  // Re-render so control inputs reflect the applied preset.
  renderControls(metadata);
}

function logEvent(eventName, detail) {
  const timestamp = new Date().toLocaleTimeString();
  eventLog.unshift({ timestamp, name: eventName, detail: detail || {} });
  if (eventLog.length > MAX_EVENTS) eventLog.pop();
  updateEventLog();
}

function updateEventLog() {
  const list = document.getElementById("event-log-list");
  if (!list) return;
  list.innerHTML = "";
  eventLog.forEach((entry) => {
    const item = document.createElement("sherpa-list-item");
    item.dataset.label       = entry.name;
    item.dataset.description = entry.timestamp;
    item.dataset.icon        = "fa-solid fa-bolt";
    list.appendChild(item);
  });
}

// ═══════════════════════════════════════════════════════════
// UTILITIES
// ═══════════════════════════════════════════════════════════

function toCamelCase(str) {
  return str.replace(/(-[a-z])/g, (g) => g[1].toUpperCase());
}

// ═══════════════════════════════════════════════════════════
// BOOTSTRAP
// ═══════════════════════════════════════════════════════════

await loadComponentList();
populateSidebar();
initGlobalToolbar();

// Docs link button in the toolbar
document.getElementById("docs-link-btn")?.addEventListener("button-click", () => {
  window.location.href = "/docs/";
});

const savedComponent = sessionStorage.getItem("selectedComponent");
if (savedComponent && COMPONENTS.find((c) => c.tag === savedComponent)) {
  selectComponent(savedComponent);
}
