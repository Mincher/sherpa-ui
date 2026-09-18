/**
 * Discover tools — understand the def-driven design system.
 *
 * Thin wrappers over scripts/lib/generation/*. One implementation, two surfaces
 * (the MCP + the generate-sherpa-component skill both call the shared lib).
 *
 *   list_components   — every component + its def summary
 *   find_token        — token NAMES from the generated tokens.css, synonym-aware
 *   get_component     — the full def + code + Figma binding shape
 *
 * THIS LIST IS THE REGISTRATIONS BELOW, and it was wrong until 2026-09-18: it
 * promised `explain_token` and `browse_ontology`, two tools that went with the
 * ontology in 2026-09-16, and omitted `find_token`, which replaced them. A
 * header comment naming tools a caller cannot call is the same rot the specs
 * had — see the round-trip gate in the pre-commit hook, which exists because a
 * generated artefact drifted the same way.
 */
import { z } from "zod/v3";
import {
  loadComponentNames, loadDef, loadNameMap, loadCssTokenNames,
} from "../../scripts/lib/generation/data.mjs";
import { compileDef } from "../../scripts/lib/generation/compile-def.mjs";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/**
 * Token NAMES from the generated `tokens.css` that contain `query`.
 *
 * `tokens.css` is re-projected from Figma, so it always knows which names are
 * real — it simply knows nothing about what they are FOR. That is a smaller
 * answer than the deleted ontology gave, and an honest one; the ontology's
 * failure mode was a confident wrong answer.
 *
 * An empty query returns every name.
 */
function matchingCssTokens(query) {
  const q = String(query ?? "").toLowerCase().replace(/[\/-]/g, "");
  const all = [...loadCssTokenNames()].sort();
  if (!q) return all;
  return all.filter((t) => t.toLowerCase().replace(/[\/-]/g, "").includes(q));
}

/* ── The synonym bridge — the ONE piece of the old ontology that survived ──────
 *
 * `explain_token` and `browse_ontology` are gone: they carried purpose, role and
 * caveat per token, and that map rotted into confident wrong answers. What
 * remains is the translation half, which cannot rot — it maps a word a person
 * reaches for onto a token name that either exists in `tokens.css` or does not.
 *
 * `find_token`'s own output says so to the caller, in as many words.
 */

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

  // ── find_token — which tokens exist, by name ───────────────────────
  server.registerTool(
    "find_token",
    {
      title: "Find a Design Token by Name",
      description:
        "Search the generated `tokens.css` for token names containing a fragment — 'surface', 'border-accent', 'space', 'content/body'. Synonym-aware: 'heading' finds 'title', 'bg' finds 'surface'. Returns the real declared names, grouped by family, so you can bind one that exists. For \"which token resolves to 12px\" use `token_for` instead.",
      inputSchema: {
        query: z.string().describe("A fragment of a token name, e.g. 'surface' or 'border-accent'. Empty lists every token."),
      },
    },
    async ({ query }) => {
      try {
        const hits = expand(String(query ?? "").toLowerCase()).flatMap((t) => matchingCssTokens(t));
        const names = [...new Set(hits)].sort();
        if (!names.length) {
          return ok(`No token name contains "${query}".\n\n`
            + `\`src/styles/tokens/tokens.css\` declares ${matchingCssTokens("").length} tokens. `
            + `Try a shorter fragment — 'surface', 'border', 'content', 'space', 'size', 'rounding'.`);
        }
        // Group by the family (the segment after --sherpa-) so a long list reads.
        const byFamily = {};
        for (const n of names) {
          const fam = n.replace("--sherpa-", "").split("-")[0];
          (byFamily[fam] ??= []).push(n);
        }
        const lines = [`${names.length} token(s) match "${query}":\n`];
        for (const [fam, list] of Object.entries(byFamily).sort()) {
          lines.push(`### ${fam} (${list.length})`);
          for (const n of list.slice(0, 30)) lines.push(`  ${n}`);
          if (list.length > 30) lines.push(`  …${list.length - 30} more`);
          lines.push("");
        }
        lines.push("These are NAMES, read from the generated `tokens.css`. What each token is FOR");
        lines.push("is not recorded anywhere: the ontology that carried purpose, role and caveat");
        lines.push("was deleted 2026-09-16 for having rotted, and is not coming back. Read the");
        lines.push("component CSS that already binds one to see it in use.");
        return ok(lines.join("\n"));
      } catch (e) {
        return err(`find_token: ${e.message}`);
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
