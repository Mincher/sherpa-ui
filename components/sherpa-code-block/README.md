# sherpa-code-block

> **Category:** utility · **Base class:** SherpaElement

Syntax-highlighted, copyable code display with optional line numbers. Uses Prism.js (v1.29+) for syntax highlighting. Supports auto-language detection from content inspection. Emits code-copied event on clipboard success.

## Attributes

| Attribute | Type | Description | Default | Values |
| --------- | ---- | ----------- | ------- | ------ |
| `data-language` | enum | auto \| html \| css \| js \| jsx \| tsx \| json \| yaml \| bash \| python \| java \| go \| rust \| sql | — | `auto`, `html`, `css`, `js`, `jsx`, `tsx`, `json`, `yaml`, `bash`, `python`, `java`, `go`, `rust`, `sql` |
| `data-line-numbers` | boolean | Show line numbers (Prism plugin) | — | — |
| `data-line-start` | number | Starting line number for snippet context | `1` | — |
| `data-max-height` | string | Max height before scrollable (e.g., "300px") | — | — |
| `data-copy-button-label` | string | Button text (default: "Copy code") | — | — |
| `data-copy-toast-message` | string | Toast message (default: "Copied to clipboard!") | — | — |
| `data-theme` | enum | light \| dark \| auto (inherits from page mode) | `auto` | `light`, `dark`, `auto` |
| `data-supported-languages` | string | Read-only: comma-separated supported langs | — | — |
| `data-highlight-error` | string | Read-only: error message if highlighting failed | — | — |
| `data-src-html` | string |  | — | — |
| `data-src-json` | string |  | — | — |

## Events

### `code-copied`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("code-copied", (e) => {
  // handle event
});
```

### `code-highlight-error`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("code-highlight-error", (e) => {
  // handle event
});
```

### `code-language-detected`


**Propagation:** bubbles, composed

**Detail:** none

```js
element.addEventListener("code-language-detected", (e) => {
  // handle event
});
```

## Methods

| Method | Description |
| ------ | ----------- |
| `highlightCode(code, language)` |  |
| `reloadHighlighter()` |  |

### `highlightCode(code, language)`


**Parameters:**

- `code` (`any`) — 
- `language` (`any`) — 

## Properties

| Property | Type | Description | Access |
| -------- | ---- | ----------- | ------ |
| `supportedLanguages` | `string` | Read-only: comma-separated list of supported languages | read-only |
| `highlightError` | `string|null` | Read-only: error message if highlighting failed | read-only |
| `detectedLanguage` | `string|null` | Read-only: detected language after rendering | read-only |

## CSS Parts

Style internal elements from outside the shadow DOM:

- `header`
- `language-label`
- `copy-button`
- `pre`
- `code`

```css
sherpa-code-block::part(header) {
  /* custom styles */
}
```

## Internal CSS Custom Properties

These `--_` prefixed properties are used internally and can be
influenced by setting `data-*` attributes or status on ancestors:

- `--_hljs-attr`
- `--_hljs-bg`
- `--_hljs-comment`
- `--_hljs-keyword`
- `--_hljs-number`
- `--_hljs-string`
- `--_hljs-tag`
- `--_hljs-text`

## Usage

### Basic

```html
<sherpa-code-block data-language="auto" data-max-height="value" data-copy-button-label="value"></sherpa-code-block>
```

## Import

```js
// Individual import
import "sherpa-ui/components/sherpa-code-block/sherpa-code-block.js";

// Or import everything
import "sherpa-ui";
```

## Files

| File | Purpose |
| ---- | ------- |
| [`sherpa-code-block.js`](sherpa-code-block.js) | Component class, lifecycle, events |
| [`sherpa-code-block.css`](sherpa-code-block.css) | Styles, variants, states |
| [`sherpa-code-block.html`](sherpa-code-block.html) | Shadow DOM template(s) |
