import { z } from "zod/v3";
import { resolveTokenChain } from "../lib/loader.js";

function ok(text) { return { content: [{ type: "text", text }] }; }
function err(text) { return { content: [{ type: "text", text: `Error: ${text}` }], isError: true }; }

export function register(server, { tokens, tokenMap }) {
  server.registerTool(
    "browse_tokens",
    {
      title: "Browse Tokens",
      description: "Search Sherpa UI design tokens by name pattern or keyword. Returns token names and their CSS values grouped by source file.",
      inputSchema: {
        query: z.string().describe(
          "Search term to match against token names (e.g. 'surface', 'space-sm', 'color-brand')"
        ),
      },
    },
    async ({ query }) => {
      try {
        const q = query.toLowerCase();
        const matches = tokens.filter((t) => t.name.toLowerCase().includes(q));
        if (!matches.length) {
          return ok(`No tokens matching "${query}". Try broader terms: "surface", "text", "space", "border", "radius", "color".`);
        }

        // Group by file, include values
        const grouped = {};
        for (const t of matches) {
          if (!grouped[t.file]) grouped[t.file] = [];
          grouped[t.file].push(t);
        }

        let result = `Found ${matches.length} token(s) matching "${query}":\n\n`;
        for (const [file, entries] of Object.entries(grouped)) {
          result += `## ${file}\n`;
          for (const t of entries) {
            result += `  ${t.name}: ${t.value}\n`;
          }
          result += "\n";
        }
        result += "Use get_token_value to resolve alias chains.";
        return ok(result);
      } catch (e) {
        return err(`browse_tokens: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "list_token_groups",
    {
      title: "List Token Groups",
      description: "List the design-token namespaces grouped by prefix (surface, text, space, border, color…) with counts. Use this for discovery before drilling in with browse_tokens.",
      inputSchema: {},
    },
    async () => {
      try {
        const grouped = {};
        for (const t of tokens) {
          const m = t.name.match(/^--sherpa-([a-z0-9]+)/);
          const ns = m ? m[1] : "other";
          grouped[ns] ??= new Set();
          grouped[ns].add(t.name);
        }
        let out = `Found ${tokens.length} tokens across ${Object.keys(grouped).length} namespace(s):\n\n`;
        for (const ns of Object.keys(grouped).sort()) {
          out += `- **${ns}** — ${grouped[ns].size} tokens\n`;
        }
        out += "\nUse browse_tokens with a namespace (e.g. \"surface\") to list specific tokens with their values.";
        return ok(out);
      } catch (e) {
        return err(`list_token_groups: ${e.message}`);
      }
    }
  );

  server.registerTool(
    "get_token_value",
    {
      title: "Get Token Value",
      description: "Resolve a design token's value, following alias chains to their concrete CSS value. Returns the full resolution chain so you can understand both the semantic name and the underlying value.",
      inputSchema: {
        name: z.string().describe("Token name (e.g. --sherpa-surface-raised or sherpa-surface-raised)"),
      },
    },
    async ({ name }) => {
      try {
        // Normalise: ensure leading --
        const tokenName = name.startsWith("--") ? name : `--${name}`;
        const { resolved, chain } = resolveTokenChain(tokenName, tokenMap);

        if (!chain.length) {
          // Fuzzy fallback: find tokens whose name contains the query
          const fragment = tokenName.replace(/^--/, "");
          const matches = tokens
            .filter((t) => t.name.includes(fragment))
            .slice(0, 10)
            .map((t) => `  ${t.name}: ${t.value}`);
          if (matches.length) {
            return ok(
              `Token "${tokenName}" not found. Did you mean one of these?\n\n` +
              matches.join("\n")
            );
          }
          return ok(`Token "${tokenName}" not found. Use browse_tokens or list_token_groups to discover available tokens.`);
        }

        let out = `## ${tokenName}\n\n`;
        out += `**Resolved value:** ${resolved ?? "(unresolvable)"}\n\n`;

        if (chain.length > 1) {
          out += `**Alias chain** (${chain.length} step${chain.length > 1 ? "s" : ""}):\n`;
          for (let i = 0; i < chain.length; i++) {
            const step = chain[i];
            const prefix = i === 0 ? "→" : i === chain.length - 1 ? "  ↳" : "  ↓";
            out += `${prefix} \`${step.name}\`: \`${step.value}\`\n`;
            out += `   _(${step.file})_\n`;
          }
        } else {
          out += `**File:** ${chain[0].file}\n`;
        }

        return ok(out);
      } catch (e) {
        return err(`get_token_value: ${e.message}`);
      }
    }
  );
}
