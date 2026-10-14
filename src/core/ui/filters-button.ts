/**
 * filters-button.ts — the ONE Filters button's menu, for a bar and a panel.
 *
 * The filters a view holds, then what it may add, then the saved ones it may
 * add. A held filter the view HIDES — folded off a bar, or in a shut scope —
 * keeps its row, and a caret on it opens its child menu. A ONE-value filter's
 * tick is its on/off instead. TRAP T-one-filters-button
 *
 * Map:
 * - FILTERS_LABEL — The button's name, and its menu's heading.
 * - ADDED_SECTION — The heading over the filters the view holds.
 * - AVAILABLE_SECTION — The heading over the filters it may add.
 * - SAVED_SECTION — The heading over the saved filters it may add, at the bottom.
 * - DRILL_FLAGS — Menu attributes owned by the FILTER, not by the Filters menu.
 * - ListedFilter — One filter the menu lists.
 * - SavedSet — One saved set of filters, as the menu and the Saved chip draw it.
 * - SET_ROW — A saved set's row value: this, then its id.
 * - AddedFilter — One filter the view holds.
 * - filtersMenuItems — The menu's list: added, available, then saved.
 * - setPick — A Filters menu's ticks, as a saved-set request: apply one, or dismiss the one on.
 * - drawSavedChip — The Saved chip says the set on screen: its name, and ` *` and the warning look once changed.
 * - MenuDrill — One filter's rows, moved into the Filters menu and back.
 * - .home — The menu drilled into, or null.
 * - .menu — The Filters menu it is drilled into, or null.
 * - .into — Move a menu's rows into the Filters menu.
 * - .out — Put the rows home and the Filters menu's own list back.
 */
import type { FilterMenuItem } from './filter-menu.js';

export const FILTERS_LABEL = 'Filters';
export const ADDED_SECTION = 'Added filters';
export const AVAILABLE_SECTION = 'Available filters';
export const SAVED_SECTION = 'Saved filters';

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

/** One saved set of filters, as the menu and the Saved chip draw it: the one
 *  ON is applied, and `edited` when its filters have changed since. TODO 105 */
export interface SavedSet {
  id: string;
  label: string;
  on?: boolean;
  edited?: boolean;
}

/** A saved set's row value: this, then its id. Its tick APPLIES it. */
export const SET_ROW = 'set:';

/** One filter the view holds. */
export interface AddedFilter extends ListedFilter {
  /** A tick takes it off. Without one its row has no box. */
  removable: boolean;
  /** Folded off a bar, or in a shut scope: its row opens its child menu. */
  hidden: boolean;
  /** Picks its child menu holds. */
  count?: number;
  /** A ONE-value filter — a preset, an on/off chip — and whether it is ON:
   *  its tick means On, and a × removes it. Will, TODO 54. */
  on?: boolean;
}

/**
 * ONE section for what the view holds: a hidden filter is a row there with a
 * caret, not a second section. Will, 2026-09-25. A filter is in ONE section —
 * a held saved filter is Added, never Custom too.
 * TRAP T-the-add-menu-is-the-whole-list
 * TRAP T-saved-filters-are-the-last-section
 */
export function filtersMenuItems(
  added: readonly AddedFilter[], offer: readonly ListedFilter[], sets: readonly SavedSet[] = [],
): Array<FilterMenuItem & { label: string }> {
  return [
    // A held filter the reader cannot take off is listed only while hidden.
    ...added.filter((f) => f.removable || f.hidden).map((f) => (f.on !== undefined ? {
      // ONE value: its tick turns it on, and its × takes it off. Will, TODO 54.
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: ADDED_SECTION,
      selected: f.on, ...(f.removable ? { remove: true } : {}),
    } : {
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: ADDED_SECTION,
      ...(f.removable ? { selected: true } : { pickable: false }),
      ...(f.hidden ? { drill: true, count: f.count ?? 0 } : {}),
    })),
    ...offer.filter((f) => !f.readings).map((f) => ({
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: AVAILABLE_SECTION,
    })),
    ...offer.filter((f) => f.readings)
      .map((f) => ({ value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: SAVED_SECTION })),
    // A reader's saved SETS: a tick applies one, and the one on is ticked. TODO 105
    ...sets.map((s) => ({ value: `${SET_ROW}${s.id}`, label: s.label, section: SAVED_SECTION, selected: !!s.on })),
  ];
}

/**
 * A Filters menu's ticks, as a saved-set request: the set newly ticked is
 * applied; the one on, unticked, is dismissed. The set rows are taken out of
 * `want`, so the rest is the held filters' answer. TODO 105
 */
export function setPick(want: Set<string>, sets: readonly SavedSet[]): { apply?: string; dismiss?: boolean } {
  const on = sets.find((s) => s.on)?.id;
  const picked = [...want].filter((v) => v.startsWith(SET_ROW)).map((v) => v.slice(SET_ROW.length));
  for (const id of picked) want.delete(`${SET_ROW}${id}`);
  const apply = picked.find((id) => id !== on);
  if (apply) return { apply };
  return on && !picked.includes(on) ? { dismiss: true } : {};
}

/** The Saved chip says the set on screen: its name, and ` *` and the warning
 *  look once changed. `data-saved` on the host shows it. TRAP T-saved-filters-are-every-scope */
export function drawSavedChip(host: HTMLElement, chip: HTMLElement | null, sets: readonly SavedSet[]): void {
  const on = host.hasAttribute('data-saveable') ? sets.find((set) => set.on) : undefined;
  host.toggleAttribute('data-saved', !!on);
  if (!chip || !on) return;
  (chip as HTMLElement & { valueLabel: string }).valueLabel = `${on.label}${on.edited ? ' *' : ''}`;
  if (on.edited) chip.dataset['status'] = 'warning';
  else chip.removeAttribute('data-status');
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
