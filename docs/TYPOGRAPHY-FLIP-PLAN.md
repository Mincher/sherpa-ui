# Typography flip — WEIGHT becomes the mode (model C) — ✅ DONE 2026-08-17

**Status: COMPLETE.** 6 weight modes + 26 size/use-case extensions built; ~6663 nodes
re-pinned; 17 old collections deleted; Button page verified rendering. Backups were `typography-backup-2026-08-17.json` and
`typography-pinmap-2026-08-17.json` — **deleted 2026-09-16**, along with the
other eleven migration dumps in this folder (~1.3MB). They restored Typography
collections that were themselves deleted later, when Typography moved into
Theme `content/*`, so they could not have been replayed. Recoverable from git
history if ever needed.


Goal: **Typography = one collection.** WEIGHT is the free axis (the mode).
SIZE + USE-CASE become extensions. 6 vars stay: `size`, `line-height`,
`letter-spacing`, `paragraph`, `weight`, `family`.

## Modes = WEIGHT (6)

`light 300 · regular 400 · medium 500 · semibold 600 · bold 700 · black 900`
Each mode re-values `weight` → Core `fonts/weight/{n}` (all 6 tokens exist).
**regular (400) = default mode.** All other vars carry base values across all modes
(size=14, lh=20, tracking=0, paragraph/base, family=Inter).

## SIZE = top-level extensions (8)

`H1 · H2 · H3 · H4 · H5 · large · small · extra-small` — override
`size` / `line-height` / `letter-spacing`. (base size = no ext; it's the mode default.)

| ext | size | line-height | tracking |
|-----|------|-------------|----------|
| H1, H2 | 16 | 24 | -0.02 |
| H3, H4 | 12 | 16 | -0.02 |
| H5 | 14 | 20 | -0.02 |
| large | 16 | 24 | 0 |
| small | 12 | 16 | 0 |
| extra-small | 10 | 12 | 0 |

(size/lh alias Core `size/*` tokens: 6:485=10, 6:486=12, 6:487=14, 6:488=16,
6:489=?, 6:490=24 — confirm the lh ids during build.)

## USE-CASE = nested extensions (2, under each size ext AND under base)

`Hero` (Inter, promo ramp) · `Mono` (JetBrains Mono) — override `family`
(+ any use-case size ramp). **Brand = no ext (base default).**

Nesting: each SIZE ext `.extend()`s Hero + Mono, AND the base mode carries Hero + Mono
at base size. So a node pins ONE leaf that composes size + use-case; weight comes from
the mode (free, trickles).

Leaf count: 8 sizes × 2 use-cases (nested) + 2 base-size use-cases + 8 bare sizes
= **~26 extensions**. Weight adds NO leaves (it's the mode).

## Pin model per text node
1. Set WEIGHT via `setExplicitVariableModeForCollection(Typography, weightModeId)` — or
   inherit from a parent pin (trickles).
2. Pin ONE size/use-case ext leaf (e.g. "H1", or "H1 › Hero", or none = Brand base).
3. Bind the 6 vars once; the pins resolve size+weight+family together.

## Build steps (destructive — needs go-ahead)
1. **Back up** current Typography + all 30 use-case/weight collections (export values).
2. On Typography: rename mode `H1`→`regular`, add 5 weight modes, re-value `weight` per
   mode, flatten size/lh/tracking to base across all modes.
3. Create 8 SIZE extensions; override size/lh/tracking per ext.
4. Under base + each SIZE ext, create Hero + Mono nested exts; override family (+ ramp).
5. **Delete** the 30 old collections (light/medium/… (Brand/Hero/Mono), Hero, Mono).
6. **Re-pin ~3768 text nodes**: map old (use-case, size-mode, weight-ext) → new
   (weight-mode + size/use-case leaf). This is the main cost.
7. Verify via bound nodes (valuesByMode reads exts EMPTY — resolve through a pinned node).
8. Update memory `sherpa-figma-typography-collections` + project token CSS.

## Risks
- ~3768 node re-pin is the big job; sweep may time out the bridge report at 32s but
  commits server-side (re-read after settle).
- Extension override readback false-negative — always verify via bound node.
- Token CSS projection + code consumers must follow (weight now a mode, not baked).
