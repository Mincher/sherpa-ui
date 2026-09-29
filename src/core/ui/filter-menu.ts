/**
 * filter-menu.ts — ONE FILTER DEF, ONE `<sherpa-menu>`.
 *
 * A bar, a panel and a column heading all show the same field. Each builds its
 * own element from this, so no view ever takes another's.
 * TRAP T-one-field-one-filter-menu
 * TRAP T-a-panel-builds-its-own-menus
 * TRAP T-an-inline-menu-is-the-same-menu
 *
 * Map:
 * - FilterMenuItem — One row a menu offers.
 * - FilterMenuDef — Enough of a filter definition to draw its menu.
 * - FilterMenuOptions — where the card stays inside, and whether it draws inline
 * - menuFor — Build a field's menu.
 */

import { OPS_FOR_TYPE, type FilterOp } from '../data/store.js';
import {
  advancedOf, hasOwnBody, kindOf, picksOne, type FilterKind, type KindSource,
} from './filter-kind.js';

/** One row a menu offers. */
export interface FilterMenuItem {
  value: string;
  label?: string;
  selected?: boolean;
  available?: boolean;
  /** A second fact the row shows, muted — where a filter lives now. */
  note?: string;
  /** The section it is in, headed where it changes. */
  section?: string;
  /** It opens a child menu: a caret at its end. */
  drill?: boolean;
  /** `false`: no tick box. */
  pickable?: boolean;
  /** Picks its child menu holds. */
  count?: number;
}

/** Enough of a filter definition to draw its menu. */
export interface FilterMenuDef extends KindSource {
  label?: string;
  options?: readonly FilterMenuItem[];
  min?: number;
  max?: number;
  step?: number;
  availableDates?: readonly string[];
  range?: boolean;
  persistent?: boolean;
  commit?: boolean;
  /** `false`: no Select all — a list of filters, where "every one" is never the answer. */
  selectAll?: boolean;
  op?: FilterOp;
  text?: string;
}

export interface FilterMenuOptions {
  /** The element the menu card must stay inside. */
  bounds?: string | undefined;
  /** Draw it INLINE, in a panel body, rather than as a chip's card. */
  inline?: boolean | undefined;
  /** Its source fetches from OUTSIDE the data layer. `false`: every pick applies
   *  at once. Left out, the select mode decides, as before. */
  remote?: boolean | undefined;
}

/**
 * Build a field's menu. The ITEMS come back separately because a detached
 * clone has not upgraded yet, so its caller decides when to fill them.
 * TRAP T-custom-element-upgrade
 */
export function menuFor(
  def: FilterMenuDef,
  opts: FilterMenuOptions = {},
): { menu: HTMLElement; kind: FilterKind; items: FilterMenuItem[] } {
  const menu = document.createElement('sherpa-menu');
  const kind = kindOf(def);
  const one = picksOne(kind);

  menu.setAttribute('slot', 'menu');
  if (def.label) menu.setAttribute('data-heading', def.label);
  menu.setAttribute('data-select', one ? 'single' : 'multiple');

  // A NUMBER opens as a RANGE; a def that says otherwise wins.
  // TRAP T-a-default-is-not-an-override
  const asRange = def.range ?? kind === 'number';
  /* APPLY IS FOR A REMOTE FETCH (Will, 2026-09-27). A LOCAL pick applies at
     once — multi-select and ranges too — and the menu is FIXED, so the Range
     switch cannot turn Apply on. Remote, the select mode decides.
     TRAP T-commit-follows-select-mode */
  const local = opts.remote === false;
  const defers = def.commit ?? (!local && !one && !(hasOwnBody(kind) && !asRange));
  if (defers) menu.setAttribute('data-commit', '');
  // A def that NAMED `commit` outranks the Range switch's own rule.
  if (def.commit != null || local) menu.setAttribute('data-commit-fixed', '');
  // TRAP T-every-chip-menu-gets-clear-and-search — a persistent chip gets no Clear.
  if (!def.persistent) menu.setAttribute('data-clearable', '');
  menu.setAttribute('data-search', '');
  if (opts.bounds) menu.setAttribute('data-bounds', opts.bounds);
  if (opts.inline) menu.setAttribute('data-inline', '');
  if (def.selectAll === false) menu.setAttribute('data-no-select-all', '');

  /* THE MENU OWNS ITS BODY. This says WHICH and hands over the numbers; the
     switch, the field, the slider and their rules are the menu's.
     TRAP T-a-menu-owns-its-own-bodies */
  if (kind === 'number') {
    // No list to search, only a value to type or drag.
    menu.removeAttribute('data-search');
    menu.setAttribute('data-body', 'number');
    if (asRange) menu.setAttribute('data-range', '');
    menu.setAttribute('data-min', String(def.min ?? 0));
    menu.setAttribute('data-max', String(def.max ?? 100));
    if (def.step != null) menu.setAttribute('data-step', String(def.step));
    return { menu, kind, items: [] };
  }

  if (kind === 'date') {
    /* TRAP T-calendar-header-has-no-heading — no search; CLEAR stays, as a
       date chip has no other way back to "no date". */
    menu.removeAttribute('data-search');
    menu.setAttribute('data-body', 'date');
    if (def.range) menu.setAttribute('data-range', '');
    // The Menu set's `Type = Calendar` variant: a wider card.
    menu.setAttribute('data-type', 'calendar');
    /* SLOTTED, because the calendar projects its stepper into the menu's
       header slot and slot assignment only reaches LIGHT DOM.
       TRAP T-projected-slot-content-crosses-two-shadow-boundaries */
    const cal = document.createElement('sherpa-calendar');
    cal.className = 'qf-calendar';
    cal.setAttribute('data-embedded', '');
    if (def.range) cal.setAttribute('data-type', 'range');
    if (def.availableDates?.length) {
      cal.setAttribute('data-available', def.availableDates.join(','));
    }
    menu.appendChild(cal);
    return { menu, kind, items: [] };
  }

  /* A VALUE menu is a FILTER menu. A PERSISTENT chip is a selector, not a
     field question — "which saved view" has no Contains.
     TRAP T-an-operator-decides-pick-or-type */
  if (!def.persistent) {
    menu.setAttribute('data-type', 'filter');
    if (def.op) menu.setAttribute('data-op', def.op);

    /* ADVANCED IS OPT-IN. TRAP T-conditions-are-opt-in-per-field */
    const advanced = advancedOf(def);
    if (advanced) {
      menu.setAttribute('data-advanced', '');
      /* VALUES, CONDITIONS, OR BOTH. `only` opens in Advanced mode and hides
         the switch — there is no list behind it.
         TRAP T-a-filter-answers-by-values-conditions-or-both */
      if (advanced === 'only') {
        menu.setAttribute('data-advanced-only', '');
        menu.setAttribute('data-mode', 'advanced');
      }
      const ops = OPS_FOR_TYPE['text'] ?? [];
      if (ops.length) menu.setAttribute('data-conditions', ops.join(','));
      if (def.text) menu.setAttribute('data-value', def.text);
    }
  }

  return { menu, kind, items: [...(def.options ?? [])] };
}
