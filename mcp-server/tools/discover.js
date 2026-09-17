/**
 * Discover tools — understand the def-driven design system.
 *
 * Thin wrappers over scripts/lib/generation/*. One implementation, two surfaces
 * (the MCP + the generate-sherpa-component skill both call the shared lib).
 *
 *   list_components   — every component + its def summary
 *   explain_token     — purpose/role/whenNOT/caveat (ontology + synonym bridge)
 *   browse_ontology   — tokens by role / tier
 *   get_component     — the full def + code + Figma binding shape
 */
import { z } from "zod/v3";
import {
  loadOntology, loadComponentNames, loadDef, loadNameMap, loadCssTokenNames,
} from "../../scripts/lib/generation/data.mjs";
import { compileDef } from "../../scripts/lib/generation/compile-def.mjs";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/**
 * Token NAMES from the generated `tokens.css` that contain `query`.
 *
 * The fallback for every ontology answer. `tokens.css` is re-projected from
 * Figma, so it always knows which names are real — it simply knows nothing about
 * what they are FOR. That is a smaller answer than the ontology gave, and an
 * honest one; the ontology's failure mode was a confident wrong answer.
 *
 * An empty query returns every name.
 */
function matchingCssTokens(query) {
  const q = String(query ?? "").toLowerCase().replace(/[\/-]/g, "");
  const all = [...loadCssTokenNames()].sort();
  if (!q) return all;
  return all.filter((t) => t.toLowerCase().replace(/[\/-]/g, "").includes(q));
}

// ── ontology helpers (ported from the old ontology.js — synonym bridge + caveat) ──

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
function findEntries(ontology, query) {
  const q = query.toLowerCase();
  const ids = Object.keys(ontology);
  // exact id, then name-suffix, then substring (each term synonym-expanded)
  const exact = ids.filter((id) => id.toLowerCase() === q);
  if (exact.length) return exact.map((id) => ontology[id]);
  const byName = ids.filter((id) => (id.split("::")[1] ?? "").toLowerCase() === q);
  if (byName.length) return byName.map((id) => ontology[id]);
  // direct substring first
  let hits = ids.filter((id) => id.toLowerCase().includes(q));
  if (hits.length) return hits.map((id) => ontology[id]);
  // else synonym-expand each segment and require ALL segments to match (AND, not OR)
  const segs = q.split(/[\s/]+/).filter(Boolean);
  hits = ids.filter((id) => {
    const name = id.toLowerCase();
    return segs.every((seg) => expand(seg).some((t) => name.includes(t)));
  });
  return hits.map((id) => ontology[id]);
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

// ── component summary from a def ──────────────────────────────────────

function defSummary(def) {
  if (!def) return null;
  return {
    name: def.name,
    figmaName: def.figmaName ?? null,
    category: def.category ?? null,
    description: def.description ?? "",
    props: (def.props ?? []).length,
    events: (def.events ?? []).map((e) => e.name),
    nested: (def.nested ?? []).map((n) => n.component),
    built: def.figma?.built ?? false,
  };
}

export function register(server) {
  // ── list_components — every component + its def summary ─────────────
  server.registerTool(
    "list_components",
    {
      title: "List Components",
      description:
        "List every Sherpa-UI component with its def summary — category, description, prop/event counts, and nested children. The starting point: pick a component, then call get_component for the full def + code + Figma shape.",
      inputSchema: {
        category: z.string().optional().describe("Filter by category: control | container | content | data | nav | chart"),
      },
    },
    async ({ category }) => {
      try {
        const names = loadComponentNames().filter((n) => n.startsWith("sherpa-")).sort();
        const rows = [];
        for (const name of names) {
          const s = defSummary(loadDef(name));
          if (!s) continue;
          if (category && s.category !== category.toLowerCase()) continue;
          rows.push(s);
        }
        if (!rows.length) return ok(`No components${category ? ` in category "${category}"` : ""}.`);
        // group by category for readability
        const byCat = {};
        for (const r of rows) (byCat[r.category ?? "uncategorised"] ??= []).push(r);
        let out = `${rows.length} component(s)${category ? ` · category=${category}` : ""}:\n\n`;
        for (const [cat, items] of Object.entries(byCat)) {
          out += `## ${cat} (${items.length})\n`;
          for (const r of items) {
            const bits = [`${r.props} props`];
            if (r.events.length) bits.push(`${r.events.length} events`);
            if (r.nested.length) bits.push(`nests ${r.nested.join(", ")}`);
            out += `- **${r.name}**${r.figmaName ? ` (Figma: ${r.figmaName})` : ""} — ${r.description}\n`;
            out += `  _${bits.join(" · ")}_\n`;
          }
          out += "\n";
        }
        return ok(out.trimEnd());
      } catch (e) {
        return err(`list_components: ${e.message}`);
      }
    }
  );

  // ── explain_token — "what is X for, and when not?" ─────────────────
  server.registerTool(
    "explain_token",
    {
      title: "Explain a Design Token",
      description:
        "Explain what a design-system variable/token is FOR — its purpose, when to use it, when NOT to, what it aliases, and its siblings. The 'understanding' layer: ask by token name (e.g. 'content/heading', 'status-surface/default', 'control-border/accent'). Synonym-aware ('heading' → title, 'bg' → surface).",
      inputSchema: {
        token: z.string().describe("A token/variable name or fragment (e.g. 'content/heading', 'status-surface')"),
      },
    },
    async ({ token }) => {
      try {
        const o = loadOntology();
        const matches = findEntries(o, token);
        if (!matches.length) {
          /* An EMPTY ontology is not the same as an unmatched token.
             `docs/ontology/tokens` was deleted 2026-09-16 (it described removed
             collections), so this returned "no entry matching X — try a
             fragment like surface" to someone who had just typed `surface`.
             That reads as "your token is wrong" when the truth is "I have no
             list". Answer what tokens.css CAN answer — the name — and say
             plainly what is missing. */
          if (!Object.keys(o).length) {
            const hits = matchingCssTokens(token);
            const head = `No ontology is loaded — \`docs/ontology/tokens\` was deleted 2026-09-16, so PURPOSE, ROLE and CAVEAT are unavailable for every token.`;
            return ok(hits.length
              ? `${head}\n\nFrom the generated \`tokens.css\`, ${hits.length} token(s) match "${token}":\n` +
                hits.slice(0, 40).map((t) => `  ${t}`).join("\n") +
                (hits.length > 40 ? `\n  …${hits.length - 40} more` : "") +
                `\n\nThe NAME is real; what it is for is not recorded anywhere right now.`
              : `${head}\n\nNo token in \`tokens.css\` matches "${token}" either, so the name itself is likely wrong.`);
          }
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
        "List tokens by role (surface | border | content | space | radius | size | effect | palette | chart | type) and/or tier (core | style | component | override). Use to discover what fills / borders / text-inks exist before binding.",
      inputSchema: {
        role: z.string().optional().describe("Filter by role: surface, border, content, space, radius, size, effect, palette, chart, type"),
        tier: z.string().optional().describe("Filter by tier: core, style, component, override, reference, semantic"),
      },
    },
    async ({ role, tier }) => {
      try {
        const o = loadOntology();
        let entries = Object.values(o);
        if (role) entries = entries.filter((e) => e.role === role.toLowerCase());
        if (tier) entries = entries.filter((e) => e.tier === tier.toLowerCase());
        if (!entries.length) {
          // Same distinction as explain_token: no ontology ≠ no tokens.
          if (!Object.keys(o).length) {
            const all = matchingCssTokens("");
            return ok(
              `No ontology is loaded — \`docs/ontology/tokens\` was deleted 2026-09-16, so tokens cannot be filtered by role or tier.\n\n` +
              `The generated \`tokens.css\` declares ${all.length} token name(s); use \`token_for\` or read \`src/styles/tokens/tokens.css\` directly.`,
            );
          }
          return ok(`No tokens with role=${role ?? "*"} tier=${tier ?? "*"}.`);
        }
        // group by role for readability
        const byRole = {};
        for (const e of entries) (byRole[e.role] ??= []).push(e.id);
        let out = `${entries.length} token(s)` + (role ? ` role=${role}` : "") + (tier ? ` tier=${tier}` : "") + `:\n\n`;
        for (const [r, ids] of Object.entries(byRole)) {
          out += `## ${r} (${ids.length})\n` + ids.slice(0, 40).map((id) => `  ${id}`).join("\n") + (ids.length > 40 ? `\n  …${ids.length - 40} more` : "") + "\n\n";
        }
        return ok(out.trimEnd());
      } catch (e) {
        return err(`browse_ontology: ${e.message}`);
      }
    }
  );

  // ── get_component — full def + code + Figma binding shape ───────────
  server.registerTool(
    "get_component",
    {
      title: "Get a Component (def + code + Figma shape)",
      description:
        "The full picture for one component: its component.yaml spec (structure, props, tokens, events), the compiled TS/HTML/CSS (from compile_def, when the def carries an anatomy block), and its Figma binding shape (variant axes, bool/text/instance props, mode pins). Use before authoring a variant, reusing it as a nested child, or building it in Figma.",
      inputSchema: {
        name: z.string().describe("Component element name (e.g. sherpa-tag)"),
        include: z.enum(["all", "def", "code", "figma"]).optional()
          .describe("Which parts to return (default all): def | code | figma | all"),
      },
    },
    async ({ name, include = "all" }) => {
      try {
        const def = loadDef(name);
        if (!def) {
          const avail = loadComponentNames().filter((n) => n.startsWith("sherpa-")).sort().join(", ");
          return ok(`Component "${name}" has no def.\n\nAvailable: ${avail}`);
        }
        const nameMap = loadNameMap();
        let out = "";

        if (include === "all" || include === "def") {
          out += `# ${def.name}${def.figmaName ? `  (Figma: ${def.figmaName})` : ""}\n`;
          out += `${def.description ?? ""}\n\n`;
          out += `## Definition\n\`\`\`json\n${JSON.stringify(def, null, 2)}\n\`\`\`\n\n`;
        }

        if (include === "all" || include === "code") {
          // An anatomy is present in any of its three forms — `root`, `roots`
          // (a multi-root template), or `byTemplate` (a component whose
          // templates are different trees). Checking only `root` skipped the
          // compile step for sherpa-button, sherpa-input-text and
          // sherpa-nav-item entirely.
          if (def.anatomy?.root || def.anatomy?.roots || def.anatomy?.byTemplate) {
            try {
              const { ts, html, css } = compileDef(def);
              out += `## Compiled code (def → code)\n`;
              out += `### ${name}.ts\n\`\`\`ts\n${ts}\`\`\`\n\n`;
              out += `### ${name}.html\n\`\`\`html\n${html}\`\`\`\n\n`;
              out += `### ${name}.css\n\`\`\`css\n${css}\`\`\`\n\n`;
              out += `_Note: the compiler is a scaffolder, not a replicator — hand-written CSS owns polish (hex fallbacks, edge-case rules). Read \`sherpa://component/${name}/css\` for the shipped file._\n\n`;
            } catch (e) {
              out += `## Compiled code\n_compile_def failed: ${e.message}_\n\n`;
            }
          } else {
            out += `## Compiled code\n_No anatomy block on this def — def→code compile needs one. Read the shipped files via sherpa://component/${name}/{ts,html,css}._\n\n`;
          }
        }

        if (include === "all" || include === "figma") {
          out += `## Figma binding shape\n`;
          const mapEntry = nameMap[name];
          if (mapEntry) out += `- name-map: \`${name}\` ↔ **${mapEntry.figma}** (status: ${mapEntry.status})\n`;
          if (def.figma) {
            const f = def.figma;
            out += `- node type: ${f.nodeType ?? "?"}  ·  built: ${f.built ?? false}\n`;
            if (f.variantAxes?.length) out += `- variant axes: ${f.variantAxes.map((a) => `${a.name}=[${a.values.join("|")}]`).join("  ·  ")}\n`;
            if (f.booleanProps?.length) out += `- boolean props: ${f.booleanProps.join(", ")}\n`;
            if (f.textProps?.length) out += `- text props: ${f.textProps.join(", ")}\n`;
            if (f.instanceProps?.length) out += `- instance props: ${f.instanceProps.join(", ")}\n`;
            if (f.modePins && Object.keys(f.modePins).length) out += `- mode pins: ${Object.entries(f.modePins).map(([k, v]) => `${k}=${v}`).join(", ")}\n`;
            if (f.note) out += `- note: ${f.note}\n`;
          } else {
            out += `- (no figma block on this def)\n`;
          }
        }

        return ok(out.trimEnd());
      } catch (e) {
        return err(`get_component: ${e.message}`);
      }
    }
  );
}
