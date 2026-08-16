# Content collection migration

Restructure status/content tokens: a first-class **`Content`** collection (role as the mode
axis) that every component aliases into, with **Status as scoped Extended Collections** on
Content + Container, replacing the monolithic `Status` collection.

## Ratified design decisions
1. **Content modes = the ROLE** (`title | primary | secondary | tertiary`). Theme (light/dark)
   stays one tier below — each Content var aliases a `Style (Sherpa)::content/<role>/<variant>`
   token which carries light/dark. Content is a thin **role-selector**, does not own theme.
2. **Content vars** = 3 mode-driven (`content/base`, `content/on-color`, `content/on-color-subtle`)
   + state tokens kept **named** (`content/active`, `content/inactive/*`, `content/link/*` — same
   in every role mode; they're states, not hierarchy roles).
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

## Phase status
- **✅ Phase 1 (DONE 2026-08-16):** built the `Content` collection. Modes title/primary/secondary/
  tertiary; `content/base` + `content/on-color` + `content/on-color-subtle` alias
  `Style::content/<role>/<variant>` per role-mode; state tokens named. Purely ADDITIVE — the old
  `Style::content/*` vars still exist and all 87 consumers still work. Nothing broke.

### Deferred phases (dedicated effort)
- **Phase 2:** Add Status Extended Collections to Content (default+inverse × info/critical/warning/
  urgent/success), re-valuing content/base etc. per status.
- **Phase 3:** Add the same Status extensions to Container (override container-surface/-border).
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
