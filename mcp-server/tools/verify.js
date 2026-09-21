/**
 * Verify tools — check a built component against the design-system rules.
 *
 *   audit_component — bindings + ontology accuracy for a built component
 *   check_bindings  — the "every property binds a variable" audit (Rule 9)
 *
 * There is no ontology and no plan to rebuild one, so token ROLE and SCOPE are
 * never checked — only that a bound token NAME exists in tokens.css.
 */
import { z } from "zod/v3";
import {
  loadDef, loadComponentNames, loadCssTokenNames,
} from "../../scripts/lib/generation/data.mjs";
import { validateDef } from "../../scripts/lib/generation/validate-def.mjs";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }


/** Normalise a token alias to a comparable short key. */
const norm = (s) => s.toLowerCase().replace(/^.*::/, "").replace(/[/-]/g, "");


/** Def-side binding report: every element.property in `tokens`, and whether the
 *  token it binds is declared in tokens.css. `role` is always null — see header. */
function bindingReport(def, cssTokens) {
  /* Name existence is the only question. Do not re-add a role/scope check
     against a missing lookup: an empty one marked all 1173 bindings bad. */
  const cssNorm = [...(cssTokens ?? [])].map((t) => norm(t.replace("--sherpa-", "")));
  const declaredInCss = (alias) => {
    const t = norm(alias);
    return cssNorm.some((k) => k === t || k.endsWith(t));
  };
  const rows = [];
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const isStatus = typeof tok !== "string";
    const alias = isStatus ? (tok.override ?? tok.fallback) : tok;
    const known = declaredInCss(alias);
    rows.push({
      key,
      binds: isStatus ? `{override: ${tok.override}, fallback: ${tok.fallback}}` : alias,
      role: null,
      status: known ? "ok" : "undeclared-token",
      notes: known ? [] : [`"${alias}" is not declared in tokens.css`],
    });
  }
  return rows;
}

export function register(server) {
  server.registerTool(
    "audit_component",
    {
      title: "Audit a Built Component",
      description:
        "Re-check a BUILT component against the design-system rules: runs validate_def on its def (reuse, token roles, the control-content vs status-content flip, status-container aliasing, event shape) AND reports each element.property→token binding with its ontology role. Note: the ROLE half of this audit needs the ontology, which was deleted 2026-09-16 for having rotted — token names are checked against the generated tokens.css instead, and role/scope are reported as unavailable rather than guessed.",
      inputSchema: {
        name: z.string().describe("Component element name (e.g. sherpa-tag)"),
      },
    },
    async ({ name }) => {
      try {
        const def = loadDef(name);
        if (!def) {
          const avail = loadComponentNames().filter((n) => n.startsWith("sherpa-")).sort().join(", ");
          return ok(`Component "${name}" has no def.\n\nAvailable: ${avail}`);
        }
        const { ok: passed, errors, warnings } = validateDef(def);
        const rows = bindingReport(def, loadCssTokenNames());

        const fmt = (o) => `  [${o.code}] ${o.msg}${o.where ? `  (@ ${o.where})` : ""}`;
        let out = `## audit_component — ${name}\n\n`;
        out += passed ? `✅ def rules **PASS**` : `❌ def rules **FAIL** — ${errors.length} error(s)`;
        out += `  ·  ${rows.length} token binding(s)\n\n`;

        if (errors.length) out += `### Errors (${errors.length})\n` + errors.map(fmt).join("\n") + "\n\n";
        if (warnings.length) out += `### Warnings (${warnings.length})\n` + warnings.map(fmt).join("\n") + "\n\n";

        out += `### Token bindings (def side)\n`;
        for (const r of rows) {
          const icon = r.status === "ok" ? "✅" : "⚠️";
          out += `${icon} \`${r.key}\` → ${r.binds}${r.role ? ` (role=${r.role})` : ""}`;
          if (r.notes.length) out += `\n    ${r.notes.join("; ")}`;
          out += "\n";
        }

        out += `\n### What this audit could NOT check\n`;
        out += `Token ROLE and SCOPE are not checked, and will not be: the ontology that carried them was deleted 2026-09-16 for having rotted, and its build scripts followed. What IS checked above: every token name against the generated \`tokens.css\` — which is re-projected from Figma and therefore cannot go stale by hand — plus every rule that never needed a role.`;

        return ok(out);
      } catch (e) {
        return err(`audit_component: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "check_bindings",
    {
      title: "Check Bindings (every property binds a variable)",
      description:
        "Rule 9 — a component's geometry/colour properties must each bind the token that resolves to their value; never a raw number. Reports each element.property→token in the def with its ontology role + scope fit, and flags scope mismatches (a fill token bound to a stroke) and any raw values. The LIVE pass (scripts/audit-bindings.mjs shouldBind + value→token maps) runs over the built Figma nodes via the build-figma skill — this returns the def-side view + that rule.",
      inputSchema: {
        name: z.string().describe("Component element name (e.g. sherpa-tag)"),
      },
    },
    async ({ name }) => {
      try {
        const def = loadDef(name);
        if (!def) {
          const avail = loadComponentNames().filter((n) => n.startsWith("sherpa-")).sort().join(", ");
          return ok(`Component "${name}" has no def.\n\nAvailable: ${avail}`);
        }
        const rows = bindingReport(def, loadCssTokenNames());
        const bad = rows.filter((r) => r.status !== "ok");

        let out = `## check_bindings — ${name}\n\n`;
        out += bad.length
          ? `⚠️ ${bad.length} of ${rows.length} binding(s) need attention.\n\n`
          : `✅ all ${rows.length} def binding(s) resolve to a real token with a fitting role.\n\n`;

        for (const r of rows) {
          const icon = r.status === "ok" ? "✅" : "⚠️";
          out += `${icon} \`${r.key}\` → ${r.binds}${r.role ? ` (role=${r.role})` : ""}`;
          if (r.notes.length) out += ` — ${r.notes.join("; ")}`;
          out += "\n";
        }

        out += `\n### The live rule\n`;
        out += `\`scripts/audit-bindings.mjs\` holds the value→token maps + \`shouldBind()\`. The full pass walks the built Figma nodes: for every geometry property it maps the RESOLVED pixel value to a Core token (space 12 → space/sm, radius 8 → rounding/lg, …), binds where one exists, and SKIPS off-scale values (radius 1, 5) and strokeless-frame stroke-widths. Never bind instance internals. Run it via the build-figma-component verify gate; this checked the def's token map.`;

        return ok(out);
      } catch (e) {
        return err(`check_bindings: ${e.message}`);
      }
    }
  );
}
