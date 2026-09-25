/**
 * filters-button.ts — the ONE Filters button's menu, for a bar and a panel.
 *
 * The filters a view hides lead it, each a door into its own menu or a tick
 * for an on/off one; then every filter, ticked when held; then the saved ones.
 * TRAP T-one-filters-button
 *
 * Map:
 * - FILTERS_LABEL — The button's name, and its menu's heading.
 * - HIDDEN_SECTION — The heading over the filters the view hides.
 * - ALL_SECTION — The heading over every filter, under the hidden ones.
 * - CUSTOM_SECTION — The heading over the saved filters, at the bottom.
 * - DRILL_FLAGS — Menu attributes owned by the FILTER, not by the Filters menu.
 * - ListedFilter — One filter the menu lists.
 * - filtersMenuItems — The menu's list: every filter, then the saved ones.
 * - HiddenFilter — One filter the view hides.
 * - addHiddenRows — Lead a Filters menu with the filters its view hides.
 * - syncHiddenCounts — Write each door row's pick count.
 * - MenuDrill — One filter's rows, moved into the Filters menu and back.
 * - .home — The menu drilled into, or null.
 * - .menu — The Filters menu it is drilled into, or null.
 * - .into — Move a menu's rows into the Filters menu.
 * - .out — Put the rows home and the Filters menu's own list back.
 */
import type { FilterMenuItem } from './filter-menu.js';

export const FILTERS_LABEL = 'Filters';
export const HIDDEN_SECTION = 'More filters';
export const ALL_SECTION = 'All filters';
export const CUSTOM_SECTION = 'Custom';

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

/**
 * Ticked is held, so a tick adds and an untick removes. Saved filters go LAST,
 * under their own heading. TRAP T-the-add-menu-is-the-whole-list
 * TRAP T-saved-filters-are-the-custom-section
 */
export function filtersMenuItems(
  held: readonly ListedFilter[], offer: readonly ListedFilter[], hidden: boolean,
): Array<FilterMenuItem & { label: string }> {
  // Under the hidden filters, the list needs a heading of its own.
  const all = hidden ? { section: ALL_SECTION } : {};
  return [
    ...held.filter((f) => !f.readings)
      .map((f) => ({ value: f.id, label: f.label, selected: true, ...all })),
    ...offer.filter((f) => !f.readings)
      .map((f) => ({ value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), ...all })),
    ...held.filter((f) => f.readings)
      .map((f) => ({ value: f.id, label: f.label, selected: true, section: CUSTOM_SECTION })),
    ...offer.filter((f) => f.readings)
      .map((f) => ({ value: f.id, label: f.label, section: CUSTOM_SECTION })),
  ];
}

/** One filter the view hides. */
export interface HiddenFilter {
  id: string;
  label: string;
  icon?: string | undefined;
  /** It has a menu to drill into. Without one it is ticked in place. */
  door: boolean;
  on: boolean;
}

/** The rows come from the host's own templates: qf-section-tpl, qf-toggle-tpl, qf-folded-tpl. */
export function addHiddenRows(
  menu: HTMLElement,
  hidden: readonly HiddenFilter[],
  clone: (selector: string) => HTMLElement | null,
  onToggle: (event: Event) => void,
): void {
  if (!hidden.length) return;
  const head = clone('template.qf-section-tpl');
  if (head) {
    head.textContent = HIDDEN_SECTION;
    menu.appendChild(head);
  }
  for (const one of hidden) {
    if (!one.door) {
      const toggle = clone('template.qf-toggle-tpl');
      if (!toggle) continue;
      toggle.dataset['for'] = one.id;
      toggle.setAttribute('data-lead', '');
      const box = toggle.querySelector<HTMLInputElement>('input');
      const text = toggle.querySelector('.qf-toggle-label');
      if (text) text.textContent = one.label;
      if (box) box.checked = one.on;
      // Bound to the BOX: a native `change` is not composed and stops at the menu.
      box?.addEventListener('change', onToggle);
      menu.appendChild(toggle);
      continue;
    }
    const row = clone('template.qf-folded-tpl');
    if (!row) continue;
    row.dataset['for'] = one.id;
    row.dataset['label'] = one.label;
    row.setAttribute('data-lead', '');
    if (one.icon) row.dataset['icon'] = one.icon;
    menu.appendChild(row);
  }
}

/** `countOf` answers null for a row it does not know, which is left alone. */
export function syncHiddenCounts(menu: HTMLElement, countOf: (id: string) => number | null): void {
  for (const row of menu.querySelectorAll<HTMLElement>('.qf-folded')) {
    const id = row.dataset['for'];
    const badge = row.querySelector<HTMLElement>('.qf-folded-count');
    const count = id ? countOf(id) : null;
    if (!badge || count == null) continue;
    badge.textContent = String(count);
    // A data-* ON THE ROW: nothing can write `:host(...)` for an element inside a menu.
    row.toggleAttribute('data-count', count > 0);
  }
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
