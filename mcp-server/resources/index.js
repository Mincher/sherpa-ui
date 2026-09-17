/**
 * Resources — the def-driven read surface.
 *
 *   sherpa://def/{name}               — a component's <name>.component.yaml, as a def
 *   sherpa://component/{name}/{kind}  — a component's shipped ts | html | css | def
 *   sherpa://rules                    — docs/DEF-TO-FIGMA-BUILD-RULES.md
 *   sherpa://data-rules               — docs/DATA-SOURCE-RULES.md
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { loadDef } from "../../scripts/lib/generation/data.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const COMPONENTS_DIR = path.join(ROOT, "src", "components");
const RULES_PATH = path.join(ROOT, "docs", "DEF-TO-FIGMA-BUILD-RULES.md");
/* The def's SHAPE. `docs/COMPONENT-DEFINITION-STANDARD.md` used to hold it and
   no longer exists — the shape now lives in the JSON Schema, which is checked on
   every commit and therefore cannot drift from what the specs actually contain.
   A prose standard nobody validates is the artefact this repo keeps re-learning
   about. */
const STANDARD_PATH = path.join(ROOT, "schemas", "component.v1.json");
const DATA_RULES_PATH = path.join(ROOT, "docs", "DATA-SOURCE-RULES.md");

const listComponents = () =>
  fs.existsSync(COMPONENTS_DIR)
    ? fs.readdirSync(COMPONENTS_DIR).filter((n) => n.startsWith("sherpa-")).sort()
    : [];
// Serve the def as JSON text — thin YAML is hydrated to the full def first, so
// the resource contract (application/json) is unchanged for consumers.
const readDef = (name) => {
  const def = loadDef(name);
  return def ? JSON.stringify(def, null, 2) : null;
};

export function register(server) {
  // ── sherpa://def/{name} — the component def ─────────────────────────
  server.registerResource(
    "Component Def",
    new ResourceTemplate("sherpa://def/{name}", {
      list: async () => ({
        resources: listComponents()
          .filter((n) => readDef(n) != null)
          .map((n) => ({
            uri: `sherpa://def/${n}`,
            name: `${n} def`,
            description: loadDef(n)?.description ?? "",
            mimeType: "application/json",
          })),
      }),
    }),
    { description: "The component def, read from <name>.component.yaml — the shared source of truth for a Sherpa component", mimeType: "application/json" },
    async (uri, { name }) => {
      const src = readDef(name);
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: src ?? `{"error":"No def for ${name}"}`,
        }],
      };
    }
  );


  // ── sherpa://component/{name}/{kind} — shipped source files ─────────
  // The def itself is served by sherpa://def/{name} above; here just the code.
  const KINDS = {
    ts: { file: (n) => `${n}.ts`, mime: "application/typescript", label: "TS" },
    html: { file: (n) => `${n}.html`, mime: "text/html", label: "HTML" },
    css: { file: (n) => `${n}.css`, mime: "text/css", label: "CSS" },
  };

  for (const [kind, info] of Object.entries(KINDS)) {
    server.registerResource(
      `Component ${info.label}`,
      new ResourceTemplate(`sherpa://component/{name}/${kind}`, {
        list: async () => ({
          resources: listComponents()
            .filter((n) => fs.existsSync(path.join(COMPONENTS_DIR, n, info.file(n))))
            .map((n) => ({
              uri: `sherpa://component/${n}/${kind}`,
              name: `${n} ${info.label}`,
              mimeType: info.mime,
            })),
        }),
      }),
      { description: `${info.label} source for a Sherpa component`, mimeType: info.mime },
      async (uri, { name }) => {
        const filePath = path.join(COMPONENTS_DIR, name, info.file(name));
        const src = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
        return {
          contents: [{
            uri: uri.href,
            mimeType: info.mime,
            text: src ?? `/* No ${kind} file for ${name} */`,
          }],
        };
      }
    );
  }

  // ── sherpa://rules — the def→Figma build rules + the def standard ───
  server.registerResource(
    "Def→Figma Build Rules",
    "sherpa://rules",
    { description: "The hard rules for building a component from a def (DEF-TO-FIGMA-BUILD-RULES.md) + the def standard", mimeType: "text/markdown" },
    async (uri) => {
      const rules = fs.existsSync(RULES_PATH) ? fs.readFileSync(RULES_PATH, "utf8") : "(DEF-TO-FIGMA-BUILD-RULES.md not found)";
      const standard = fs.existsSync(STANDARD_PATH) ? fs.readFileSync(STANDARD_PATH, "utf8") : "";
      const text = standard
        ? `${rules}\n\n---\n\n# Appendix: the component spec SCHEMA\n\nThe shape every \`<name>.component.yaml\` must match. Validated on every commit by \`npm run spec:check\`, so it describes what the specs really contain.\n\n\`\`\`json\n${standard}\n\`\`\``
        : rules;
      return {
        contents: [{
          uri: uri.href ?? "sherpa://rules",
          mimeType: "text/markdown",
          text,
        }],
      };
    }
  );

  /* ── sherpa://data-rules — what Sherpa expects of your data ──────────
     What an agent needs before it can point a Sherpa app at a backend, or
     write a schema for one: the row shape, the filter grammar, the store
     contract, where validation belongs, and the fact that none of it needs a
     browser. It was not written down anywhere until 2026-09-17 — an agent was
     reading the source to find out.

     The same page serves people; that is the point of it being a doc rather
     than a tool's description string. */
  server.registerResource(
    "Sherpa Data Rules",
    "sherpa://data-rules",
    {
      description:
        "What Sherpa expects of your data: the row shape, the [field, op, value] filter grammar, the Store contract, where validation belongs, and the headless entry point (DATA-SOURCE-RULES.md)",
      mimeType: "text/markdown",
    },
    async (uri) => ({
      contents: [{
        uri: uri.href ?? "sherpa://data-rules",
        mimeType: "text/markdown",
        text: fs.existsSync(DATA_RULES_PATH)
          ? fs.readFileSync(DATA_RULES_PATH, "utf8")
          : "(DATA-SOURCE-RULES.md not found)",
      }],
    })
  );
}
