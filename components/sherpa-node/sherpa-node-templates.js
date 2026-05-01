/**
 * sherpa-node-templates.js
 *
 * Loads the shared sherpa-node-templates.html catalogue once and
 * provides helpers to attach matching <template class="rows-tpl">
 * blocks into a node's light DOM.
 *
 * Usage:
 *   import {
 *     attachAllTemplatesForKind,
 *     getSubtypesForKind,
 *   } from "sherpa-ui/components/sherpa-node/sherpa-node-templates.js";
 *
 *   await attachAllTemplatesForKind(nodeEl, "math");
 *   nodeEl.dataset.subtypes = JSON.stringify(getSubtypesForKind("math"));
 *   nodeEl.dataset.subtype = "add";
 */

const TEMPLATES_URL = new URL("./sherpa-node-templates.html", import.meta.url).href;

/** @type {Promise<Document> | null} */
let _docPromise = null;

/** Default human-friendly labels per subtype value, used when the template
 *  doesn't override. Consumers can pass their own labels into
 *  getSubtypesForKind(). */
const SUBTYPE_LABELS = {
  // variable
  number: "Number", decimal: "Decimal", text: "Text", property: "Property",
  // math
  add: "Add", subtract: "Subtract", multiply: "Multiply", divide: "Divide",
  ratio: "Ratio", floor: "Floor", ceiling: "Ceiling", average: "Average",
  round: "Round", increment: "Increment",
  // logic
  and: "And", or: "Or",
  gt: "Greater than", gte: "Greater than or equal",
  lt: "Less than", lte: "Less than or equal",
  eq: "Equals", neq: "Does not equal",
  // time
  between: "Between times", duration: "After duration", schedule: "Schedule",
  // collection
  asset: "Asset", user: "User", group: "Group", role: "Role", tag: "Tag",
  // util
  "listen-frequency": "Listen at frequency",
  "listen-status": "Listen for status",
  skill: "Skill",
  // misc
  default: "Default", trigger: "Trigger",
};

async function loadDoc() {
  if (!_docPromise) {
    _docPromise = fetch(TEMPLATES_URL)
      .then((r) => r.text())
      .then((html) => new DOMParser().parseFromString(html, "text/html"));
  }
  return _docPromise;
}

/**
 * Append every <template class="rows-tpl" data-kind={kind}> from the
 * catalogue into nodeEl as light-DOM children. Idempotent — duplicates
 * are skipped if already present.
 */
export async function attachAllTemplatesForKind(nodeEl, kind) {
  const doc = await loadDoc();
  const templates = doc.querySelectorAll(
    `template.rows-tpl[data-kind="${CSS.escape(kind)}"]`
  );
  for (const tpl of templates) {
    const subtype = tpl.dataset.subtype || "";
    const exists = nodeEl.querySelector(
      `:scope > template.rows-tpl[data-kind="${CSS.escape(kind)}"][data-subtype="${CSS.escape(subtype)}"]`
    );
    if (exists) continue;
    nodeEl.appendChild(document.importNode(tpl, true));
  }
}

/**
 * Returns [{value, label}] for every subtype defined for a given kind.
 * Order matches their order in sherpa-node-templates.html.
 */
export async function getSubtypesForKind(kind) {
  const doc = await loadDoc();
  const templates = doc.querySelectorAll(
    `template.rows-tpl[data-kind="${CSS.escape(kind)}"]`
  );
  const out = [];
  for (const tpl of templates) {
    const value = tpl.dataset.subtype || "";
    const label = SUBTYPE_LABELS[value] || value;
    out.push({ value, label });
  }
  return out;
}

/**
 * Convenience: attach templates AND set data-subtypes / data-subtype.
 * If subtype is omitted, the first subtype is selected.
 */
export async function configureNode(nodeEl, kind, subtype) {
  nodeEl.setAttribute("data-kind", kind);
  await attachAllTemplatesForKind(nodeEl, kind);
  const subtypes = await getSubtypesForKind(kind);
  nodeEl.dataset.subtypes = JSON.stringify(subtypes);
  nodeEl.dataset.subtype = subtype || subtypes[0]?.value || "";
}
