/**
 * filters-button.ts — the ONE Filters button, for a bar and a panel: its face, its
 * menu, its saved sets and its one-value rows.
 *
 * The filters a view holds, then what it may add, then the saved ones it may
 * add. A held filter the view HIDES — folded off a bar, or in a shut scope —
 * keeps its row, and a caret on it opens its child menu. A ONE-value filter's
 * tick is its on/off instead. TRAP T-one-filters-button
 *
 * Map:
 * - MANAGE_SETS — The Saved section's lead row: Manage Saved Filters, the host's dialog.
 * - ListedFilter — One filter the menu lists.
 * - SavedSet — One saved set of filters, as the Filters menu lists it.
 * - AddedFilter — One filter the view holds.
 * - drawFiltersButton — The ONE Filters button, redrawn: the old menu gone; never off.
 * - hangFiltersMenu — The ONE Filters menu, made from its def and hung on its button — the bar's and the column's alike: `hide`, Li…
 * - savedMenuDef — The Saved button's menu, split from Filters: the saved sets, a tick taking one.
 * - saves — Does this host save filters: `data-saveable`, and its provider allows it here?
 * - SavedSets — The reader's saved sets, as the host last drew them, and those on a bar.
 * - .set — Keep a copy of the host's sets.
 * - .all — A copy of each set, as kept.
 * - .listed — What the Filters menu lists: nothing unless the host saves.
 * - .pick — A Filters menu's ticks, as saved-set requests: add each newly ticked, take off each unticked.
 * - OneRows — What each ONE-value row was told — on or off.
 * - .tell — Remember what a fresh Filters list tells its one-value rows.
 * - .has — Is this a one-value row?
 * - .ids — The one-value rows, by value.
 * - .flip — Apply says this row is `on`: true if the reader CHANGED it, which is remembered.
 * - .follow — A chip moved elsewhere: a SHUT menu's rows tick as `isOn` says.
 * - MenuDrill — One filter's rows, moved into the Filters menu and back.
 * - .home — The menu drilled into, or null.
 * - .menu — The Filters menu it is drilled into, or null.
 * - .into — Move a menu's rows into the Filters menu.
 * - .out — Put the rows home and the Filters menu's own list back.
 */
import type { FilterDef } from './filter-def.js';
import { menuFor, type FilterMenuItem, type FilterMenuOptions } from './filter-menu.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';

const FILTERS_LABEL = 'Filters';
const ADDED_SECTION = 'Added filters';
const AVAILABLE_SECTION = 'Available filters';
const SAVED_SECTION = 'Saved filters';
const MANAGE_LABEL = 'Manage Saved Filters';

/** The Saved section's lead row: Manage Saved Filters — rename and remove the
 *  reader's sets, in the host's dialog. Will, TODO 427 */
export const MANAGE_SETS = 'filters-manage';

/** TRAP T-drill-flags-travel-and-replace — never merged. */
const DRILL_FLAGS = ['data-commit', 'data-range', 'data-select', 'data-search'] as const;

/** One filter the menu lists. */
export interface ListedFilter {
  id: string;
  label: string;
  /** A second fact the row shows, muted. */
  note?: string | undefined;
  /** No value is left under the filters before it: greyed — hidden while Hide
   *  unmatching is on. TRAP T-the-add-menu-is-the-whole-list */
  spent?: boolean;
}

/** One saved set of filters, as the menu draws it. TODO 105 */
export interface SavedSet {
  id: string;
  label: string;
  /** Its chip is on a bar: its row is ticked. Will, TODO 605 */
  added?: boolean;
  /** The reader's own: a page's own is never saved over or deleted. */
  own?: boolean;
}

/** A saved set's row value: this, then its id. Its tick ADDS its chip. */
const SET_ROW = 'set:';

/** One filter the view holds. */
export interface AddedFilter extends ListedFilter {
  /** A tick takes it off. Without one its row has no box. */
  removable: boolean;
  /** Folded off a bar, or in a shut scope: its row opens its child menu. */
  hidden: boolean;
  /** Picks its child menu holds. */
  count?: number;
  /** A ONE-value filter — a preset, an on/off chip — and whether it is ON:
   *  its tick means On; its chip's own Remove takes it off. Will, TODOs 54, 380 */
  on?: boolean;
}

/**
 * ONE section for what the view holds: a hidden filter is a row there with a
 * caret, not a second section. Will, 2026-09-25. A filter is in ONE section —
 * a held saved filter is Added, never Custom too.
 * TRAP T-the-add-menu-is-the-whole-list
 * TRAP T-saved-filters-are-the-last-section
 */
function filtersMenuItems(
  added: readonly AddedFilter[], offer: readonly ListedFilter[], sets: readonly SavedSet[] = [], manage = false,
): Array<FilterMenuItem & { label: string }> {
  return [
    // A held filter the reader cannot take off is listed only while hidden.
    ...added.filter((f) => f.removable || f.hidden).map((f) => (f.on !== undefined ? {
      // ONE value: its tick turns it on. No ×: the chip takes it off. Will, TODOs 54, 380
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: ADDED_SECTION,
      selected: f.on,
    } : {
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: ADDED_SECTION,
      ...(f.removable ? { selected: true } : { pickable: false }),
      ...(f.hidden ? { drill: true, count: f.count ?? 0 } : {}),
    })),
    ...offer.map((f) => ({
      value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: AVAILABLE_SECTION,
      ...(f.spent ? { available: false } : {}),
    })),
    // Led by Manage Saved Filters, where the reader has sets of their own. Will, TODO 427
    ...(manage && sets.some((s) => s.own) ? [{ value: MANAGE_SETS, label: MANAGE_LABEL, section: SAVED_SECTION, action: true }] : []),
    // A reader's saved SETS: ticked while its chip is on a bar. TODO 105 · Will, TODO 605
    ...sets.map((s) => ({ value: `${SET_ROW}${s.id}`, label: s.label, section: SAVED_SECTION, selected: !!s.added })),
  ];
}

/** The ONE Filters button, redrawn: the old menu gone. Its menu's def — never
 *  off, as it holds the filter actions too (TODO 383). No badge (Will, TODO 447).
 *  TRAP T-one-filters-button · TRAP T-add-menu-batches */
export function drawFiltersButton(
  btn: HTMLElement,
  added: readonly AddedFilter[], offer: readonly ListedFilter[], sets: readonly SavedSet[], manage = false,
): FilterDef {
  const options = filtersMenuItems(added, offer, sets, manage);
  btn.querySelector('sherpa-menu')?.remove();
  return {
    id: 'add', label: FILTERS_LABEL, select: 'multiple',
    // Adding EVERY filter at once is never the answer. Will, 2026-09-25.
    selectAll: false,
    // The one menu that KEEPS Apply: each tick stamps a chip.
    commit: true,
    options,
  };
}

/** The ONE Filters menu, made from its def and hung on its button — the bar's and the
 *  column's alike: `hide`, Limit hides what it rules out; `opts`, the host's menu flags. TODO 523 U13 */
export function hangFiltersMenu(root: ParentNode, btn: HTMLElement, def: FilterDef, hide: boolean, opts: FilterMenuOptions = {}): SherpaMenu {
  const { menu, items } = menuFor(root, def, opts);
  menu.toggleAttribute('data-hide-unavailable', hide);
  btn.append(menu);
  menu.items?.(items);
  return menu;
}

/** The SAVED button's menu, where the app splits it from Filters: the saved
 *  sets, a tick adding one — its save rows and Manage are the host's to draw
 *  below them (`drawSaveActions`). Will, TODO 436 */
export function savedMenuDef(sets: readonly SavedSet[]): FilterDef {
  return {
    // A tick adds a set at once: no Apply. TODO 436
    id: 'saved', label: SAVED_SECTION, select: 'multiple', selectAll: false, commit: false,
    options: sets.map((s) => ({ value: `${SET_ROW}${s.id}`, label: s.label, selected: !!s.added })),
  };
}


/** Does this host save filters: it is `data-saveable`, and its provider does
 *  not keep saving off it (`data-no-saves`: the View's bar and the panel, while
 *  sets are saved at local scopes only). TODO 485 */
export function saves(host: Element): boolean {
  return host.hasAttribute('data-saveable') && !host.hasAttribute('data-no-saves');
}

/** The reader's saved sets, as the host last drew them, and those on a bar: each
 *  a preset of the reader's. Will, TODO 605. TODO 105 · TRAP T-saved-filters-are-every-scope */
export class SavedSets {
  /** The sets, copied. */
  #sets: SavedSet[] = [];
  /** The bar or panel that draws them. */
  readonly #host: HTMLElement;

  constructor(host: HTMLElement) {
    this.#host = host;
  }

  /** Keep a copy of the host's sets. */
  set(sets: readonly SavedSet[]): void {
    this.#sets = sets.map((set) => ({ ...set }));
  }

  /** A copy of each set, as kept. */
  get all(): SavedSet[] {
    return this.#sets.map((set) => ({ ...set }));
  }

  /** What the Filters menu lists: the page's own always; the reader's while the host saves. */
  get listed(): readonly SavedSet[] {
    if (this.#host.hasAttribute('data-no-saves')) return [];
    return saves(this.#host) ? this.#sets : this.#sets.filter((set) => !set.own);
  }

  /** A Filters menu's ticks, as saved-set requests: each set newly ticked is added,
   *  each unticked comes off. The set rows are taken out of `want`, so the rest is
   *  the held filters' answer. Will, TODO 605 */
  pick(want: Set<string>): { apply: string[]; dismiss: string[] } {
    const added = this.listed.filter((set) => set.added).map((set) => set.id);
    const picked = [...want].filter((v) => v.startsWith(SET_ROW)).map((v) => v.slice(SET_ROW.length));
    for (const id of picked) want.delete(`${SET_ROW}${id}`);
    return { apply: picked.filter((id) => !added.includes(id)), dismiss: added.filter((id) => !picked.includes(id)) };
  }
}

/** What each ONE-value row was told — on or off. Apply flips only a row the reader
 *  changed; a press elsewhere re-ticks a SHUT menu. TODO 54 · TRAP T-the-add-menu-is-the-whole-list */
export class OneRows {
  /** Each one-value row's value, and whether it was told on. */
  #told = new Map<string, boolean>();

  /** Remember what a fresh Filters list tells its one-value rows. */
  tell(added: readonly AddedFilter[]): void {
    this.#told = new Map(added.flatMap((f) => (f.on === undefined ? [] : [[f.id, f.on] as const])));
  }

  /** Is this a one-value row? */
  has(id: string): boolean {
    return this.#told.has(id);
  }

  /** The one-value rows, by value. */
  get ids(): string[] {
    return [...this.#told.keys()];
  }

  /** Apply says this row is `on`: true if the reader CHANGED it, which is remembered. */
  flip(id: string, on: boolean): boolean {
    if (this.#told.get(id) === on) return false;
    this.#told.set(id, on);
    return true;
  }

  /** A chip moved elsewhere: a SHUT menu's rows tick as `isOn` says. An open menu holds the reader's draft. */
  follow(menu: SherpaMenu | null | undefined, isOn: (id: string) => boolean): void {
    if (!menu || menu.open || !this.#told.size) return;
    let moved = false;
    for (const [id, was] of this.#told) {
      const on = isOn(id);
      if (on === was) continue;
      this.#told.set(id, on);
      moved = true;
    }
    if (!moved) return;
    const told = this.#told;
    menu.values = [...(menu.values ?? []).filter((v) => !told.has(v)), ...[...told].filter(([, on]) => on).map(([id]) => id)];
  }
}

/** TRAP T-drill-moves-not-clones — the rows are moved, never copied. */
export class MenuDrill {
  /** Where the rows came from, and the Filters menu's own rows and settings. */
  #at: {
    menu: SherpaMenu; home: HTMLElement; rows: Element[];
    own: Record<string, string | null>; heading: string;
  } | null = null;

  /** The menu drilled into, or null. */
  get home(): HTMLElement | null {
    return this.#at?.home ?? null;
  }

  /** The Filters menu it is drilled into, or null. */
  get menu(): SherpaMenu | null {
    return this.#at?.menu ?? null;
  }

  /** Move `home`'s rows into `menu`. Back stays one level deep, never a chain. */
  into(menu: SherpaMenu, home: HTMLElement, label: string): void {
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
