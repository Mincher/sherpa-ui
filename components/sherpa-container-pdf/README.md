# sherpa-container-pdf

> **Category:** page-level · **Base class:** SherpaElement

Print-optimized container renderer for PDF export via browser print.

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
<sherpa-container-pdf></sherpa-container-pdf>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-container-pdf/sherpa-container-pdf.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-container-pdf.js`](sherpa-container-pdf.js) | Component class, lifecycle, events |
| [`sherpa-container-pdf.css`](sherpa-container-pdf.css) | Styles, variants, states |
