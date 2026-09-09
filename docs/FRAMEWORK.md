# Sherpa-UI as a web-app framework

Sherpa-UI is a **batteries-included boilerplate** for building web apps:

```
Client Server (Node + Express)   — emits HTML fragments, owns state + routing
        ↓  HTMX  (hx-get/hx-post → swap)
UI (sherpa-* components)          — shadow DOM, semantic, zero runtime deps
```

You get: the 52 `sherpa-*` components + the HTMX wiring conventions below + a small
Express scaffold to grow your app in. **HTML-over-the-wire** — the server returns
snippets of `sherpa-*` markup, never JSON.

## Run it
```
npm run build       # compile + project tokens → dist/
npm run serve:app   # start the Client Server → http://localhost:4100
```

## The three layers (loaded once, in the shell)
1. **Token layer** — `<link href="/dist/styles/tokens/tokens.css">` (light DOM; inherits into every shadow root).
2. **Component registry** — `<script type="module" src="/dist/index.js">` (defines every `sherpa-*`).
3. **HTMX runtime** — `<script src="/vendor/htmx.js" defer>`.

`server/shell.mjs` renders this document. Everything else is fragments swapped into it.

## Server structure (`server/`)
| file | role |
|---|---|
| `index.mjs` | Express app: static assets, the routes, boots the shell. **Add routes here.** |
| `shell.mjs` | the one full HTML document — the three layers + a `.sherpa-view` of regions. |
| `fragments.mjs` | HTML-over-the-wire renderers — return `sherpa-*` snippets. **Add fragments here.** |
| `data.mjs` | the swappable datastore (in-memory in the starter; replace with your DB/API). |
| `html.mjs` | a tiny auto-escaping tagged-template (`html`) + `raw()`. No template engine. |

## Conventions

### Fragments
- A fragment renderer returns a `sherpa-*` markup snippet built with the `html` helper
  (auto-escapes interpolated data; nest fragments freely — `html` composes).
- URL scheme: `GET /fragments/<name>` (params via query or path). Return `res.type('html')`.
- A fragment is **valid on its own** — it can be the initial render OR an HTMX swap.

### Regions (the swap contract)
- The shell lays out named regions: `<section id="detail">`, `<div id="list">`, …
- A region loads its first fragment on page load: `hx-get="/fragments/…" hx-trigger="load"`.
- Interaction fragments target a region by id: `hx-target="#detail" hx-swap="innerHTML"`.

### Component event → HTMX request (the key bridge)
Components emit **unprefixed noun-verb** CustomEvents (`item-click`, `page-change`,
`tab-change`, …), `bubbles:true composed:true`. HTMX triggers on them directly:

```html
<sherpa-list
    hx-get="/fragments/item"
    hx-trigger="item-click"                          <!-- the component's event -->
    hx-target="#detail"
    hx-vals='js:{id: event.target.dataset.itemId}'>  <!-- event.target = the shadow HOST -->
  <sherpa-list-item data-item-id="alpha" data-label="…"></sherpa-list-item>
</sherpa-list>
```

**Why it works:** the event is `composed`, so it crosses the shadow boundary and bubbles
to the container HTMX listens on. Inside `hx-vals`, `event.target` is **retargeted** by the
platform to the shadow HOST that fired it (the `<sherpa-list-item>`) — so
`event.target.dataset.*` reads the host's `data-*`. No glue code in the component.

Put the `hx-*` on the component that **owns** the interaction; use its documented event
name as `hx-trigger` (see each component's `@fires`).

### State
Prefer **server-owned** state (HTML-over-the-wire): the server renders the current truth
into each fragment. The client-side `StateStore`/`renderView` (in `src/core/render-view.ts`)
remains for purely-client views — don't run both for the same data.

## Adding a feature (recipe)
1. Add a data function in `data.mjs`.
2. Add a fragment renderer in `fragments.mjs` returning `sherpa-*` markup (+ its hx-* if it drives interaction).
3. Add a `GET /fragments/<name>` route in `index.mjs`.
4. Point a region (or a component's `hx-trigger`) at it.

## What stays pure
`sherpa-*` components carry **no** HTMX/server code — they render whatever markup the
server sends and emit their events. HTMX + Express are **framework** deps; the component
layer stays zero runtime dependencies.

See also: `docs/FRAMEWORK-SHIFT-PLAN.md` (the phased plan) and `CLAUDE.md` (component rules).
