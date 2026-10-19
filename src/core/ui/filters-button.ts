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
 * - ListedFilter — One filter the menu lists.
 * - SavedSet — One saved set of filters, as the menu and the Saved chip draw it.
 * - AddedFilter — One filter the view holds.
 * - drawFiltersButton — The ONE Filters button, redrawn: off with nothing to list, its badge the filters it hides, the old menu gone.
 * - reopenFilters — The Filters menu, rebuilt under the reader's pointer by a ×: open it again once it has drawn.
 * - SavedSets — The reader's saved sets, as the host last drew them, and the Saved chip that names the one on.
 * - .set — Keep a copy of the host's sets, and redraw the Saved chip.
 * - .all — A copy of each set, as kept.
 * - .on — The set on screen, if any.
 * - .listed — What the Filters menu lists: nothing unless the host saves.
 * - .draw — The Saved chip says the set on screen: its name, and ` *` and the warning look once changed.
 * - .pick — A Filters menu's ticks, as a saved-set request: apply one, or dismiss the one on.
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
import type { FilterMenuItem } from './filter-menu.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../../components/sherpa-quick-filter/sherpa-quick-filter.js';

const FILTERS_LABEL = 'Filters';
const ADDED_SECTION = 'Added filters';
const AVAILABLE_SECTION = 'Available filters';
const SAVED_SECTION = 'Saved filters';

/** TRAP T-drill-flags-travel-and-replace — never merged. */
const DRILL_FLAGS = ['data-commit', 'data-range', 'data-select', 'data-search'] as const;

/** One filter the menu lists. */
export interface ListedFilter {
  id: string;
  label: string;
  /** A second fact the row shows, muted. */
  note?: string | undefined;
  /** A SAVED filter carries its answer. */
  readings?: unknown;
  /** No value is left under the filters before it: greyed — hidden while Hide
   *  unmatching is on. TRAP T-the-add-menu-is-the-whole-list */
  spent?: boolean;
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
function filtersMenuItems(
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
      ...(f.spent ? { available: false } : {}),
    })),
    ...offer.filter((f) => f.readings)
      .map((f) => ({ value: f.id, label: f.label, ...(f.note ? { note: f.note } : {}), section: SAVED_SECTION })),
    // A reader's saved SETS: a tick applies one, and the one on is ticked. TODO 105
    ...sets.map((s) => ({ value: `${SET_ROW}${s.id}`, label: s.label, section: SAVED_SECTION, selected: !!s.on })),
  ];
}

/** The ONE Filters button, redrawn: off with nothing to list, its badge the
 *  filters it hides, the old menu gone. Its menu's def, or null. TRAP T-one-filters-button
 *  TRAP T-add-menu-batches */
export function drawFiltersButton(
  btn: HTMLElement, hidden: number,
  added: readonly AddedFilter[], offer: readonly ListedFilter[], sets: readonly SavedSet[],
): FilterDef | null {
  const options = filtersMenuItems(added, offer, sets);
  const any = options.length > 0 || hidden > 0;
  btn.toggleAttribute('disabled', !any);
  if (hidden) btn.dataset['badge'] = String(hidden);
  else btn.removeAttribute('data-badge');
  btn.querySelector('sherpa-menu')?.remove();
  if (!any) return null;
  return {
    id: 'add', label: FILTERS_LABEL, select: 'multiple',
    // Adding EVERY filter at once is never the answer. Will, 2026-09-25.
    selectAll: false,
    // The one menu that KEEPS Apply: each tick stamps a chip.
    commit: true,
    options,
  };
}

/** The Filters menu, rebuilt under the reader's pointer by a ×: open it again once it has drawn. TODO 54 */
export async function reopenFilters(button: HTMLElement | null): Promise<void> {
  const menu = button?.querySelector<SherpaMenu>('sherpa-menu');
  if (!button || !menu) return;
  await menu.rendered;
  if (menu.isConnected) menu.show?.(button);
}

/** The reader's saved sets, as the host last drew them, and the Saved chip that
 *  names the one on. TODO 105 · TRAP T-saved-filters-are-every-scope */
export class SavedSets {
  /** The sets, copied. */
  #sets: SavedSet[] = [];
  /** The bar or panel that draws them. */
  readonly #host: HTMLElement;
  /** Its Saved chip, looked up on each draw. */
  readonly #chip: () => SherpaQuickFilter | null;

  constructor(host: HTMLElement, chip: () => SherpaQuickFilter | null) {
    this.#host = host;
    this.#chip = chip;
  }

  /** Keep a copy of the host's sets, and redraw the Saved chip. */
  set(sets: readonly SavedSet[]): void {
    this.#sets = sets.map((set) => ({ ...set }));
    this.draw();
  }

  /** A copy of each set, as kept. */
  get all(): SavedSet[] {
    return this.#sets.map((set) => ({ ...set }));
  }

  /** The set on screen, if any. */
  get on(): SavedSet | undefined {
    return this.#sets.find((set) => set.on);
  }

  /** What the Filters menu lists: nothing unless the host saves. */
  get listed(): readonly SavedSet[] {
    return this.#host.hasAttribute('data-saveable') ? this.#sets : [];
  }

  /** The Saved chip says the set on screen: its name, and ` *` and the warning
   *  look once changed. `data-saved` on the host shows it. */
  draw(): void {
    const chip = this.#chip();
    const on = this.#host.hasAttribute('data-saveable') ? this.on : undefined;
    this.#host.toggleAttribute('data-saved', !!on);
    if (!chip || !on) return;
    chip.valueLabel = `${on.label}${on.edited ? ' *' : ''}`;
    if (on.edited) chip.dataset['status'] = 'warning';
    else chip.removeAttribute('data-status');
  }

  /** A Filters menu's ticks, as a saved-set request: the set newly ticked is
   *  applied; the one on, unticked, is dismissed. The set rows are taken out of
   *  `want`, so the rest is the held filters' answer. */
  pick(want: Set<string>): { apply?: string; dismiss?: boolean } {
    const on = this.on?.id;
    const picked = [...want].filter((v) => v.startsWith(SET_ROW)).map((v) => v.slice(SET_ROW.length));
    for (const id of picked) want.delete(`${SET_ROW}${id}`);
    const apply = picked.find((id) => id !== on);
    if (apply) return { apply };
    return on && !picked.includes(on) ? { dismiss: true } : {};
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
