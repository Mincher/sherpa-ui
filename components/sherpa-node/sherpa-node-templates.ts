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
 *   nodeEl.dataset["subtypes"] = JSON.stringify(getSubtypesForKind("math"));
 *   nodeEl.dataset["subtype"] = "add";
 */

const TEMPLATES_URL = new URL("./sherpa-node-templates.html", import.meta.url).href;

/** A subtype option in the picker. */
interface SubtypeOption {
  value: string;
  label: string;
  disabled?: boolean;
}

let _docPromise: Promise<Document> | null = null;

/** Default human-friendly labels per subtype value, used when the template
 *  doesn't override. Consumers can pass their own labels into
 *  getSubtypesForKind(). */
const SUBTYPE_LABELS: Record<string, string> = {
  // variable
  number: "Number", decimal: "Decimal", text: "Text", property: "Property",
  // math
  add: "Add", subtract: "Subtract", multiply: "Multiply", divide: "Divide",
  ratio: "Ratio", min: "Min", max: "Max", avg: "Average", sum: "Sum",
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
  concatenate: "Concatenate",
  // source
  "unified-agent": "Unified agent",
  api: "API",
  model: "Model",
  custom: "Custom",
  // output
  outcome: "Outcome",
  // delegate / chat (single-subtype standalone kinds)
  delegate: "Delegate", chat: "Chat",
  // action
  ticket: "Ticket", notify: "Notify",
  // misc
  default: "Default", trigger: "Trigger",
};

/** Per-kind label for the subtype picker itself ("Type" by default).
 *  Logic nodes call it "Operation" to match common UX conventions. */
const KIND_SUBTYPE_LABELS: Record<string, string> = {
  logic: "Operation",
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
export async function attachAllTemplatesForKind(nodeEl: HTMLElement, kind: string) {
  const doc = await loadDoc();
  const templates = doc.querySelectorAll<HTMLTemplateElement>(
    `template.rows-tpl[data-kind="${CSS.escape(kind)}"]`
  );
  for (const tpl of templates) {
    const subtype = tpl.dataset["subtype"] || "";
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
export async function getSubtypesForKind(kind: string): Promise<SubtypeOption[]> {
  const doc = await loadDoc();
  const templates = doc.querySelectorAll<HTMLTemplateElement>(
    `template.rows-tpl[data-kind="${CSS.escape(kind)}"]`
  );
  const out: SubtypeOption[] = [];
  for (const tpl of templates) {
    const value = tpl.dataset["subtype"] || "";
    const label = SUBTYPE_LABELS[value] || value;
    out.push({ value, label });
  }
  return out;
}

/**
 * Returns a grouped subtype list suitable for the picker. The catalogue's
 * built-in subtypes are returned under a "Preset" group; the optional
 * `customOptions` argument is appended as a "Custom" group when supplied.
 *
 * Consumers may use this to seed the picker, then later overwrite
 * `data-subtypes` on the node with their own grouped JSON to inject
 * saved-group entries (see components/sherpa-node/README.md).
 *
 * @param {string} kind
 * @param {Array<{value:string,label:string,disabled?:boolean}>} [customOptions]
 * @returns {Promise<Array<{label:string, options:Array}>>}
 */
export async function getGroupedSubtypesForKind(kind: string, customOptions: SubtypeOption[] = []) {
  const presets = await getSubtypesForKind(kind);
  const groups = [{ label: "Preset", options: presets }];
  if (customOptions && customOptions.length) {
    groups.push({ label: "Custom", options: customOptions });
  }
  return groups;
}

/**
 * Convenience: attach templates AND set data-subtypes / data-subtype.
 * If subtype is omitted, the first subtype is selected.
 */
export async function configureNode(nodeEl: HTMLElement, kind: string, subtype?: string) {
  nodeEl.setAttribute("data-kind", kind);
  await attachAllTemplatesForKind(nodeEl, kind);
  const subtypes = await getSubtypesForKind(kind);
  nodeEl.dataset["subtypes"] = JSON.stringify(subtypes);
  nodeEl.dataset["subtype"] = subtype || subtypes[0]?.value || "";
  const subtypeLabel = KIND_SUBTYPE_LABELS[kind];
  if (subtypeLabel) nodeEl.dataset["subtypeLabel"] = subtypeLabel;
  else delete nodeEl.dataset["subtypeLabel"];
}
