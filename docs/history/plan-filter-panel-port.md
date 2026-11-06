# Plan — the filter panel is a panel again

Written for: Will. Status: PLAN, nothing built. Needs a TODO number (the lane integrator numbers it).

## What you asked for

The filter panel goes back to being a **panel** (`sherpa-overlay-panel`) with the filter content
poured into it. The filter **toolbar** stops having a panel mode. The filter panel's function and
style do not change.

## Where it stands now

The "panel" is the filter toolbar turned on its side (`data-orientation="portrait"`, `data-column`,
`data-scope="view data"`), slotted into the shell's start area (`Sherpa Demos/app/index.html:81`).
Its panel parts live inside the toolbar:

| Part | Size today |
|---|---|
| `sherpa-quick-filter-toolbar.ts` | 2931 lines, about 108 mentions of portrait or column |
| its `.css` / `.html` | about 68 / 36 mentions |
| `toolbar-column.ts` (the column: one header over every scope) | 289 lines |
| `toolbar-header.ts` | 79 lines |
| `toolbar-rows.html` (rows the portrait and flat templates share) | 99 lines |
| chip side: `chip-arrange.ts`, `chip-section.ts` (`data-layout="section"`) | used by portrait only |
| provider: `provider-mode.ts`, `provider-page.ts`, `provider-summary` | decide panel or bars; `isColumn()` tells a column from a bar |
| e2e specs that touch the column or portrait | about 25 in sherpa-ui, plus Demos `reforged-card-toolbars.spec.ts` |

That is the parity cost you named: two presentations in one component.

## The shape

One new **content** component, `sherpa-filter-column` (the existing word is "column"). It holds the
portrait scope sections, the flat View section and the one header row. It has no chrome of its own:

```html
<sherpa-overlay-panel id="filter-column" data-heading="Filters" data-fixed="start"
                      data-floatable data-minimisable data-dismissible>
  <sherpa-filter-column data-scope="view data"></sherpa-filter-column>
</sherpa-overlay-panel>
```

The panel gives it everything the other panels have: float, dock, minimise to a tab, close, the
tabbed area. The toolbar keeps only the landscape bar.

The provider already asks panels `show()` and `hide()`; an overlay panel has both. The content asks
for its scopes as the column does today, so the join (`bindSource`) does not change.

## Phases (each one ends green; the old behaviour is the oracle)

**P0. Baseline.** Before any code: list every spec and Demos page that touches the column, and
record pixel baselines of the panel closed, open, accordion shut, floating and dark. Every later
phase must reproduce them unchanged.

**P1. Copy out.** Build `sherpa-filter-column` by MOVING the column, portrait and flat code (templates,
CSS, `toolbar-column.ts`, the section chip look stays in the chip family). The toolbar still works
beside it: nothing is deleted yet. The spec generator and docs pass.

**P2. Provider.** `isColumn` / `panels()` / mode buttons / page state follow the new component. A
panel's `panel-close` replaces the toolbar's close report. The "Include View Context in the panel"
setting and the Filters button in the page header are re-pointed.

**P3. Demos.** Swap `index.html`'s toolbar for the panel and content. Re-run every Demos spec. Keep
`keepFloat`, the saved width of the start area, and `data-node-editor`.

**P4. Clear out.** Delete portrait, flat, column and panel-mode from the toolbar: its templates, CSS,
TS, `data-orientation`, `data-column`, `data-flat`, `data-panel-mode`, the specs for them, the
TRAPS (`T-the-panel-is-the-bar-in-portrait` becomes a short note on why the split) and the LEXICON
lines. Update the weight and size baselines on purpose, and expect them to fall.

**P5. Port the specs.** Selectors move from the toolbar host to the panel and content. Run the full
suite in three engines, the a11y gate and the bench.

## Decisions for you

1. **Panel header.** The column has its own header row today (Save, the Filters menu, ⋮, search).
   - **A.** The panel's header carries the title and the panel chrome, and the content keeps its
     own row below it. Simplest, but it adds one bar.
   - **B (my pick).** The content's controls go into the panel header's `actions` and description
     slots, so the panel looks as it does now. A bit more wiring.
2. **Name.** `sherpa-filter-column` (my pick), or reuse `sherpa-filter-panel`, the old deleted
   name, which could confuse old notes.

## Risks

- **Overlap with open work:** plan-723 (one section contract for Organise and Preset), TODO 721
  (the panel header's Filters button) and 846 (node panel onto the overlay panel). Do 846 first or
  with this, since both change how a panel hosts content.
- **A closed-by-default panel in the area** must still give the Context its width back: the
  layout already does that for any slotted panel.
- **The View Context** section is flat, not an accordion: keep that as it is.
- **Tabbed areas:** a filter panel in the start area now shares it with any panel popped there.
  That is wanted, but the start-side tab row needs one look in Demos.

## Size

Large: about five to eight sessions, mostly P1, P2 and P5. P4 should remove more lines than P1 adds.
