# Review — content is a template; the container fits it

Written for: Will. Status: REVIEW, nothing changed. Asked 2026-11-06: content should be an HTML template injected into
the content element of any container; the container's CSS and the content's CSS fit and reflow it; JS only where
nothing else will do.

## The rule, as I read it

1. A container (`sherpa-container`, `sherpa-overlay-panel`, a card, a dialog) owns one **content element** (its default
   slot / `.body`).
2. Content is a **template** (an HTML `<template>`, or a file): it has no container of its own, and it names the slots it
   fills (`slot="footer"`, `slot="actions"`).
3. Putting content in a container is `clone(template)` into that element, never taking nodes out of one container and
   re-parenting them into another.
4. Fitting is CSS: the container sizes and scrolls its content element; the content fills it (`block-size: 100%`, grid rows).
5. State (docked, overlay, tab, floating) is an **attribute that CSS reads**, not a move in the DOM.

## What I found

| # | Where | What it does | Against the rule | Size of the fix |
|---|---|---|---|---|
| 1 | `sherpa-overlay-panel.ts` `#popIn` / `#popOut` / `moveInto` / `#home` | Pop and Float MOVE the whole panel element into the shell's area and back, remembering its old parent and sibling. A browser with no `moveBefore` loses focus on the way (a microtask hack). | State is a DOM move (5). Content and container travel together; every move is a disconnect, a connect, a `slotchange` race, and a focus repair. | Medium. Declare the panel once, as a child of the shell. Fixed is `slot="panel-end"`, overlay is `slot="overlay"` on the SAME element: the browser re-assigns it, nothing disconnects, focus and scroll stay. `#home`, `moveInto`, the focus hack and the WebKit special case go. |
| 2 | Demos `index.html` (assistant) | Fetches the Chat page's template into the panel, then "unwraps the card": finds its `sherpa-container`, takes `#thread` and the composer out, sets `slot="footer"` on the composer, and `card.replaceWith(...)`. | The content carries its own container (2), so it has to be torn apart to fit another (3). | Small. Split the Chat template into container-less content (thread, composer with `slot="footer"`); the Chat page wraps it in its card, the panel receives it as is. No unwrap code. |
| 3 | `node-graph.ts` `inspectNode`, `contentTabs`, `inspectNone` | The details panel is BUILT by `createElement` and `replaceChildren` on every pick, including its tabs. | Content is code, not a template (2). Rule 17 (every element in the template) is not kept. | Medium. A `<template class="inspector-tpl">` with the Details / JSON / Data pages and the empty state; `renderItems` and the directives fill it; the panel's content element fits it. |
| 4 | Filter column (toolbar `portrait`, `column`, `flat` templates) | One component draws a bar and a panel; the panel's content lives inside the toolbar's own templates. | The container and its content are one component (1, 2). | Already planned: `sherpa-filter-panel` (new) as the content of an overlay panel; the 847 lane is doing it. |
| 5 | `show-as-menu.ts`, `sherpa-outlet` (a Context's markup), `page-components.ts` | `importNode(template.content)` and `innerHTML = markup` into a content element. | None. This is the rule. | none |

## Order I would work in

1. **#2** first (small, shows the rule): content with no container, slots named.
2. **#1** next (the real source of the trouble): one panel element, its state a `slot`/attribute change, no moves.
3. **#3** with the node details work (it already has three tabs to template).
4. **#4** stays with the 847 lane; it must hand the filter content to the panel as a template and use #1's states.

## Risks

- #1 changes how an app declares its panels (children of the shell, not of the page body). The panels were put outside
  the shell so a Context swap cannot take them; as shell children in their own slots they are as safe, since the outlet
  fills only the content slot.
- #1 touches about 40 specs that read `parent`, `slot` and `next` of a panel; the new tests would read `slot` only.
