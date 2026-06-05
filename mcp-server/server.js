import path from "path";
import { fileURLToPath } from "url";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

import { log } from "./lib/logger.js";
import {
  loadSchemas, loadTokens, buildTokenMap, loadPatterns,
  loadCssUtilities, loadUtilities, parseTemplateIds,
} from "./lib/loader.js";

import { register as registerComponentTools } from "./tools/component.js";
import { register as registerExampleTools }   from "./tools/examples.js";
import { register as registerTokenTools }      from "./tools/tokens.js";
import { register as registerPatternTools }    from "./tools/patterns.js";
import { register as registerUtilityTools }    from "./tools/utilities.js";
import { register as registerSearchTools }     from "./tools/search.js";
import { register as registerMetaTools }       from "./tools/meta.js";
import { register as registerResources }       from "./resources/index.js";
import { register as registerPrompts }         from "./prompts/index.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT            = path.resolve(__dirname, "..");
const SCHEMAS_DIR     = path.join(ROOT, "schemas", "components");
const CSS_UTIL_DIR    = path.join(ROOT, "schemas", "css-utilities");
const COMPONENTS_DIR  = path.join(ROOT, "components");
const PATTERNS_DIR    = path.join(ROOT, "patterns");
const DOCS_DIR        = path.join(ROOT, "docs");
const CSS_DIR         = path.join(ROOT, "css");
const CSS_STYLES_DIR  = path.join(ROOT, "css", "styles");
const COPILOT_PATH    = path.join(ROOT, ".github", "copilot-instructions.md");

const PATHS = {
  rootDir:       ROOT,
  schemasDir:    SCHEMAS_DIR,
  componentsDir: COMPONENTS_DIR,
  patternsDir:   PATTERNS_DIR,
  docsDir:       DOCS_DIR,
  cssDir:        CSS_DIR,
  copilotPath:   COPILOT_PATH,
};

export async function createServer() {
  const startTime = Date.now();
  log.info("Starting Sherpa UI MCP server…");

  // Load all data at startup
  const schemas      = loadSchemas(SCHEMAS_DIR);
  const tokens       = loadTokens(CSS_STYLES_DIR, ROOT);
  const tokenMap     = buildTokenMap(tokens);
  const patterns     = loadPatterns(PATTERNS_DIR);
  const cssUtilities = loadCssUtilities(CSS_UTIL_DIR);
  const utilities    = loadUtilities(COMPONENTS_DIR);

  log.info(
    `Data loaded — ${schemas.size} schemas, ${tokens.length} tokens, ` +
    `${patterns.size} patterns, ${utilities.size} utilities in ${Date.now() - startTime}ms`
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
  registerPatternTools(server, data, { patternsDir: PATTERNS_DIR, rootDir: ROOT, componentsDir: COMPONENTS_DIR });
  registerUtilityTools(server, data);
  registerSearchTools(server, data);
  registerMetaTools(server, data, { docsDir: DOCS_DIR, cssDir: CSS_DIR, copilotPath: COPILOT_PATH });

  // Resources
  registerResources(server, data, PATHS);

  // Prompts
  registerPrompts(server, data, PATHS);

  log.info(`Server ready — ${Date.now() - startTime}ms startup`);
  return server;
}
