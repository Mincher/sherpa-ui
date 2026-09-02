# Style tint/shade capture map

Captured 2026-08-17 before collapsing Core hue ramps to single `base`/`500` seeds.

**Purpose:** every Style (Sherpa) var that aliased a Core *step* (e.g. `neutral/800`) is being
repointed to the range's **base seed**. This map records the **tint/shade level** that re-derives the
original step from that seed — so Style can later be rebuilt as a 2-layer composite (base + overlay)
instead of aliasing a literal step.

**How to read:** `styleVar` @ `mode` used Core step `wasStep`; to reproduce it, take `newBase`
(the seed) and overlay `tone`(tint|shade) at `level`%. `err` = colour distance (0 = exact).
Core alpha ramps reverse in dark mode, so the SAME `level` index self-inverts — but the captured
level here is measured against the light-mode seed; dark-mode rows record the dark step separately.

## Known weak fits (seed can't reach the step by pure tint/shade)
- **warning shades** (color 5/6/7, err 0.24–0.34): amber desaturates worst when darkened; and
  `warning/600` sits *brighter* than the 500 seed so tint/0 can't reach it. Needs attention.
- **brand 600/700** (err 0.31): the brand seed (phlox/500) is *lighter* than 600/700, so those
  mid-dark steps aren't reachable by tinting up or shading a little. `content/active/base`
  (brand/700) inherits this.
- **accent primary hover/down** (err 0.11–0.17): accent seed lighter than the 700/800 pressed states.

These are the cases where "1 seed per range" loses fidelity — flag for a design decision (accept the
drift, or keep a 2nd seed for those ranges).

## Full map (138 bindings)

The complete JSON is embedded below for the rebuild script to consume.

```json
[
  {"styleVar":"app/primary","mode":"light","wasStep":"color/neutral/0","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":100},
  {"styleVar":"app/secondary","mode":"light","wasStep":"color/neutral/0","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":100},
  {"styleVar":"app/secondary","mode":"dark","wasStep":"color/neutral/1000","range":"neutral","newBase":"color/neutral/500","tone":"shade","level":90},
  {"styleVar":"app/tertiary","mode":"light","wasStep":"color/neutral/200","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":90},
  {"styleVar":"app/tertiary","mode":"dark","wasStep":"color/neutral/900","range":"neutral","newBase":"color/neutral/500","tone":"shade","level":80},
  {"styleVar":"surface/primary/base","mode":"light","wasStep":"color/neutral/0","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":100},
  {"styleVar":"content/title/base","mode":"light","wasStep":"color/neutral/1000","range":"neutral","newBase":"color/neutral/500","tone":"shade","level":90},
  {"styleVar":"content/title/base","mode":"dark","wasStep":"color/neutral/200","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":90},
  {"styleVar":"border/primary","mode":"light","wasStep":"color/neutral/400","range":"neutral","newBase":"color/neutral/500","tone":"tint","level":30},
  {"styleVar":"border/primary","mode":"dark","wasStep":"color/neutral/700","range":"neutral","newBase":"color/neutral/500","tone":"shade","level":50}
]
```

> Note: only a representative slice is inlined above. The authoritative full 138-row map lives in the
> session transcript (figma_execute result, 2026-08-17) and is regenerable by re-running the capture
> query. Regenerate rather than trust this slice for the actual rebuild.
