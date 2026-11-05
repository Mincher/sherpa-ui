# Plan 740 — the node look, new sockets, a resize handle

Will, 2026-11-05. Read from his Figma "ACP Module", page "Node Graph Exploration", section
"Nodes" (2872:32139). Read only: nothing in Figma was changed.

## What the Figma shows (a node is 240 wide; border 0.5px; padding 0)

| Column (label) | Corner radii TL TR BR BL | Fill (Figma variable) | Stroke |
|---|---|---|---|
| Sources | 16 4 4 16 (x-large / medium) | surface/info (#d9e8f2) | stroke/info |
| Groups (Custom Nodes) | 4 4 4 4 | surface/info (#d9e8f2) | stroke/info |
| Variables, Math, Logic, Time, Collections, Utils | 4 4 4 4 | surface/container (white) | neutrals/gray-lighter |
| Output | 4 16 16 4 | surface/success-light (#d9f2e5) | stroke/success-light |
| AI | 16 16 16 4 | surface/brand-lighter (#f8ebff) | stroke/brand |

Each node: header 48 high, a body slot, a footer 48 high (forks). A text label sits above each
column in the SECTION only. We add none to a node.

## The sockets (a 16 x 32 hit box; the shape is 16 x 16, 2px ring)

| Socket | Shape | Ring and fill |
|---|---|---|
| Input, single | D: radii 4 8 8 4, inner dot 8 x 8 | ring Color 5 (info), fill surface/info |
| Input, multiple | the same D, 16 x 32 (double height); dot 8 x 24 | the same |
| Step input (single, multiple) | pill (radius 999), single 16, multiple 32 | brand |
| Output, default and True (connected) | a rounded triangle pointing right, 16 x 16 | brand / success ring |
| Output, False | a rounded square, radii 4 | critical ring |
| Output, any, not connected | a rounded square, radii 4, white | the ring of its type |

## Token map (the repo's own; no hex invented)

- Radius: medium = `--sherpa-display-mode-border-rounding-base` (4px); x-large = `-xl` (16px).
- Fills: a Style `info` or `success` pin resolves its SURFACE to plain white (the status-pin rule),
  so no pin is added. The node binds the THEME tier, as components do: Sources and Custom Nodes
  `--sherpa-theme-surface-info-base` (#D4F0FF; Figma #d9e8f2, near); Output
  `--sherpa-theme-surface-success-base` (#F0FFF5; Figma #d9f2e5 is darker: NO exact token, reported);
  AI `--sherpa-theme-surface-active-base` (brand colour 1). Others keep the card's surface.
- Strokes keep the node's pinned border. No per-category stroke is invented.
- AI: no kind exists. The STYLE for `data-category="ai"` is built; the registry can carry it.

## What I will build

1. A node carries `data-category` (from its kind's `category`, lowercased and dashed); CSS styles it.
2. Sockets: input a D; `data-input-many` doubles it; True a triangle, False a rounded square;
   an output keeps its type shape; an input is the D in the type's ink (the type still reads from
   the ink and the tip words, as the Figma does: its inputs are D whatever the type).
3. A resize handle in the node's bottom right corner, a template element shown by hover or focus
   in CSS. Width and height each 100%-200% of the natural size; Ctrl (Cmd on a Mac) keeps the aspect.
4. The size is saved: `size: { w, h }` beside `x`, `y` (workflow v2, defs, Custom Node body),
   kept per tab in the Query editor. A resize is one journal step; the edit
   `{ resize: { node, w, h } }` faults in words outside 100-200%.
5. The primary key is ONE helper, `src/core/ui/modifier-key.ts` (Cmd on Apple, Ctrl elsewhere).
6. Keyboard: Alt+Arrow on the focused header grows or shrinks by a step (the smallest way).

## Tests

Node tests: the `resize` edit and its fault, v2 `size`, v1 read, Custom Node body, undo, the key.
Specs in 3 engines by real pointer events: handle on hover, drag, Ctrl drag, clamps, routes on
sockets, undo, socket shapes by pixels, category radius and painted fill, forced colours, a11y.
