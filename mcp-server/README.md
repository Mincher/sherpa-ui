# Sherpa UI — MCP Server Guide

The Sherpa UI MCP server gives AI coding assistants (GitHub Copilot, Claude,
Cursor, etc.) direct access to the full component library — every attribute,
slot, event, design token, and usage rule. Instead of the AI guessing how your
components work, it queries the server and gets the real API.

---

## Table of Contents

1. [Setup](#1-setup)
2. [What the Server Provides](#2-what-the-server-provides)
3. [Tools Reference](#3-tools-reference)
4. [Resources & Prompts](#4-resources--prompts)
5. [Walkthrough: Building a Dashboard](#5-walkthrough-building-a-dashboard)
6. [Component Categories](#6-component-categories)
7. [Keeping Schemas Up to Date](#7-keeping-schemas-up-to-date)
8. [Architecture](#8-architecture)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Setup

### Prerequisites

- Node.js 18+
- The `sherpa-ui` repository (or `sherpa-ui` installed as a dependency)

### Running manually

```bash
npm run mcp
```

You won't see any output — the server communicates over **stdio** (standard
input/output), not HTTP. It's designed to be launched by an AI client, not
used in a browser.

### Connecting to VS Code (GitHub Copilot)

Create (or add to) `.vscode/mcp.json` in your project:

```json
{
  "servers": {
    "sherpa-ui": {
      "type": "stdio",
      "command": "node",
      "args": ["./node_modules/sherpa-ui/mcp-server/index.js"]
    }
  }
}
```

> If sherpa-ui is a local checkout rather than an npm dependency, point `args`
> to the absolute path of `mcp-server/index.js`.

VS Code will start the server automatically when Copilot needs it.

### Connecting to Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "sherpa-ui": {
      "command": "node",
      "args": ["/absolute/path/to/sherpa-ui/mcp-server/index.js"]
    }
  }
}
```

Restart Claude Desktop after saving.

### Connecting to Cursor

Add to `.cursor/mcp.json` in your project:

```json
{
  "mcpServers": {
    "sherpa-ui": {
      "command": "node",
      "args": ["./node_modules/sherpa-ui/mcp-server/index.js"]
    }
  }
}
```

---

## 2. What the Server Provides

| Capability     | Count | What it gives the AI                                      |
| -------------- | ----- | --------------------------------------------------------- |
| **Tools**      | 23    | Query, generate, validate, search, token resolution, component suggestions, flows |
| **Resources**  | 250+  | Schemas, HTML templates, CSS, JS, READMEs, utilities, patterns, guidelines |
| **Prompts**    | 4     | build_ui, review_component_usage, create_component, debug_component |

The AI uses these automatically — you just ask it to build something with
Sherpa components and it pulls in what it needs.

---

## 3. Tools Reference

### `query_component` — Look up a component's API

Returns the full schema for a single component: every attribute (with type,
default, and allowed values), every slot, every event (with detail shape),
methods, CSS custom properties, and available HTML template variants.

**Input:**
```json
{ "tagName": "sherpa-button" }
```

**Use when:** You want the AI to understand exactly how a specific component
works before writing code that uses it.

---

### `list_components` — Browse the library

Returns a summary of all 53 components, or filters by category. Each entry
includes the tag name, description, and counts of attributes/slots/events.

**Input:**
```json
{ "category": "form" }
```

Categories: `core`, `layout`, `navigation`, `form`, `data-display`,
`data-viz`, `feedback`, `page-level`. Omit `category` to list everything.

**Use when:** You want to see what's available before deciding which
components to use.

---

### `generate_component` — Create valid HTML

Generates standards-compliant HTML for a component with the attributes and
slot content you specify. Only includes attributes that exist in the schema.
Boolean attributes render without values. All values are sanitized.

You can optionally specify a `templateId` for components that have multiple
HTML template variants (e.g. sherpa-button has `default`, `icon`,
`button-menu`, `icon-menu`).

**Input:**
```json
{
  "tagName": "sherpa-button",
  "attributes": {
    "data-label": "Save Changes",
    "data-variant": "primary",
    "data-icon-start": "check"
  },
  "templateId": "icon"
}
```

**Output:**
```html
<sherpa-button data-label="Save Changes" data-variant="primary" data-icon-start="check"></sherpa-button>
```

You can also pass slot content:

```json
{
  "tagName": "sherpa-view-header",
  "attributes": { "data-title": "Dashboard" },
  "slots": {
    "actions": "<sherpa-button data-label='Export' data-variant='secondary'></sherpa-button>"
  }
}
```

**Output:**
```html
<sherpa-view-header data-title="Dashboard">
  <span slot="actions"><sherpa-button data-label='Export' data-variant='secondary'></sherpa-button></span>
</sherpa-view-header>
```

**Use when:** You want guaranteed-correct component markup without the AI
improvising attribute names.

---

### `browse_tokens` — Search design tokens

Searches all `--sherpa-*` CSS custom properties by keyword. Returns matches
grouped by source file.

**Input:**
```json
{ "query": "surface" }
```

**Output:**
```
Found 23 tokens matching "surface":

## css/styles/tokens-semantic.css
  --sherpa-surface-default
  --sherpa-surface-raised
  --sherpa-surface-sunken
  --sherpa-surface-control-primary-default
  ...
```

Good search terms: `surface`, `text`, `space`, `border`, `radius`, `color`,
`font`, `shadow`.

**Use when:** You need the AI to use the correct design tokens in any custom
CSS it writes, rather than hardcoding colours and spacing.

---

### `validate_usage` — Schema-aware audit of component HTML

Checks a block of HTML for issues:

- **Unknown components** — tags that don't exist in the library
- **Unknown attributes per component** — e.g. `<sherpa-callout data-label>`
  when the component actually observes `data-heading`. The check uses the
  generated schemas (including inherited attrs from base classes and mixins),
  so it catches the #1 cause of broken examples.
- **Self-closing custom elements** — `<sherpa-button/>` instead of
  `<sherpa-button></sherpa-button>`
- **Opacity-based disabled styling** — should use inactive tokens instead

**Input:**
```json
{
  "html": "<sherpa-callout data-label=\"Heads up\"></sherpa-callout>"
}
```

**Output:**
```
Found 1 issue(s):

ERROR: <sherpa-callout> uses unknown attribute "data-label" — not in component schema. Run query_component to see the real attribute surface.
```

**Use when:** You want to verify generated HTML before using it, or as a
quality gate after the AI writes component markup.

---

### `list_patterns` — Browse layout and UX patterns

Returns available view patterns (app shells, dashboard grids, detail views,
etc.), optionally filtered by category.

**Input:**
```json
{ "category": "layouts" }
```

Categories: `layouts`, `feedback`, `flows`. Omit `category` to list everything.

**Use when:** You want the AI to understand what standard layouts exist before
composing a view from scratch.

---

### `get_pattern` — Get a pattern's HTML

Returns the full HTML source for a specific pattern, including template
markup, comment documentation, and component composition.

**Input:**
```json
{ "patternId": "dashboard-grid" }
```

**Use when:** You want the AI to use a proven layout pattern as a starting
point rather than inventing structure from scratch.

---

### `compose_view` — Compose a complete view

Combines a layout pattern with component API references into annotated HTML.
The AI gets the layout pattern's HTML plus inline API documentation for the
components it uses, making it easy to customise the pattern.

**Input:**
```json
{
  "layoutPattern": "app-shell",
  "components": ["sherpa-nav", "sherpa-view-header", "sherpa-filter-bar"],
  "description": "Admin dashboard with navigation and global filters"
}
```

**Use when:** You want the AI to build a complete page view starting from a
layout pattern, with all relevant component APIs at hand.

---

### `generate_flow` — Generate a CRUD flow

Generates a complete add, edit, or delete flow for a given entity. Returns
trigger button + dialog + form fields (or confirmation callout) + toast
feedback comments. All flow events use `bubbles: true, composed: true`.

**Input:**
```json
{
  "flowType": "add",
  "entityName": "device",
  "fields": [
    { "name": "hostname", "label": "Hostname", "required": true },
    { "name": "ip_address", "label": "IP Address" },
    { "name": "location", "label": "Location", "type": "select" }
  ]
}
```

**Output:** Complete HTML with trigger button, dialog containing the
specified form fields, cancel/save buttons, and toast feedback comments.

For delete flows, the dialog uses a `sherpa-callout` warning instead of
form fields. The `fields` parameter is ignored for delete.

**Use when:** You want the AI to generate a standards-compliant CRUD flow
with correct event conventions, rather than improvising the structure.

---

### `get_component_source` — Read the canonical source

Returns the raw HTML template, CSS, JS, examples file, or README for a
component. Use this when the JSON schema isn't enough — for example, when you
need to see the actual internal class names, CSS custom properties, lifecycle
hooks, or how the component handles a specific edge case.

**Input:**
```json
{ "tagName": "sherpa-button", "kind": "css" }
```

`kind`: `html` | `css` | `js` | `examples` | `readme`

**Use when:** The agent needs deep knowledge of a component's implementation,
not just its public API.

---

### `get_component_examples` — Get canonical, schema-true examples

Returns the structured examples from a component's `.examples.html` file —
the same blocks rendered on the docs site. Each entry has `{ id, label,
description, layout, preview, setup }`. **Every example is guaranteed to use
the real, current API**, so this is the safest source for building new docs
or copy-pasteable snippets.

**Input:**
```json
{ "tagName": "sherpa-button" }
```

Optional `format`: `json` (default — parsed entries) or `raw` (full file).

**Use this before `generate_component`** when you want to follow an existing
authoring pattern rather than synthesise one from scratch.

---

### `list_component_examples` — Discover what's already documented

Lists every component that ships with a `.examples.html` file, including the
labels of each example block. Use as a starting point when planning new docs
or finding prior art.

---

### `search_api` — Find which component does X

Search every component schema in one shot for matching attributes, events,
slots, methods, properties, CSS parts, or CSS custom properties. Useful when
you know *what* you need (e.g. an event called `selection-change`) but not
*which* component emits it.

**Input:**
```json
{ "query": "selection-change", "facet": "events" }
```

`facet`: `all` (default) | `attributes` | `events` | `slots` | `methods` | `properties` | `cssParts` | `cssProperties`

**Use when:** You need to discover capabilities across the library rather
than inspecting one component at a time.

---

### `list_token_groups` — Discover token namespaces

Lists every `--sherpa-*` token namespace (e.g. `surface`, `text`, `space`,
`border`) with counts. Use this for *discovery* before drilling in with
`browse_tokens`.

**Use when:** You don't yet know which token family applies to your styling
problem.

---

### `list_utilities` — List utility modules

Returns every utility under `components/utilities/` (FlowManager, FormManager,
ThemeManager, formatters, mixins, base classes) with a short JSDoc summary.

**Use when:** You're about to wire a flow, write a form helper, or extend a
base class and need to know what's already available.

---

### `get_utility` — Read a utility's source

Returns the source for a utility module by id (e.g. `flow-manager`,
`form-manager`, `sherpa-element`). Defaults to JS; pass `kind: "css"` or
`"html"` for utilities that have those files.

**Input:**
```json
{ "id": "flow-manager" }
```

**Use when:** You need to understand how a utility is structured before using
or extending it.

---

### `server_info` — Server health check

Returns the library version, counts of loaded schemas/tokens/patterns/utilities, startup time, and a list of all available tools and resources.

**Use when:** At the start of a session to confirm the server is running and check what data is loaded.

---

### `get_token_value` — Resolve a token's value

Follows a design token's alias chain to its concrete CSS value. Returns each step in the chain with the source file.

**Input:**
```json
{ "name": "--sherpa-surface-app-background-default" }
```

**Output:**
```
--sherpa-surface-app-background-default
  → var(--sherpa-color-neutral-0)  (sherpa-themes.css)
  ↳ var(--core-color-basic-monochrome-0)  (sherpa-alias.css)
Resolved: var(--core-color-basic-monochrome-0)
```

**Use when:** You need to understand what a token actually resolves to before using it in custom CSS.

---

### `suggest_components` — Semantic component recommendations

Scores every component against a plain-English description and returns the best matches with rationale and quick stats.

**Input:**
```json
{ "query": "filter a data table" }
```

**Output:** Ranked list of components with category, description, attribute counts, and a `query_component` follow-up call.

**Use when:** You're not sure which component to use and want a ranked recommendation before committing to one.

---

### `get_architecture` — Layered architecture rules

Returns the canonical architecture rules for the library: layer separation
(HTML / CSS / JS), the `SherpaElement` base class lifecycle, the `data-*`
attribute pattern, the cloning-template pattern, anti-patterns, and CRUD
flow composition. Sourced from `.github/copilot-instructions.md` — the
single canonical agent-guidance document for this repository.

**Use when:** Read this *once* at the start of any non-trivial task before
generating components, flows, or modifying existing code.

---

## 4. Resources & Prompts

### Resources

The AI can read these reference documents directly from the server:

| URI                                        | What it contains                               |
| ------------------------------------------ | ---------------------------------------------- |
| `sherpa://guidelines/copilot-instructions`  | Canonical agent guidance — full coding rules   |
| `sherpa://guidelines/api-standard`          | JSDoc format and attribute naming conventions  |
| `sherpa://guidelines/component-template`    | Starter template for new components            |
| `sherpa://guidelines/css-file-template`     | CSS file structure, section order, nesting rules |
| `sherpa://guidelines/token-usage`           | How to use design tokens correctly             |
| `sherpa://guidelines/text-styles`           | Typography scale and text utility classes      |
| `sherpa://schema/{tagName}`                 | JSON schema for any component                  |
| `sherpa://template/{tagName}`               | Raw HTML template for any component            |
| `sherpa://component/{tagName}/css`          | Raw CSS source for any component               |
| `sherpa://component/{tagName}/js`           | Raw JS source for any component                |
| `sherpa://component/{tagName}/examples`     | Structured examples for any component          |
| `sherpa://component/{tagName}/readme`       | Generated README for any component             |
| `sherpa://css-utility/{className}`          | JSON schema for a CSS utility class            |
| `sherpa://utility/{id}`                     | Source for a utility module (FlowManager etc.) |
| `sherpa://pattern/{patternId}`              | View layout or UX pattern HTML                 |

### Prompts

**`build_ui`** — A guided prompt that tells the AI to build a complete UI
layout using Sherpa components. It automatically injects component API
context and the library's rules.

| Argument        | Required | Description                                        |
| --------------- | -------- | -------------------------------------------------- |
| `description`   | Yes      | What you want built (plain English)                |
| `components`    | No       | Comma-separated list of components to focus on     |
| `layoutPattern` | No       | Layout pattern ID to use as starting point         |

**Example:** "Build a settings page with a form containing text inputs for
name and email, a password input, and save/cancel buttons."

---

**`review_component_usage`** — Audit existing HTML for correctness and anti-patterns. Injects the component schemas for all Sherpa tags found in the HTML, plus COMPONENT-API-STANDARD.md and CSS-FILE-TEMPLATE.md so CSS and TypeScript violations can be flagged too.

| Argument  | Required | Description                                    |
| --------- | -------- | ---------------------------------------------- |
| `html`    | Yes      | HTML to review                                 |
| `context` | No       | What the HTML is supposed to do                |

---

**`create_component`** — Scaffold a new Sherpa UI component following library conventions. Injects the full COMPONENT-TEMPLATE.md, COMPONENT-API-STANDARD.md, and CSS-FILE-TEMPLATE.md so the AI has the complete authoring contract.

| Argument      | Required | Description                        |
| ------------- | -------- | ---------------------------------- |
| `tagName`     | Yes      | Component tag name                 |
| `description` | Yes      | What the component does            |
| `category`    | No       | Category for the component         |
| `attributes`  | No       | Comma-separated attribute names    |

---

**`debug_component`** — Step-by-step diagnosis for a component that isn't working. Injects the full component schema, COMPONENT-API-STANDARD.md, CSS-FILE-TEMPLATE.md, and a structured diagnostic checklist covering attributes, slots, events, CSS imports, shadow DOM, and token usage.

| Argument  | Required | Description                               |
| --------- | -------- | ----------------------------------------- |
| `tagName` | Yes      | Component tag name                        |
| `issue`   | Yes      | What's wrong or not working               |
| `html`    | No       | The HTML being used                       |

---

## 5. Walkthrough: Building a Dashboard

Here's what happens behind the scenes when you ask an AI assistant to
"Build me a support ticket dashboard" with the Sherpa MCP server connected.

### Step 1 — The AI discovers what's available

It calls `list_components` with category `data-display` to find grid and
metric components, then `data-viz` for charts, and `page-level` for the
page header.

### Step 2 — It looks up the APIs it needs

It calls `query_component` for `sherpa-data-grid`, `sherpa-metric`,
`sherpa-view-header`, and `sherpa-filter-bar` to learn every attribute,
slot, and event.

### Step 3 — It generates the markup

Multiple `generate_component` calls produce validated HTML:

```html
<!-- Page header with an export button in the actions slot -->
<sherpa-view-header data-title="Support Dashboard">
  <span slot="actions">
    <sherpa-button data-label="Export" data-variant="secondary" data-icon-start="download"></sherpa-button>
  </span>
</sherpa-view-header>

<!-- Metric cards -->
<sherpa-metric data-label="Open Tickets" data-value="142" data-trend="up"></sherpa-metric>
<sherpa-metric data-label="Avg Response" data-value="4.2h" data-trend="down"></sherpa-metric>
<sherpa-metric data-label="Resolved Today" data-value="38"></sherpa-metric>

<!-- Filter bar and data grid -->
<sherpa-filter-bar data-label="Filter tickets"></sherpa-filter-bar>

<sherpa-data-grid
  data-label="Support Tickets"
  data-page-size="25"
  data-sortable
  data-filterable
  data-export>
</sherpa-data-grid>
```

### Step 4 — It finds the right tokens for any custom CSS

It calls `browse_tokens` with queries like `surface` and `space` to write
wrapper CSS using the real token names:

```css
.dashboard-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  background: var(--sherpa-surface-sunken, #f5f5f5);
  padding: var(--sherpa-space-lg, 24px);
  gap: var(--sherpa-space-md, 16px);
}
```

### Step 5 — It validates everything

A final `validate_usage` call confirms no unknown components, no bare
attributes, no self-closing tags.

### Step 6 — It writes the JavaScript

Using the event information from `query_component`, it wires up data
loading via the **dataset cascade** — the app shell dispatches
`datasetfiltered` events and each viz component aggregates locally.
No `setDataProvider()` registration is needed.

**The result:** A complete, standards-compliant dashboard — no guessed
attribute names, no wrong token values, no invalid HTML.

---

## 6. Component Categories

| Category       | Count | Examples                                            |
| -------------- | ----- | --------------------------------------------------- |
| `core`         | 6     | sherpa-button, sherpa-tag, sherpa-loader              |
| `layout`       | 4     | sherpa-container, sherpa-panel |
| `navigation`   | 7     | sherpa-nav, sherpa-tabs, sherpa-breadcrumbs           |
| `form`         | 11    | sherpa-input-text, sherpa-input-select, sherpa-switch |
| `data-display` | 6     | sherpa-data-grid, sherpa-key-value-list               |
| `data-viz`     | 7     | sherpa-barchart, sherpa-donut-chart, sherpa-metric    |
| `feedback`     | 5     | sherpa-dialog, sherpa-toast, sherpa-callout            |
| `page-level`   | 6     | sherpa-view-header, sherpa-container-footer, sherpa-toolbar      |

---

## 7. Keeping Schemas & Patterns Up to Date

The MCP server reads component schemas from `schemas/components/` and
pattern indexes from `patterns/index.json`. If you change a component's
JSDoc header or add/modify pattern HTML files, regenerate:

```bash
npm run schemas          # Rebuild JSON schemas only
npm run patterns         # Rebuild pattern index only
npm run build            # Full build: tokens + docs + schemas + patterns
```

Then restart the MCP server (or restart your AI client) so it picks up the
new data.

---

## 8. Architecture

```
sherpa-ui/
├── mcp-server/
│   ├── index.js              ← Entry point (stdio transport)
│   ├── server.js             ← Server factory: loads data, registers everything
│   ├── lib/
│   │   ├── loader.js         ← Data loading (schemas, tokens+values, patterns, utils)
│   │   ├── validation.js     ← HTML audit (unknown attrs, enum values, self-closing)
│   │   ├── generators.js     ← HTML/flow/pattern generation
│   │   ├── icons.js          ← Font Awesome icon→entity map
│   │   └── logger.js         ← stderr-only logger
│   ├── tools/
│   │   ├── component.js      ← query_component, list_components, generate_component
│   │   ├── examples.js       ← get_component_source/examples, list_component_examples
│   │   ├── tokens.js         ← browse_tokens, list_token_groups, get_token_value
│   │   ├── patterns.js       ← list/get/generate_pattern, compose_view, generate_flow
│   │   ├── utilities.js      ← list/get_utility, list/get_css_utility
│   │   ├── search.js         ← search_api (paginated), suggest_components
│   │   └── meta.js           ← server_info, validate_usage, get_architecture
│   ├── resources/
│   │   └── index.js          ← All sherpa:// resource registrations
│   └── prompts/
│       └── index.js          ← build_ui, review_component_usage, create_component, debug_component
├── schemas/
│   ├── component-schema.json ← JSON Schema definition
│   └── components/
│       ├── index.json        ← List of all component tag names
│       ├── sherpa-button.json
│       └── ...               ← One JSON file per component
├── patterns/
│   ├── index.json            ← Pattern catalog (generated)
│   ├── layouts/              ← View layout patterns (HTML)
│   ├── feedback/             ← Feedback/state patterns (HTML)
│   └── flows/                ← CRUD flow patterns (HTML + JSON)
├── components/               ← Component source (HTML templates served)
├── docs/                     ← Guidelines served as resources
├── css/styles/               ← Token CSS files scanned by browse_tokens (values captured)
└── .github/
    └── copilot-instructions.md
```

The server loads all schemas and scans all design tokens at startup. Every
tool call reads from this in-memory data — no network requests, no external
dependencies.

---

## 9. Troubleshooting

### "The MCP server isn't showing up in my AI client"

- Make sure Node.js 18+ is installed (`node --version`)
- Verify the path in your config file points to the correct `index.js`
- Restart the AI client after changing the config
- Check that `schemas/components/index.json` exists — run `npm run schemas`
  if it doesn't

### "The server starts but the AI can't find my component"

- The component may not have a JSON schema yet. Run `npm run schemas` to
  regenerate
- Check that the component's `.js` file has a `@element` JSDoc tag — the
  schema extractor looks for this

### "Attributes I added aren't appearing"

- Add `@attr {type} data-my-attr — Description` to the component's JSDoc
- Run `npm run schemas` to regenerate
- Restart the MCP server

### "Token search returns no results"

- Tokens are scanned from `css/styles/`. Make sure your token CSS files
  are there
- Try broader search terms: `surface`, `text`, `space`, `border`
- Core tokens (`--core-*`) are included in search results but
  components should use semantic tokens (`--sherpa-*`)
