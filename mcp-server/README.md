# Sherpa UI MCP Server

An [MCP](https://modelcontextprotocol.io/) server that exposes the Sherpa UI
component library API to AI agents. It lets agents query component schemas,
generate valid HTML, browse design tokens, and validate usage — all over the
standard **stdio** transport.

## Quick Start

```bash
# From the repo root
npm run mcp
```

Or invoke via the `bin` entry:

```bash
npx sherpa-mcp
```

## Capabilities

### Tools

| Tool                 | Description                                                                 |
| -------------------- | --------------------------------------------------------------------------- |
| `query_component`    | Returns full JSON API for a component (attributes, slots, events, methods)  |
| `list_components`    | Lists all 53 components, with optional category filter                      |
| `generate_component` | Generates valid HTML for a component with given attributes and slot content  |
| `browse_tokens`      | Searches `--sherpa-*` design tokens by keyword                              |
| `validate_usage`     | Checks HTML for common mistakes: unknown tags, missing `data-*`, self-close |

### Resources (59 total)

**6 Guideline documents** — served as `text/markdown`:

| URI                                        | Content                   |
| ------------------------------------------ | ------------------------- |
| `sherpa://guidelines/component-guidelines`  | Component Guidelines      |
| `sherpa://guidelines/api-standard`          | Component API Standard    |
| `sherpa://guidelines/component-template`    | Component Template        |
| `sherpa://guidelines/token-usage`           | Design Token Usage Guide  |
| `sherpa://guidelines/text-styles`           | Text Styles Reference     |
| `sherpa://guidelines/copilot-instructions`  | Copilot Instructions      |

**53 Component schemas** — served as `application/json` via a resource template:

```
sherpa://schema/{tagName}       e.g. sherpa://schema/sherpa-button
```

### Prompts

| Prompt      | Description                                                  |
| ----------- | ------------------------------------------------------------ |
| `build_ui`  | Guided prompt for building a UI layout with Sherpa components |

Arguments: `description` (required), `components` (optional comma-separated list).

## Client Configuration

### VS Code (Copilot / Continue)

Add to `.vscode/mcp.json` in your project:

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

### Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`:

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

### Cursor

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

## Component Categories

| Category         | Count | Examples                                           |
| ---------------- | ----- | -------------------------------------------------- |
| `core`           | 6     | sherpa-button, sherpa-tag, sherpa-loader             |
| `layout`         | 5     | sherpa-card, sherpa-panel, sherpa-container-pdf      |
| `navigation`     | 7     | sherpa-nav, sherpa-tabs, sherpa-breadcrumbs          |
| `form`           | 11    | sherpa-input-text, sherpa-input-select, sherpa-switch|
| `data-display`   | 6     | sherpa-data-grid, sherpa-key-value-list              |
| `data-viz`       | 7     | sherpa-barchart, sherpa-donut-chart, sherpa-metric   |
| `feedback`       | 5     | sherpa-dialog, sherpa-toast, sherpa-callout           |
| `page-level`     | 6     | sherpa-view-header, sherpa-footer, sherpa-toolbar     |

## Regenerating Schemas

If component JSDoc headers change, regenerate the JSON schemas before
restarting the MCP server:

```bash
npm run schemas
```

Or as part of a full build:

```bash
npm run build
```

## Architecture

```
mcp-server/
  index.js          ← Server entry point (stdio transport)
schemas/
  component-schema.json   ← JSON Schema definition
  components/
    index.json            ← Array of all tag names
    sherpa-button.json    ← Per-component API schema
    ...
```

The server reads schemas and tokens at startup, then serves them through MCP
tools, resources, and prompts. No network requests are made — everything is
read from the local filesystem.
