# Sherpa UI

Sherpa UI is a library of web components, and the design tokens that style
them. Each component is a custom element, such as `<sherpa-button>` or
`<sherpa-data-grid>`, that works in plain HTML. There is no framework and no
runtime dependency. The tokens are projected from Figma.

Beside the components there is a data layer (stores, queries, validation) that
needs no DOM, and an app layer (a router, a data provider, saved Views) that
loads only when you import it.

> **Status: beta. Sherpa UI is not on the npm registry yet.** The package
> called `sherpa-ui` there is a different project: do not install it. Until
> Sherpa is published, build it from this repository and install it by path.

## Get it

```bash
git clone https://github.com/Mincher/sherpa-ui.git
cd sherpa-ui
npm install
npm run build
```

Then, in your own project (here, a folder beside the clone), install the clone
by its path:

```bash
npm install ../sherpa-ui
```

## A first page

Put this in `index.html`, beside `node_modules`:

```html
<!doctype html>
<html lang="en" data-mode="auto">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>My page</title>
  <link rel="stylesheet" href="./node_modules/sherpa-ui/dist/styles/tokens/tokens.css">
  <link rel="stylesheet" href="./node_modules/sherpa-ui/dist/styles/tokens/page.css">
  <script type="module" src="./node_modules/sherpa-ui/dist/components.js"></script>
</head>
<body>
  <sherpa-callout data-status="warning" data-heading="Heads up">Your trial ends in 3 days.</sherpa-callout>
  <sherpa-button data-look="saturated" data-icon-start="plus">Add customer</sherpa-button>
</body>
</html>
```

Then serve the folder:

```bash
npm pkg set scripts.start="sherpa-ui serve ."
npm start
```

Open http://localhost:4000/. `sherpa-ui serve` is in the package that you
installed, so nothing is downloaded.

- `tokens.css` gives every component its variables. `page.css` styles the page
  itself: its margins, font and colours. Leave `page.css` out when the
  components go into a page that is not yours.
- `data-mode="auto"` follows the OS, and `data-mode="dark"` is dark. With no
  `data-mode`, the page is light.
- `components.js` defines every display component. To load less, load one
  component alone, for example
  `./node_modules/sherpa-ui/dist/components/sherpa-button/sherpa-button.js`.

## Entry points

| Import | What it holds |
|---|---|
| `sherpa-ui` | The three below, in one import |
| `sherpa-ui/components` | Every display component, and the base they stand on: `SherpaElement`, `define`, `installTokens`, `useTemplate`, `settled`. In a browser, the import defines each element |
| `sherpa-ui/app` | The app layer: `<sherpa-provider>`, `<sherpa-router>`, `<sherpa-outlet>`, `SessionStore`, saved Views and `checkApp`. No display component imports it, so a page that imports only `sherpa-ui/components` does not load it |
| `sherpa-ui/data` | The data layer, with no DOM: the stores, `DataSource`, `bindSource`, the query and validation. For a server, a test or a tool |

- `sherpa-ui/css` is `tokens.css`, and `sherpa-ui/css/page` is `page.css`.
- `sherpa-ui/components/<name>` is one component alone, for example
  `import 'sherpa-ui/components/button'`.
- Each component has a page in
  [docs/components](https://github.com/Mincher/sherpa-ui/blob/main/docs/components/README.md):
  its attributes, events, slots, parts and an example, written from its spec.

A bundler or Node finds these names through the package's `exports`. A page
with no bundler needs an import map to use them in its own modules. Put it in
`<head>`, before the first module script:

```html
<script type="importmap">
  { "imports": {
    "sherpa-ui": "./node_modules/sherpa-ui/dist/index.js",
    "sherpa-ui/components": "./node_modules/sherpa-ui/dist/components.js",
    "sherpa-ui/app": "./node_modules/sherpa-ui/dist/app.js",
    "sherpa-ui/data": "./node_modules/sherpa-ui/dist/data.js"
  } }
</script>
```

Every import is safe on a server. There, a component module loads and defines
nothing.

## The data layer alone

The data layer needs no DOM. Save this as `data.mjs` in your project, then run
`node data.mjs`. With the import map above, the same code runs in a browser
module.

```js
import { ArrayStore } from 'sherpa-ui/data';

const store = new ArrayStore([
  { id: 1, name: 'Contoso', seats: 120 },
  { id: 2, name: 'Fabrikam', seats: 12 },
  { id: 3, name: 'Northwind', seats: 45 },
]);
const { rows, total } = await store.load({
  filter: ['seats', 'gt', 20],
  sort: [{ field: 'name', direction: 'asc' }],
});
console.log(total, rows.map((row) => row.name)); // 2 [ 'Contoso', 'Northwind' ]
```

A filter is data, `[field, op, value]`, so the same filter can go to a server.
[docs/DATA-SOURCE-RULES.md](docs/DATA-SOURCE-RULES.md) is the full contract
between Sherpa and a backend.

## A whole app

In an app, a component ASKS for its data, and `<sherpa-provider>` answers it
from the page's definition. Nothing is bound by hand.
[docs/APP-GUIDE.md](docs/APP-GUIDE.md) builds an app step by step: the page,
the shell, `app.json`, the stores, a page definition, Views and the session.

## In your editor

The package ships `custom-elements.json` (the standard manifest, named by
`package.json`'s `customElements`) and VS Code's HTML data. Both list every
`<sherpa-*>` tag with its attributes, values, events and slots. In VS Code, add
this to `.vscode/settings.json` for completion and hover docs in plain HTML:

```json
{ "html.customData": ["./node_modules/sherpa-ui/vscode.html-data.json"] }
```

## What it needs

- **A current browser.** Chrome, Edge and Firefox, on a desktop and on
  Android, are the targets. Safari is not. Every iOS browser runs on WebKit, and
  Sherpa is tested in WebKit too: where WebKit lacks something Sherpa uses —
  today `Temporal` — Sherpa carries a small stand-in of its own.
- **Nothing else at run time.** No dependency, no polyfill, no CDN. Icons are
  SVG inside the package, and nothing is fetched from anywhere else.
- **Your own font, if you want it.** The tokens ask for Inter, then
  `system-ui`. Sherpa loads no font: link Inter in your page to use it.
- **Dates are `Temporal`** — `PlainDate`, never a `Date` — where the browser
  has it, and the stand-in where it has not.
- **Node 22 or later, for the tools only:** the build, `sherpa-ui serve` and
  the MCP server. A browser needs nothing from Node.

## For an agent

Sherpa has an MCP server. It gives an agent the components, the tokens, the
data layer and these guides: `docs/APP-GUIDE.md` is `sherpa://app-guide`, and
`docs/DATA-SOURCE-RULES.md` is `sherpa://data-rules`. It is its own package,
`sherpa-ui-mcp`, which is not on npm yet, so run it from your clone. Run
`npm run build` there once: its data tools read `dist/`. Then give your MCP
client `node` and the full path to `mcp-server/index.js`. The client starts
the server:

```json
{
  "mcpServers": {
    "sherpa-ui": { "command": "node", "args": ["/full/path/to/sherpa-ui/mcp-server/index.js"] }
  }
}
```

Do not use `npx sherpa-mcp`. On npm, `sherpa-mcp` is a different project.

## Work on Sherpa

```bash
npm install          # also turns on the pre-commit hook
npm run build        # src/ → dist/; each template and sheet goes inside its JS
npm run type-check   # strict TypeScript, no emit
npm run lint         # eslint, and the data layer's DOM-free boundary
npm test             # Playwright in three engines, then the node tests
npm run map          # every file's purpose and exports, from its header
```

The hook runs the gates on each commit. The rules, and the gates that hold
most of them, are in
[docs/PRINCIPLES.md](https://github.com/Mincher/sherpa-ui/blob/main/docs/PRINCIPLES.md).
[CLAUDE.md](https://github.com/Mincher/sherpa-ui/blob/main/CLAUDE.md) is the
detail: the commands, the architecture and the conventions. Neither ships in
the package.

## License

MIT — see [LICENSE](LICENSE). Copyright (c) 2026 the Sherpa-UI contributors.
