/**
 * filter-def.ts — ONE filter, as a bar or the panel draws it. A source hands
 * each its `HeldFilter`s, which are FilterDefs. TODO 196
 * TRAP T-the-panel-is-the-toolbar-in-a-column
 *
 * Map:
 * - FilterOption — One value a filter offers: a row in a chip's menu, or one of the panel's chips.
 * - FilterDef — One filter, as a bar or the panel draws it.
 */
import type { SaidField } from '../data/filter-face.js';
import type { FieldReading } from '../data/filter-state.js';
import type { FilterOp } from '../data/store.js';
import type { FilterKind, OffersAdvanced } from './filter-kind.js';
import type { SavedAnswer } from './saved-filter-menu.js';

/** One value a filter offers: a row in a chip's menu, or one of the panel's chips. */
export interface FilterOption {
  value: string;
  label?: string;
  selected?: boolean;
  /** `false`: ruled out — listed, greyed and refused unless picked. TRAP T-a-ruled-out-value-is-greyed */
  available?: boolean;
  /** A second fact its menu row shows, muted. */
  note?: string;
  /** The section its menu row is in, headed where it changes. */
  section?: string;
  /** The data-viz series a chart draws this value in, from 1 — its chip's swatch. */
  swatch?: number;
  /** The panel's: what the value's own chip IS — a preset that carries its answer is `advanced`. */
  kind?: FilterKind;
  /** The panel's: a saved filter's answer, as its chip's card draws it.
   *  TRAP T-a-saved-chip-lists-its-conditions */
  saved?: SavedAnswer;
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
  /** A number filter's slider ends and field clamp. Default 0..100. */
  min?: number;
  max?: number;
  step?: number;
  /** ISO days a DATE filter may pick. A SET, not a span; every other day draws inactive. */
  availableDates?: string[];
  /** Start in RANGE mode. The reader may still flip it. */
  range?: boolean;
  /** A DATE that holds times: its Advanced rows offer a time box. TODO 21d */
  time?: boolean;
  /** ON, with nothing picked — a preset's whole state. */
  active?: boolean;
  /** Offer Remove. OPT-IN: a host-placed chip must not delete itself. */
  removable?: boolean;
  /** Which condition it is on. Defaults to `eq`. */
  op?: FilterOp;
  /** What the reader TYPED, for a condition that takes text rather than a pick. */
  text?: string;
  /** WHAT IS IN FORCE, from the data layer — the answer the rows are under.
   *  TRAP T-a-panel-builds-its-own-menus */
  state?: FieldReading;
  /** What the Add menu shows beside it — where it lives now, if somewhere else. */
  note?: string;
  /** A SAVED filter: its answer, given field by field. TRAP T-a-saved-filter-is-its-readings */
  readings?: Readonly<Record<string, FieldReading>>;
  /** A saved filter's conditions in WORDS, as its source says them.
   *  TRAP T-a-saved-chip-lists-its-conditions */
  says?: SaidField[];
  /** Its answer survives a View change. TRAP T-a-field-can-carry-over-views */
  carryOver?: boolean;
  /** The bar's: a chip that cannot be switched OFF. TRAP T-persistent-chip-is-a-selector */
  persistent?: boolean;
  /** The bar's: `false` — its menu has no Select all row. */
  selectAll?: boolean;
  /** The bar's: defer picks behind Apply. TRAP T-commit-follows-select-mode */
  commit?: boolean;
  /** The panel's: a chip with no field behind it — one question, answered yes
   *  or no. TRAP T-a-chip-with-no-field-is-a-preset */
  preset?: boolean;
  /** The panel's: ONE chip with its menu, not a run — a date's menu IS a
   *  calendar. TRAP T-only-group-and-sort-stay-one-chip */
  asChip?: boolean;
  /** The panel's: a scope ABOVE holds it now. It keeps its heading here, and
   *  draws no values. TRAP T-a-panel-asks-for-its-scopes */
  appliedAt?: string;
  /** The panel's: where a View field may be SENT DOWN — `origin` is the scope
   *  it came UP from. TRAP T-send-to-view-filters */
  sendTo?: { scope: string; label: string; origin?: boolean }[];
}
