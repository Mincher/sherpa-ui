# Icons

One `.svg` per icon, exported from the Figma **Icons** section
(`UnBEepLWb6d7b9ykm33j2s`, node `17:3931`). Figma is the source of truth; these
files are a build input, not a place to draw.

`scripts/generate-icons.mjs` reads this folder and writes `src/core/icon-paths.ts`,
which carries each path plus the INK bbox a fitted viewBox needs. Run it after
changing anything here:

```bash
npm run icons
```

**To re-export from Figma** — or to swap in Font Awesome Pro once the licence
lands — replace the files here and re-run the generator. Nothing else changes:
components name an icon, and `.sherpa-icon-box` sizes it.

Each file is a plain single-path SVG on a 14x14 viewBox, with no `fill`
attribute — colour comes from `currentcolor` at render time.
