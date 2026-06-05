import fs from "fs";
import path from "path";
import { ResourceTemplate } from "@modelcontextprotocol/sdk/server/mcp.js";
import { readComponentSource, readUtilitySource } from "../lib/loader.js";

const GUIDE_FILES = {
  "copilot-instructions": { file: "copilot-instructions.md", name: "Copilot Instructions (canonical agent guidance)" },
  "api-standard":         { file: "COMPONENT-API-STANDARD.md", name: "Component API Standard" },
  "component-template":   { file: "COMPONENT-TEMPLATE.md", name: "Component Template" },
  "css-file-template":    { file: "CSS-FILE-TEMPLATE.md", name: "CSS File Template & Standards" },
  "token-usage":          { file: "TOKENS-USAGE-GUIDE.md", name: "Design Token Usage Guide" },
  "text-styles":          { file: "TEXT-STYLES.md", name: "Text Styles Reference" },
};

export function register(server, { schemas, patterns, cssUtilities, utilities }, paths) {
  const { docsDir, cssDir, copilotPath, componentsDir, rootDir } = paths;

  // ── Guideline documents ─────────────────────────────────────────────
  for (const [slug, info] of Object.entries(GUIDE_FILES)) {
    server.registerResource(
      info.name,
      `sherpa://guidelines/${slug}`,
      { description: info.name, mimeType: "text/markdown" },
      async () => {
        let content = null;
        const docsFile = path.join(docsDir, info.file);
        const cssFile  = path.join(cssDir, info.file);
        if (fs.existsSync(docsFile))           content = fs.readFileSync(docsFile, "utf8");
        else if (fs.existsSync(cssFile))       content = fs.readFileSync(cssFile, "utf8");
        else if (slug === "copilot-instructions" && fs.existsSync(copilotPath)) {
          content = fs.readFileSync(copilotPath, "utf8");
        }
        return {
          contents: [{
            uri:      `sherpa://guidelines/${slug}`,
            mimeType: "text/markdown",
            text:     content ?? `Document not found: ${info.file}`,
          }],
        };
      }
    );
  }

  // ── Component schemas ───────────────────────────────────────────────
  server.registerResource(
    "Component Schema",
    new ResourceTemplate("sherpa://schema/{tagName}", {
      list: async () => ({
        resources: [...schemas.keys()].map((tag) => ({
          uri:         `sherpa://schema/${tag}`,
          name:        tag,
          description: schemas.get(tag)?.description ?? "",
          mimeType:    "application/json",
        })),
      }),
    }),
    { description: "JSON API schema for a Sherpa UI component", mimeType: "application/json" },
    async (uri, { tagName }) => {
      const schema = schemas.get(tagName);
      return {
        contents: [{
          uri:      uri.href,
          mimeType: "application/json",
          text:     schema
            ? JSON.stringify(schema, null, 2)
            : `{"error": "Unknown component: ${tagName}"}`,
        }],
      };
    }
  );

  // ── Component HTML templates ────────────────────────────────────────
  server.registerResource(
    "Component Template",
    new ResourceTemplate("sherpa://template/{tagName}", {
      list: async () => ({
        resources: [...schemas.keys()].map((tag) => ({
          uri:      `sherpa://template/${tag}`,
          name:     `${tag} template`,
          mimeType: "text/html",
        })),
      }),
    }),
    { description: "Raw HTML template for a Sherpa UI component", mimeType: "text/html" },
    async (uri, { tagName }) => {
      const htmlPath = path.join(componentsDir, tagName, `${tagName}.html`);
      const html = fs.existsSync(htmlPath) ? fs.readFileSync(htmlPath, "utf8") : null;
      return {
        contents: [{
          uri:      uri.href,
          mimeType: "text/html",
          text:     html ?? `<!-- No template found for ${tagName} -->`,
        }],
      };
    }
  );

  // ── Component source files (CSS / JS / examples / readme) ──────────
  const COMPONENT_KINDS = {
    css:      { mime: "text/css",               label: "CSS" },
    js:       { mime: "application/javascript", label: "JS" },
    examples: { mime: "text/html",              label: "Examples" },
    readme:   { mime: "text/markdown",          label: "README" },
  };

  for (const [kind, info] of Object.entries(COMPONENT_KINDS)) {
    server.registerResource(
      `Component ${info.label}`,
      new ResourceTemplate(`sherpa://component/{tagName}/${kind}`, {
        list: async () => ({
          resources: [...schemas.keys()]
            .filter((tag) => readComponentSource(tag, kind, componentsDir) != null)
            .map((tag) => ({
              uri:      `sherpa://component/${tag}/${kind}`,
              name:     `${tag} ${info.label}`,
              mimeType: info.mime,
            })),
        }),
      }),
      { description: `${info.label} source for a Sherpa UI component`, mimeType: info.mime },
      async (uri, { tagName }) => {
        const src = readComponentSource(tagName, kind, componentsDir);
        return {
          contents: [{
            uri:      uri.href,
            mimeType: info.mime,
            text:     src ?? `/* No ${kind} file for ${tagName} */`,
          }],
        };
      }
    );
  }

  // ── Pattern HTML files ──────────────────────────────────────────────
  server.registerResource(
    "Pattern",
    new ResourceTemplate("sherpa://pattern/{patternId}", {
      list: async () => ({
        resources: [...patterns.entries()].map(([id, entry]) => ({
          uri:         `sherpa://pattern/${id}`,
          name:        entry.name,
          description: `${entry.category}: ${entry.description ?? entry.name}`,
          mimeType:    "text/html",
        })),
      }),
    }),
    { description: "View layout or UX pattern HTML", mimeType: "text/html" },
    async (uri, { patternId }) => {
      const entry = patterns.get(patternId);
      if (!entry) {
        return {
          contents: [{
            uri: uri.href, mimeType: "text/html",
            text: `<!-- Unknown pattern: ${patternId} -->`,
          }],
        };
      }
      const filePath = path.join(rootDir, entry.file);
      const html = fs.existsSync(filePath) ? fs.readFileSync(filePath, "utf8") : null;
      return {
        contents: [{
          uri:      uri.href,
          mimeType: "text/html",
          text:     html ?? `<!-- Pattern file not found: ${entry.file} -->`,
        }],
      };
    }
  );

  // ── CSS utility class schemas ───────────────────────────────────────
  server.registerResource(
    "CSS Utility Schema",
    new ResourceTemplate("sherpa://css-utility/{className}", {
      list: async () => ({
        resources: [...cssUtilities.keys()].map((className) => ({
          uri:         `sherpa://css-utility/${className}`,
          name:        className,
          description: cssUtilities.get(className)?.description ?? "",
          mimeType:    "application/json",
        })),
      }),
    }),
    { description: "JSON schema for a Sherpa UI CSS utility class", mimeType: "application/json" },
    async (uri, { className }) => {
      const util = cssUtilities.get(className);
      return {
        contents: [{
          uri:      uri.href,
          mimeType: "application/json",
          text:     util
            ? JSON.stringify(util, null, 2)
            : `{"error": "Unknown CSS utility: ${className}"}`,
        }],
      };
    }
  );

  // ── Utility module sources ──────────────────────────────────────────
  server.registerResource(
    "Utility Module",
    new ResourceTemplate("sherpa://utility/{id}", {
      list: async () => ({
        resources: [...utilities.values()].map((u) => ({
          uri:      `sherpa://utility/${u.id}`,
          name:     u.id,
          mimeType: "application/javascript",
        })),
      }),
    }),
    { description: "Source for a Sherpa UI utility module", mimeType: "application/javascript" },
    async (uri, { id }) => {
      const src = readUtilitySource(id, "js", utilities);
      return {
        contents: [{
          uri:      uri.href,
          mimeType: "application/javascript",
          text:     src ?? `/* Unknown utility: ${id} */`,
        }],
      };
    }
  );
}
