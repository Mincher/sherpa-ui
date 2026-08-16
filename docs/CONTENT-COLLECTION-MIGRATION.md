# Content collection migration

Restructure status/content tokens: a first-class **`Content`** collection (role as the mode
axis) that every component aliases into, with **Status as scoped Extended Collections** on
Content + Container, replacing the monolithic `Status` collection.

## Ratified design decisions
1. **Content modes = ROLE + STATE** (`title | primary | secondary | tertiary | active | inactive`).
   Theme (light/dark) stays one tier below — each Content var aliases a
   `Style (Sherpa)::content/<role>/<variant>` token which carries light/dark. Content is a thin
   **role/state selector**, does not own theme. active/inactive are MODES (not repeated vars) —
   a state is a natural mode axis; `content/base @ active` → content/active/base, `@ inactive` →
   content/inactive/base, etc.
2. **Content vars** (5) = 3 mode-driven (`content/base`, `content/on-color`,
   `content/on-color-subtle`, resolving per role AND state mode) + 2 named
   (`content/link/base`, `content/link/visited` — link has its own base/visited variants and
   isn't a hierarchy role, so it stays named). The old `content/active` + `content/inactive/*`
   named vars were DELETED (collapsed into the active/inactive modes — they repeated one value
   across all role modes, wasting the axis).
3. **Status → Extended Collections** on Content (text ink) and Container (fills+borders), each in
   **default (saturated)** + **inverse (border-only)** form per status. Then **delete the
   standalone `Status` collection**.

## Spike findings (proven, non-destructive tests)
- **R1 — variables CANNOT move across collections.** The Figma Plugin API has NO
  `moveToCollection`. Putting content in a new collection = **recreate** them (new IDs), so the
  **87 consumer aliases** into the old `content/*` (from Control, Status, Container, Color Sets,
  Badge, Switch) must each be **re-pointed** by script. This is the migration's main cost.
- **R3 — role-as-mode WORKS.** Two text nodes in one component pinned different Content modes
  (heading→title, body→primary) and held. Multi-role components select the role **per text node**
  via `setExplicitVariableModeForCollection(Content, roleMode)` — exactly like Typography mode
  pinning. Design is viable.

## Extension overrides — how (and how to VERIFY)
Extensions ARE scriptable. `parentColl.extend(name)` creates one inheriting the parent's modes;
override a variable per extension-mode with `variable.setValueForMode(extModeId, alias)`. **The
write persists, but `variable.valuesByMode` reads it back EMPTY** (only parent-mode ids show).
Do NOT conclude the write failed — that's a read false-negative. **Verify by resolving through a
bound node:** bind a text node's fill to the variable, `setExplicitVariableModeForCollection(ext,
extModeId)`, read the node's resolved `fills[0].color`. (Recurring gotcha — see the memory note
`sherpa-figma-extension-override-readback`.)

## Phase status
- **✅ Phase 1 (DONE 2026-08-16):** built the `Content` collection. Modes title/primary/secondary/
  tertiary; `content/base` + `content/on-color` + `content/on-color-subtle` alias
  `Style::content/<role>/<variant>` per role-mode; state tokens named. Purely ADDITIVE — the old
  `Style::content/*` vars still exist and all 87 consumers still work. Nothing broke.
- **✅ Phase 1b (DONE 2026-08-16):** collapsed active/inactive into MODES. Added `active` +
  `inactive` modes (Content now 6 modes); the 3 mode-driven vars resolve to content/active/base
  and content/inactive/{base,on-color,on-color-subtle} in those modes. DELETED the redundant
  `content/active` + `content/inactive/*` named vars (kept `content/link/*`). The 10 status
  extensions inherited the 2 new modes and correctly leave active/inactive as state ink (they
  only tint the 4 role modes) — verified via bound node. **Apply the same active/inactive-as-modes
  pattern to Container in Phase 3.**

- **✅ Phase 2 (DONE 2026-08-16):** Status Extended Collections on Content —
  **`info | critical | warning | urgent | success`** (5, one per status). Each inherits Content's
  modes and overrides `content/base` per role-mode → `content/<role>/on-color` (so a component
  that binds `content/base` and pins its status extension gets the on-a-fill ink automatically).
  State modes (active/inactive) are left untouched — a disabled/active control keeps its state ink
  under status. Verified via bound-node (critical base@title = white; critical base@active =
  brand purple unchanged; success base@primary = light).

  **Collapsed 10 → 5:** originally built as `(default)` + `(inverse)` per status, but the
  default/inverse split was redundant — the only difference was `content/base` (default→on-color,
  inverse→base), and `content/on-color` is ALREADY the on-a-fill ink while `content/base` is the
  on-a-light-surface ink. So a component just binds the right VARIABLE for its surface
  (`content/on-color` on a saturated fill, `content/base` on a light outline) — no need for two
  extension forms. Deleted the 5 `(inverse)`, renamed the 5 `(default)` to the bare status name.
  (Also note: content ink is NOT status-specific — white text is the same on info-fill or
  critical-fill; the status HUE lives in surface/border, which is Container/Control's job.)

- **✅ Phase 3 (DONE 2026-08-16):** Status extensions on Container + re-tinted Content extensions
  to the status ramps. Ramp step mapping (each `status/<name>/color 1..6`, 1=lightest … 6=darkest):

  | override | ramp step |
  |---|---|
  | Content `base` & `on-color-subtle` | **color 6** (dark status ink) |
  | Content `on-color` | **color 1** (light status ink) |
  | Container `border/default` | **color 5** |
  | Container `surface/saturated` | **color 4** (the saturated fill) |
  | Container `surface/unsaturated` | **color 2** (light tint) |

  - Content extensions (info/critical/warning/urgent/success) now re-tint content to the STATUS
    hue: base+on-color-subtle → color 6 (e.g. dark red text), on-color → color 1 (light text on
    the saturated fill). Was neutral on-color before Phase 3.
  - Added two Container surface variables — `container-surface/saturated` + `/unsaturated` — that
    mirror `container-surface/default` in the base modes and are overridden by the status
    extensions (a component picks saturated vs unsaturated for its fill treatment).
  - Added the 5 status extensions to Container; each (across all 3 Container modes default/
    secondary/tertiary) overrides surface/saturated→color 4, surface/unsaturated→color 2,
    border/default→color 5.
  - Verified via bound node: critical content base@title = #9b2509 (color 6), on-color = #fff7f5
    (color 1); critical surface-saturated = #dd2c01 (color 4), unsaturated = #ffd7ca (color 2),
    border = #bf2c09 (color 5). Additive — nothing broke.

- **✅ Phase 3b (DONE 2026-08-16):** active/inactive as MODES on Container (mirrors Content 1b).
  Container now has 5 modes: default | secondary | tertiary | **active | inactive**. In the
  inactive mode the surfaces (default/saturated/unsaturated/hover/down) → surface/primary/inactive
  and border → border/primary/inactive; active mode → the pressed/down look. DELETED the redundant
  `container-surface/inactive` + `container-border/inactive` named vars (collapsed into the mode).
  Kept `container-surface/hover` + `/down` named (interaction states, separate from active/inactive).
  The 5 Container status extensions inherited the 2 new modes and compose correctly: a status
  container's saturated surface tints at default (#dd2c01 for critical), but **inactive wins over
  status** (critical saturated @ inactive = #f2f2f2 grey — a disabled container looks disabled
  regardless of status). Verified via bound node.

### Deferred phases (dedicated effort)
- **Phase 4 (the expensive one):** Re-point the 87 consumer aliases from `Style::content/*` →
  `Content::content/*`; re-point every `status-*` binding → the new per-collection extensions.
  Verify every multi-role component pins the Content mode per text node.
- **Phase 5:** Delete the standalone `Status` collection (+ Saturated / Border Only extensions).
- **Phase 6:** Regenerate `tokens.css` (scripts/project-tokens.mjs — the status-cascade projector
  needs rework: `--_status-*` now comes from per-collection extensions, not one Status collection),
  update `scripts/lib/scope-rules.mjs` + the ontology, fix component CSS consuming `--_status-*`,
  full test pass.

## Migration mechanics (for Phase 4)
- Recreate, don't move (R1). Script: for each old `Style::content/<role>/<variant>`, find its
  Content equivalent (`content/<variant>` @ role-mode), and re-point every consumer var's
  per-mode alias from the old id to the new. Consumer list source: scan all vars' `valuesByMode`
  for `VARIABLE_ALIAS` → old content ids (87 today).
- The CODE side is easier: `tokens.css` is generated, so once the Figma source is re-pointed and
  `project-tokens.mjs` is updated, the code CSS re-resolves automatically. The manual code work is
  the status-cascade projector + any component CSS with hardcoded status var names.

## Risks still open for the deferred work
- **Q1:** active/inactive/link — kept named in Content (done). Confirm no consumer needs them moded.
- **Q2:** Does Control also get Status extensions (like Container), or bind Content + Control modes
  only? (buttons-in-status). Decide in Phase 2.
- **R2:** the code status cascade (`--_status-*`) assumes ONE Status collection; the projector
  rework (Phase 6) is non-trivial — budget for it.
