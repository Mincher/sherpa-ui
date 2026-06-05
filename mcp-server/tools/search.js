import { z } from "zod/v3";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

/** Score a schema for relevance to a set of query words. */
function scoreComponent(schema, words) {
  let score = 0;
  const desc = schema.description?.toLowerCase() ?? "";
  const cat  = (schema.category ?? schema.group ?? "").toLowerCase();

  for (const word of words) {
    if (schema.tagName.includes(word)) score += 4;
    if (desc.includes(word))           score += 3;
    if (cat.includes(word))            score += 2;
    for (const a of schema.attributes ?? []) {
      if ((a.description ?? "").toLowerCase().includes(word)) score += 1;
    }
    for (const e of schema.events ?? []) {
      if ((e.name + " " + (e.description ?? "")).toLowerCase().includes(word)) score += 1;
    }
    for (const s of schema.slots ?? []) {
      if ((s.description ?? "").toLowerCase().includes(word)) score += 0.5;
    }
  }
  return score;
}

export function register(server, { schemas }) {
  server.registerTool(
    "search_api",
    {
      title: "Search Component API",
      description: "Search across every component schema for matching attributes, events, slots, methods, properties, CSS parts, or CSS custom properties. Use to find which component(s) emit a specific event or expose a particular attribute.",
      inputSchema: {
        query:  z.string().describe("Substring to match (case-insensitive)"),
        facet:  z.enum(["all", "attributes", "events", "slots", "methods", "properties", "cssParts", "cssProperties"])
                 .optional().describe("Limit search to a specific facet (defaults to all)"),
        limit:  z.number().int().min(1).max(200).optional()
                 .describe("Max results to return (default 50)"),
        offset: z.number().int().min(0).optional()
                 .describe("Offset for pagination (default 0)"),
      },
    },
    async ({ query, facet, limit = 50, offset = 0 }) => {
      try {
        const q = query.toLowerCase();
        const facets = facet && facet !== "all"
          ? [facet]
          : ["attributes", "events", "slots", "methods", "properties", "cssParts", "cssProperties"];

        const allResults = [];
        for (const schema of schemas.values()) {
          for (const f of facets) {
            for (const item of schema[f] ?? []) {
              const haystack = [
                item.name ?? "",
                item.description ?? "",
                ...(item.enumValues ?? item.values ?? []),
              ].join(" ").toLowerCase();
              if (haystack.includes(q)) {
                allResults.push({
                  tagName:     schema.tagName,
                  facet:       f,
                  name:        item.name,
                  type:        item.type,
                  description: item.description,
                });
              }
            }
          }
        }

        const total = allResults.length;
        if (!total) return ok(`No API matches for "${query}".`);

        const page = allResults.slice(offset, offset + limit);

        // Group by tagName
        const grouped = {};
        for (const r of page) {
          grouped[r.tagName] ??= [];
          grouped[r.tagName].push(r);
        }

        let out = `Found ${total} match(es) for "${query}"`;
        if (total > limit || offset > 0) {
          out += ` (showing ${offset + 1}–${Math.min(offset + limit, total)})`;
        }
        out += ":\n\n";

        for (const [tag, items] of Object.entries(grouped)) {
          out += `## ${tag}\n`;
          for (const r of items) {
            out += `  ${r.facet}: ${r.name}`;
            if (r.type) out += ` {${r.type}}`;
            if (r.description) out += ` — ${r.description}`;
            out += "\n";
          }
          out += "\n";
        }

        if (total > offset + limit) {
          out += `_(${total - offset - limit} more results — use offset=${offset + limit} to paginate)_\n`;
        }
        return ok(out);
      } catch (e) {
        return err(`search_api: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "suggest_components",
    {
      title: "Suggest Components",
      description: "Given a plain-English description of what you need, returns ranked Sherpa UI components that best match, with rationale. Use this when you're not sure which component to use.",
      inputSchema: {
        query: z.string().describe('What you need, e.g. "filter a data table", "show a loading spinner", "confirm a destructive action"'),
        limit: z.number().int().min(1).max(20).optional()
                .describe("Max suggestions to return (default 5)"),
      },
    },
    async ({ query, limit = 5 }) => {
      try {
        const words = query.toLowerCase().split(/\s+/).filter((w) => w.length > 2);
        if (!words.length) return ok("Please provide a more descriptive query.");

        const scored = [...schemas.values()]
          .map((schema) => ({ schema, score: scoreComponent(schema, words) }))
          .filter((x) => x.score > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limit);

        if (!scored.length) {
          return ok(
            `No components matched "${query}". Try list_components to browse the full library, ` +
            `or search_api to find by specific attribute or event name.`
          );
        }

        let out = `Top ${scored.length} suggestion(s) for "${query}":\n\n`;
        for (let i = 0; i < scored.length; i++) {
          const { schema, score } = scored[i];
          out += `### ${i + 1}. \`${schema.tagName}\`\n`;
          out += `**Category:** ${schema.category ?? schema.group ?? "—"}\n`;
          if (schema.description) out += `**Description:** ${schema.description}\n`;
          out += `**Relevance score:** ${score}\n`;
          out += `**Quick stats:** ${schema.attributes?.length ?? 0} attrs, ${schema.slots?.length ?? 0} slots, ${schema.events?.length ?? 0} events\n`;
          out += `**Learn more:** call \`query_component("${schema.tagName}")\`\n\n`;
        }
        return ok(out);
      } catch (e) {
        return err(`suggest_components: ${e.message}`);
      }
    }
  );
}
