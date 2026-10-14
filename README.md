# Sherpa UI

A standards-based Web Component library and design-token system. Zero framework,
zero runtime dependencies — Custom Elements + Shadow DOM + HTML templates, styled
by design tokens projected from Figma.

## Use it

No build step is needed: `dist/` runs from any static host or CDN. Map the
name, link the tokens, import it once:

```html
<script type="importmap">
  { "imports": { "sherpa-ui": "/dist/index.js", "sherpa-ui/data": "/dist/data.js" } }
</script>
<link rel="stylesheet" href="/dist/styles/tokens/tokens.css" />
<script type="module">
  import 'sherpa-ui';               // registers every <sherpa-*> element
</script>
```

With npm and a bundler, `npm install sherpa-ui`, then `import 'sherpa-ui'` and
load `sherpa-ui/css` as a stylesheet (or call `installTokens()`). One component
alone is `import 'sherpa-ui/components/button'`. Any import is safe on a server:
there it defines nothing.
`sherpa-ui/data` is the data layer alone, with no DOM, for a server or a test.

[Sherpa Demos](https://github.com/Mincher/sherpa-demos) is one app built on
it — a router, a provider, the app shell, page definitions and Views. Sherpa
itself knows no app: [docs/APP-GUIDE.md](docs/APP-GUIDE.md) says how one is
built.

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
- **Node 22 or later** only for the tooling: `npm create sherpa-ui`,
  `npx sherpa-ui serve` and the MCP server.

## Develop

```bash
npm run build        # compile src/ → dist/ (+ copy CSS/HTML assets)
npm run type-check   # strict TypeScript, no emit
npm test             # Playwright in three browsers, then the node unit tests
npm run lint         # eslint src/
```

## How it fits together

- **Components** live in `src/components/sherpa-<name>/` as a three-file split:
  `.ts` (behaviour), `.css` (all presentation), `.html` (template + slots). JS is
  the last resort — HTML data-attributes and CSS own structure and appearance.
- **Tokens** are projected from the Figma file by `scripts/project-tokens.mjs` into
  `src/styles/tokens/tokens.css`, layered by Figma's aliasing tiers
  (`@layer core, display-mode, theme, layout, structure, border, style, elevation,
  components`). See [CLAUDE.md](https://github.com/Mincher/sherpa-ui/blob/main/CLAUDE.md#token-architecture) for what each owns.
- **Two-way Figma ↔ code** is the direction of travel.

The rules are in [docs/PRINCIPLES.md](https://github.com/Mincher/sherpa-ui/blob/main/docs/PRINCIPLES.md);
the commands, architecture and conventions in
[CLAUDE.md](https://github.com/Mincher/sherpa-ui/blob/main/CLAUDE.md). Neither
ships in the package: they are the repository's.

## License

MIT
