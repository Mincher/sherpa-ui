// HTML attrs that are valid on any element and shouldn't trigger "unknown" warnings
const STANDARD_ATTRS = new Set([
  "class", "id", "style", "hidden", "slot", "part", "role", "tabindex",
  "aria-label", "aria-hidden", "aria-expanded", "aria-controls",
  "aria-describedby", "aria-current", "aria-selected", "aria-live",
  "aria-required", "aria-invalid", "aria-multiselectable",
  "disabled", "readonly", "required", "name", "value", "placeholder", "type",
  "min", "max", "step", "pattern", "minlength", "maxlength", "novalidate",
  "open", "checked", "selected", "for", "href", "src", "alt", "title",
  "autofocus", "autocomplete", "multiple", "action", "method", "enctype",
]);

/**
 * Per-tag attribute audit. Checks each <sherpa-*> tag's attributes against
 * its schema: unknown names and (where schema has enumValues) bad enum values.
 */
export function auditTagAttributes(html, schemas) {
  const issues = [];
  const tagRe = /<(sherpa-[a-z0-9-]+)([^>]*?)\/?>/g;
  let m;
  while ((m = tagRe.exec(html))) {
    const tag = m[1];
    const schema = schemas.get(tag);
    if (!schema) continue;
    const attrStr = m[2] || "";
    const declaredAttrs = new Map((schema.attributes || []).map((a) => [a.name, a]));

    // Strip quoted values so words inside values aren't read as attr names
    const stripped = attrStr
      .replace(/=\s*"[^"]*"/g, "")
      .replace(/=\s*'[^']*'/g, "");

    for (const tok of stripped.split(/\s+/)) {
      const attr = tok.trim().toLowerCase();
      if (!attr || !/^[a-z][\w-]*$/.test(attr)) continue;
      if (STANDARD_ATTRS.has(attr) || attr.startsWith("aria-")) continue;
      if (!declaredAttrs.has(attr)) {
        issues.push({
          severity: "error",
          message: `<${tag}> uses unknown attribute "${attr}" — not in schema. Use query_component to see valid attributes.`,
        });
        continue;
      }

      // Enum value check: only when the attribute is declared with enumValues
      const attrDef = declaredAttrs.get(attr);
      const enumVals = attrDef.enumValues ?? attrDef.values;
      if (enumVals?.length) {
        const valRe = new RegExp(`\\b${attr}\\s*=\\s*["']([^"']*)["']`);
        const valMatch = attrStr.match(valRe);
        if (valMatch && !enumVals.includes(valMatch[1])) {
          issues.push({
            severity: "warning",
            message: `<${tag}> attribute "${attr}="${valMatch[1]}"` +
              ` — valid values: ${enumVals.join(", ")}`,
          });
        }
      }
    }
  }
  return issues;
}

/** Full HTML audit: unknown components, attribute errors, self-closing tags, and style anti-patterns. */
export function validateUsage(html, schemas) {
  const issues = [];

  // Unknown component tags
  for (const m of html.matchAll(/<(sherpa-[a-z][a-z0-9-]*)/g)) {
    if (!schemas.has(m[1])) {
      issues.push({ severity: "error", message: `Unknown component: <${m[1]}>` });
    }
  }

  issues.push(...auditTagAttributes(html, schemas));

  // Self-closing custom elements
  for (const m of html.matchAll(/<(sherpa-[a-z-]+)\s[^>]*\/>/g)) {
    issues.push({
      severity: "error",
      message: `<${m[1]}/> is self-closing — custom elements require explicit closing tags`,
    });
  }

  // Opacity-based disabled styling anti-pattern
  if (html.includes("opacity") && html.includes("disabled")) {
    issues.push({
      severity: "warning",
      message: "Avoid opacity for disabled state — use inactive tokens per property",
    });
  }

  return issues;
}
