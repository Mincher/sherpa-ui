# Sherpa UI Playground

> **Interactive component explorer with live preview**  
> **Built entirely with Sherpa UI components** 🎨

---

## Features

✨ **Live Preview** — See components update in real-time as you edit  
🎨 **Attribute Controls** — Manipulate component attributes with UI controls  
📖 **API Documentation** — View complete API from component schemas  
🔗 **Shareable Links** — Share component examples via URL  
🌓 **Dark Mode** — Toggle dark mode for preview  
📋 **Copy Code** — One-click code copying  
🏗️ **Built with Sherpa UI** — Dogfooding our own component library!

---

## Architecture

The playground is **built entirely using Sherpa UI components**, demonstrating real-world usage:

### Components Used

- **`sherpa-layout-view`** — Main page layout
- **`sherpa-layout-grid`** — Three-column grid (sidebar, main, api)
- **`sherpa-container`** — Panels and sections
- **`sherpa-container-header`** — Panel headers
- **`sherpa-panel`** — Code editor and preview containers
- **`sherpa-toolbar`** — Top action buttons
- **`sherpa-button`** — All interactive buttons
- **`sherpa-empty-state`** — Placeholder states
- **`sherpa-tag`** — Status badge in header

This is a perfect example of **"eating our own dog food"** — the playground showcases the component library while being built with it!

---

## Usage

### Getting Started

1. **Open the playground:**
   ```
   Open playground/index.html in your browser
   ```

2. **Select a component** from the dropdown

3. **Edit the code** in the HTML Code pane (left)

4. **See live preview** in the Live Preview pane (right)

5. **View API docs** in the right sidebar

### Controls

**Component Selector** — Choose from 77+ components

**Attribute Controls** — Dynamically generated controls for each component:
- Text inputs for string attributes
- Checkboxes for boolean attributes
- Dropdowns for enum attributes
- Textareas for slot content

**Code Editor** — Edit HTML directly with syntax highlighting

**Preview** — Live rendering of your component code

**API Documentation** — Auto-generated from JSON schemas:
- Attributes
- Properties
- Events
- Slots

### Toolbar Actions

**Share** — Copy shareable link to clipboard  
**Reset** — Reset component to default state  
**Copy Code** — Copy HTML to clipboard  
**Dark Mode** — Toggle dark mode preview

---

## How It Works

### Component Architecture

```html
<sherpa-layout-view>
  <div slot="product-bar">
    <!-- Header with logo and sherpa-tag -->
  </div>

  <div slot="content">
    <sherpa-toolbar>
      <!-- sherpa-button actions -->
    </sherpa-toolbar>

    <sherpa-layout-grid data-columns="280px 1fr 320px">
      <!-- Left: Component selector -->
      <sherpa-container>
        <sherpa-container-header>Component</sherpa-container-header>
        <!-- Controls and selectors -->
      </sherpa-container>

      <!-- Center: Code + Preview -->
      <div>
        <sherpa-panel>
          <sherpa-container-header slot="header">HTML Code</sherpa-container-header>
          <textarea><!-- Code editor --></textarea>
        </sherpa-panel>
        <sherpa-panel>
          <sherpa-container-header slot="header">Live Preview</sherpa-container-header>
          <div><!-- Live component preview --></div>
        </sherpa-panel>
      </div>

      <!-- Right: API docs -->
      <sherpa-container>
        <sherpa-container-header>API Documentation</sherpa-container-header>
        <!-- Auto-generated API docs -->
      </sherpa-container>
    </sherpa-layout-grid>
  </div>
</sherpa-layout-view>
```

### Data Flow

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│  Component  │────▶│   Schema     │────▶│  Controls  │
│   Selector  │     │   Loader     │     │ Generator  │
└─────────────┘     └──────────────┘     └────────────┘
                            │
                            ▼
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│    Code     │◀───▶│    State     │────▶│  Preview   │
│   Editor    │     │   Manager    │     │  Renderer  │
└─────────────┘     └──────────────┘     └────────────┘
                            │
                            ▼
                    ┌──────────────┐
                    │     API      │
                    │     Docs     │
                    └──────────────┘
```

### Key Components

**`playground.js`** — Main application logic
- Schema loading
- Control generation
- State management
- Preview rendering
- URL state handling

**`playground.css`** — Multi-pane layout styling
- Three-column grid layout
- Responsive design
- Dark mode support

**`index.html`** — Playground UI structure
- Component selector
- Code editor pane
- Preview pane
- API documentation pane

---

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl/Cmd + C` | Copy code (when editor focused) |
| `Ctrl/Cmd + Enter` | Update preview |
| `Esc` | Clear selection |

---

## URL Parameters

Share component examples via URL:

```
?component=sherpa-button
?component=sherpa-button&code=<base64-encoded-html>
```

**Example:**
```
playground/index.html?component=sherpa-button&code=PHNoZXJwYS1idXR0b24+Q2xpY2sgTWU8L3NoZXJwYS1idXR0b24+
```

---

## Examples

### Basic Button

```html
<sherpa-button data-variant="primary">
  Click Me
</sherpa-button>
```

### Input with Label

```html
<sherpa-input-text 
  data-label="Username"
  data-placeholder="Enter username"
  data-required>
</sherpa-input-text>
```

### Calendar with Range

```html
<sherpa-calendar 
  data-mode="range"
  data-min="2026-05-01"
  data-max="2026-05-31">
</sherpa-calendar>
```

### Container with Slots

```html
<sherpa-container>
  <div slot="header">
    <h2>Header Content</h2>
  </div>
  <div>
    Main content goes here
  </div>
  <div slot="footer">
    <sherpa-button>Save</sherpa-button>
  </div>
</sherpa-container>
```

---

## Extending the Playground

### Adding Custom Features

1. **Custom Controls** — Add specialized controls in `createAttributeControl()`

2. **Code Snippets** — Add pre-built examples for each component

3. **Export Options** — Add JSFiddle, CodePen export

4. **Theme Switcher** — Add theme selection UI

### Integration Points

The playground can be embedded in:
- Component documentation pages
- README files (via iframe)
- Storybook alternatives
- Training materials

---

## Browser Support

- ✅ Chrome 90+
- ✅ Firefox 88+
- ✅ Safari 14+
- ✅ Edge 90+

**Requirements:**
- ES Modules support
- Shadow DOM support
- CSS Grid support

---

## Development

### Local Setup

```bash
# No build step required!
# Just open in browser:
open playground/index.html

# Or serve with any static server:
npx http-server . -p 8080
# Then visit: http://localhost:8080/playground/
```

### File Structure

```
playground/
├── index.html          # Main playground UI
├── playground.js       # Application logic
├── playground.css      # Styling
└── README.md          # This file
```

---

## Roadmap

Future enhancements:

- [ ] Syntax highlighting in code editor (CodeMirror/Monaco)
- [ ] Code auto-formatting (Prettier)
- [ ] Component search/filter
- [ ] Example library (pre-built templates)
- [ ] Export to CodePen/JSFiddle
- [ ] Accessibility checker integration
- [ ] Mobile responsive controls
- [ ] Keyboard navigation improvements
- [ ] History/undo functionality
- [ ] Multiple component preview (composition)

---

## Troubleshooting

**Components not loading?**
- Check browser console for errors
- Verify component is in `components/index.js`
- Ensure schema exists in `schemas/components/`

**Preview not updating?**
- Check for JavaScript errors in console
- Verify component module loaded successfully
- Try Reset button

**Styles not applying?**
- Ensure CSS files are loaded in `index.html`
- Check Shadow DOM encapsulation
- Verify component CSS URL is correct

---

## Credits

Built for **Sherpa UI** — A standards-based Web Component library

**Technologies:**
- Vanilla JavaScript (ES Modules)
- Web Components (Shadow DOM)
- CSS Grid Layout
- JSON Schemas

---

**Last Updated:** 2026-05-28  
**Version:** 1.0.0  
**License:** MIT
