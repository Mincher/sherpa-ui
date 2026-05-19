# sherpa-code-block

Syntax-highlighted, copyable code display component. Uses [Prism.js](https://prismjs.com/) (v1.29+) for syntax highlighting with support for 50+ languages. Automatically detects language from content, displays line numbers (optional), and provides copy-to-clipboard functionality.

## Features

- **Syntax highlighting** for HTML, CSS, JavaScript, TypeScript, JSX, JSON, YAML, Python, Go, Rust, SQL, and more
- **Auto-language detection** from content inspection
- **Line numbers** with optional starting line
- **Dark mode support** via `data-theme` attribute or automatic detection
- **Copy button** with toast feedback
- **Responsive** and mobile-friendly
- **Accessible** with ARIA labels and screen reader support

## Basic Usage

### Simple Code Display
```html
<sherpa-code-block>
  const greeting = "Hello, Sherpa!";
  console.log(greeting);
</sherpa-code-block>
```

### With Explicit Language
```html
<sherpa-code-block data-language="javascript">
  const greeting = "Hello, Sherpa!";
  console.log(greeting);
</sherpa-code-block>
```

### With Line Numbers
```html
<sherpa-code-block data-language="json" data-line-numbers>
  {
    "name": "Sherpa UI",
    "version": "2.0.0",
    "license": "MIT"
  }
</sherpa-code-block>
```

### With Max Height (Scrollable)
```html
<sherpa-code-block 
  data-language="python"
  data-max-height="300px">
  def fibonacci(n):
      if n <= 1:
          return n
      return fibonacci(n - 1) + fibonacci(n - 2)
</sherpa-code-block>
```

### Custom Copy Message
```html
<sherpa-code-block 
  data-language="bash"
  data-copy-button-label="Copy command"
  data-copy-toast-message="Command copied!">
  npm install @sherpa-ui/components
</sherpa-code-block>
```

## Attributes

| Attribute | Type | Default | Description |
|-----------|------|---------|-------------|
| `data-language` | enum | `"auto"` | Language: `auto`, `html`, `css`, `js`, `jsx`, `tsx`, `json`, `yaml`, `bash`, `python`, `java`, `go`, `rust`, `sql`, etc. |
| `data-line-numbers` | flag | — | Show line numbers on the left |
| `data-line-start` | number | `1` | Starting line number for snippets |
| `data-max-height` | string | — | Max height before scrollable (e.g., `"300px"`) |
| `data-copy-button-label` | string | `"Copy code"` | Copy button text/aria-label |
| `data-copy-toast-message` | string | `"Copied to clipboard!"` | Success message shown in toast |
| `data-theme` | enum | `"auto"` | `"light"`, `"dark"`, or `"auto"` (inherits from page) |
| `data-supported-languages` | string | — | Read-only: comma-separated list of supported languages |
| `data-highlight-error` | string | — | Read-only: error message if highlighting failed |

## CSS Parts

Use `::part()` for custom styling:

```css
sherpa-code-block::part(header) { /* Header container */ }
sherpa-code-block::part(language-label) { /* Language identifier */ }
sherpa-code-block::part(copy-button) { /* Copy button */ }
sherpa-code-block::part(pre) { /* Pre wrapper */ }
sherpa-code-block::part(code) { /* Code element */ }
```

### Example: Custom Styling
```css
sherpa-code-block::part(header) {
  background: #f0f0f0;
  padding: 8px 12px;
  border-radius: 4px 4px 0 0;
}

sherpa-code-block::part(pre) {
  max-height: 400px;
  border-radius: 0 0 4px 4px;
}
```

## JavaScript API

### Properties

```javascript
// Supported languages (read-only)
block.supportedLanguages;
// → "html,css,js,javascript,jsx,tsx,json,yaml,bash,..."

// Error message if highlighting failed (read-only)
block.highlightError;
// → null or error message string

// Detected language after rendering (read-only)
block.detectedLanguage;
// → "javascript"
```

### Methods

```javascript
// Manually highlight code with specific language
await block.highlightCode('const x = 1;', 'javascript');

// Reload Prism.js from CDN if it failed
await block.reloadHighlighter();
```

### Events

#### `code-copied`
Fired when code is successfully copied to clipboard:
```javascript
block.addEventListener('code-copied', (e) => {
  console.log(`Copied ${e.detail.codeLength} chars of ${e.detail.language}`);
  // detail: { language, codeLength, success, timestamp, highlightLoaded }
});
```

#### `code-highlight-error`
Fired if Prism.js fails to load or highlighting fails:
```javascript
block.addEventListener('code-highlight-error', (e) => {
  console.error(`Highlighting failed: ${e.detail.error}`);
  // detail: { language, error, fallbackToPlaintext }
});
```

#### `code-language-detected`
Fired when auto-detection completes:
```javascript
block.addEventListener('code-language-detected', (e) => {
  if (e.detail.confidence < 0.7) {
    console.warn(`Low confidence detection: ${e.detail.detected}`);
  }
  // detail: { detected, requested, confidence }
});
```

## Examples

### Auto-Detect Language
```html
<sherpa-code-block>
  function sayHello(name) {
    return `Hello, ${name}!`;
  }
</sherpa-code-block>
```

### HTML with Line Numbers
```html
<sherpa-code-block data-language="html" data-line-numbers>
  <div class="container">
    <h1>Welcome</h1>
    <p>This is a paragraph.</p>
  </div>
</sherpa-code-block>
```

### JSON Configuration
```html
<sherpa-code-block 
  data-language="json" 
  data-max-height="250px"
  data-line-numbers>
  {
    "apiVersion": "v1",
    "kind": "Pod",
    "metadata": {
      "name": "example-pod"
    }
  }
</sherpa-code-block>
```

### Programmatic Usage
```javascript
const block = document.querySelector('sherpa-code-block');

// Listen for events
block.addEventListener('code-copied', (e) => {
  console.log(`${e.detail.codeLength} chars copied in ${e.detail.language}`);
});

// Re-highlight with different language
await block.highlightCode(codeString, 'python');

// Check if highlighting loaded successfully
if (block.highlightError) {
  console.warn('Highlighting unavailable:', block.highlightError);
}
```

## Accessibility

- **Role:** `region` for screen reader announcement
- **ARIA Labels:** Automatically labeled; override with `aria-label` if needed
- **Keyboard:** Copy button is keyboard-accessible
- **High Contrast:** Respects `prefers-contrast` via theme system
- **Language Detection:** Announced to screen readers

## Browser Support

- Chrome 99+
- Firefox 97+
- Safari 15.4+
- Edge 99+

Prism.js is loaded from CDN (cdnjs.cloudflare.com). If CDN is unavailable, code displays unstyled but readable.

## Installation

```bash
npm install @sherpa-ui/components
```

```javascript
import { SherpaCodeBlock } from '@sherpa-ui/components';
```

## Related

- [Prism.js Documentation](https://prismjs.com/)
- [Sherpa UI Tokens](../../css/TOKENS-USAGE-GUIDE.md)
