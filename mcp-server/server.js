import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { log } from "./lib/logger.js";
import {
  SchemaRegistry, loadTokens, buildTokenMap,
  loadCssUtilities, loadUtilities, parseTemplateIds,
} from "./lib/loader.js";

import { register as registerComponentTools } from "./tools/component.js";
import { register as registerExampleTools }   from "./tools/examples.js";
import { register as registerTokenTools }      from "./tools/tokens.js";
import { register as registerUtilityTools }    from "./tools/utilities.js";
import { register as registerSearchTools }     from "./tools/search.js";
import { register as registerMetaTools }       from "./tools/meta.js";
import { register as registerOntologyTools }   from "./tools/ontology.js";
import { register as registerResources }       from "./resources/index.js";
import { register as registerPrompts }         from "./prompts/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT            = path.resolve(__dirname, "..");
const CSS_UTIL_DIR    = path.join(__dirname, "data", "css-utilities");
const COMPONENTS_DIR  = path.join(ROOT, "src", "components");
const DOCS_DIR        = path.join(ROOT, "docs");
// Reforged: tokens live in src/styles/tokens/ (projected from Figma). The old
// css/ tree is gone; CSS_DIR now aliases docs/ (a harmless guideline fallback).
const CSS_DIR         = DOCS_DIR;
const CSS_STYLES_DIR  = path.join(ROOT, "src", "styles", "tokens");
const COPILOT_PATH    = path.join(ROOT, ".github", "instructions", "copilot-instructions.md");

const PATHS = {
  rootDir:       ROOT,
  componentsDir: COMPONENTS_DIR,

  docsDir:       DOCS_DIR,
  cssDir:        CSS_DIR,
  copilotPath:   COPILOT_PATH,
};

export async function createServer() {
  const startTime = Date.now();
  log.info("Starting Sherpa UI MCP server…");

  // schemas are loaded lazily on first access, cached for the session
  const schemas      = new SchemaRegistry(COMPONENTS_DIR);
  const tokens       = loadTokens(CSS_STYLES_DIR, ROOT);
  const tokenMap     = buildTokenMap(tokens);
  const patterns     = new Map(); // patterns/ removed from the reforged tree
  const cssUtilities = loadCssUtilities(CSS_UTIL_DIR);
  const utilities    = loadUtilities(COMPONENTS_DIR);

  log.info(
    `Data loaded — ${schemas.size} components (lazy), ${tokens.length} tokens, ` +
    `${utilities.size} utilities in ${Date.now() - startTime}ms`
  );

  const server = new McpServer(
    { name: "sherpa-ui", version: "2.0.0" },
    { capabilities: { resources: {}, tools: {}, prompts: {} } }
  );

  const data = { schemas, tokens, tokenMap, patterns, cssUtilities, utilities, startTime };
  const loaderHelpers = { parseTemplateIds, componentsDir: COMPONENTS_DIR };

  // Tools
  registerComponentTools(server, data, loaderHelpers);
  registerExampleTools(server, data, loaderHelpers);
  registerTokenTools(server, data);
  registerUtilityTools(server, data);
  registerSearchTools(server, data);
  registerMetaTools(server, data, { docsDir: DOCS_DIR, cssDir: CSS_DIR, copilotPath: COPILOT_PATH });
  registerOntologyTools(server);

  // Resources
  registerResources(server, data, PATHS);

  // Prompts
  registerPrompts(server, data, PATHS);

  log.info(`Server ready — ${Date.now() - startTime}ms startup`);
  return server;
}
