# Sherpa-UI → boilerplate framework — plan (2026-09-07)

## The shift
Sherpa-UI stops being *only* a component library and becomes a **batteries-included
web-app framework**:

```
Client Server (Node + Express)   — emits HTML fragments, owns state + routing
        ↓  HTMX  (hx-get/hx-post → swap)
UI (sherpa-* components)          — shadow DOM, semantic, zero runtime deps
```

A new app = the component kit + HTMX conventions + a server scaffold to fill in.

## What already exists (build on it, don't replace)
- 52 semantic, Figma-reconciled `sherpa-*` components (zero runtime deps).
- `src/core/render-view.ts` — a **client-side** view layer: `ViewDefinition {root, elements, state}`,
  a `StateStore`, `renderView()` composing an id-addressed tree into `.sherpa-view`.
- `dist/index.js` registers all components; `tokens.css` is the light-DOM token layer.
- No server, no app entry HTML, no routing yet.

## Guiding principles
- **Components stay pure UI** — no HTMX/server code leaks into `sherpa-*` internals. They render
  whatever markup the server sends; HTMX lives in the light-DOM composition.
- **HTML-over-the-wire** — the server returns *fragments of `sherpa-*` markup*, not JSON.
- **Progressive enhancement** — a fragment is valid HTML on its own; HTMX just swaps it in.
- **Keep zero-dep on the UI side.** HTMX (+ Express) are FRAMEWORK deps, not component deps.

## Phases

### Phase 0 — decide fragment conventions (design, no code)
- Fragment = a snippet of `sherpa-*` elements the server renders (e.g. a `<sherpa-list>` with
  stamped rows, or a view region). Define: URL scheme (`/fragments/<name>`), how state/params pass
  (query/path/hx-vals), and the swap target contract (`hx-target` → a `[data-region]` in `.sherpa-view`).
- Decide how `renderView`'s client-side `ViewDefinition` relates to server fragments — likely: the
  server renders the *initial* view HTML; HTMX swaps *regions* on interaction. `render-view.ts`
  stays for client-composed views; new server-rendered path is additive.

### Phase 1 — the Client Server scaffold (Node + Express)
- New `server/` dir: `server/index.mjs` (Express app), `server/fragments/` (fragment renderers as
  template-literal or a tiny template helper returning `sherpa-*` HTML), `server/routes.mjs`.
- Serve `dist/` (components), `tokens.css`, and the HTMX script as static assets.
- One page route (`GET /`) returns the app shell HTML: `<html>` + token `<link>` + `<script type=module>`
  importing `dist/index.js` + the HTMX `<script>` + a `.sherpa-view` with regions.
- `npm run serve` (or `dev`) boots it.

### Phase 2 — wire HTMX into the view layer
- Add HTMX as a framework dep (documented as such). Load it in the shell.
- Regions in `.sherpa-view` carry `hx-get="/fragments/…" hx-trigger hx-target hx-swap`.
- Components emit their existing noun-verb events; a thin bridge (or `hx-trigger="row-click from:…"`)
  turns a component event into an HTMX request. Decide: event→request bridging convention.
- If a fragment contains `sherpa-*` with shadow DOM that itself needs hx-*, call `htmx.process(root)`
  in `SherpaElement.onConnect` (only if that case arises — likely not needed at first).

### Phase 3 — VERTICAL SLICE (the first build, this session)
- Prove the loop end-to-end on ONE view: e.g. a list view.
  - `GET /` → shell with a `[data-region="body"]` that `hx-get="/fragments/items"` on load.
  - `GET /fragments/items` → returns `<sherpa-list>` markup with rows.
  - Clicking a row (component `item-click`) → `hx-get="/fragments/item/:id"` → swaps a detail region.
- Manual verify in the browser (screenshot). This is the go/no-go for the whole framework shape.

### Phase 4 — boilerplate-ise (after the slice proves out)
- Extract the slice into a reusable starter: `create-sherpa-app` layout or a `template/` dir
  (server + shell + example view + fragment examples + conventions doc).
- Document the conventions (fragment URLs, region contract, event→hx bridge) in a FRAMEWORK.md.
- CI/build: `npm run build` (components) + server start; a smoke test that the slice loads.

### Phase 5 — migrate the sandbox/examples onto the framework (optional)
- Re-express the sandbox or an example app using the server+HTMX path to dogfood it.

## Risks / open questions (resolve as we go)
- **Event → HTMX bridge**: components fire DOM CustomEvents; HTMX triggers on events too
  (`hx-trigger="item-click"`). Need to confirm composed events cross the shadow boundary to the
  hx-* host (they do — events are `composed:true`). This is the key integration point to prove in Phase 3.
- **State ownership**: server-owned (HTML-over-wire) vs the existing client `StateStore`. Framework
  should favour server-owned state; `StateStore` remains for purely-client views. Don't run both for
  the same data.
- **Templating on the server**: start with template literals returning `sherpa-*` HTML; add a helper
  if it gets repetitive. Avoid a heavy template engine unless needed.
- **Build output**: server must serve the transformed `dist/` CSS/JS (already produced by build).

## Decisions locked (Will, 2026-09-07)
- Server = **Node + Express**.
- First deliverable = **this plan + one vertical slice** (Phase 3), then decide.
