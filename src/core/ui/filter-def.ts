/**
 * filter-def.ts — ONE filter, as a bar or the panel draws it. A source hands
 * each its `HeldFilter`s, which are FilterDefs. TODO 196
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 *
 * Map:
 * - FilterOption — One value a filter offers: a row in a chip's menu, or one of the panel's chips.
 * - FilterDef — One filter, as a bar or the panel draws it.
 */
import type { FieldReading } from '../data/filter-state.js';
import type { FilterOp } from '../data/store.js';
import type { FilterKind, OffersAdvanced } from './filter-kind.js';

/** One value a filter offers: a row in a chip's menu, or one of the panel's chips. */
export interface FilterOption {
  value: string;
  label?: string;
  selected?: boolean;
  /** `false`: ruled out — listed, greyed and refused unless picked. TRAP T-a-ruled-out-value-is-greyed */
  available?: boolean;
  /** A second fact its menu row shows, muted. */
  note?: string;
  /** A word after its label in its MENU ROW only — a chart chip's "(Default)": never
   *  part of its value's name on the chip. Will, TODO 684 */
  suffix?: string;
  /** The section its menu row is in, headed where it changes. */
  section?: string;
  /** The data-viz series a chart draws this value in, from 1, or a status value's status — its chip's swatch. */
  swatch?: number | string;
  /** A tiered field's child value: its parent value's key. TODO 369 */
  parent?: string;
}

/** One filter, as a bar or the panel draws it. */
export interface FilterDef extends OffersAdvanced {
  id: string;
  label: string;
  /** The FIELD it answers, when its id is not that field — the header's Date
   *  chip answers the record's time. `null`: it answers no field HERE, so it
   *  reports nothing. */
  field?: string | null;
  type?: string;
  /** WHAT THIS FILTER IS — see `core/ui/filter-kind.ts`. A def that leaves it
   *  out has it worked out from `select`, `advanced` and whether there are
   *  options, in ONE place. TRAP T-a-chip-knows-what-kind-it-is
   *  TRAP T-number-and-date-lead-with-a-range-switch */
  kind?: FilterKind;
  /** Values it filters by — a menu of checkbox or radio rows. */
  options?: FilterOption[];
  select?: 'single' | 'multiple';
  /** Its leading glyph. TRAP T-only-five-filter-chips-carry-an-icon */
  icon?: string;
  /** What it is, in a few words: its chip's tip says it, in lines. Will, TODO 691 */
  description?: string;
  /** The named SECTION it sits in, in portrait; none, a section of its own. Will, TODO 438 */
  section?: string;
  /** A number filter's box clamp, and a range row's slider ends. Default 0..100. */
  min?: number;
  max?: number;
  step?: number;
  /** ISO days a DATE filter may pick. A SET, not a span; every other day draws inactive. */
  availableDates?: string[];
  /** A DATE starts in RANGE mode; the reader may still flip it. A number has no
   *  range in Simple: it is an Advanced row (TODO 375). */
  range?: boolean;
  /** A DATE that holds times: its Advanced rows offer a time box. TODO 21d */
  time?: boolean;
  /** ON, with nothing picked — a preset's whole state. */
  active?: boolean;
  /** Offer Remove. OPT-IN: a host-placed chip must not delete itself. */
  removable?: boolean;
  /** Its page fixes it: never removed, and the bar divides the last from what
   *  follows. Will, TODO 703 · TRAP T-a-fixed-field-stays-held */
  fixed?: boolean;
  /** A FILTER a reader cannot switch off: drawn as a persistent chip, still
   *  answering its field. Will, TODO 703 */
  alwaysOn?: boolean;
  /** The page's own: its definition holds it here, so it keeps its place — a
   *  reader drags only what was added. Will, TODO 452 */
  own?: boolean;
  /** An app's PRESET: a boolean chip with its own conditions, first in its
   *  scope, never moved or dragged. Will, TODO 493 · TRAP T-a-preset-is-its-own-part */
  preset?: boolean;
  /** The App Context holds it, and this page has no such field: drawn
   *  inactive, refused, and saying why. Will, TODO 453 */
  unused?: boolean;
  /** Which condition it is on. Defaults to `eq`. */
  op?: FilterOp;
  /** What the reader TYPED, for a condition that takes text rather than a pick. */
  text?: string;
  /** WHAT IS IN FORCE, from the data layer — the answer the rows are under.
   *  TRAP T-a-panel-builds-its-own-menus */
  state?: FieldReading;
  /** What the Add menu shows beside it — where it lives now, if somewhere else. */
  note?: string;
  /** Its answer survives a View change. TRAP T-a-field-can-carry-over-views */
  carryOver?: boolean;
  /** The scope its answer is in, where not its bar's: a chart's legend, drawn in its
   *  card's toolbar. Its requests name it. Will, TODO 670 */
  answeredIn?: string;
  /** The bar's: a SELECTOR that cannot be switched OFF, and answers no field. TRAP T-persistent-chip-is-a-selector */
  persistent?: boolean;
  /** The bar's: `false` — its menu has no Select all row. */
  selectAll?: boolean;
  /** Its values are still being read: its menu says Loading. TODO 345 */
  loading?: boolean;
  /** The bar's: defer picks behind Apply. TRAP T-commit-follows-select-mode */
  commit?: boolean;
  /** The panel's: the ONE scope a View field is SENT DOWN to — `origin` when
   *  it came UP from there. TRAP T-send-to-view-filters */
  sendTo?: { scope: string; label: string; origin?: boolean };
}
