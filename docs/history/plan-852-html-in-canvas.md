# Plan 852 — the node editor drawn with HTML-in-Canvas

Will, 2026-11-11: "We should be using CSS and HTML in Canvas to draw nodes" — asked which, he picked Chrome's
HTML-in-Canvas API. And: "sherpa-canvas should be a wrapper around a real canvas that allows us to set attributes in the
templates." TODO 852 (Will, 2026-11-06) asks for a MEASURED spike first: 500 and 2,000 nodes, drawn with it against
today's DOM, comparing draw, drag, zoom and input. PRINCIPLES: progressive enhancement — HTML and CSS first, JS last.

## The API, as shipped (Chrome 157, 2026-10-26; read 2026-11-11)

- The canvas opts in: `<canvas content="drawable">`. Each element it draws carries `drawable` (any descendant, since
  Chrome 155; before, direct children only, and the attribute was `layoutsubtree`).
- A `paint` event (`CanvasPaintEvent`, `changedElements`) fires on the canvas when a drawable's layout, text or style
  changes; `canvas.requestPaint()` asks for one next frame. Drawing in `paint` shows this frame; DOM changes there, next.
- 2D: `ctx.drawElementImage(el, dx, dy[, dw, dh])`, inside `paint`. Since 155 it returns nothing: the browser moves the
  element's hit testing, focus ring and accessibility bounds to where it was drawn, through the context's transform.
  `canvas.clearElementGeometry(el)` takes one out of hit testing (offscreen to assistive tech).
- WebGL `texElementSubImage2D`, WebGPU `drawElementImageToTexture`, with `canvas.updateElementGeometry(el, …)`.
- Drawable HTML stays in the accessibility tree as ordinary DOM.
- Feature test: a canvas given `content="drawable"` reads it back from `canvas.content`.
- Firefox and WebKit: not there. Chromium 150–154 had the trial shape (`layoutsubtree`, a returned `DOMMatrix`).

## Measured so far (2026-11-11)

- **Our test Chromium is 153** (Playwright 1.63): only the trial API, behind `--enable-blink-features=CanvasDrawElement`.
  **This Mac's Google Chrome is 157**: the shipped API, no flag (`channel: 'chrome'` in Playwright).
- **Shadow DOM works** (Chrome 157). A canvas inside a component's shadow root, `<canvas content="drawable"><slot>`,
  draws a SLOTTED `drawable` element, and a click at the drawn place hits it. An element with its own shadow root (as
  `sherpa-node` has) draws whole. A real `<input>` inside a drawn element draws and is hit.

So a node can stay what it is — a `sherpa-node`, light DOM of the canvas component, with real fields — and only how it
reaches the screen changes.

## The model

- **`sherpa-canvas` wraps a real `<canvas>`** (Will). Its template is `<canvas content="drawable"><slot></slot></canvas>`
  where the engine has the API; the attributes a page writes on the wrapper reach the canvas through the template
  (`data-attr-*`, the one binding language), so a page sets them in its markup, never in script.
- **Same DOM, one implementation.** The nodes, their rows, fields, sockets and tabs are the same elements and CSS in every
  engine. Where the API is, the canvas draws them (`drawElementImage` at each node's place, through one transform for pan
  and zoom) and the lines are canvas paths; where it is not, the plane draws them as today. The geometry (places, socket
  boxes, lines) is computed once, for both.
- **Pan and zoom** become the context's transform and one `requestPaint()`, not a CSS transform on a DOM layer.

## The spike — measured, 2026-11-11

Chrome 157 (this Mac's, `channel: 'chrome'`), DPR 2, a 1400×860 view; N real `sherpa-node`s in a grid of 20 columns, each
a header, a field and two label rows in two grey boxes; no lines. The DOM plane is today's `sherpa-layout-canvas`. The
canvas is a plain `<canvas content="drawable">` holding the same nodes, drawn in `paint` at their places through one
transform, only those in view. Main-thread ms per act (CDP `TaskDuration`), each over 30 steps a frame apart; the script
is not in the repo (/private/tmp/claude-502/probe/hic-spike.mjs).

| | DOM, 500 | Canvas, 500 | DOM, 2,000 | Canvas, 2,000 |
|---|---:|---:|---:|---:|
| First draw | 1,591 | 975 | 6,170 | 3,855 |
| A pan step | 8.1 | 7.3 | 30 | 22 |
| A zoom step | **332** | 21 | **2,106** | 71 |
| A node drag, a move | 21.5 | 6.4 | 36 | 17 |
| A typed letter in a field | 14.7 | 9.8 | 65 | 26 |
| JS heap, MB | 19 | 27 | 43 | 55 |

- **Zoom is where the DOM plane fails**: every node is drawn again at the new scale, 2.1 s a step at 2,000 nodes. The
  canvas scales a drawn image: 71 ms.
- **`drawable` only on what the view shows.** Every `drawable` element costs each paint, drawn or not: with all 2,000
  `drawable` (15 drawn), a step cost 60–68 ms; with only those in view, 17–22. `clearElementGeometry` on the rest each
  paint saved nothing.
- **Hit testing follows the drawing**: a click where a field is DRAWN reaches its `<input>`, and typing goes in. (A click
  at the element's own layout box reaches nothing: tests must click where it is drawn.)
- **A drawn element is clipped to its own box.** The socket tabs overhang the card, and are cut off; so would the step
  caption and a fork's True and False tabs. In the canvas, the node's box must hold its tabs: the card inset in a host as
  wide as tab, card and tab (the Harness Figma node already is).

Still to check by hand before a build: keyboard focus and its ring, text selection, a `<select>`'s popup, a socket's tip
(a top-layer popover anchored to a drawn element), forced colours, and what a screen reader reads.

## Decide after the spike

**The numbers say go** for speed: faster in every act at 2,000 nodes, and 30 times faster to zoom. It goes ahead if the
hand checks above lose nothing a reader uses; then a plan of steps: the wrapper, the paint loop, the lines on the canvas, tests in Chrome 157 (a Playwright project on
`channel: 'chrome'`, since the bundled Chromium is 153), and the fallback held by the same specs in Firefox and WebKit.
Stop, if not: the numbers go in this file, and the DOM plane stays.
