import { z } from "zod/v3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ONTOLOGY_PATH = path.resolve(__dirname, "..", "..", "docs", "ontology", "tokens.json");

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/** Lazy-load + cache the ontology. */
let _ontology = null;
function ontology() {
  if (_ontology) return _ontology;
  _ontology = fs.existsSync(ONTOLOGY_PATH) ? JSON.parse(fs.readFileSync(ONTOLOGY_PATH, "utf8")) : {};
  return _ontology;
}

/**
 * Synonyms — words people reach for that are NOT the token's actual name. This
 * is the translation bridge: `heading` is not a token, `content/title` is.
 * Expands a query term to the real vocabulary before matching.
 */
const SYNONYMS = {
  heading: "title", header: "title", h1: "title", h2: "title",
  body: "primary", text: "content", ink: "content", copy: "primary",
  muted: "secondary", subtle: "tertiary", disabled: "inactive",
  bg: "surface", background: "surface", fill: "surface",
  stroke: "border", outline: "border", divider: "border",
  radius: "rounding", corner: "rounding",
  gap: "space", padding: "space", margin: "space",
};

function expand(term) {
  return SYNONYMS[term] ? [term, SYNONYMS[term]] : [term];
}

/** Match a user query against ontology ids (fuzzy: by name, ignoring collection; synonym-aware). */
function findEntries(query) {
  const o = ontology();
  const q = query.toLowerCase();
  const ids = Object.keys(o);
  // exact id, then name-suffix, then substring (each term synonym-expanded)
  const exact = ids.filter((id) => id.toLowerCase() === q);
  if (exact.length) return exact.map((id) => o[id]);
  const byName = ids.filter((id) => id.split("::")[1].toLowerCase() === q);
  if (byName.length) return byName.map((id) => o[id]);
  // direct substring first
  let hits = ids.filter((id) => id.toLowerCase().includes(q));
  if (hits.length) return hits.map((id) => o[id]);
  // else synonym-expand each segment and require ALL segments to match (AND, not OR)
  const segs = q.split(/[\s/]+/).filter(Boolean);
  hits = ids.filter((id) => {
    const name = id.toLowerCase();
    return segs.every((seg) => expand(seg).some((t) => name.includes(t)));
  });
  return hits.map((id) => o[id]);
}

function renderEntry(e) {
  const lines = [];
  lines.push(`# ${e.id}`);
  lines.push(`**${e.purpose}**`);
  lines.push("");
  lines.push(`- role: \`${e.role}\`  ·  tier: \`${e.tier}\`  ·  type: ${e.resolvedType}`);
  lines.push(`- scope: ${e.scope?.length ? e.scope.join(", ") : "open (ALL_SCOPES)"}`);
  lines.push(`- ✅ when to use: ${e.whenToUse}`);
  lines.push(`- ❌ when NOT: ${e.whenNOT}`);
  if (e.aliasedFrom && Object.keys(e.aliasedFrom).length) {
    const a = Object.entries(e.aliasedFrom).map(([m, v]) => `${m} → ${v}`).join("  ·  ");
    lines.push(`- aliased from: ${a}`);
  }
  if (e.consumedBy?.length) lines.push(`- consumed by: ${e.consumedBy.join(", ")}`);
  if (e.caveat) lines.push(`- ⚠️ CAVEAT: ${e.caveat}`);
  if (e.seeAlso?.length) lines.push(`- see also: ${e.seeAlso.join(", ")}`);
  if (e.needsReview) lines.push(`- ⚠️ needs human review (opaque name, no direct consumer)`);
  return lines.join("\n");
}

export function register(server) {
  // ── explain_token — "what is X for, and when not?" ─────────────────
  server.registerTool(
    "explain_token",
    {
      title: "Explain a Design Token",
      description:
        "Explain what a design-system variable/token is FOR — its purpose, when to use it, when NOT to, what it aliases, and its siblings. The 'understanding' layer: ask by token name (e.g. 'content/heading', 'status-surface/default', 'control-border/accent').",
      inputSchema: {
        token: z.string().describe("A token/variable name or fragment (e.g. 'content/heading', 'status-surface')"),
      },
    },
    async ({ token }) => {
      try {
        const matches = findEntries(token);
        if (!matches.length) {
          return ok(`No ontology entry matching "${token}". Try a fragment like "surface", "border", "content", "status", "space".`);
        }
        if (matches.length > 8) {
          return ok(
            `${matches.length} tokens match "${token}". Narrow it. First 8:\n` +
              matches.slice(0, 8).map((e) => `  ${e.id} — ${e.role}`).join("\n")
          );
        }
        return ok(matches.map(renderEntry).join("\n\n---\n\n"));
      } catch (e) {
        return err(`explain_token: ${e.message}`);
      }
    }
  );

  // ── browse_ontology — by role / tier ───────────────────────────────
  server.registerTool(
    "browse_ontology",
    {
      title: "Browse the Design-System Ontology",
      description:
        "List tokens by role (surface | border | content | space | radius | size | effect | palette | chart) and/or tier (core | style | component | override). Use to discover what fills / borders / text-inks exist before binding.",
      inputSchema: {
        role: z.string().optional().describe("Filter by role: surface, border, content, space, radius, size, effect, palette, chart"),
        tier: z.string().optional().describe("Filter by tier: core, style, component, override"),
      },
    },
    async ({ role, tier }) => {
      try {
        const o = ontology();
        let entries = Object.values(o);
        if (role) entries = entries.filter((e) => e.role === role.toLowerCase());
        if (tier) entries = entries.filter((e) => e.tier === tier.toLowerCase());
        if (!entries.length) return ok(`No tokens with role=${role ?? "*"} tier=${tier ?? "*"}.`);
        // group by role for readability
        const byRole = {};
        for (const e of entries) (byRole[e.role] ??= []).push(e.id);
        let out = `${entries.length} token(s)` + (role ? ` role=${role}` : "") + (tier ? ` tier=${tier}` : "") + `:\n\n`;
        for (const [r, ids] of Object.entries(byRole)) {
          out += `## ${r} (${ids.length})\n` + ids.slice(0, 40).map((id) => `  ${id}`).join("\n") + (ids.length > 40 ? `\n  …${ids.length - 40} more` : "") + "\n\n";
        }
        return ok(out);
      } catch (e) {
        return err(`browse_ontology: ${e.message}`);
      }
    }
  );
}
