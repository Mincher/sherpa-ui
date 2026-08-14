/**
 * Resources — the def-driven read surface.
 *
 *   sherpa://def/{name}               — a component's <name>.def.json
 *   sherpa://ontology/{id}            — one design-system token's ontology entry
 *   sherpa://component/{name}/{kind}  — a component's shipped ts | html | css | def
 *   sherpa://rules                    — docs/DEF-TO-FIGMA-BUILD-RULES.md
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..", "..");
const COMPONENTS_DIR = path.join(ROOT, "src", "components");
const ONTOLOGY_PATH = path.join(ROOT, "docs", "ontology", "tokens.json");
const RULES_PATH = path.join(ROOT, "docs", "DEF-TO-FIGMA-BUILD-RULES.md");
const STANDARD_PATH = path.join(ROOT, "docs", "COMPONENT-DEFINITION-STANDARD.md");

const readJson = (p) => (fs.existsSync(p) ? JSON.parse(fs.readFileSync(p, "utf8")) : null);
const listComponents = () =>
  fs.existsSync(COMPONENTS_DIR)
    ? fs.readdirSync(COMPONENTS_DIR).filter((n) => n.startsWith("sherpa-")).sort()
    : [];
const loadOntology = () => readJson(ONTOLOGY_PATH) ?? {};
const readDef = (name) => {
  const p = path.join(COMPONENTS_DIR, name, `${name}.def.json`);
  return fs.existsSync(p) ? fs.readFileSync(p, "utf8") : null;
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
            description: (readJson(path.join(COMPONENTS_DIR, n, `${n}.def.json`))?.description) ?? "",
            mimeType: "application/json",
          })),
      }),
    }),
    { description: "The <name>.def.json — the shared source of truth for a Sherpa component", mimeType: "application/json" },
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

  // ── sherpa://ontology/{id} — one token's ontology entry ─────────────
  server.registerResource(
    "Token Ontology",
    new ResourceTemplate("sherpa://ontology/{id}", {
      list: async () => ({
        resources: Object.values(loadOntology()).map((e) => ({
          uri: `sherpa://ontology/${encodeURIComponent(e.id)}`,
          name: e.id,
          description: e.purpose,
          mimeType: "application/json",
        })),
      }),
    }),
    { description: "Purpose/usage ontology for a Sherpa design-system variable", mimeType: "application/json" },
    async (uri, { id }) => {
      const o = loadOntology();
      const entry = o[decodeURIComponent(id)];
      return {
        contents: [{
          uri: uri.href,
          mimeType: "application/json",
          text: entry ? JSON.stringify(entry, null, 2) : `{"error":"Unknown token: ${id}"}`,
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
        ? `${rules}\n\n---\n\n# Appendix: Component Definition Standard\n\n${standard}`
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
}
