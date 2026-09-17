/**
 * Verify tools — check a built component against the design-system rules.
 *
 *   audit_component — bindings + ontology accuracy for a built component
 *   check_bindings  — the "every property binds a variable" audit (Rule 9)
 *
 * A FULL audit would read the LIVE Figma bindings (via the bridge) and check
 * each one's role against the ontology. THAT IS NOT AVAILABLE: `docs/ontology/`
 * was deleted 2026-09-16 for having rotted, so `scripts/audit-ontology.mjs`
 * exits 2 with instructions rather than running. These tools do the def-side
 * check — token NAMES against the generated tokens.css, plus the rules that
 * need no ontology — and say plainly what they cannot answer.
 */
import { z } from "zod/v3";
import {
  loadDef, loadComponentNames, loadOntology, loadCssTokenNames,
} from "../../scripts/lib/generation/data.mjs";
import { validateDef } from "../../scripts/lib/generation/validate-def.mjs";
import { scopeAllows } from "../../scripts/lib/generation/resolve.mjs";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/** Property (last segment of an element.property token key) → the role it implies. */
const PROP_ROLE = {
  background: "surface", surface: "surface", fill: "surface",
  borderColor: "border", border: "border",
  color: "content",
  borderRadius: "radius", borderWidth: "border",
  gap: "space", padding: "space", paddingBlock: "space", paddingInline: "space",
  fontSize: "type", fontWeight: "type", size: "size",
};

/** Property → the Figma scope-check bucket for scopeAllows(). */
const PROP_SCOPE_KIND = {
  background: "fill", surface: "fill", fill: "fill",
  borderColor: "stroke", border: "stroke",
  color: "text",
  borderRadius: "cornerRadius", borderWidth: "strokeWeight",
  gap: "gap", padding: "padding", paddingBlock: "padding", paddingInline: "padding",
  size: "size",
};

/** Normalise an ontology id / a def token alias to a comparable short key. */
const norm = (s) => s.toLowerCase().replace(/^.*::/, "").replace(/[/-]/g, "");

/** Find the ontology id whose normalised name matches a def token alias. */
function findOntId(ontology, alias) {
  const target = norm(alias);
  return Object.keys(ontology).find((id) => norm(id).endsWith(target) || norm(id) === target) ?? null;
}

/**
 * Def-side binding report: every element.property in the def's `tokens` block,
 * with the token it binds, the ontology role, and whether that role fits the
 * property (Rule 9 — every geometry/colour property binds a resolving token).
 */
function bindingReport(def, ontology, cssTokens) {
  const rows = [];
  /* The ontology answers ROLE and SCOPE. It cannot answer "does this token
     exist" any more — `docs/ontology/tokens` was deleted 2026-09-16 and
     `loadOntology()` returns `{}`, which made this report mark ALL 1173 bindings
     across all 58 components `unknown-token`. A report that condemns everything
     says nothing. With no ontology, the existence question goes to `tokens.css`
     (generated from Figma, so it cannot rot by hand) and role/scope are reported
     as unknown — a missing answer, not a wrong one. */
  const haveOntology = Object.keys(ontology).length > 0;
  const cssNorm = [...(cssTokens ?? [])].map((t) => norm(t.replace("--sherpa-", "")));
  const declaredInCss = (alias) => {
    const t = norm(alias);
    return cssNorm.some((k) => k === t || k.endsWith(t));
  };
  for (const [key, tok] of Object.entries(def.tokens ?? {})) {
    const prop = key.split(".").pop();
    const expectRole = PROP_ROLE[prop];
    const alias = typeof tok === "string" ? tok : (tok.override ?? tok.fallback);
    const isStatus = typeof tok !== "string";
    const ontId = findOntId(ontology, isStatus ? (tok.fallback ?? tok.override) : alias);
    const role = ontId ? ontology[ontId].role : null;
    const scopes = ontId ? (ontology[ontId].scope ?? []) : null;

    let status = "ok";
    const notes = [];
    if (!ontId && haveOntology) { status = "unknown-token"; notes.push(`"${alias}" not in ontology`); }
    else if (!ontId) {
      // No ontology at all. Answer what CAN be answered — does the name exist —
      // and say plainly that role and scope are unavailable.
      if (declaredInCss(alias)) { status = "ok"; notes.push("role/scope unknown — no ontology loaded"); }
      else { status = "undeclared-token"; notes.push(`"${alias}" is not declared in tokens.css`); }
    }
    else {
      if (expectRole && role && role !== expectRole
        && !(expectRole === "surface" && role === "palette")
        && !(expectRole === "space" && role === "size")) {
        status = "role-mismatch";
        notes.push(`role=${role} but property implies ${expectRole}`);
      }
      const scopeKind = PROP_SCOPE_KIND[prop];
      if (scopeKind && scopes) {
        const chk = scopeAllows(scopeKind, scopes);
        if (!chk.ok) { status = "scope-mismatch"; notes.push(chk.error); }
      }
      // Rule 4 — a control label must not bind status-content directly.
      if (prop === "color" && typeof tok !== "string" && /status-content/.test(tok.override ?? "")) {
        status = "button-content-bug";
        notes.push("control label binds status-content — light-on-light bug (Rule 4)");
      }
    }
    rows.push({ key, binds: isStatus ? `{override: ${tok.override}, fallback: ${tok.fallback}}` : alias, role, status, notes });
  }
  return rows;
}

export function register(server) {
  // ── audit_component — bindings + ontology accuracy for a built comp ──
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
        const ontology = loadOntology();
        const { ok: passed, errors, warnings } = validateDef(def);
        const rows = bindingReport(def, ontology, loadCssTokenNames());

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
        out += `The ROLE half of this audit is unavailable: it needs \`docs/ontology/\`, deleted 2026-09-16 for having rotted, and rebuilding it needs a fresh Figma variable export (the committed graph is from 2026-08-14). \`scripts/audit-ontology.mjs\` exits with those instructions rather than running. What IS checked above: every token name against the generated \`tokens.css\`, plus every rule that needs no ontology.`;

        return ok(out);
      } catch (e) {
        return err(`audit_component: ${e.message}`);
      }
    }
  );

  // ── check_bindings — "every property binds a variable" (Rule 9) ─────
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
        const ontology = loadOntology();
        const rows = bindingReport(def, ontology, loadCssTokenNames());
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
