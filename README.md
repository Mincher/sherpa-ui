# Sherpa UI

A standards-based Web Component library and design-token system. Zero framework,
zero runtime dependencies — Custom Elements + Shadow DOM + HTML templates, styled
by design tokens projected from Figma.

## Install

```bash
npm install sherpa-ui
```

```js
import 'sherpa-ui';                 // registers all <sherpa-*> elements
import 'sherpa-ui/css';             // the token layer (or installTokens())
```

## Develop

```bash
npm run build        # compile src/ → dist-reforged/ (+ copy CSS/HTML assets)
npm run type-check   # strict TypeScript, no emit
npm test             # Playwright e2e against the reforged harness
npm run lint         # eslint src/
```

## How it fits together

- **Components** live in `src/components/sherpa-<name>/` as a three-file split:
  `.ts` (behaviour), `.css` (all presentation), `.html` (template + slots). JS is
  the last resort — HTML data-attributes and CSS own structure and appearance.
- **Tokens** are projected from the Figma file by `scripts/project-tokens.mjs` into
  `src/styles/tokens/tokens.css`, layered by Figma's aliasing tiers
  (`@layer core, style, overrides, components`). See
  [docs/VARIABLE-TOKEN-MAP.md](docs/VARIABLE-TOKEN-MAP.md).
- **Two-way Figma ↔ code** is the direction of travel — see
  [docs/FIGMA-CODE-SYNC-PLAN.md](docs/FIGMA-CODE-SYNC-PLAN.md).

Architecture and conventions are documented in `CLAUDE.md`.

## License

MIT
