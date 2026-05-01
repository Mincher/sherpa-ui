# sherpa-container-pdf-exporter

> **Category:** core · **Base class:** SherpaElement

Print-optimized renderer for PDF export via browser print.

## Methods

| Method | Description |
| ------ | ----------- |
| `setData(sourceContainer, options)` | Renders the source container |

### `setData(sourceContainer, options)`

Renders the source container

**Parameters:**

- `sourceContainer` (`any`) — 
- `options` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `includeChart` | `boolean` | Render chart visual (clone SVG/canvas from shadow DOM) | read/write |
| `includeMetrics` | `boolean` | Render metrics row | read/write |
| `includeDataGrid` | `boolean` | Include tabular data representation | read/write |

## Usage

### Basic

```html
<sherpa-container-pdf-exporter></sherpa-container-pdf-exporter>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-container-pdf-exporter/sherpa-container-pdf-exporter.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-container-pdf-exporter.js`](sherpa-container-pdf-exporter.js) | Component class, lifecycle, events |
| [`sherpa-container-pdf-exporter.css`](sherpa-container-pdf-exporter.css) | Styles, variants, states |
