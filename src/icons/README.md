# Icons

One `.svg` per icon, exported from the Figma **Icons** section
(`UnBEepLWb6d7b9ykm33j2s`, node `17:3931`). Figma is the source of truth; these
files are a build input, not a place to draw.

`scripts/generate-icons.mjs` reads this folder and writes the sprite,
`src/core/ui/icons.svg` — one `<symbol>` per icon, its id the icon's name — and
the names into `src/core/ui/icon-names.ts`. Run it after changing anything here:

```bash
npm run icons
```

**To re-export from Figma**, or to swap in another icon set, replace the
files here and re-run the generator. Nothing else changes:
components name an icon, and `.sherpa-icon-box` sizes it.

Each file is a 14x14 viewBox — every icon shares one frame — whose shapes carry
their own fill: `currentcolor` for the one-colour icons, so they take the text's
colour, and fixed colours for the status badges and OS marks.
