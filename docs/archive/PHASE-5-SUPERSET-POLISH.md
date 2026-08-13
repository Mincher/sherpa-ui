# Phase 5 — Superset Polish (Node Graph + AI Surface)

**Date:** 2026-07-30
**Nature:** the most open-ended phase ("mature these subsystems"). Approached by surveying both, then executing the concrete, contractually-owed, and low-risk items — deferring the higher-design AI abstraction per an explicit scope decision.

## Node-graph

### Removed `sherpa-node-header` (deprecated → deleted)
Was fully orphaned (no element usage, no imports beyond its own export). Deleted the folder + `index.ts` export + 3 `component-categories.ts` entries. `sherpa-node-row data-variant="header"` is the replacement.

### Removed dead `data-multi` from `sherpa-node-row`
Declared/observed and documented but **never read** by CSS or JS — pure surface reduction, zero behavioural risk.

### Migrated node-graph events `sherpa-*` → unprefixed (Phase 0.5 contract)
The node family was the last holdout using a `sherpa-*` **event** prefix. All 14 renamed at dispatch sites, the 4 internal `sherpa-node-canvas` listeners, `@fires` JSDoc, and the typed event map (`utilities/types.ts`). **Element names stay `sherpa-*`.** Breaking for consumers — full rename table + migration note in [DEPRECATIONS.md](DEPRECATIONS.md).

| Before | After |
|---|---|
| `sherpa-node-{pointerdown,subtype-change,value-change,select,delete,drilldown}` | `node-*` |
| `sherpa-socket-pointerdown` | `socket-pointerdown` |
| `sherpa-edge-{create,update,delete,select}` | `edge-*` |
| `sherpa-canvas-subgraph-{enter,exit}` | `canvas-subgraph-*` |
| `sherpa-viewport-change` | `viewport-change` |

### Corrected DEPRECATIONS.md — `data-multi` on `sherpa-node-socket`
The earlier register entry was **wrong** ("contained to one component"). Real scope: authored on **9 sockets** in `sherpa-node-templates.html`, read live by JS in `sherpa-node.ts` + `sherpa-node-canvas.ts` (edge-lane geometry), with a **stale** "CSS compat" claim (no CSS reads `[data-multi]`). Flagged higher-risk and **deferred** (changing authored markup + edge geometry needs visual verification of multi-input nodes).

## AI surface (light scope — chosen)

No shared proposal contract existed; the AI quick-filter chip and proposal-preview were unrelated stubs. Rather than invent a large shared abstraction, added the minimum to make the proposal surface integratable:

- **`sherpa-proposal-preview`** now emits canonical **`proposal-accept` / `proposal-reject` / `proposal-edit`** from its `decision` slot (controls matched by `data-action`). `proposal-accept` carries **`getOps()`** — structured ops read from the slotted `sherpa-proposal-op` children.
- **`sherpa-proposal-op`** gained machine-readable payload attributes (`data-target`, `data-field`, `data-value`) so hosts can apply/undo an op programmatically instead of parsing slotted text; `add-edge`/`remove-edge` now render **distinct arrow glyphs** (⇢ / ⇥) instead of reusing +/−.
- Fixed the stale `data-rows` doc in `sherpa-prompt-composer.html` → `data-max-height`.

The `sherpa-quick-filter` AI chip keeps its own `quick-filter-ai-accept` event (not force-fit into the proposal model) — a full shared `Proposal` contract was **deliberately deferred** as needing product-design input.

## Verified
- type-check ✓ · 0 lint errors · 0 TS suppressions · MCP schemas correct.
- **In-browser:** `proposal-accept` fires with structured ops `{op, target, field, value, label}`; `proposal-reject` fires; node event rename leaves element tags intact and type-safe (typed event map updated in lockstep).

## Deferred (documented, not done)
- **`data-multi` → `data-variant` socket migration** — higher-risk (9 template authorings + edge geometry); needs visual verification. Tracked in DEPRECATIONS.md.
- **Full shared AI `Proposal` contract** + wiring the quick-filter AI chip into it — net-new abstraction, needs product design.
- **Tests + sticker-sheet demos + `data-accepts`** for node/AI components — the largest remaining coverage gap (zero node/AI tests today); a good ongoing-hardening track (ties into the Phase 7 test-harness provisioning).
