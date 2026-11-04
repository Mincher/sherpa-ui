# Traps — Charts

One of the eleven areas of [the traps](../TRAPS.md): each entry is here because its
first `Site:` is in this area (`npm run check:traps` holds it so). 43 entries.

### T-gauge-status-is-named

A gauge's status colours are **named** (`--sherpa-status-<name>-fill`), never
resolved by POSITION into the data-viz series.

Positional lookup was the shipped bug: the palette became ONE STATUS PER
SEQUENCE, so sequence 1 is the whole green ramp and sequence 2 the whole amber
one. A gauge painting success/warning/critical asked for series 1, 2 and 4 —
**three shades of green**.

A status is a MODE in that palette and a gauge paints several at once, so it
cannot pin one.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-gauge-band-is-a-closed-path

Each gauge band is **ONE CLOSED `<path>`** — a ring segment with all four
corners rounded, built by the same `ringSegmentPath()` that draws a donut slice,
over the half circle from 9 o'clock to 3 o'clock.

Two rejected implementations, in order:

1. **Conic-gradient divs.** No per-band element at all, so a zone's hit target
   had to be a separate HTML wedge clipped to an 8-point polygon — which made
   the hollow centre hittable and missed the band's outer edge.
2. **A stroked circle whose dash exposed its own span.** It fixed the hit target
   but not the paint: a stroke is a thick LINE, so it has two caps and no
   corners. It could carry no border round the whole band (only a second arc
   along the two long edges) and no corner rounding at all. Its dash also had to
   be pushed half a circumference along to reach the gauge's zero, because
   rotating it instead resolved `transform-origin` against the circle's own fill
   box and swung the whole ring off centre.

A closed path does the paint and the hit target in one element, exactly as the
donut does, and needs neither workaround — a transform would skew the rounded
corners anyway.

The geometry constants live in TS, not CSS, because an SVG `d` cannot read a
custom property:

| | |
|---|---|
| `RING_WIDTH = 15` | the donut's band: `innerRadius` 0.7 on a 100-unit circle, the outer 30%. It was **9** (Figma's older `innerRadius` 0.82), which read as a thin hoop beside the donut on the same dashboard row |
| `CORNER = 1` | the donut's 2px on a 200px chart; `ringSegmentPath()` clamps it down for a band too thin or too short |
| `OUTLINE = 0.5` | 1px on a 200px chart, ALIGNED INSIDE as in Figma. SVG has no inside stroke, so the path is drawn half a stroke in from the true band edges — the same trick `sherpa-radial-chart` uses |
| `START_DEG = 270`, `SPAN_DEG = 180` | clockwise from 12 o'clock: 9 o'clock round the top to 3 o'clock (270 + 180 = 450, which is 90 wrapped past the top) |

JS still hands CSS the needle angle; the big number, caption and scale are text.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-zones-paint-in-full

A gauge's ZONES paint **in full**, whatever the value. A zone is a THRESHOLD —
it says what a reading in that range would mean — so it is part of the SCALE,
not part of the reading. The NEEDLE says where the value falls.

Clipping the colour at the value would grey out the very band the reader is
about to enter, which is the one they most need to see.

With NO zones there is a single band as long as the value, coloured from CSS
(`--_fill`, which already resolves `data-status`). THAT is a reading, not a
scale, so it does stop at the value.

The FILLER is one grey band over whatever the bands leave uncovered, so the
gauge always reads full width rather than stopping short: zones covering the
whole scale need none, zones stopping at 80 or a bare value of 25 get grey for
the rest. It replaced a full half-circle track drawn underneath everything —
the bands already cover the gauge up to their end, so the only part of that
track that ever SHOWED was the leftover, and drawing just that removes a second
copy of the half-circle geometry, which is where it kept going wrong. The
remainder is chrome, not data: CSS greys it, drops its pointer target and gives
it no hover dot, so it never claims a tooltip.

Also the reason the middle scale tick is a TICK. Printing `data-label ?? the
value` there puts the reading at the top centre of the arc — a place that means
"half way". On the Figma component the needle happens to sit
at 50 too, so the two readings agreed and the bug stayed hidden. There are
three ticks — min, the MIDPOINT, max — and `data-unit` suffixes all three
(Figma's gauge reads 0% / 50% / 100%).

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-hotspots-follow-what-was-drawn

The hover dots are stamped from the zones `#renderArcs` **actually drew**, which
it returns for the purpose — never from the declared `data-zones` list. A
zero-width zone is SKIPPED, so a tip stamped from the declared list would point
at a band that does not exist and every later index would slip by one.

`#renderArcs` therefore counts with its own `index`, not `forEach`'s: `forEach`'s
index would leave a hole wherever a band was skipped, while the hover layer
indexes its dots from 0 with no holes — so tip N would pair with band N+1. The
index is the only thing pairing an arc with its tip; `top-layer-tips.ts` pairs them by it.

The dot and its tip are **SIBLINGS**, both cloned out of the same fragment. The
tip cannot be a descendant of the dot: an absolutely-positioned ancestor breaks
anchor positioning for a fixed tip, and the dot must be absolute to sit on its
band. Both carry the anchor NAME `--gauge-zone-<i>` — the dot declares it, the
tip points at it. Without it the tip has no anchor, `position-area` is
meaningless and the browser parks the tip wherever it likes.

The ONLY numbers JS gives CSS are the angle and the colour: `cos()`/`sin()` in
the CSS turn the angle into a position on the ring, so the dots follow the gauge
at any size with nothing measured here. The tip is pushed OUTWARD along its
band's radius (`radialArea`) so neighbouring zones' tips diverge instead of
stacking.

The accessible name goes on the **ARC**, which is what a pointer and a screen
reader's virtual cursor land on. The `<svg>` is `aria-hidden`, so the band needs
`role="img"` to be announced at all.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`

### T-legend-caps-at-six-and-rolls-up

A legend draws at most `MAX_ITEMS = 6` rows. Beyond six it stops being a key —
nobody matches the eleventh shade of purple to its label, and beside a chart it
grows taller than the chart. Five named categories plus an "Other" total keeps
the shape readable and still accounts for every value: the numbers add up to
the same whole.

The roll-up only happens when it BUYS something. With exactly `MAX_ITEMS + 1`
entries "Other" would stand for one category, so the sixth is left named.

Only NUMERIC values are summed. A legend of labels with no values gets an
"Other" row with no value rather than a meaningless 0. Its swatch takes
`colorIndex: MAX_ITEMS` — the next hue after the named ones — so "Other" never
reuses a colour that already means something.

Because of all this, a consumer toggling a chart must prefer
**`detail.indices` over `detail.index`**: the "Other" row stands for several
series, and `index` alone would hide one and leave the rest drawn under a row
that says they are off. When the row comes back ON it reports only the
categories the reader had left active, so restoring the group does not silently
un-hide something they switched off in the breakdown.

The folded categories are kept WITH their original indices (`#rolled`), because
the breakdown menu has to name the right series back to the chart and the row
itself only knows a total.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-rollup-row-has-its-own-prototype

The LAST row of a capped legend needs a second control beside its key chip.
A menu button nested inside the chip's button is invalid HTML, and the browser
un-nests it. So `template.rollup-tpl` is a WRAPPER holding the menu button, and
the row — an ordinary `template.item-tpl` clone, found as `.rollup > .item` —
goes in front of it (TODO 149). Nothing in TS marks it with a class (TODO 344).

The legend hears only its chips' `quick-filter-click`, so a click on the menu
button toggles nothing and needs no `stopPropagation()`.

The breakdown is the menu's own CHECKBOX rows (`data-select="multiple"`),
handed as data through `menu.items()` (TODO 523 P2), plus `data-commit`, which
is the point — the reader ticks several categories and the menu stays open until
Apply rather than closing after every click. `sherpa-menu` already holds the
rows as a draft and restores them on Cancel, so nothing here manages that. Each
row's `value` is the SOURCE index, so Apply can name the right series back to
the chart without a second lookup.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-legend-suspend-remembers-the-set

The "Other" row's own toggle SUSPENDS its whole group. Its breakdown checkboxes
must follow it — leaving them ticked under a row that says "off" is a lie.

But the per-item choices are **NOT CLEARED**. They live in `#rolledActive`, so
switching the row back on restores exactly the set the reader last applied
rather than turning everything on. `#syncBreakdownBoxes` only ticks and unticks
the boxes and never touches that set, which is what makes the round trip
lossless. Suspended → every box off. Restored → back to the remembered set.

Same suspend-but-remember rule the Sort chip and the value-filter chips use:
suspend ≠ clear.

Applying the breakdown of a SUSPENDED group therefore turns the row back ON —
ticking anything in it means the reader wants it back, and Apply would
otherwise record a set that nothing displays. An empty set leaves the row off,
which is the same statement.

The key chip's `data-current` is the state; the chip says `aria-pressed` from
it and dims itself, so the two cannot disagree.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-hiding-a-series-rescales-the-axis

**A category left out is a chart drawn from FEWER rows**, never a `display:
none` on the drawn `<g>` / bar / slice. Since 2026-09-29 (the API audit, A3)
the charts have no hide doors at all — `setBarHidden`, `setSeriesHidden`,
`setSliceHidden` and their getters are gone, and every provider push cleared
them anyway. A legend's pick narrows ITS chart through the provider, which
hands the chart the rows that are left.

The scale is derived from the rows it is GIVEN, so the three charts say it in
their own terms:

- **line chart** — the y-extent covers the series drawn, so leaving one out
  re-scales the axis.
- **barchart** — the y-max comes from the bars it is given, so the rest use the
  full height; with no bars, no axis.
- **donut** — the total covers the slices it is given, so the ring always
  CLOSES. A donut reads as parts OF A WHOLE; a hole where a slice used to be
  would misreport the rest.

A mark's COLOUR comes from its `colorIndex` — the category's slot in the
declared order — never its position, so leaving one out never shifts another's
hue (`T-a-category-keeps-its-colour`).

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-line-chart.spec.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-gridlines-run-to-the-top-label

The gridline loop runs to `bands` **INCLUSIVE**, so the TOPMOST axis label gets a
line, and starts at `i = 1`, so the bottom one does not.

Stopping at `bands - 1` — 0% and 100% being the plot's own edges — leaves the
highest value the one label on the axis with nothing beside it, as only the
BOTTOM edge is drawn (the x-axis rule). `i = 0` stays
excluded for the same reason from the other end: that line would sit exactly
under the x-axis rule.

Both the lines and the labels are placed by `tickPercent(i, bands)` off the same
`#tickSteps()` count, so the two cannot drift. The SVG's y runs DOWNWARD, so a
percentage measured UP from the bottom is inverted (`100 - tickPercent(…)`).

- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`

### T-chart-tip-is-a-sibling-of-its-dot

Every chart hover tooltip is a **SIBLING** of its dot, never a descendant, and
JS supplies exactly one thing about it: the anchor NAME.

**Why siblings.** The dot must be `position: absolute` to sit on its own mark, and
an absolutely-positioned ANCESTOR breaks anchor positioning for a `fixed` tip. So
the whole fragment is cloned and `dot` and `tip` are appended side by side.

**Why the anchor name comes from JS.** CSS cannot derive a per-mark
`anchor-name`. Without one the tip has NO anchor at all, `position-area` is then
meaningless, and the browser parks the tip wherever it likes — which is why every
donut tip appeared beside its dot instead of above it. The name goes on **BOTH**:
the dot DECLARES it, the tip POINTS at it.

Everything else about the placement is declarative — see `.sherpa-tip` in
`core/sherpa-anchor.css`. Nothing here measures anything.

Per chart:

- **line chart** — the dots reuse the SAME x/y percentages the polyline was drawn
  from, so a dot can never sit anywhere but on its own point. They are HTML, not
  SVG, because an SVG element cannot be a CSS anchor. A dot lives in the
  `.hotspots` layer, OUTSIDE the `<g>` carrying the series' properties, so it
  inherits nothing — without an explicit `--_border` its `var(--_border, …)` fell
  through to the fallback and every dot painted the same grey. The tip's label is
  the series NAME plus the x label, because a value alone is ambiguous on a
  multi-series chart.
- **barchart** — the tip lives on the bar COLUMN, so there is no separate dot
  and the anchor name is the ONE thing JS supplies; everything else about the
  placement is declarative.
- **donut** — the ONLY number JS gives CSS is the slice's MID-ANGLE, measured
  from 12 o'clock to match the arcs; `cos()`/`sin()` in the CSS turn it into a
  position, so the dot follows the ring at any size. `radialArea(mid)` pushes the
  tip OUTWARD along the slice's radius so it clears the ring rather than covering
  the data it describes. The TIP carries the slice index too, because the slice
  is inside `<svg>` and cannot be reached by a sibling selector.
- **sparkline** — a dot is stamped per value with its own `--_v` and `--_i`
  inline, and positions itself in CSS; dot and tip share an anchor name, so no
  CSS rule is written per index and there is no cap in the CSS (TODO 283).

- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `src/core/ui/chart-parts.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-y-axis-width-is-fixed-not-measured

The y-axis column's width is **FIXED in CSS** and long labels truncate. Nothing
about it is measured in JS.

Sizing it from the data made the plot WIGGLE whenever a value crossed a digit
boundary — a live chart that re-scales on its own then shifts its whole plot
sideways as the numbers tick.

The axis PRESENCE is written rather than inferred, for the same reason
`T-empty-write-lets-css-collapse` exists: an absent `data-ticks` must not mean
"no axis", and a `data-ticks="0"` must. So `:state(has-y-axis)` is written
from the bands `renderValueAxis` drew, and the `data-ticks` read passes `min: 0`
rather than testing `>= 0` — a
NEGATIVE count then clamps to "no ticks" instead of silently falling back to the
default of 4 (which matches the Figma Chart Axis).

`renderValueAxis` clears the ticks BEFORE its early return, or a `data-ticks="0"`
would leave the previous scale on screen labelling nothing.

One label per division BOUNDARY — `steps + 1` of them — each placed at the SAME
percentage `tickPercent()` gives its gridline, so the two cannot drift. The
barchart also hands `--_bands` to CSS, because its gridline gradient repeats
every 1/bands of the plot: the lines and the labels come off that ONE number.

The line chart's span is `min..max`, NOT `0..max`: its y-scale is derived from
its own extent, so an axis running from 0 would label gridlines that are not
where the lines actually sit. Each tick is placed by its own `--_at`, so the
DOM's order says nothing about where a label sits.

- Site: `src/core/ui/chart-parts.ts`

### T-chart-datum-aliases-are-not-copies

`BarDatum`, `DonutSlice` and `LegendItem` are **ALIASES**, not copies, of the
shared shapes in `core/chart-datum.ts`. Do not "tidy" one into its own interface.

A bar, a donut slice and a legend row are the same three fields, and three names
for one shape meant crossing between them cost a `.map()` that rebuilt each
object identically. The names stay because each reads better at its own call
site.

`LegendItem` aliases `LegendDatum` rather than `ChartDatum`, because a legend
sits BESIDE a chart showing the same data, so a `ChartDatum` should pass straight
into one — and it does: `LegendDatum` is `ChartDatum` plus the two things only a
legend has, a value it may PRINT rather than plot, and a status swatch.

`sherpa-radial-chart`'s `RadialSlice` is the third alias and is deliberately NOT
cited there: its one-line JSDoc is the exported type's first prose line, which
the spec generator reads into git-tracked YAML.

- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`

### T-populate-label-not-name

`sherpa-metric`'s populate shape takes **`label`**, matching the attribute
(`data-label`) and every other populate shape in the library — `label` is the
word in 7 of 13.

It takes no `name`: a rename drops the old name (`T-a-rename-drops-the-old-name`).

This is the component-level half of
`T-populate-vocabulary-is-label-value-description`.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`

### T-metric-status-follows-the-trend

**STATUS IS TIED TO THE TREND** (Will's rule), so `sherpa-metric` sets its own
`data-status` — a caller passing one would be duplicating something the data
already says, and the two could then disagree.

    up    → success   (a rise is good news)
    down  → critical  (a fall is bad news)
    flat  → default   (nothing to report)
    none  → default   (a raw data point with no relevant trend)

"Default" means **NO `data-status` at all**, not `data-status="default"`. A
status pin only colours for a NAMED status, so REMOVING the attribute is
what returns the tile to its neutral surface and ink — the same reason
`T-empty-write-lets-css-collapse` exists.

The trend itself is derived from `deltaPercent` when it is not given explicitly
(`> 0` up, `< 0` down, `0` flat, absent or non-finite → none).

- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `src/components/sherpa-metric/sherpa-metric.css`

### T-donut-slice-is-a-closed-path

Each donut slice is **ONE CLOSED `<path>`** — a ring segment with all four
corners rounded, built by `ringSegmentPath()`. A STROKED CIRCLE whose dash
exposes only its own span can express NEITHER of the two things Figma asks for.

A stroke is a thick LINE: it has two caps and no corners. So it could not carry a
border round the whole slice (only along the two long edges, as a second arc
drawn on top), and it could not round the four corners at all. A closed path does
both in ONE element: `fill` tints the body at 60%, `stroke` traces the entire
boundary, and the corner arcs are part of the outline. Same primitive, same
reason, as `T-gauge-band-is-a-closed-path`.

The geometry, all in viewBox units of a 100×100 box (so every number is a
percentage of it), matching Figma's five ELLIPSE arcs with `arcData.innerRadius`
0.7, `cornerRadius` 2, a 1px stroke and a 60% fill:

- `CORNER = 1` — Figma's `cornerRadius` 2 on a 200px chart.
  `ringSegmentPath()` clamps it down for a slice too thin or too short to hold
  it.
- `OUTLINE = 0.5` — 1px on a 200px chart, ALIGNED INSIDE. SVG has no inside
  stroke (it always straddles the path), so the path is drawn half a stroke in
  from the TRUE edges and the stroke then lands inside the band, exactly as Figma
  paints it. That is why `outer` is `CENTRE - OUTLINE / 2` and `inner` is
  `CENTRE * 0.7 + OUTLINE / 2` — Figma's `innerRadius` 0.7 makes the band the
  outer 30%, and a `pie` fills to the centre instead.
- `MIN_SHARE = 0.005` — a slice never shrinks below this SHARE, so a 0.1% slice
  is still a visible sliver rather than a zero-width path the browser drops
  entirely.

Slices **TOUCH** — no gap, as in Figma, where the 2px rounding alone separates
them. The old flat-capped 1-unit gap was standing in for that rounding.

There is **no `-90deg` transform**: `ringSegmentPath()` measures CLOCKWISE FROM
12 O'CLOCK already, which is where Figma's `startingAngle` of -1.5708 rad puts
the first slice. No transform means the rounded corners stay true.

The `<path>` is cloned from INSIDE the template's `<svg>`, not the wrapper — the
wrapper exists only so the HTML parser puts the path in the SVG namespace.

The slice's `--_border` is its own token: colour 5 of the series' sequence, held
at FULL strength. A mark's FILL moves along its ramp; its BORDER does not.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`

### T-sparkline-headroom-is-a-share-of-the-box

A sparkline's normalisation window is PADDED, and the padding is a fraction of
the **BOX**, not of the data's spread.

Normalising to exactly `min..max` puts the lowest value at 0% — flat against the
bottom edge — so the area fill has nothing to fill under it and the trend reads
as a line clipped at the floor.

A fraction of the SPREAD was the obvious fix and is wrong: it gave the same 11.5%
every time, which on a 28px sparkline is only **3.2px** of fill — a sliver. What
governs how the fill looks is its share of the box.

So `LINE_SHARE = 0.62`. The extra range is `spread / share - spread`, split
**0.8 below** the minimum (that is the fill) and the rest above the peak (so the
line does not touch the top edge either). At 0.62 the line uses the top ~62% of
the box and the lowest point sits ~30% up, so roughly a third of the height is
fill. The trend still reads clearly; a larger share would flatten it.

Only the most recent `SLOTS` (8) values are kept, and one shape is stamped per
pair, each with its own two values inline. The COUNT goes to CSS as `--_len` because CSS cannot count for
itself, and the hover dots space themselves with `--_i / (--_len - 1)` — so that
one number is all they need, and no per-dot x position comes from JS.

- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`

### T-a-gauge-composes-the-ring

`sherpa-radial-chart` (was `sherpa-radial-chart`) owns the ring — donut, pie, and
the arc variables `data-sweep-start`, `data-sweep` and `data-inner`. The gauge
uses the same pen and keeps its own needle, zones, scale and caption.

**It composes at the DRAWING layer, not the DOM**, and the measurement is why:

| | |
|---|---|
| shared CSS classes | 7 of 24 — **29%** |
| gauge-only | `needle` `hub` `hub-cap` `scale` `zone` `caption` + 6 more |

A nested `<sherpa-radial-chart>` cannot work either, and it is worth knowing
before trying: the gauge's SVG is `viewBox="0 0 100 50"` with
`aspect-ratio: 2` — the TOP HALF of the ring's box — while the ring is
`0 0 100 100` at `aspect-ratio: 1`. A child brings its own square box and its
own shadow root, so the parent's crop cannot reach it. Composing in the DOM
would mean the gauge reaching into the child's layout.

What they DO share is `ringSegmentPath()`, which already takes every variable
either needs, and the geometry constants beside it.

**One of those constants was written twice.** The gauge computed its hole as
`CENTRE - 15` and the ring as `CENTRE * 0.7`. Both are 35.25 at a 100-unit box
— one value with two spellings, which drift apart the moment either moves. They
now share `RADIAL_INNER_RATIO`.

- Site: `src/core/ui/shared-constants.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-percentage-floor-needs-a-definite-parent

`minmax(min(var(--_plot-height), 100%), 1fr)` in `sherpa-barchart.css` reads as
"180px, but yield when the host is shorter". In a host with NO height it
collapses the plot to nothing.

A percentage inside a track sizing function resolves against the grid
container's block size. When that size is indefinite — the normal case for a
chart dropped into a page — the percentage cannot resolve, the `min()` falls to
zero, and the 180px floor is gone.

Measured: a `sherpa-barchart` with only `inline-size: 400px` set was **35px
tall**, plot 23px, bars 13px. The only test that caught it was a TOOLTIP test,
which failed on "the tip sits above the bar" because there was no room above
the bar. Nothing in the chart suite noticed the chart had no height.

A BARE floor is wrong too. It cannot shrink, so the Records card (225px host,
one row shorter than the Dashboard's) drew its x-axis labels over the legend:
the `.chart-body` box shrank to 145px, but its 180px row overflowed it.

The fix is a flex BASIS, not a track floor. `.chart-body` takes
`flex: 1 1 <plot + x-axis row>` and rows `minmax(0, 1fr) auto`. A basis is the
natural size: an unsized host gets it in full, a short host shrinks it, a tall
one grows it. Measured the same in Chromium, Firefox and WebKit.

A grid item has no flex basis, so the VERTICAL-legend mode (the host is a grid)
keeps the bare floor. Without it, that chart falls to a 3px plot.

- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `test/e2e/reforged-chart-tooltips.spec.ts`
- Site: `test/e2e/reforged-chart-legend-slot.spec.ts`

### T-a-bar-hangs-from-the-zero-line

A bar measured from the plot floor, so a NEGATIVE value drew an empty column
and said nothing at all.

Now the scale fits the data, and where it dips below zero the baseline lifts
off the floor: `--_zero` is how far up zero sits, `data-below-zero` says the
chart is in that mode, and a negative bar hangs beneath the line.

**Flex cannot place it.** A bar that starts part-way up the plot has no flex
expression — the first attempt used `margin-block-end`, and the column's
remaining space squashed the tallest bar to 98px where it wanted 144. Only in
this mode the bar is positioned against its column instead: `inset-block-end`
for a positive one, and `inset-block-start` for a negative, whose TOP edge is
the line. A chart of positive values keeps the flex layout untouched.

Measured on a 180px plot with `[-5, 10, 20]`: the line at 36px (a fifth of the
way up, since −5 is a fifth of the 25 span), the negative bar from 36 down to
0, and 20 drawing exactly twice 10.

- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `test/e2e/reforged-barchart.spec.ts`

### T-a-metric-condenses-by-wrapping

A metric tile drops its sparkline at narrow widths, and NO breakpoint says so.

The card is a WRAPPING flex row that CLIPS. The figures block is bounded
120–160px and the sparkline carries a 120px floor of its own. When the card
cannot give the sparkline its floor, the sparkline wraps to a second line and
the clip hides it, leaving value and trend. The threshold falls out of the
arithmetic — 16 host padding + 160 figures + 8 gap + 120 sparkline = 304px —
so it moves on its own if any of those tokens change.

This replaced `@container sherpa-metric (max-width: 220px)`, a guessed number
that had no relationship to what the tile actually holds.

THE CARD NEEDS AN EXPLICIT ONE-LINE HEIGHT (`--_line`, from the value and trend
line-heights). A wrapping flex box measures its WRAPPED height, so the tile grew
88 -> 96px the moment the sparkline wrapped, and `min-block-size: max-content`
does not help — it measures the wrapped height too.

Value and delta both ellipse on one line for the same reason: a wrap would push
the trend out of the card and past the clip.

- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-metric/sherpa-metric.css`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-at-property-needs-the-document

**`@property` in an adopted stylesheet does not register.** It parses, it lists
in `cssRules` as a `CSSPropertyRule`, and `CSS.supports('--x', '1')` returns
**true**. None of that is registration: the value stays an untyped string, so
arithmetic never computes and `if(style(--x: 0))` never matches.

Measured. The same cells, same sheet, same shadow root:

```
adopted sheet only:           "calc(sibling-index() - 1)"   ← raw text
then registered in document:  "0", "1", "2"                 ← same cells
```

So the five `--sherpa-group-*` used by `.sherpa-group-grid` are registered in
`tokens.css` (a document `<link>`), while the RULES that use them stay in the
adopted sheet. `scripts/project-tokens.mjs` emits the block.

This is the third member of a family worth naming together, because they fail
the same silent way and were each found by measuring rather than reading:
`@import` is dropped from an adopted sheet
(T-import-dies-in-an-adopted-sheet), a document class rule cannot reach a
shadow root (T-a-document-class-cannot-reach-a-shadow-root), and `@property`
cannot register from one.

`src/` used to hold 16 more of these in component sheets — sparkline (10),
slider (3), gauge (2), barchart (1) — every one commented "typed so it
animates". **They were deleted 2026-09-22.** Three things were true of all of
them:

- They never registered, being in adopted sheets.
- Nothing animates a custom property anywhere in `src/` — grepped.
- JS writes each as a FINISHED string (`"5"`, `"30%"`, `"18deg"`) and the CSS
  only reads it back, so no type was needed.

Proof they did nothing: a browser snapshot of `--_v0`, `--_min`, `--_range`,
`--_len`, `--_pct`, `--_fill-pct`, `--_angle` and `--_h` was taken before and
after removal and came back **byte-identical**. 576 tests unchanged.

The lesson is the comment, not the code: sixteen blocks claimed to enable an
animation that does not exist, in a place the feature cannot work. A comment
that explains a mechanism is worth checking against whether the mechanism runs.

- Site: `src/core/sherpa-grouping.css`
- Site: `scripts/project-tokens.mjs`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.css`
- Site: `src/components/sherpa-slider/sherpa-slider.css`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`
- Site: `src/components/sherpa-barchart/sherpa-barchart.css`
- Site: `test/e2e/reforged-grouping.spec.ts`
- Site: `src/components/sherpa-group/sherpa-group.css`

### T-a-legend-remembers-its-off-set-by-label

`sherpa-chart-legend` had no memory and no public door. `#render()` never wrote
`aria-pressed`, so **every re-populate silently cleared the toggles** — which a
source push does on any filter change. And nothing outside could set them, so a
chip over the same field had no way to push back.

It now keeps an off-set and exposes it as `legend.off`.

**By LABEL, not by index.** A re-populate re-orders and re-counts: a filter that
removes a category shifts every index below it, so an index-keyed set would
dim the wrong row. `countBy` puts the field VALUE in `label`, which is also
exactly what the filter needs — no lookup table.

The getter is the read-back door the ownership rule asks for: a host that SET
something needs to ask what the component now holds.

**A roll-up row records what it FOLDED.** Its own label is "Other", which is a
value of nothing: recording that dims the row and narrows nothing, which is
exactly what the dashboard did on the first pass — clicking Other left the
count at 1284 and `off` reading `["Other"]`. It now records the real
categories, and reads as ON while any of them is.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-suspended-legend-row-keeps-its-place

Will, 2026-09-22: *"I just want it to be set to an inactive state so that it
can be toggled back on. Kinda like how we can toggle filter chips without
losing the chip or set value."*

Once a legend toggle became a FILTER (T-a-legend-toggle-is-a-filter), turning a
row off deleted it. The chain is short and each link is correct on its own:

1. The click writes `['status', 'ne', 'churned']` into the source.
2. The source pushes the filtered rows.
3. `countBy` returns one datum per category **present in those rows** —
   `includeEmpty` is off by default, because an empty bar for a category
   nothing matched is normally noise.
4. `churned` has no rows, so it is absent, so the legend drops it.

A row that is gone cannot be switched back on. Measured: clicking "churned"
left three rows of four, while `legend.off` still correctly read
`["churned"]` — the STATE was right and only the drawing was wrong.

The legend now remembers the last datum it saw for each label and re-inserts a
suspended one, in its original place, at the value it last held. So the row
reads `churned 25`, greyed, rather than `churned 0` or nothing — the same way a
filter chip keeps its set value when you switch it off.

**Not fixed with `includeEmpty: true`.** That would show `churned 0`, which is
a different claim: zero records match, rather than this category is excluded
from the question. And it would put the burden on every caller.

This is the suspend-versus-clear rule in a new place. "Off" keeps the value;
"gone" deletes it. Collapsing them has now cost a typed filter, a sort column
and a legend row.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-breakdown-pick-is-a-legend-pick

Unticking a folded category in the "Other" breakdown menu did NOTHING to the
view. The chart kept its slice, the tiles kept their count, and the menu closed
looking as if it had worked.

Two halves, both missing:

- the legend emitted `legend-breakdown-change` and **nothing in the app
  listened**. It was a public event with no subscriber anywhere but its own
  test.
- the legend never updated its own `off` set, so a caller reading `legend.off`
  — which is how `bindSelection` draws the field — saw no change either.

A breakdown pick IS a legend pick: the folded rows go into `off` like any
other, and the row re-reports itself as `legend-item-click` with its
`indices`. One event for a caller to bind, and the off-set stays the one
answer. `legend-breakdown-change` still fires for a caller who wants the
narrower detail.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-gauge-names-its-zones-once

**A gauge's zone is NAMED on the gauge, and its tooltip and its legend row
both say that name** — TODO 128, Will: *"Gauge tooltips should match the
segment name as shown in the legend."* The two had different owners: the tip
said the zone's STATUS word (`Success`, `Warning`, `Critical`), and the
legend was filled by hand in the page's script (`Low (0–20)`, `Watch
(20–40)`), so they could not agree, and the ranges were typed twice.

A band in `data-zones` takes a third part — `0-20:success:Low`, or `label` in
the JSON form. The tip reads `Low` · `0–20%` (the range carries the gauge's
unit), and the gauge FILLS its slotted legend with the same two — label and
value — so a legend row is `Low 0–20%`.

Only NAMED zones fill a legend: a gauge with no names leaves its legend to
its host, as before, and a band with no name keeps its status word. The fill
is skipped when the rows have not changed, as every value write comes
through the same sync.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-gauge-chart.spec.ts`

### T-a-chart-shape-places-its-legend

**A chart wider than square puts its legend beside it, a list; square or narrower,
below it, a strip.** Will, TODO 623: *"Use CSS aspect ratio, of a chart's container
(container query)… Wider containers get the legend to the side. Square or narrower
place it below."* **In a layout grid, its card's column and row spans decide, not
its pixels.** Will, TODO 623: *"use the column and row span ratios, instead of aspect
ratio"*. So a 4x4 card that measures 470x289 is square, and its legend goes below.
Nothing else says where: `data-legend` on a chart and `data-orientation` on its
legend are gone. Under 22rem of its own width, a strip becomes a list (Will, TODO 162).

Six things that are not obvious:

- **`.chart-shape` is the box the query reads.** The whole chart, or in a layout grid
  a box of one pixel per span: 4x3px. One query answers both, and `.chart-figure`
  escapes it with `position: absolute`, onto the host. `container-type` gives no
  layout containment in all three engines, measured, so the host stays its
  containing block.
- **The grid publishes the spans.** `--sherpa-layout-grid-col-span` and `-row-span`
  sit beside each `grid-column` and `grid-row` in the generated grid rules, so they
  follow the breakpoint, a lone last child and a drag, and a card inherits them. Read
  with NO fallback, on purpose. A card with no row span leaves `.chart-shape` `auto`,
  so its pixels decide.
- **`size`, not `inline-size`.** An aspect ratio reads both axes. A size container
  takes no height from its content, so each family names what an unsized chart
  measures, in `contain-intrinsic-block-size`: bar and line 212px, gauge 208px, radial
  300px. Those are what each measured before. A line had no real one.
- **The HOST is a container, and a container cannot restyle itself.** So the figure
  is what the query turns: a flex column, or the 7:3 grid.
- **The legend is TOLD, by a style query.** WebKit walks from a slotted legend's sheet
  to the chart's HOST and never to a box inside the chart, so a size query there read
  the wrong box. A name is tree-scoped too. The chart's sheet sets
  `--sherpa-chart-legend-strip` on it, which works in all three, and
  `@container style()` reads it. Measured in Chromium 153, Firefox 155, WebKit 26.6.
  Outside a chart it is unset, so a list.
- **`:state(has-legend)` guards the split.** With no legend, a wide chart keeps one
  column and its plot takes the whole chart.

`::slotted()` inside an `@container` works in Chromium, WebKit and Firefox, measured
by the tests below.

- Site: `src/core/sherpa-chart-frame.css`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend-slot.spec.ts`

### T-a-match-marks-its-own-mark

**A highlight covers the mark that matches: its own start to its own end.** Will, TODO 638.
A matched count alone says how much, and not where. Drawn across a whole stacked bar it
started at the base, so hovering the third value lit the first. So `summariseMarked` says
`matched` on every piece and section, and each draws its own part from its own start. A bar
or slice with nothing inside it still fills from its base: its match has no position.

- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `test/unit/aggregate.test.mjs`

### T-a-horizontal-legend-is-three-by-two

A horizontal legend was a wrapping flex row, so it put a different number of
entries on each line at every width — three here, five there, and a lone one
stranded below.

It is a 3x2 GRID: six cells, which is `MAX_ITEMS`, so the last cell is always
the roll-up with its breakdown menu. `1fr` columns rather than `auto`, because
three equal cells are what keep the second row's entries under the first row's.
Entries are centred in their cell, since a two-row grid leaves a cell taller
than its entry wherever a label wraps.

**And the grid is capped and centred.** Will, 2026-09-26: across a 12-column
card the three cells sat a third of the page apart, too far to read as one
key. `max-inline-size: 40rem` — rem, so it follows the text size, as the tip's
`16rem` does — and `margin-inline: auto`. Narrower than that, it fills.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-the-breakdown-button-shares-the-other-row

The roll-up needs a track for its menu button. Without one, the toggle spanned
every track and the button wrapped to the line BELOW, which reads as a seventh
row that is not there.

The legend declares a track for it: entry, value, button (two and a button
since TODO 149 made the swatch and label one key chip). An ordinary entry takes
the first two and leaves the button's empty; the roll-up takes all three.

An implicit track is only created by an item placed past the explicit ones, and
`1 / -1` is not one — so the button's track must be declared.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-legend-keeps-one-row-on

Will, same message: *"at least 1 must be active at all times so we need to
prevent toggling of the last active legend item."*

Hiding the last row leaves an empty chart beside an empty grid and no obvious
way back — and it is not a question anyone asks. The click is REFUSED and the
legend is put back as it was, rather than left dimmed over an unchanged filter.

**THE LEGEND REFUSES IT, not the caller.** In the data layer the floor is a
filter rule guarding a VISIBILITY question. Will: *"legend filtering is just filtering. visibility &
state is a component concern."* It is now in `sherpa-chart-legend`, beside the
off-set and the roll-up rows it has to count — so any caller gets it, not only
one that used the right binding.

Two doors reach the same state and both are guarded: the click, and a host
writing `legend.off`. A refused click reports NOTHING — no `legend-item-click`,
no `aria-pressed` change — because a dimmed row over an unchanged filter is the
lie the rule exists to prevent.

A roll-up row counts as the categories it FOLDED, never as its own "Other"
label, which is a value of nothing.

**"On" means it DRAWS, for a click (2026-10-12, TODO 228).** A row the other
answers rule out ("Limit to matching filters") is greyed and cannot be
pressed, and a row a filter emptied draws nothing — but both counted as on, so
a reader could switch off every row that drew and leave an empty chart. The
floor counts only rows that draw; when none does, nothing is held. A HOST's
write keeps the old floor — only every row off is refused — because a chip
over the same field may pick a value no row has now, and the legend follows it.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-readonly-legend-is-a-key-not-a-filter

`data-readonly` makes a legend a pure KEY: no toggling, no button semantics.
A gauge's rows name its field's ZONES, the values of a status field; without
`data-readonly` they pick them (plan 683), and with it they only name them.

Each row is a LIGHT KEY, no chip (plan 695 P5): its swatch and its name in a
`<span>`, its value beside it, drawn in the legend's own sheet as the key chip
draws them. No button, no `aria-pressed`, no tab stop — a keyboard user must not
be handed a control that does nothing. (The chip's old `role="presentation"` on a
`tabindex="-1"` button was still a button: a focusable element keeps its role.)
`disabled` would be WRONG: the row is not unavailable, it was never interactive.

What the key chip said, the key says: ruled out, its tip and `aria-description`
say so; in lines, its tip names it; its anchor is named per row, as a chart's dot
and its tip are (`T-chart-tip-is-a-sibling-of-its-dot`). The legend's click
handler still guards on `data-readonly`.

- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.ts`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.css`
- Site: `src/components/sherpa-chart-legend/sherpa-chart-legend.html`
- Site: `test/e2e/reforged-chart-legend.spec.ts`

### T-a-chart-datum-is-reachable-without-a-pointer

A chart's tooltip carries the NUMBER. If only `:hover` reveals it, the number
is pointer-only — the chart draws data a keyboard reader cannot get at.

`sherpa-barchart` made each mark a `<button>`; `sherpa-line-chart`'s buttons
were `tabindex="-1"`, so it was not reachable either. `sherpa-radial-chart` and
`sherpa-gauge-chart` lit their tips
from `:hover` on an SVG arc with no `tabindex`, so **zero** of their data was
reachable. Measured before the fix:

```
#bar   8 focusable   #line  16 focusable
#donut 0             #gauge  0
```

The gauge's own comment said the accessible name went "on the ARC, which is
what a reader reaches" — the name was there and nothing could reach it.

Each chart is now ONE tab stop, with the arrows between its marks
(`T-one-tab-stop-per-set`); a mark keeps the `role="img"` and `aria-label` it
carried, and its tip lifts on `focusin` as on `pointerover`. The ring and the
gauge are `role="group"`, not `img`: an `img` makes its children presentational,
which hid every slice's and band's name.
An SVG `<path>` takes focus from `tabindex` perfectly well; it is only as a CSS
ANCHOR that it fails (T-anchoring-is-generic), which is what the separate
zero-size hotspot exists for.

`role="img"`, not `button`: the path IS the datum, not a control that does
something.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `test/e2e/reforged-chart-keyboard.spec.ts`

### T-a-total-says-so-in-its-label

A metric tile takes a `values` series, so it can show the LAST reading — what
a current-state tile means — or the SUM, for things that accumulate. `show:
'last' | 'total'` picks, defaulting to `last`.

**A total prefixes its own label.** Two tiles reading "Alerts 1,284" and
"Alerts 37" are indistinguishable on screen; "Total alerts" and "Alerts" are
not. A label that already begins with "Total" is left alone, so nothing reads
"Total total spend".

**An explicit `value` always wins.** Deriving over the caller's own number
would silently disagree with it; `show` only answers when nothing else has.

The derived number is grouped, because a total runs large — a series of
1000, 2500 and 900 reads `4,400`.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-the-scale-is-as-wide-as-the-ring

`sherpa-gauge-chart` puts min · caption · max on one row beneath the arc, and
that row took the HOST's width while the ring takes `.gauge-wrap`'s — capped at
`--_max-size` and holding a 2:1 ratio.

So in a host wider than 320px the ring sits centred with space either side, and
the 0% and 100% labels landed out in that space, clear of the arc they label.
Measured on the dashboard: the ring spanned **908–1228** while the labels sat
at **889** and **1247**. The 50% tick looked right because it is centred, which
is the same place under either width.

The scale now carries the same `max-inline-size`. After: both labels sit
exactly at the ring's edges, overhang zero.

- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.css`

### T-the-centre-totals-what-the-ring-draws

A donut's centre reads the TOTAL of the slices it draws, unless the host named
its own `data-label`.

As a plain attribute it is a string that stays put while the ring beneath it
redraws on every filter (`data-label="1,284"`), and a donut given none shows
nothing.

Deriving it means the number and the ring can never disagree. A HIDDEN slice
leaves the total, because the ring no longer counts it either: three slices of
40, 35 and 25 read `100`, and hiding the first reads `60`.

`data-label` still wins when a host names the centre, and an empty ring claims
nothing rather than `0`.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-metric-group-knows-it-is-stuck

**A sticky metric group knows it is stuck from its OWN view timeline, its
view cut to the line it sticks at** (TODO 402; Will: A, a scroll-driven
animation, not `scroll-state()`). `view-timeline-inset: 0
calc(100% - <its top>)` leaves a view of zero height at that line, so `cover
0` is the scroll at which its top reaches it: the moment it sticks. Measured
to the pixel in Chromium and WebKit, for a second group under the first too.
Its animation sets `--_stuck: 1`, and `@container style(--_stuck: 1)` joins
the slotted metrics. At the grid's mobile band,
`style(--sherpa-layout-grid-columns: 4)` joins them too; style queries work in
all three engines.

**From two stuck groups each is HALF a row** (Will: A): a later group once it
sticks, the first once the SECOND does, so the first must read the second's
timeline. WebKit reads a timeline name only inside one tree, so every group's
timeline is named in the PAGE, by the group's `static pageCss`, with
`timeline-scope` on their parent; the shadow sheet only reads them. The flag
is `--_metric-half`, which the metric reads too: its name and value on one
line. A first group with no second gets no half animation: a named timeline
that does not resolve fills to its END, so it would be half for ever.

**A half group never moves the page.** The host is always one grid row; only
its slot draws half, and the host takes no pointer. Had the first group's row
shrunk, the second's line would move with it.

Three things that do NOT work, each measured:

- A view timeline on a sticky box with no inset never reaches `exit`: the
  range takes the stuck distance in, so its exit is at the grid's end.
- The GRID's timeline (`exit-crossing <px>`) does, but needs the group's
  offset in the grid, which CSS cannot know.
- A name declared in one shadow root, read from another: Chromium does it;
  WebKit does not.

A sticky GRID item sticks for the whole grid, not just its row, in all three
engines. Firefox 155 has no view timeline: it sticks, full rows, unjoined, and
`@supports` keeps a 0s animation from leaving it joined.

- Site: `src/components/sherpa-metric-group/sherpa-metric-group.css`
- Site: `src/components/sherpa-metric-group/sherpa-metric-group-page.css`
- Site: `src/components/sherpa-metric-group/sherpa-metric-group.ts`
- Site: `src/components/sherpa-metric/sherpa-metric.css`
- Site: `test/e2e/reforged-metric-group.spec.ts`

### T-a-trend-line-is-one-shape

A sparkline's line and its fill are ONE `clip-path: polygon()` each, on two
elements that span the chart. JS lists the points, because CSS cannot count
them; each point's height is still a `calc()` of `--_min` and `--_range`, so CSS
scales the values.

They were one piece per pair of values, side by side. Where two pieces met on a
part pixel, each drew its edge at part strength, and the two did not add up to
a full pixel: a pale column through the fill at each point. Rounding each edge
to a whole pixel (TODO 323's first fix) closed it only where the chart starts on
a whole pixel. In Demos' Records page (4 tiles, five window widths), 5 of 20
sparklines at 1x and 6 of 20 at 2x started on a part pixel (x = 201.59,
555.50…) and showed up to 6 seams each. With one shape: 0 seams in Chromium,
Firefox and WebKit, at 1x and 2x, on any start.

Overlapping the pieces is no fix: the fill is see-through, so an overlap draws
a dark column instead. The bars keep one piece each: their gap means no two
share an edge. The pieces stay for the line too, as the boxes of its end dots.

- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.css`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.html`
- Site: `test/e2e/reforged-sparkline.spec.ts`

### T-a-datum-focus-ring-is-for-the-keyboard-only

A chart datum is its chart's tab stop, so a reader with no pointer can reach it —
`T-a-chart-datum-is-reachable-without-a-pointer`. The cost is that CLICKING one
leaves it focused, and the browser paints its default ring: measured on a donut
slice, `rgb(0, 95, 204) auto 5px`, a blue halo across the chart.

`:focus` without `:focus-visible` IS the mouse case. Measured after a real mouse
click on a slice: `matches(':focus')` true, `matches(':focus-visible')` false —
and the UA outline was painted anyway.

So suppress that one, and DRAW the keyboard ring rather than leaving it to the
UA:

```css
.chart-segment:focus:not(:focus-visible) { outline: none; }
.chart-segment:focus-visible {
  outline: none;
  stroke: var(--sherpa-theme-border-accent-2, #3b4ccd);
  stroke-width: 2;
}
```

A `stroke`, not a `box-shadow`: an SVG `<path>` has no box to shadow, and the
inset-ring idiom the controls use does not apply.

One rule in the segments sheet serves both — the donut's `.slice` and the gauge's `.zone` are each a `.chart-segment`.

- Site: `src/core/sherpa-chart-segments.css`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-pie-slice-has-no-rounded-corner

`sherpa-radial-chart` passed `radius: CORNER` to `ringSegmentPath()` for every
slice, including `data-type="pie"`. A donut's corners round because they sit on
two ARCS; a pie slice's two straight edges meet at the CENTRE, and a radius
there rounds the point off.

Measured: a pie path began `M 50.0000 49.0000` — one unit short of the centre of
the 100-unit box — and carried an `A 1 1` corner arc. After `radius: pie ? 0 :
CORNER` it begins `M 50.0000 50.0000` with no corner arc, and the donut is
unchanged at six arcs including its rounding.

Will stated the rule: *"Pie segments will have 0 inner radius and no corner
rounding on segments."* The inner radius was already right; the rounding was
not.

Since 2026-11-02 the point sits off the centre by its gap, along the slice's
middle, so the gap keeps one width (`T-a-chart-gap-is-real-space`). It is still
sharp.

- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `test/e2e/reforged-radial-chart.spec.ts`

### T-a-format-is-the-platforms

**A number's format is the platform's own `Intl.NumberFormatOptions`, as JSON
— never a mini-language of ours.** Will, 2026-09-27: *"No need to reinvent
foundational things that we already get for free."* `sherpa-metric` reads
`data-format='{"style":"currency","currency":"USD","maximumFractionDigits":0}'`
and hands it to `Intl.NumberFormat` in the reader's locale. Undeclared, it
uses the library's one format (`formatValue`). JSON that does not parse, or
options Intl refuses, report `metric-bad-format` and fall back — never a blank
tile. The data layer never formats: it returns the number
(`T-an-aggregate-returns-the-number`).

**Exact strings differ by engine and locale** (`1.3M` in Node, `1.3m` in a
browser), so a test compares against `Intl`'s own output in the same page,
never a literal.

- Site: `src/components/sherpa-metric/sherpa-metric.ts`

### T-a-host-label-must-reach-its-control

**An `aria-label` on a Sherpa host names NOTHING.** Measured 2026-09-26 on the
running page: the panel's Reset all and to-toolbar buttons read as unnamed
`button`s, and every switch as an unnamed `switch`. The host is a custom
element with no role, so the platform drops its label, and the real control
inside the shadow root has none of its own. 59 sites in the templates and
examples, plus 18 in code, were written this way — the natural way to write
it.

So a component DECLARES which inner control a host label names —
`static labelTarget` — and the base class copies the host's `aria-label`
there, follows every change, and removes it when the host's is removed. It
only ever removes a label it wrote, so a component that names its own control
keeps it. Five declare one: button (`.trigger`), input-text, select-checkbox,
select-radio (`.control`) and switch (`.input`).

**`aria-pressed` travels with it** (TODO 79): a toggle button's state is as
dead on the host as its name. The nav's Pin and Settings, and the bar's ★,
set it on a composed `sherpa-button`; the base class copies it to the same
control, and removes it when the host's is removed.

The test asks the accessibility tree (`getByRole(…, { name })`), not the
attribute: an attribute check passes on exactly the bug.

- Site: `src/core/ui/sherpa-element.ts`
- Site: `src/components/sherpa-button/sherpa-button.ts`
- Site: `src/components/sherpa-input-text/sherpa-input-text.ts`
- Site: `src/components/sherpa-select-checkbox/sherpa-select-checkbox.ts`
- Site: `src/components/sherpa-select-radio/sherpa-select-radio.ts`
- Site: `src/components/sherpa-switch/sherpa-switch.ts`
- Site: `test/e2e/reforged-host-label.spec.ts`
- Site: `test/e2e/reforged-quick-filter-toolbar.spec.ts`
- Site: `src/components/sherpa-barchart/sherpa-barchart.ts`
- Site: `src/components/sherpa-line-chart/sherpa-line-chart.ts`
- Site: `src/components/sherpa-radial-chart/sherpa-radial-chart.ts`
- Site: `src/components/sherpa-gauge-chart/sherpa-gauge-chart.ts`
- Site: `src/components/sherpa-sparkline/sherpa-sparkline.ts`

### T-a-metric-stroke-takes-no-room

**A metric's 0.5px edge is drawn INSIDE, as inset shadows, not a border** —
Will, TODO 444 (A). Figma's stroke is inside and takes no room, and the tile is
one layout-grid row tall (88). Chromium draws a 0.5px border 1px wide, at 1x and
2x, so a padding that gave back 0.5 per side left the tile 89 tall, and a held
row clipped it. Four inset shadows — one per edge, so a grouped run can still
zero a side through `--sherpa-border-*` — take no room, and the padding is the
full 4 / 8.

- Site: `src/components/sherpa-metric/sherpa-metric.css`
- Site: `test/e2e/reforged-metric.spec.ts`

### T-a-metric-is-one-row-at-every-density

**A metric's height IS the layout row: `--sherpa-display-mode-size-row`, 76 /
88 / 104** — Will, TODO 444 part 2. Density moves the spacing and the header
but not the text's line heights, so a tile sized by its content came out 78 in
compact and 108 in comfortable, and a held row clipped its trend. Figma's
Metric is FIXED too (96, at every density), so it gives no other size to copy.
The card row takes what the row leaves (`flex: 1 1 0`), and the figures stand
the value at the top and the trend at the foot of it: the space between is 2 /
8 / 8. A half-row metric (a stuck group) is sized by its content, as before.

- Site: `src/components/sherpa-metric/sherpa-metric.css`
- Site: `test/e2e/reforged-metric.spec.ts`
