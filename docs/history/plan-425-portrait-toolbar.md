# TODO 425 — the filter panel is the bar, in portrait: the plan of 2026-10-22

Will, 2026-10-22: the panel and the bar hold the same elements, so they are ONE
component in two orientations. Build a PORTRAIT toolbar that does what the panel
does, mostly in HTML and CSS; keep the panel; show both side by side in Demos.

## The model

- **One bar per scope, as now.** Landscape, each scope's bar sits where it
  always has. Portrait, the bars of a page stack in the panel area — one
  section each — so nothing about a bar's binding changes.
- **The flip is an attribute:** `data-orientation="portrait"` on
  `sherpa-quick-filter-toolbar`. CSS lays the same zones out as a column: the
  actions as a header row, then Switch, Group and Sort, then one section per
  field. Nothing folds in portrait.
- **Two chip variants, named for what they hold:**
  - a **field chip** — a field and its values: toggle part (badge, label) and
    menu part (value label, menu icon, menu). Today's default chip.
  - a **value chip** — one value of a field, a toggle with its count. Today's
    boolean chip, and the panel's run chips.
- **A field chip in a section** (`data-layout="section"`, set by its bar in
  portrait): its toggle part is the section's heading (label, badge), its menu
  part still opens the full menu (Advanced, Select all, Discard, Remove), and
  below it a run of VALUE chips, one per menu row. A value chip's press picks
  its row through the menu (`values`, then `apply()`), so the field chip stays
  the one owner of the answer, in both orientations, and every rule it already
  has — none, pending, waits, Limit — holds in portrait too.
- **Tiers** (Customer): its run is of field chips — each parent a value with
  its own Sites menu.

## The phases, one commit or more each

1. The chip's section layout and its value chips (lists); the bar's portrait
   layout; the Demos page, old panel and portrait bars side by side.
2. Each value chip's count, pending (only what changed) and greying.
3. Tiers: a parent chip and its Sites menu.
4. Each section's heading: the scope's name, shut and open, its badge and Apply.
5. Panel mode in the app: the bars move to the panel area in portrait; then
   Favorite, Save and Refresh to the App Header (Will: "can consider").
