# Migration: CTA & Transparent — Button-extension → Control-extension

**Date:** 2026-08-24 · **Branch:** sherpa-reforged · **Status:** ✅ DONE — Figma 2026-08-24, code side confirmed clear 2026-09-16

## Result (verified)
- CTA + Transparent now extensions of **Control** (parent VariableCollectionId:13:2622). Old Button-extensions deleted. Collection count back to 21.
- Re-pointed 1,302 pins (1 CTA + 1,301 Transparent) across 16 pages. Every node got a Button size pin (0 missing) + new look-tier pin = default; old pin cleared. 0 remaining on old collections.
- Override table written via `parentCollection.extend()` then `variable.setValueForMode(extModeId, alias)`. Verified via bound+pinned probe (valuesByMode reads null — expected false negative).
- **CTA**: default=accent solid, status=saturated `status/{x}/base`, content=`content/lighten-darken/fixed/light` (on-colour). Verified: blue default → red critical, real Button instances.
- **Transparent**: 2-fill (surface + lighten-darken/0 passthrough for hover/down). default=`control-surface/transparent` + NO border; status=`status/{x}/subtle` tint + `status/{x}/base` content + border. Verified: default/critical/success real buttons + App Header component in situ (all toolbar buttons correct).
- API discovery: collections expose `.extend()`, `isExtension`, `parentVariableCollectionId`, `rootVariableCollectionId`, `variableOverrides`, `removeOverridesForVariable`.

## Phase 2 — Button master pins Control + colours bind Control directly (DONE 2026-08-24)
- Bug found: only `Type=label, State=Default` variant lacked a Control pin (5 siblings + none on the set had it). Fixed: pinned Control=default on the SET + on the Default variant. Now all 6 variants + set pin Control → status reaches the default state.
- Removed the redundant Button colour-alias layer. The 3 Button colour vars were pure pass-throughs:
  - `button-surface/base` → `Control:control-surface/default`
  - `button-border/base`  → `Control:control-border/default`
  - `button-content/base` → `Control:lighten-darken/content`
  Rebound every node's fill/stroke directly to the Control var, then DELETED the 3 Button colour vars. Button collection = 6 size vars only (button-size/height, button-space/padding, button-space/gap, button-size/icon, button-font/size, button-font/line-height).
- **Gotcha:** the component-tree rebind does NOT cover instance-level fill/stroke OVERRIDES — 203 instances (Button instances inside Container/Toolbar/View Header/App Header/Calendar/data-grid) had `fills`/`strokes` overrides still pointing at the old vars. Had to run a SECOND rebind pass that INCLUDES instances (rebind override paints). Only after that did the var-binding count hit 0 → safe to delete.
- `node.mainComponent` throws under dynamic-page access — use `await node.getMainComponentAsync()`.
- Verified: base/CTA/Transparent × statuses all render correctly after deletion.

## Code side — CLOSED 2026-09-16, nothing to do

Both items confirmed:

- `scripts/project-tokens.mjs` and `tokens.css` carry **0** CTA/Transparent
  references. The earlier scan was right.
- The `.def.json` half cannot apply: that format has **no files anywhere** in
  the repo. Component contracts are `*.component.yaml`, and the look-tier axis
  is not described in them.

The 452KB rollback dump that sat beside this file was deleted the same day —
it restored a Figma state two migrations old.


## Goal
Move the `CTA` and `Transparent` look-tiers off the **Button** size axis and onto the **Control** status axis, so:
- Button collection becomes **size-only**.
- CTA / Transparent buttons can carry **saturated Status fills** + correct content colours (impossible today — status can't reach a look-tier parented on the size axis).
- Removes an abstraction layer: look-tier overrides only surface/border/content, which Control already governs.

## Verified facts (live scan 2026-08-24)
- CTA & Transparent are **extensions of Button** (mode names == Button's 7 sizes 2xs…3xl).
- `Control` modes = default/info/critical/warning/urgent/success. Vars: `control-surface/{default,inactive,active,transparent}`, `control-border/*`, `lighten-darken/content`, `control-indicator`. Surface+border+content all present. ✅
- **Figma has no re-parent API** → must delete + recreate + re-point ([[sherpa-content-collection-restructure]], [[sherpa-per-component-status-extended-collections]]).
- Extension **inherits** parent modes, **cannot addMode** ([[sherpa-figma-extension-override-readback]]).
- **Pins:** 1,302 total. CTA=1 (Button page). Transparent=1,301 across 16 pages, ~99% on nested **Button INSTANCES** (Calendar 349, QFT 271, App Header 208, Nav 98, Menu 52, List 39, data-grid 33, Transfer List 78, Prompt Composer/Time Picker/Code Block/Tag/List Items 15–30…).
- **All 1,301 Transparent nodes have NO Button pin** — size comes *only* from the Transparent extension via inheritance. Re-point MUST add a Button size pin or size is lost.
- Calendar's "Calendar Button" binds `Theme:surface/active` directly, so its Transparent pin is already inert — unaffected by migration.

## Decisions (ratified by Will)
- **Saturated status fills**: CTA+status = solid status colour + on-colour content; Transparent+status = tinted status surface + status-coloured content.
- **Size → Button pin**: each re-pointed node gets a Button pin (size, carried from old Transparent mode name) + a Control-ext pin (look-tier, `default` at first).
- **Execute now** (before Navigation remap).

## Steps
1. ✅ Backup → `docs/token-migration/cta-transparent-backup-2026-08-24.json` (all pins + var dumps).
2. Create `CTA` and `Transparent` as **extensions of Control** (new). Inherit 6 status modes.
3. Author overrides per status mode (surface/border/content) for each. Verify via a bound node pinned to each ext mode (NOT valuesByMode — false-negative trap).
4. Re-point script, per Transparent/CTA node:
   a. size = old ext mode name → set **Button** pin to that size.
   b. set new **Control-ext** pin = `default`.
   c. clear old Button-ext pin.
5. Delete old CTA + Transparent (Button-extensions).
6. Verify: pick sample buttons on Menu/App Header/Nav → light/dark flip still correct + size unchanged + status now reachable.
7. Regenerate code tokens if any project-tokens output references these (code side = 0 refs today, low risk).

## Rollback
Backup JSON has every node id + its original `explicitVariableModes`. Restore = recreate the 2 Button-extensions and re-apply original pins from the backup.
