/**
 * shared-constants.ts — values MORE THAN ONE component must agree on.
 *
 * Not icons, despite one of them being icon names: `NON_VALUE_ROWS` is a CSS
 * selector, and three of the four importers want only that.
 * TRAP T-shared-values-two-components-must-agree-on
 *
 * Map:
 * - movedTo — What a filter another scope holds says: `Filter moved to View scope.`
 * - onByPreset — What a chip or a value a preset on holds says.
 * - heldByPreset — What a preset's field says of its values while the preset is on.
 * - RULED_OUT — What a value the filters before it rule out says, on its chip and its menu row
 * - SET_ASIDE — What a PICKED value a later filter rules out says
 * - NOT_AVAILABLE — What a disabled chip says
 * - unusedHere — What an App Context filter says on a page with no such field
 * - UNAPPLIED — What leads a pending chip's tip
 * - UNFETCHED — What leads the tip of a chip whose data could not be fetched
 * - VIEW_CHIP — The View chip's id: the chip a View is picked through.
 * - GRAPH_CHIP — The graph chip's id, and the URL's parameter: the entity a graph View shows.
 * - REST_WAIT — How long a pointer RESTS on a chip or a legend row before it previews the highlight, in ms.
 * - ORGANISE_ICONS — The ORGANISE glyphs — grouping and the three sort states.
 * - NON_VALUE_ROWS — Rows in a filter menu that are NOT values, as a selector.
 * - MIRRORED_CONTROL_ATTRS — Native attributes a select control mirrors onto its inner `<input>`.
 * - RADIAL_CENTRE — Centre of that box.
 * - RADIAL_CORNER — Segment corner radius.
 * - RADIAL_OUTLINE — Outline thickness, aligned INSIDE as in Figma.
 * - RADIAL_INNER_RATIO — The hole, as a FRACTION of the outer radius.
 * - DONUT_INNER_RATIO — A donut's hole: smaller than a gauge's, so a split slice has room.
 * - SEGMENT_GAP — The gap between a chart's segments, in px.
 * - SECTION_GAP — The gap between a segment's sections, in px.
 * - SECTION_OUTLINE — A section's outline, in px: thinner than its segment's.
 * - SEGMENT_PADDING — The space inside a segment's outline, around its sections, in px.
 * - DEFAULT_TICKS — Gridlines a cartesian chart draws when `data-ticks` is absent.
 */

/** What a filter another scope holds says — a chip's tooltip and a panel's
 *  note, in the SAME words. A scope's heading may end in "filters"; the
 *  sentence says "scope". TRAP T-an-inactive-chip-says-where-its-filter-went */
export function movedTo(scope?: string | null): string {
  const name = (scope ?? '').replace(/\s+filters$/i, '').trim();
  return `Filter moved to ${name || 'a higher'} scope.`;
}

/** What a chip or a value a preset on holds says. Will, TODO 521 */
export function onByPreset(names: string): string {
  return `On by the preset ${names}.`;
}

/** What a preset's field says of its values while the preset is on. Will, TODO 601 */
export function heldByPreset(names: string): string {
  return `Held by the preset ${names}.`;
}

/** What a value the filters before it rule out says, on its chip and its menu
 *  row. Will, TODO 176. TRAP T-a-ruled-out-value-is-greyed */
export const RULED_OUT = 'Limited by the filters before it: no matches.';

/** What a PICKED value a later filter rules out says: kept, not applied.
 *  Will, TODO 180. TRAP T-a-ruled-out-value-is-greyed */
export const SET_ASIDE = 'Limited by the filters before it: not applied.';

/** What a disabled chip says. Will, TODO 176. */
export const NOT_AVAILABLE = 'Not available here.';

/** What an App Context filter says on a page with no such field. Will, TODO 453 */
export function unusedHere(label?: string | null): string {
  return `Not used on this page: its data has no ${label || 'such field'}.`;
}

/** What leads a pending chip's tip: changed, not applied. Will, TODO 406.
 *  TRAP T-a-pending-chip-reads-as-a-warning */
export const UNAPPLIED = 'Unapplied changes';

/** What leads the tip of a chip whose data could not be fetched: a system
 *  error, not 0 matches. Will, TODO 411. */
export const UNFETCHED = 'Unable to fetch data';

/** The View chip's id: the chip a View is picked through. The same word as VIEW, the scope id, but not the same idea. */
export const VIEW_CHIP = 'view';

/** The graph chip's id, and the URL's parameter: the entity a graph View shows. TRAP T-a-graph-is-a-view-of-a-type */
export const GRAPH_CHIP = 'graph';

/** How long a pointer RESTS on a chip or a legend row before it previews the highlight, in ms. TODO 449 */
export const REST_WAIT = 150;

/**
 * The ORGANISE glyphs — grouping and the three sort states.
 *
 * Tri-state: a column that is not the current sort shows `sortNone`, offering
 * itself without claiming to be active.
 */
export const ORGANISE_ICONS = {
  group: 'group',
  sortNone: 'sort-none',
  sortAsc: 'sort-ascending',
  sortDesc: 'sort-descending',
} as const;


/**
 * Rows in a filter menu that are NOT values, as a selector.
 *
 * TRAP T-non-value-rows-is-one-selector
 */
export const NON_VALUE_ROWS = '.qf-all, .qf-none, [data-by-preset]';


/**
 * Native attributes a select control mirrors onto its inner `<input>`.
 *
 * Checkbox, radio and switch mirror these four.
 * `sherpa-input-text` keeps its OWN longer list: a text field also mirrors
 * `placeholder`, `pattern`, `inputmode` and the length limits, which a checkbox
 * has no use for. A superset is not the same value.
 */
export const MIRRORED_CONTROL_ATTRS = ['name', 'value', 'required', 'disabled'] as const;

/**
 * A radial chart's geometry, in viewBox units of a 100×100 box.
 *
 * Donut and gauge draw the same arc with the same pen: `ringSegmentPath()` takes
 * all three, so a value that moved in one and not the other would draw two
 * different rings from one function.
 */
const RADIAL_BOX = 100;
/** Centre of that box. A gauge shows only its TOP half. */
export const RADIAL_CENTRE = RADIAL_BOX / 2;
/** Segment corner radius. */
export const RADIAL_CORNER = 1;
/** Outline thickness, aligned INSIDE as in Figma. */
export const RADIAL_OUTLINE = 0.5;
/**
 * The hole, as a FRACTION of the outer radius. Measured 2026-09-24: the gauge
 * wrote `CENTRE - 15` and the ring `CENTRE * 0.7`, which are the SAME 35.25 at
 * this box size — two constants for one value, drifting apart the moment either
 * moved. TRAP T-a-gauge-composes-the-ring
 */
export const RADIAL_INNER_RATIO = 0.7;

/** A donut's hole: smaller than a gauge's, so its bands and sections have room. Will, TODO 635 */
export const DONUT_INNER_RATIO = 0.55;

/** The gap between a chart's segments, in px: each keeps its full outline. Will, TODO 635 */
export const SEGMENT_GAP = 1;

/** The gap between a segment's sections, in px. Will, TODOs 635, 686 */
export const SECTION_GAP = 1;

/** A section's outline, in px: thinner than its segment's. Will, TODO 635 */
export const SECTION_OUTLINE = 0.5;

/** The space inside a segment's outline, around its sections, in px. Will, TODO 693 */
export const SEGMENT_PADDING = 1;

/**
 * Gridlines a cartesian chart draws when `data-ticks` is absent.
 * Matches the Figma Chart Axis.
 */
export const DEFAULT_TICKS = 4;
