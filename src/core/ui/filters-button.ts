/**
 * filters-button.ts — the ONE Filters button's menu, for a bar and a panel.
 *
 * The filters a view holds, then what it may add, then the saved ones it may
 * add. A held filter the view HIDES — folded off a bar, or in a shut scope —
 * keeps its row, and a caret on it opens its child menu. TRAP T-one-filters-button
 *
 * Map:
 * - FILTERS_LABEL — The button's name, and its menu's heading.
 * - ADDED_SECTION — The heading over the filters the view holds.
 * - AVAILABLE_SECTION — The heading over the filters it may add.
 * - SAVED_SECTION — The heading over the saved filters it may add, at the bottom.
 * - ON — The one value an on/off filter's child menu offers.
 * - DRILL_FLAGS — Menu attributes owned by the FILTER, not by the Filters menu.
 * - ListedFilter — One filter the menu lists.
 * - AddedFilter — One filter the view holds.
 * - filtersMenuItems — The menu's list: added, available, then custom.
 * - onOffMenu — An on/off filter's child menu: one row, "On".
 * - MenuDrill — One filter's rows, moved into the Filters menu and back.
 * - .home — The menu drilled into, or null.
 * - .menu — The Filters menu it is drilled into, or null.
 * - .into — Move a menu's rows into the Filters menu.
 * - .out — Put the rows home and the Filters menu's own list back.
 */
import { menuFor, type FilterMenuItem } from './filter-menu.js';

export const FILTERS_LABEL = 'Filters';
export const ADDED_SECTION = 'Added filters';
export const AVAILABLE_SECTION = 'Available filters';
export const SAVED_SECTION = 'Saved filters';
export const ON = 'on';

/** TRAP T-drill-flags-travel-and-replace — never merged. */
export const DRILL_FLAGS = ['data-commit', 'data-range', 'data-select', 'data-search'] as const;

/** One filter the menu lists. */
export interface ListedFilter {
  id: string;
  label: string;
  /** A second fact the row shows, muted. */
  note?: string | undefined;
  /** A SAVED filter carries its answer. */
  readings?: unknown;
}

/** One filter the view holds. */
export interface AddedFilter extends ListedFilter {
  /** A tick takes it off. Without one its row has no box. */
  removable: boolean;
  /** Folded off a bar, or in a shut scope: its row opens its child menu. */
  hidden: boolean;
  /** Picks its child menu holds. */
  count?: number;
}

/**
 * ONE section for what the view holds: a hidden filter is a row there with a
 * caret, not a second section. Will, 2026-09-25. A filter is in ONE section —
 * a held saved filter is Added, never Custom too.
 * TRAP T-the-add-menu-is-the-whole-list
 * TRAP T-saved-filters-are-the-custom-section
 */
export function filtersMenuItems(
  added: readonly AddedFilter[], offer: readonly ListedFilter[],
): Array<FilterMenuItem & { label: string }> {
  return [
    // A held filter the reader cannot take off is listed only while hidden.
    ...added.filter((f) => f.removable || f.hidden).map((f) => ({
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: ADDED_SECTION,
      ...(f.removable ? { selected: true } : { pickable: false }),
      ...(f.hidden ? { drill: true, count: f.count ?? 0 } : {}),
    })),
    ...offer.filter((f) => !f.readings).map((f) => ({
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: AVAILABLE_SECTION,
    })),
    ...offer.filter((f) => f.readings)
      .map((f) => ({ value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: SAVED_SECTION })),
  ];
}

/** Its pick applies at once, as the chip's own body would. Will, 2026-09-25. */
export function onOffMenu(label: string, on: boolean): { menu: HTMLElement; items: FilterMenuItem[] } {
  const built = menuFor({
    label, select: 'multiple', commit: false, selectAll: false,
    options: [{ value: ON, label: 'On', selected: on }],
  });
  // One row: nothing to search.
  built.menu.removeAttribute('data-search');
  return built;
}

/** TRAP T-drill-moves-not-clones — the rows are moved, never copied. */
export class MenuDrill {
  /** Where the rows came from, and the Filters menu's own rows and settings. */
  #at: {
    menu: HTMLElement; home: HTMLElement; rows: Element[];
    own: Record<string, string | null>; heading: string;
  } | null = null;

  /** The menu drilled into, or null. */
  get home(): HTMLElement | null {
    return this.#at?.home ?? null;
  }

  /** The Filters menu it is drilled into, or null. */
  get menu(): HTMLElement | null {
    return this.#at?.menu ?? null;
  }

  /** Move `home`'s rows into `menu`. Back stays one level deep, never a chain. */
  into(menu: HTMLElement, home: HTMLElement, label: string): void {
    this.out();
    /* The Filters menu has settings of ITS OWN — Apply, search, many picks —
       and gets them back on the way out. TRAP T-one-filters-button */
    this.#at = {
      menu, home, rows: [...menu.children],
      own: Object.fromEntries([...DRILL_FLAGS, 'data-saveable'].map((f) => [f, menu.getAttribute(f)])),
      heading: menu.getAttribute('data-heading') ?? FILTERS_LABEL,
    };
    menu.replaceChildren(...home.childNodes);
    // A drill edits ONE filter: Save, which saves them all, waits outside.
    menu.removeAttribute('data-saveable');
    menu.setAttribute('data-drill', '');
    menu.dataset['drillFrom'] = FILTERS_LABEL;
    menu.setAttribute('data-heading', label);
    for (const flag of DRILL_FLAGS) copy(home, menu, flag);
  }

  /** Put the rows home and the Filters menu's own list back. True if it was drilled. */
  out(): boolean {
    const at = this.#at;
    if (!at) return false;
    this.#at = null;
    at.home.replaceChildren(...at.menu.childNodes);
    at.menu.replaceChildren(...at.rows);
    at.menu.removeAttribute('data-drill');
    delete at.menu.dataset['drillFrom'];
    at.menu.setAttribute('data-heading', at.heading);
    // A flag changed inside the drill — the Range switch — goes home with the rows.
    for (const flag of DRILL_FLAGS) copy(at.menu, at.home, flag);
    for (const [flag, value] of Object.entries(at.own)) {
      if (value == null) at.menu.removeAttribute(flag);
      else at.menu.setAttribute(flag, value);
    }
    return true;
  }
}

/** Copy one attribute, absence included. */
function copy(from: HTMLElement, to: HTMLElement, flag: string): void {
  const value = from.getAttribute(flag);
  if (value == null) to.removeAttribute(flag);
  else to.setAttribute(flag, value);
}
