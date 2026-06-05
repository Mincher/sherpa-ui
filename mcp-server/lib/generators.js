import { iconToEntity } from "./icons.js";

const ICON_ATTRS = new Set(["data-icon-start", "data-icon-end", "data-icon"]);

/** Generate valid HTML for a component from its schema + caller-supplied attrs/slots. */
export function generateComponentHTML(schema, attrs = {}, slotContent = {}) {
  const parts = [`<${schema.tagName}`];

  for (const [name, value] of Object.entries(attrs)) {
    const attrDef = schema.attributes?.find((a) => a.name === name);
    if (!attrDef) continue; // skip unknown attrs

    if (attrDef.type === "boolean") {
      if (value === true || value === "true") parts.push(` ${name}`);
    } else {
      let resolved = String(value);
      if (ICON_ATTRS.has(name)) resolved = iconToEntity(resolved);
      // Sanitise: preserve &#x...; entities for icons, escape everything else
      const safe = resolved
        .replace(/&(?!#x[0-9a-fA-F]+;)/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;");
      parts.push(` ${name}="${safe}"`);
    }
  }

  parts.push(">");

  if (Object.keys(slotContent).length) {
    for (const [slotName, content] of Object.entries(slotContent)) {
      if (slotName === "" || slotName === "default") {
        parts.push(`\n  ${content}`);
      } else {
        parts.push(`\n  <span slot="${slotName}">${content}</span>`);
      }
    }
    parts.push("\n");
  }

  parts.push(`</${schema.tagName}>`);
  return parts.join("");
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

/** Generate HTML + JS for add/edit/delete CRUD flows. */
export function generateFlowHTML(flowType, entityName, fields) {
  const entityLabel = cap(entityName);
  const indent = "    ";
  const slug = entityName.replace(/\s+/g, "-").toLowerCase();

  if (flowType === "add" || flowType === "edit") {
    const isEdit = flowType === "edit";
    const dialogTitle = isEdit ? `Edit ${entityLabel}` : `Add ${entityLabel}`;
    const triggerLabel = isEdit ? "Edit" : "Add";
    const triggerIcon = isEdit ? iconToEntity("pen-to-square") : iconToEntity("plus");
    const triggerVariant = isEdit ? "secondary" : "primary";
    const triggerId = isEdit ? `edit-${slug}-btn` : `add-${slug}-btn`;

    let fieldHTML = "";
    const fieldDefs = fields?.length
      ? fields
      : [{ name: "name", label: "Name", required: true }];

    for (const f of fieldDefs) {
      const tag = f.type === "select" ? "sherpa-input-select" : "sherpa-input-text";
      const req = f.required ? " required" : "";
      fieldHTML += `${indent}<${tag} data-label="${f.label || cap(f.name)}" name="${f.name}"${req}></${tag}>\n`;
    }

    const prePopNote = isEdit
      ? `\n${indent}<!-- FormManager.populate(record) fills fields before dialog opens -->`
      : "";

    const requiredFields = (fieldDefs).filter((f) => f.required).map((f) => `'${f.name}'`);
    const requiredCheck = requiredFields.length
      ? `\n    const missing = form.validate();\n    if (missing.length) throw new Error('Please fill in all required fields.');`
      : "";

    const editHooks = isEdit
      ? `\n\n// Wire edit trigger (typically from a grid row-action event)
// grid.addEventListener('row-action', (e) => {
//   const record = e.detail?.rowData;
//   if (!record) return;
//   form.populate(record);
//   flow.startEdit(record);
// });`
      : "";

    return `<!-- ${cap(flowType)} ${entityLabel} flow -->

<!-- Trigger -->
<sherpa-button
  id="${triggerId}"
  data-label="${triggerLabel}"
  data-variant="${triggerVariant}"
  data-icon-start="${triggerIcon}">
</sherpa-button>

<!-- Dialog -->
<sherpa-dialog id="${slug}-dialog" data-label="${dialogTitle}" data-size="medium" data-dismissible>
${prePopNote}
${fieldHTML.trimEnd()}

  <sherpa-button slot="footer" data-label="Cancel" data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Save" data-variant="primary"></sherpa-button>
</sherpa-dialog>

<script type="module">
import { FlowManager } from 'sherpa-ui/components/app-utils/flow-manager.js';
import { FormManager } from 'sherpa-ui/components/app-utils/form-manager.js';
// import { loadDataset } from '/scripts/services/DataService.js';

const contentArea = document.querySelector('[data-dataset="TODO_DATASET"]');
const dialog      = document.getElementById('${slug}-dialog');
const form        = new FormManager(dialog);

const flow = new FlowManager({
  entity: '${entityName}',
  contentArea,
  dialogs: { addEdit: dialog },
  async onSave(editingRecord, flowType) {
    const values = form.read();${requiredCheck}
    // TODO: Call your API or mutate dataset here
    return values;
  },
  onRefresh: () => {
    // TODO: reload contentArea data, e.g. loadDataset('TODO_DATASET')
  },
});

document.getElementById('${triggerId}')?.addEventListener('button-click', () => {
  form.clear();
  flow.startAdd();
});${editHooks}
</script>`;
  }

  if (flowType === "delete") {
    return `<!-- Delete ${entityLabel} flow -->

<!-- Trigger -->
<sherpa-button
  id="delete-${slug}-btn"
  data-label="Delete"
  data-variant="secondary"
  data-status="critical"
  data-icon-start="${iconToEntity("trash-can")}">
</sherpa-button>

<!-- Confirmation dialog -->
<sherpa-dialog id="delete-${slug}-dialog" data-label="Delete ${entityLabel}" data-size="small" data-dismissible>
  <sherpa-callout data-status="warning" data-heading="This action cannot be undone">
    Are you sure you want to delete this ${entityName}? This will permanently remove it and all associated data.
  </sherpa-callout>

  <sherpa-button slot="footer" data-label="Cancel" data-variant="secondary"></sherpa-button>
  <sherpa-button slot="footer" data-label="Delete" data-variant="primary" data-status="critical"></sherpa-button>
</sherpa-dialog>

<script type="module">
import { FlowManager } from 'sherpa-ui/components/app-utils/flow-manager.js';
// import { loadDataset } from '/scripts/services/DataService.js';

const contentArea = document.querySelector('[data-dataset="TODO_DATASET"]');

const flow = new FlowManager({
  entity: '${entityName}',
  contentArea,
  dialogs: { delete: document.getElementById('delete-${slug}-dialog') },
  async onDelete(ids) {
    // TODO: Call your API or mutate dataset here
    return ids.length;
  },
  onRefresh: () => {
    // TODO: reload contentArea data
  },
});

// Wire delete trigger (typically from selection)
// document.getElementById('delete-${slug}-btn')?.addEventListener('button-click', () => {
//   const selected = grid.getSelectedRows?.() ?? [];
//   if (!selected.length) return;
//   flow.startDelete(selected);
// });
</script>`;
  }

  return `Unknown flow type: "${flowType}". Use "add", "edit", or "delete".`;
}

/** Recursively render a pattern component tree (for v2.0 JSON-driven patterns). */
export function generatePatternComponent(component, data) {
  const attrs = component.attributes || {};
  let attrStr = "";
  for (const [key, value] of Object.entries(attrs)) {
    if (typeof value === "boolean") {
      if (value) attrStr += ` ${key}`;
    } else {
      const interpolated = String(value)
        .replace(/\{\{entityType\}\}/g, data.entityType || "Entity")
        .replace(/\{\{entityName\}\}/g, data.entityName || "entity");
      // Sanitise for attribute context
      const safe = interpolated.replace(/"/g, "&quot;").replace(/</g, "&lt;");
      attrStr += ` ${key}="${safe}"`;
    }
  }

  const idAttr = component.id ? ` id="${component.id}"` : "";
  const tag = component.type;

  if (!component.children?.length) {
    return `<${tag}${idAttr}${attrStr}></${tag}>`;
  }

  const children = component.children
    .map((c) => "  " + generatePatternComponent(c, data))
    .join("\n");
  return `<${tag}${idAttr}${attrStr}>\n${children}\n</${tag}>`;
}
