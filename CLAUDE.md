# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

---

## Read these first

**[docs/PRINCIPLES.md](docs/PRINCIPLES.md) is the rules, stated once**, and it
is imported below, so every session reads it. Rules 1–14 each have a gate in
the pre-commit hook; 15 on, a reviewer holds them. Where a rule appears in more
than one place, PRINCIPLES.md is the statement and its gate is the arbiter.

**`npm run map [path]` is the map of the code** — every file's one-line purpose
and every export, read from the file headers. Run it BEFORE writing something
new, to find what already does it. Updating a changed file's `Map:` is the last
step of any change: `npm run map:write <file>`, and `check:map` blocks the commit
until it matches.

This file is the commands and where each thing is stated. It states no rule.

| Doc | Read it when |
|---|---|
| [docs/PRINCIPLES.md](docs/PRINCIPLES.md) | **First, always.** The rules, and the gate that enforces each |
| [docs/TODO.md](docs/TODO.md) | The one list of open work. A done item keeps its row and its section |
| [docs/HANDOVER.md](docs/HANDOVER.md) | Picking up the work in hand: where it stands, and what Will asked for next |
| [docs/TRAPS.md](docs/TRAPS.md) | Any `TRAP T-…` citation you meet in the code. The reasons, gated both ways. By area: [docs/TRAPS-INDEX.md](docs/TRAPS-INDEX.md) |
| [docs/APP-GUIDE.md](docs/APP-GUIDE.md) | Building an app on Sherpa, step by step. Served to agents as `sherpa://app-guide` |
| [docs/DATA-SOURCE-RULES.md](docs/DATA-SOURCE-RULES.md) | Pointing Sherpa at a backend. Served to agents as `sherpa://data-rules` |
| [docs/DEF-TO-FIGMA-BUILD-RULES.md](docs/DEF-TO-FIGMA-BUILD-RULES.md) | Building a component: the five files, the class, the template, the CSS recipes, Figma. Served as `sherpa://rules` |
| [docs/components/](docs/components/README.md) | Using one component: its attributes, events, slots, parts and example. Written from its spec |

Active branch is `sherpa-data-layer`. **Never push** — commit freely, pushing is
Will's call.

@docs/PRINCIPLES.md

---

## Commands

```bash
# Build (clean → compile TS → transform + copy CSS/HTML assets into dist/ →
# put each template and sheet INTO the JS, so nothing is fetched)
npm run build
npm run build:dev         # the same, but components FETCH their files — for live reload
npm run build:watch       # build-reforged.mjs --watch — TS *and* assets, fetched (a dev build)
npm run build:watch:ts    # tsc --watch — TS only, no asset copy
node scripts/build-reforged.mjs --no-minify  # as shipped, with readable names — to profile

# Type check (no emit)
npm run type-check
npm run type-check:tests  # the specs, against the source they drive — in the hook (TODO 492)

# Lint TypeScript. Includes the DOM-FREE BOUNDARY: every module in
# src/core/data/ (and bind-source.ts) may not touch document/window/
# customElements/storage — they are the half of the data layer a server, a
# test or an MCP tool imports.
npm run lint
npm run lint:fix

# Lint component CSS (structural rules; --strict elevates grid warnings to errors)
npm run lint:css
npm run lint:css:strict

# Check the component specs. Three halves, and ALL must pass:
#   validate   — the spec matches schemas/component.v1.json
#   round-trip — the spec regenerates the source it was made from
#   fresh      — the spec ON DISK is what the source generates now
# `spec:check` RUNS IN THE PRE-COMMIT HOOK (`--staged`: freshness only for the
# components the commit touches) and writes nothing. A stale spec blocks the
# commit; `node scripts/generate-component-spec.mjs <name>` fixes it.
npm run spec:check
npm run spec:validate      # the schema half alone

# What the specs make, written and never edited: custom-elements.json and VS
# Code's HTML data (manifest), and a page per component in docs/components/
# (reference). The hook's check:manifest and check:reference block a stale one,
# so run both after a spec or an example changes.
npm run manifest
npm run reference

# Tests — Playwright in three engines, then the node unit tests. The webServer
# runs `npm run build`, so `npm test` builds for you.
npm test
npm run test:node         # the node unit tests alone — they import dist/, so build first
npm run test:ui           # the Playwright UI runner
npm run test:headed
npm run test:report       # open the last HTML report

# The ACCESSIBILITY gate — axe-core over every component, WCAG 2.1 AA. It
# writes a report per component to test/a11y/reports/ (not tracked), and
# test/a11y/baseline.json holds the known failures: a count may only fall.
npm run test:a11y
npm run test:a11y:update  # record a baseline that FELL

# Serve
npm run preview           # serve the repo on :4000 — WITHOUT building
# The example APP is its own project now: ../Sherpa Demos — its server and tests are there (:4200)

# An APP's markup against the specs — every sherpa-* tag, data-* and enum value.
# An app runs it on itself (Demos does, in its npm test); sherpa-ui knows no app.
npx sherpa-ui check-usage <folder>

# What ONE import costs — JS and fetched files per entry, may only fall; and no
# display component reaches the app layer. Reads dist/; npm test runs it too.
npm run check:weight
npm run check:weight -- --update-baseline  # record growth on purpose

# What a reader's act costs the data layer: loads, counts, rows, compiles and
# clones per act, may only fall. Bundles src/, so it needs no build; the hook
# runs it on data-layer commits, npm test always.
npm run check:bench
npm run check:bench -- --update-baseline  # record a change on purpose

# The code map — every file's purpose and exports, from its header
npm run map [path]        # print it; e.g. `npm run map src/core/data`
npm run map:write <file>  # add missing names, drop stale ones — then edit the lines
npm run check:map         # the gate; the hook runs it --staged
node scripts/code-map.mjs --privates [path]  # the #private members still without a line

# A new app — its own package, create-sherpa-ui, in ../Sherpa Starter (TRAP T-a-starter-is-one-folder)
npm create sherpa-ui ../my-app

# MCP server — its own package, sherpa-ui-mcp
npm run mcp               # stdio transport — connect from Claude Desktop / Cursor
npm run check:mcp-pack    # pack both packages, install them, call every tool, resource and prompt
```

---

## Architecture

- **Web Components** — Custom Elements + Shadow DOM + HTML Templates. No
  framework, no virtual DOM, zero runtime dependencies.
- **TypeScript** strict mode, compiled to ES2022 ES modules (`dist/components/`).
- **CSS** with design tokens projected from Figma Variables
  (`scripts/project-tokens.mjs`; never edit `tokens.css` by hand).
- **MCP server** (`mcp-server/`, its own package `sherpa-ui-mcp`) — gives AI
  agents the component specs, tokens, the data layer and the build rules. Its
  tools, resources and prompts: [mcp-server/README.md](mcp-server/README.md).

### Four entry points

```js
import { SherpaButton } from 'sherpa-ui/components';     // display components — needs a DOM
import { SherpaProvider, SessionStore } from 'sherpa-ui/app'; // the app layer — opt-in
import { ArrayStore, DataSource } from 'sherpa-ui/data';  // the data layer — no DOM
import { SherpaButton, SherpaProvider } from 'sherpa-ui'; // all three, one line
```

Importing a component defines it in a browser, and nothing in Node
(`T-a-component-imports-anywhere`). No display component imports the app layer
(`T-the-app-layer-is-opt-in`). `npm run lint` enforces both boundaries;
`check:weight` and a node test prove them.

### A component

Every component is `src/components/sherpa-<name>/`: three hand-written files
(`.ts`, `.css`, `.html`), a generated `.component.json` (never edit it —
`node scripts/generate-component-spec.mjs <name>`), and a hand-written
`.example.json`. Each extends `SherpaElement` (`src/core/ui/sherpa-element.ts`).
**The golden rule:** can HTML or CSS do it before JS? Then do it there.

## Where each thing is stated

| Topic | Stated in |
|---|---|
| The two layers, where new code goes, the doors on `SherpaElement` | PRINCIPLES — "The two layers", "The doors" |
| `:host` forms, disabled, focus ring, `@container`, the two grids, colour and state pins | PRINCIPLES 1–8; the recipes in the rules doc, "The CSS" |
| `static props`, its `kind`s and options; the template; `data-swap-*`; words | The rules doc, "The class" and "The template" |
| `data-*` as the API; `data-label` vs `data-heading`; `data-current` vs `data-selected`; no aliases | PRINCIPLES 15 |
| CSS owns visibility; everything in the template | PRINCIPLES 16–17 |
| Event names, and which events leave a component | PRINCIPLES 18; the rules doc, "Events" |
| Section, Area, Context, View | PRINCIPLES 19 |
| Tokens, tiers, fallbacks, generated regions, component-scoped tokens, layers | PRINCIPLES 20; the rules doc, "The CSS" |
| Shared sheets, family sheets and family markup | The rules doc, "The CSS" and "The template" |
| One owner per value: report, do not derive; `data-locked`; off is not gone | PRINCIPLES 21 and "Silent failures" |
| Comments, and suppressions | PRINCIPLES 22–23 |
| The router, the provider, the outlet, Settings over a Context, dialogs and toasts | APP-GUIDE |
| What the spec generator reads: events, props, anatomy | The rules doc, "What the generator reads" |
| Figma rules, override collections, `figma.extensions.json` | The rules doc, "Figma" |
| Why anything looks odd | TRAPS, by its `T-…` id |
