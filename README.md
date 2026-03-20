# Sherpa UI

A standards-based Web Component library and design token system. No bundler required — pure ES modules served directly.

## Quick Start

```bash
npm install sherpa-ui
```

### JavaScript — import all components

```js
import "sherpa-ui";
```

### CSS — import design tokens + utility classes

```html
<link rel="stylesheet" href="node_modules/sherpa-ui/css/styles/reset.css" />
<link rel="stylesheet" href="node_modules/sherpa-ui/css/styles/index.css" />
```

Or with an import map:

```html
<script type="importmap">
  {
    "imports": {
      "sherpa-ui": "./node_modules/sherpa-ui/components/index.js",
      "sherpa-ui/": "./node_modules/sherpa-ui/"
    }
  }
</script>
```

## Entry Points

| Entry     | Path                   | Purpose                                                           |
| --------- | ---------------------- | ----------------------------------------------------------------- |
| **JS**    | `components/index.js`  | Barrel export — registers all custom elements                     |
| **CSS**   | `css/styles/index.css` | Tokens + utility classes (`@layer tokens, utilities, components`) |
| **Reset** | `css/styles/reset.css` | Minimal CSS reset                                                 |

## Architecture

- **No bundler** — native ES modules with `import.meta.url` for template/style resolution
- **Shadow DOM** — components encapsulate styles via `SherpaElement` base class
- **CSS Cascade Layers** — `reset → tokens → utilities → components → app`
- **Design tokens** — sourced from Figma Variables API, processed via `npm run tokens:generate`

## Data-Viz Components

`sherpa-data-grid`, `sherpa-barchart`, and `sherpa-metric` accept data via the **dataset cascade** pattern: the app shell loads a dataset, applies global filters, and dispatches a `datasetfiltered` event on the content area. Each viz component listens, aggregates locally, and renders.

```js
import {
  setDateFieldProvider,
} from "sherpa-ui/components/utilities/content-attributes-mixin.js";

// Register a date field provider for metric sparklines
setDateFieldProvider((datasetName) => {
  // Return the date field name for chronological sorting, or null
});
```

## Global Filters

Register a global filter provider so viz components seed their first data load
with any active global filters (timerange, value filters, etc.):

```js
import { setGlobalFilterProvider } from "sherpa-ui/components/utilities/global-filters.js";

setGlobalFilterProvider(() => ({
  filters: myFilterService.getFilters(),
  timerange: myFilterService.getTimerange(),
}));
```

Viz components using `ContentAttributesMixin` auto-load from their
`data-query-src` / `data-query-key` attributes on connect and automatically
include these global filters in the initial request.

## Events

Components dispatch these events (bubble + composed) for app-level integration:

| Event                   | Source               | Detail                          |
| ----------------------- | -------------------- | ------------------------------- |
| `containerfilterchange` | `sherpa-filter-bar`  | `{ filters }`                    |
| `globalfilterchange`    | `sherpa-filter-bar`  | `{ filters }` (on `document`)   |
| `containerexport`       | `sherpa-menu-item`   | `{ value }` (bubbles from menu) |
| `viewexport`            | `sherpa-view-header` | `{ title }`                     |

## MCP Server

Sherpa UI ships with an [MCP](https://modelcontextprotocol.io/) server that
exposes component APIs, design tokens, and usage validation to AI agents.

```bash
npm run mcp                # Start the MCP server (stdio transport)
```

Add to your VS Code `.vscode/mcp.json`:

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

5 tools (`query_component`, `list_components`, `generate_component`,
`browse_tokens`, `validate_usage`), 59 resources (6 guideline docs + 53
component schemas), and a `build_ui` prompt. See
[mcp-server/README.md](mcp-server/README.md) for full details.

## Scripts

```bash
npm run build              # Generate tokens + API docs + schemas
npm run tokens:extract     # Fetch variables from Figma REST API
npm run tokens:generate    # Generate CSS from figma-variables.json
npm run docs               # Generate COMPONENT-API.md
npm run schemas            # Generate component JSON schemas
npm run mcp                # Start the MCP server
```
