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
load `sherpa-ui/css` as a stylesheet (or call `installTokens()`).
`sherpa-ui/data` is the data layer alone, with no DOM, for a server or a test.

The example app, `../Sherpa Demos`, is the working reference: a router, a
provider, the app shell, page definitions and Views.

## Develop

```bash
npm run build        # compile src/ → dist/ (+ copy CSS/HTML assets)
npm run type-check   # strict TypeScript, no emit
npm test             # Playwright, in three browsers, against test/reforged/harness.html
npm run lint         # eslint src/
```

## How it fits together

- **Components** live in `src/components/sherpa-<name>/` as a three-file split:
  `.ts` (behaviour), `.css` (all presentation), `.html` (template + slots). JS is
  the last resort — HTML data-attributes and CSS own structure and appearance.
- **Tokens** are projected from the Figma file by `scripts/project-tokens.mjs` into
  `src/styles/tokens/tokens.css`, layered by Figma's aliasing tiers
  (`@layer core, display-mode, theme, layout, structure, border, style, elevation,
  components`). See [CLAUDE.md](CLAUDE.md#token-architecture) for what each owns.
- **Two-way Figma ↔ code** is the direction of travel.

The rules are in `docs/PRINCIPLES.md`; the commands, architecture and
conventions in `CLAUDE.md`.

## License

MIT
