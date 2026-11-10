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

**Hand checks, 2026-11-11** (Chrome 157, two real nodes drawn, the canvas TWO shadow roots deep as ours will be):
- A canvas two shadow roots deep draws a node slotted through both, and hit testing reaches it.
- **A source box past the element's own draws what overhangs it**: `drawElementImage(el, -P, -P, w + 2P, h + 2P, x - P,
  y - P, w + 2P, h + 2P)` draws the side tabs, a fork's True above and False below. A node's box need not change.
- **`getBoundingClientRect()` says where an element is DRAWN** (100, 100, where it was drawn; its layout box is at 0, 0).
  So every place our code reads from it — a socket's box for its line, a tip's anchor, a test's click — follows the
  drawing.
- A click where a field is drawn focuses it; typing, Shift+arrow selection and the focus ring (drawn in the node's
  snapshot) all work; a socket's tip opens beside its tab.
- Not seen headless: a native `<select>`'s popup. To check in a real window.
- **Inside a drawing canvas, an element is laid out in FLOW**: `position: absolute` computes to `static`, so `left` and
  `top` move nothing and `offsetLeft`/`offsetTop` read 0. Its `left` still RESOLVES (`getComputedStyle(el).left` gives
  `120px` from `var(--x)`, a frame's `calc()` too): the canvas reads each element's place there.
- **An element not drawn has no drawn place**: its box reads as its hidden place in flow. So, with only the view's nodes
  `drawable`, nothing may read a node's place from layout: the lines (a socket's box today), the minimap and Fit
  (`offsetLeft`), a frame round its nodes, box-select and paste. All read it from the model: a node's place is its
  `--x`/`--y`; a socket's place in it is (socket box − node box) ÷ the node's drawn scale (its box width ÷ `offsetWidth`:
  the zoom where drawn, 1 where not). ONE helper for a node's box on the plane — the six the review found become one.

## Decide after the spike

**Will, 2026-11-11: "let's make it so".** The steps, each its own commit, every spec green after each:

1. **`sherpa-canvas`** — a component wrapping a real `<canvas content="drawable">` round a slot (Will: "a wrapper around a
   real canvas that allows us to set attributes in the templates"). Its view is its attributes, `data-x`, `data-y`,
   `data-zoom`, set in a template; it draws each element slotted in at its own layout place (its `--x`, `--y`) through
   that view, with a source box past it for what overhangs, and only what the view shows is `drawable`. It sizes its grid
   to device pixels. Where the engine has no API, its template is a plain layer the view moves by a CSS transform — today's
   plane — and the same elements lay out the same.
2. **Places from the model, not layout**: one helper for a node's box on the plane (its `--x`/`--y`, its size) and a
   socket's place in it; the canvas's measure, the lines, frames, box-select and paste use it. Nothing changes on screen;
   it is what lets a node out of view go undrawn.
3. **`sherpa-layout-canvas` draws its plane with it**: its `.plane` IS a `sherpa-canvas`; pan and zoom set its view; a
   blank press passes through it to the view (`pointer-events: none`, its content `auto`).
4. **The lines**: the routes' SVG is drawn too, its box the routes' bounds, so a click on a line still picks it.
   **Built, 2026-11-11** (steps 1–4): `sherpa-canvas` (079c4265b); places from the model (aa975e4fe); the plane IS a
   `sherpa-canvas`, and the lines' SVG has the routes' bounds (`fitLines`). Every canvas, layout-canvas and node spec
   passes drawn in Chrome 157 and plain in Chromium (554). Found on the way: the source box past a node must be 64px
   (32 cut a big socket's tab), and a node's drag scale is its DRAWN one, so a zoom shows in a drag after the next
   paint. Firefox and WebKit failures that are there before 852 too are listed in TODO 890.
5. **Tests**: a Playwright project on Google Chrome 157 (`channel: 'chrome'`) runs the canvas and node specs drawn; the
   bundled Chromium 153, Firefox and WebKit run them on the plain layer, as today. CI: the runner's Chrome.
6. **Measure** in Demos (the Records graph, the Node editor page), both ways; the trap, the APP-GUIDE, the Map.
