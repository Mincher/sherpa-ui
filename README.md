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
- **Design tokens** — sourced from Figma exports, processed via `npm run tokens:process`

## Data-Viz Components

`sherpa-base-table`, `sherpa-barchart`, `sherpa-metric`, and `sherpa-data-grid` accept data via pluggable providers:

```js
import { SherpaTable } from "sherpa-ui/components/sherpa-base-table/sherpa-base-table.js";
import { SherpaDataGrid } from "sherpa-ui/components/sherpa-data-grid/sherpa-data-grid.js";

// Register your data provider before components render
SherpaTable.setDataProvider(async (config) => {
  // Return { name, columns, rows, summary, config, metadata }
});

SherpaTable.setDateFieldProvider((datasetName) => {
  // Return the date field name for chronological sorting, or null
});

SherpaDataGrid.setDataProvider(async (config) => {
  // Same signature as SherpaTable provider
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
| `containercolumnsready` | `sherpa-filter-bar`  | `{ columns, rows }`             |
| `containerexport`       | `sherpa-menu-item`   | `{ value }` (bubbles from menu) |
| `viewexport`            | `sherpa-view-header` | `{ title }`                     |

## Scripts

```bash
npm run build            # Process tokens + generate API docs
npm run tokens:process   # Process Figma token exports
npm run docs             # Generate COMPONENT-API.md
```
