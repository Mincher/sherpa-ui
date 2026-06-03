# MCP Server Improvement Instructions

Instructions for a coding agent to bring `mcp-server/index.js` in line with MCP best practices.
Work through the four tasks in order — each builds on the previous.

---

## Context

The Sherpa UI MCP server lives at `mcp-server/index.js`. It is a single-file Node.js/ESM server
using stdio transport, the `@modelcontextprotocol/sdk`, and `zod/v3` for input schemas.
It exposes 19 tools, 250+ resources, and 1 prompt for AI agents working with the Sherpa UI
component library.

The server already works well. These changes make it more robust, discoverable, and maintainable.

---

## Task 1 — Add tool annotations

Every `registerTool` call is missing an `annotations` object. Annotations are hints that
tell MCP clients whether a tool is safe to call freely, destructive, or idempotent.

### What to do

For **every** `registerTool` call in `mcp-server/index.js`, add an `annotations` key to the
second argument (the config object). Use the table below to pick the correct values for each tool.

**Annotation reference:**

| Annotation | Type | Meaning |
|---|---|---|
| `readOnlyHint` | boolean | Tool does not modify anything |
| `destructiveHint` | boolean | Tool may perform destructive updates |
| `idempotentHint` | boolean | Repeated calls with same args have no additional effect |
| `openWorldHint` | boolean | Tool interacts with external entities (files, network) |

**Annotations per tool:**

| Tool | readOnly | destructive | idempotent | openWorld |
|---|---|---|---|---|
| `query_component` | true | false | true | false |
| `list_components` | true | false | true | false |
| `generate_component` | true | false | true | false |
| `browse_tokens` | true | false | true | false |
| `validate_usage` | true | false | true | false |
| `list_patterns` | true | false | true | false |
| `get_pattern` | true | false | true | false |
| `compose_view` | true | false | true | false |
| `generate_flow` | true | false | true | false |
| `get_component_source` | true | false | true | true |
| `get_component_examples` | true | false | true | false |
| `list_component_examples` | true | false | true | false |
| `search_api` | true | false | true | false |
| `list_token_groups` | true | false | true | false |
| `list_utilities` | true | false | true | false |
| `get_utility` | true | false | true | true |
| `list_css_utilities` | true | false | true | false |
| `get_css_utility` | true | false | true | false |
| `get_architecture` | true | false | true | true |

### Example — before

```js
server.registerTool(
  "query_component",
  {
    title: "Query Component",
    description: "Look up a Sherpa UI component's full API ...",
    inputSchema: { tagName: z.string().describe("...") },
  },
  async ({ tagName }) => { ... }
);
```

### Example — after

```js
server.registerTool(
  "query_component",
  {
    title: "Query Component",
    description: "Look up a Sherpa UI component's full API ...",
    inputSchema: { tagName: z.string().describe("...") },
    annotations: {
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
  },
  async ({ tagName }) => { ... }
);
```

### Verification

After editing, confirm every `registerTool` block contains an `annotations` key:

```bash
grep -c "annotations:" mcp-server/index.js
# Should output 19
```

---

## Task 2 — Add `structuredContent` and `outputSchema` to tool responses

Tools currently return only `content: [{ type: "text", text: ... }]`. Modern MCP clients can
also consume machine-readable `structuredContent` alongside the text. Adding this allows
programmatic consumers to process tool output without parsing strings.

### What to do

For each tool that returns structured data (JSON), do two things:

1. Add an `outputSchema` to the tool config (using `z.object(...)`) that describes the
   shape of the structured response.
2. In the handler, return `structuredContent` alongside `content`.

Only tools that return JSON objects benefit from this. Tools that return raw source code,
Markdown prose, or HTML (e.g. `get_component_source`, `get_pattern`, `get_architecture`,
`compose_view`, `generate_flow`, `generate_component`) should keep text-only responses —
adding a schema to unstructured text adds no value.

### Tools to update and their output schemas

#### `query_component`

```js
// outputSchema (add to config object):
outputSchema: z.object({
  tagName: z.string(),
  description: z.string().optional(),
  category: z.string().optional(),
  attributes: z.array(z.object({ name: z.string() }).passthrough()).optional(),
  slots: z.array(z.object({ name: z.string() }).passthrough()).optional(),
  events: z.array(z.object({ name: z.string() }).passthrough()).optional(),
  methods: z.array(z.object({ name: z.string() }).passthrough()).optional(),
  templates: z.array(z.string()).optional(),
  sources: z.record(z.string()).optional(),
}).passthrough(),

// In the handler, change the return to:
return {
  content: [{ type: "text", text: JSON.stringify(result, null, 2) }],
  structuredContent: result,
};
```

#### `list_components`

```js
outputSchema: z.object({
  components: z.array(z.object({
    tagName: z.string(),
    description: z.string().optional(),
    category: z.string().optional(),
    attributes: z.number(),
    slots: z.number(),
    events: z.number(),
  })),
}),

// Wrap the list array in an object before returning:
const output = { components: list };
return {
  content: [{ type: "text", text: JSON.stringify(output, null, 2) }],
  structuredContent: output,
};
```

#### `search_api`

```js
outputSchema: z.object({
  query: z.string(),
  facet: z.string(),
  total: z.number(),
  results: z.array(z.object({
    component: z.string(),
    facet: z.string(),
    name: z.string(),
    type: z.string().optional(),
    description: z.string().optional(),
  })),
}),

// Build a structured output object and return both:
const structured = { query, facet, total: results.length, results };
return {
  content: [{ type: "text", text: formattedText }],
  structuredContent: structured,
};
```

#### `browse_tokens`

```js
outputSchema: z.object({
  query: z.string(),
  total: z.number(),
  grouped: z.record(z.array(z.string())),
}),

// Return structured alongside existing text:
const structured = { query, total: matches.length, grouped };
return {
  content: [{ type: "text", text: formattedText }],
  structuredContent: structured,
};
```

#### `list_token_groups`

```js
outputSchema: z.object({
  groups: z.record(z.object({
    count: z.number(),
    tokens: z.array(z.string()),
  })),
}),
```

#### `validate_usage`

```js
outputSchema: z.object({
  valid: z.boolean(),
  issueCount: z.number(),
  issues: z.array(z.object({
    severity: z.enum(["ERROR", "WARNING", "INFO"]),
    message: z.string(),
  })),
}),
```

#### `list_patterns`

```js
outputSchema: z.object({
  patterns: z.array(z.object({
    id: z.string(),
    name: z.string(),
    category: z.string(),
    description: z.string().optional(),
    available: z.boolean(),
  })),
}),
```

#### `list_utilities`

```js
outputSchema: z.object({
  utilities: z.array(z.object({
    id: z.string(),
    kind: z.enum(["file", "folder"]),
    summary: z.string().optional(),
  })),
}),
```

#### `list_css_utilities`

```js
outputSchema: z.object({
  utilities: z.array(z.object({
    className: z.string(),
    description: z.string().optional(),
    attributes: z.array(z.string()),
    cssProperties: z.array(z.string()),
  })),
}),
```

#### `get_css_utility`

```js
outputSchema: z.object({
  className: z.string(),
  description: z.string().optional(),
  attributes: z.array(z.object({ name: z.string() }).passthrough()).optional(),
  cssProperties: z.array(z.object({ name: z.string() }).passthrough()).optional(),
}).passthrough(),
```

#### `list_component_examples`

```js
outputSchema: z.object({
  components: z.array(z.object({
    tagName: z.string(),
    exampleLabels: z.array(z.string()),
  })),
}),
```

#### `get_component_examples`

```js
outputSchema: z.object({
  tagName: z.string(),
  examples: z.array(z.object({
    id: z.string(),
    label: z.string(),
    description: z.string().optional(),
    layout: z.string().optional(),
  }).passthrough()),
}),
```

### Pattern for adding structuredContent

In every handler listed above, find where `content` is returned and add `structuredContent`:

```js
// Before:
return {
  content: [{ type: "text", text: JSON.stringify(someObject, null, 2) }],
};

// After:
return {
  content: [{ type: "text", text: JSON.stringify(someObject, null, 2) }],
  structuredContent: someObject,
};
```

For tools that currently build a formatted text string AND have structured data (e.g.
`browse_tokens`, `search_api`), keep the formatted text in `content` and put the raw
data object in `structuredContent`.

### Verification

```bash
grep -c "structuredContent" mcp-server/index.js
# Should be ≥ 12 (one per structured tool)

grep -c "outputSchema" mcp-server/index.js
# Should be ≥ 12
```

---

## Task 3 — Migrate to TypeScript

The server is currently a single 1700+ line JavaScript file. This task converts it to TypeScript
with proper types and splits it into modules.

### Target file structure

```
mcp-server/
├── package.json          (new — MCP server has its own build)
├── tsconfig.json         (new)
├── index.ts              (entry point — replaces index.js)
├── data.ts               (data loading: loadSchemas, loadTokens, loadPatterns, etc.)
├── types.ts              (TypeScript interfaces for ComponentSchema, Token, Pattern, etc.)
├── tools/
│   ├── components.ts     (query_component, list_components, generate_component,
│   │                      get_component_source, get_component_examples,
│   │                      list_component_examples, validate_usage)
│   ├── tokens.ts         (browse_tokens, list_token_groups)
│   ├── patterns.ts       (list_patterns, get_pattern, compose_view)
│   ├── flows.ts          (generate_flow)
│   ├── search.ts         (search_api)
│   └── utilities.ts      (list_utilities, get_utility, list_css_utilities,
│                          get_css_utility, get_architecture)
└── resources.ts          (all resource and prompt registrations)
```

### Step-by-step

#### 3a. Add a `mcp-server/package.json`

The mcp-server needs its own build so it doesn't conflict with the main repo's TypeScript config.

```json
{
  "name": "sherpa-ui-mcp-server",
  "version": "1.0.0",
  "description": "MCP server for Sherpa UI component library",
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "build": "tsc",
    "dev": "tsx watch index.ts",
    "start": "node dist/index.js"
  },
  "engines": { "node": ">=18" },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.27.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/node": "^22.10.0",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
```

Also update the root `package.json` to point the `mcp` script at the compiled output:

```json
"mcp": "node mcp-server/dist/index.js"
```

And add a build step:

```json
"build:mcp": "cd mcp-server && npm install && npm run build"
```

#### 3b. Add `mcp-server/tsconfig.json`

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "lib": ["ES2022"],
    "outDir": "./dist",
    "rootDir": "./",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "declaration": true,
    "sourceMap": true
  },
  "include": ["*.ts", "tools/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

#### 3c. Create `mcp-server/types.ts`

Define interfaces for all data structures the server uses. Extract these from the current
runtime shapes in `index.js`. Key types to define:

```typescript
export interface AttributeDef {
  name: string;
  type?: string;
  default?: string;
  description?: string;
  values?: string[];
}

export interface SlotDef {
  name?: string;
  description?: string;
}

export interface EventDef {
  name: string;
  description?: string;
  detail?: unknown;
}

export interface MethodDef {
  name: string;
  description?: string;
  signature?: string;
}

export interface ComponentSchema {
  tagName: string;
  description?: string;
  category?: string;
  group?: string;
  attributes: AttributeDef[];
  slots: SlotDef[];
  events: EventDef[];
  methods?: MethodDef[];
  properties?: unknown[];
  cssParts?: unknown[];
  cssProperties?: unknown[];
}

export interface Token {
  name: string;
  file: string;
}

export interface UtilityDef {
  id: string;
  kind: "file" | "folder";
  files: {
    js?: string;
    css?: string;
    html?: string;
  };
  summary?: string;
}

export interface PatternEntry {
  id: string;
  name: string;
  category: string;
  description?: string;
  file: string;
  available?: boolean;
}

export interface CssUtilitySchema {
  className: string;
  description?: string;
  attributes?: AttributeDef[];
  cssProperties?: AttributeDef[];
}

export interface ServerData {
  schemas: Map<string, ComponentSchema>;
  tokens: Token[];
  patterns: PatternEntry[];
  utilities: Map<string, UtilityDef>;
  cssUtilities: Map<string, CssUtilitySchema>;
}
```

#### 3d. Create `mcp-server/data.ts`

Move all data-loading functions out of `index.js` into this file:
- `loadSchemas()` → returns `Map<string, ComponentSchema>`
- `loadTokens()` → returns `Token[]`
- `loadPatterns()` → returns `PatternEntry[]`
- `loadUtilities()` → returns `Map<string, UtilityDef>`
- `loadCssUtilities()` → returns `Map<string, CssUtilitySchema>`

Export a single `loadServerData(): ServerData` function that calls all of them
and returns the combined result. This is called once at server startup.

#### 3e. Split tools into modules under `mcp-server/tools/`

Each tools file should:
- Import `McpServer` from the SDK and the `ServerData` type from `../types.js`
- Export a single `register<Domain>Tools(server: McpServer, data: ServerData): void` function
- Move the relevant `server.registerTool(...)` calls into that function
- Add proper TypeScript types to all parameters and return values (no `any`)
- Import `z` from `zod` locally

Example structure for `tools/components.ts`:

```typescript
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { ServerData } from "../types.js";

export function registerComponentTools(server: McpServer, data: ServerData): void {
  server.registerTool(
    "query_component",
    {
      title: "Query Component",
      description: "...",
      inputSchema: { tagName: z.string().describe("...") },
      annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false },
      outputSchema: z.object({ ... }),
    },
    async ({ tagName }) => {
      // ... handler body
    }
  );
  // ... other component tools
}
```

#### 3f. Create `mcp-server/resources.ts`

Move all `server.registerResource(...)` and `server.registerPrompt(...)` calls into:

```typescript
export function registerResources(server: McpServer, data: ServerData): void { ... }
export function registerPrompts(server: McpServer, data: ServerData): void { ... }
```

#### 3g. Create `mcp-server/index.ts`

The new entry point wires everything together:

```typescript
#!/usr/bin/env node
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { loadServerData } from "./data.js";
import { registerComponentTools } from "./tools/components.js";
import { registerTokenTools } from "./tools/tokens.js";
import { registerPatternTools } from "./tools/patterns.js";
import { registerFlowTools } from "./tools/flows.js";
import { registerSearchTools } from "./tools/search.js";
import { registerUtilityTools } from "./tools/utilities.js";
import { registerResources, registerPrompts } from "./resources.js";

const server = new McpServer({ name: "sherpa-ui-mcp-server", version: "1.0.0" });
const data = loadServerData();

registerComponentTools(server, data);
registerTokenTools(server, data);
registerPatternTools(server, data);
registerFlowTools(server, data);
registerSearchTools(server, data);
registerUtilityTools(server, data);
registerResources(server, data);
registerPrompts(server, data);

const transport = new StdioServerTransport();
await server.connect(transport);
```

#### 3h. TypeScript rules to follow throughout

- Enable `strict: true` — no exceptions
- No `any` — use `unknown` then narrow, or define a proper interface
- All function parameters and return types must be explicit
- Use `z.infer<typeof Schema>` to derive handler parameter types from Zod schemas
- Use optional chaining (`?.`) and nullish coalescing (`??`) instead of falsy checks
- Use `unknown` + `instanceof Error` guards in catch blocks

#### 3i. Build and verify

```bash
cd mcp-server
npm install
npm run build
# Must complete with 0 errors

node dist/index.js
# Should start without output (stdio server waits silently)
```

Also update `.gitignore` at the repo root to include `mcp-server/dist/`.

---

## Task 4 — Create evaluations

Evaluations verify that an AI agent can use the MCP server to answer realistic questions.
They must be created by **actually calling the tools** to find real answers — do not guess.

### What to do

1. Connect to the MCP server (or load the server data directly in a script) and use
   read-only tools to explore the library.
2. Generate 10 questions that require multiple tool calls and have a single, stable,
   verifiable answer.
3. Verify each answer yourself before writing it into the XML.
4. Save the result to `mcp-server/eval/questions.xml`.

### Requirements for each question

- **Independent**: Does not depend on another question's answer
- **Read-only**: Only uses non-destructive tools (`query_component`, `search_api`, etc.)
- **Multi-step**: Requires at least 2 tool calls to answer
- **Realistic**: Something a developer using Sherpa UI would actually want to know
- **Verifiable**: Single, unambiguous string answer (a number, a tag name, an attribute name, etc.)
- **Stable**: The answer won't change unless the component library itself changes

### Good question types

- "Which component has an attribute named X?" → `search_api` + `query_component`
- "How many components are in category Y?" → `list_components`
- "What is the default value of attribute Z on component W?" → `query_component`
- "Which token group has the most tokens?" → `list_token_groups` + `browse_tokens`
- "What event does component X emit when Y happens?" → `query_component`
- "Which pattern uses both sherpa-nav and sherpa-data-grid?" → `get_pattern` for each
- "How many slots does sherpa-dialog have?" → `query_component`

### Output format

```xml
<evaluation>
  <qa_pair>
    <question>Which Sherpa UI component attribute controls the number of items shown per page in sherpa-data-grid?</question>
    <answer>data-page-size</answer>
  </qa_pair>
  <!-- 9 more qa_pairs -->
</evaluation>
```

Save to: `mcp-server/eval/questions.xml`

### Running evaluations (future)

Once questions exist, an eval runner can be built as `mcp-server/eval/run-eval.ts` that:
1. Starts the MCP server as a subprocess
2. Connects a client
3. Gives each question to an agent with access to the server
4. Checks the agent's final answer against the expected string
5. Reports pass/fail per question

---

## After all tasks are complete

1. Update `mcp-server/README.md` to reflect the new TypeScript build step (`npm run build:mcp`)
   and the location of the compiled entry point (`mcp-server/dist/index.js`).
2. Update any AI client config examples in the README to point at `dist/index.js`.
3. Run the full build to confirm nothing is broken: `npm run build && npm run build:mcp`.
