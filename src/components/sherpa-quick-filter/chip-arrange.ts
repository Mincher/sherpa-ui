/**
 * chip-arrange.ts — a chip that ARRANGES rows rather than choosing them: Group toggles,
 * Sort cycles asc → desc → off. Its column is its menu's pick, else `data-column`; a
 * Sort's way is `data-direction`. The toolbar's Group and Sort, a chart's Primary,
 * Secondary and order Sort. A module of sherpa-quick-filter, not an element. Plan 695 P5
 * TRAP T-a-chip-knows-what-kind-it-is · TRAP T-one-cycle-for-one-value · TRAP T-off-is-not-forgotten
 *
 * Map:
 * - ArrangeHost — What the arrangement asks of its chip.
 * - ChipArrange — A Group or Sort chip's column, way, gesture and face.
 * - .on — Does it arrange: is it a Group or a Sort?
 * - .column — The column it arranges by: its menu's pick, else `data-column`.
 * - .direction — Which way a Sort points, or null while it is off.
 * - .press — The body's own gesture: Group toggles, Sort cycles.
 * - .picked — A column picked in its menu: applied at once, and said.
 * - .steer — Its column and way, from its host: silent.
 * - .draw — The column in the caret, the glyph that says which way, and its tip.
 * - .clear — No column and no way: forgotten.
 */
import { nextSort, sortDirectionFrom } from '../../core/data/cycle.js';
import type { SortDirection } from '../../core/data/store.js';
import { arranges, type FilterKind } from '../../core/ui/filter-kind.js';
import { ORGANISE_ICONS } from '../../core/ui/shared-constants.js';
import type { ChipHost } from './chip-host.js';
import type { ChipSays } from './chip-says.js';

/** What the arrangement asks of its chip. */
export interface ArrangeHost extends ChipHost {
  /** What it says. */
  readonly says: ChipSays;
  /** A word from its markup. */
  word(key: string): string;
  /** A Group picked or cleared its column. */
  grouped(field: string | null): void;
  /** A Sort picked its column or way; `clear`: None, no sort to resume. */
  sorted(field: string | null, direction: SortDirection, clear: boolean): void;
}

/** A Group or Sort chip's column, way, gesture and face. */
export class ChipArrange {
  /** Its chip. */
  readonly #host: ArrangeHost;

  constructor(host: ArrangeHost) {
    this.#host = host;
  }

  /** GROUP or SORT: it arranges rows rather than choosing them. */
  on(): boolean {
    return arranges(this.#host.el.dataset['kind'] as FilterKind);
  }

  /**
   * The column this chip arranges by.
   *
   * Its MENU's own pick, where it has one. A host that draws the choice some
   * other way — a run of options, a saved view — names it in `data-column`
   * instead; the menu wins whenever there is a menu to ask.
   */
  column(): string {
    const { el } = this.#host;
    /* THE MENU FIRST, the attribute second. A menu stamps its rows on its own
       upgrade, so for one tick it reads unpicked — and a host that seeded the
       column would have had it forgotten. Its rows are RADIOS, so this can
       only ever fall back, never overrule a pick.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    const box = el.menu ? el.querySelector<HTMLInputElement>('[slot="menu"] input:checked') : null;
    // NONE picks no column, not the one it remembers. TODO 407
    if (box?.closest('.qf-none')) return '';
    return box?.value || el.dataset['column'] || '';
  }

  /** Which way a SORT chip is pointing, or null when it is off. */
  direction(): SortDirection | null {
    const { el } = this.#host;
    if (!el.current) return null;
    return sortDirectionFrom(el.dataset['direction']) ?? 'asc';
  }

  /**
   * The chip's own gesture, for the two kinds that have one.
   *
   * GROUP toggles. SORT cycles asc → desc → suspended → asc, from `nextSort()`
   * in the data layer — the same step the grid's column heading takes. Written
   * separately in the toolbar and the panel, the two drifted every time.
   * TRAP T-a-chip-knows-what-kind-it-is · TRAP T-one-cycle-for-one-value
   * TRAP T-sort-is-tri-state · TRAP T-group-chip-body-toggles-grouping
   * TRAP T-a-chip-body-cycles-its-states
   * TRAP T-an-organise-chip-is-named-for-its-job-not-its-field
   */
  press(): void {
    const { el } = this.#host;
    const field = this.column();
    /* NO COLUMN, NOTHING TO ARRANGE. Turning it on would light a chip that
       sorts by nothing, and a reader who has not chosen has done nothing
       wrong. TRAP T-an-organise-chip-has-no-values */
    if (!field) {
      if (this.#drawn()) return;
      el.current = false;
      this.draw();
      return;
    }
    if (el.dataset['kind'] === 'group') {
      const on = !el.current;
      if (!this.#drawn()) {
        el.current = on;
        this.draw();
      }
      this.#host.grouped(on ? field : null);
      return;
    }
    const next = nextSort(field, el.current ? field : null, this.direction());
    this.#sort(next.field, next.direction);
  }

  /** LOCKED, the chip reports and its host draws it: it writes no state of its
   *  own. 366 step 22 · TRAP T-locked-chip-relays-and-nothing-else */
  #drawn(): boolean {
    return this.#host.el.hasAttribute('data-locked');
  }

  /** A column was picked from the menu: apply it and say so. */
  picked(): void {
    const { el } = this.#host;
    const field = this.column();
    // NONE clears: the column is forgotten, and a sort is not kept to resume. TODO 407
    const none = !field;
    if (none) this.#host.set('data-column', null);
    if (el.dataset['kind'] === 'group') {
      if (!this.#drawn()) {
        el.current = !!field;
        this.draw();
      }
      this.#host.grouped(field || null);
      return;
    }
    // The way it is ALREADY pointing — picking a column does not rewind it.
    this.#sort(field, field ? sortDirectionFrom(el.dataset['direction']) ?? 'asc' : null, none);
  }

  /**
   * Apply a sort and report it — the ONE place a chip's direction is written.
   *
   * The attribute is the state channel a host reads back, and `asc` used to be
   * stamped at three moments by three owners: this cycle, the container that
   * built the chip, and that container's attribute sync.
   * TRAP T-one-cycle-for-one-value
   */
  #sort(field: string | null, direction: SortDirection | null, clear = false): void {
    if (!this.#drawn()) {
      // A suspended chip rewinds to `asc` — that is where a resume starts.
      this.#host.set('data-direction', direction ?? 'asc');
      this.#host.el.current = direction !== null;
      this.draw();
    }
    this.#host.sorted(direction === null ? null : field, direction ?? 'asc', clear);
  }

  /**
   * Steer a GROUP or SORT chip: its column, and for a sort which way. SILENT,
   * like every steer. No field is OFF, and the chip keeps the column it had; a
   * sort with `''` for its direction is suspended, and resumes ascending.
   * TRAP T-a-chip-body-cycles-its-states · TRAP T-off-is-not-forgotten
   * TRAP T-a-suspended-sort-is-one-owners-job · TRAP T-one-cycle-for-one-value
   */
  steer(field: string, direction?: string | null): void {
    if (!this.on()) return;
    const { el } = this.#host;
    if (!field) {
      this.#host.set('data-current', null);
      this.draw();
      return;
    }
    /* NAME THE COLUMN, then tick it. A rebuilt menu has no rows for a frame, so
       the tick can miss — `data-column` is what the chip reads until it lands.
       TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    this.#host.set('data-column', field);
    for (const radio of el.querySelectorAll<HTMLInputElement>('input[type="radio"]')) {
      radio.checked = radio.value === field;
    }
    const suspended = el.dataset['kind'] === 'sort' && direction === '';
    if (el.dataset['kind'] === 'sort') {
      this.#host.set('data-direction', suspended ? 'asc' : sortDirectionFrom(direction ?? undefined) ?? 'asc');
    }
    this.#host.set('data-current', !suspended);
    this.draw();
  }

  /** The column in the caret, and the glyph that says which way. */
  draw(): void {
    if (!this.on()) return;
    const { el, says } = this.#host;
    /* OFF IS NOT FORGOTTEN. A suspended arrangement keeps its column, so the
       caret still names it and one more click resumes exactly what was there.
       TRAP T-off-is-not-forgotten · TRAP T-grid-suspend-is-not-clear */
    const field = this.column();
    const row = el.querySelector<HTMLElement>(`[slot="menu"] input[value="${CSS.escape(field)}"]`)
      ?.closest<HTMLElement>('label, .menu-row');
    /* With no menu, nothing was picked: the tip says only the way. TODO 548. Its
       name is its item's, never a word its row adds — "(Default)". Will, TODO 684 */
    const named = field ? el.menu?.itemData?.find((i) => i.value === field)?.label : undefined;
    says.valueLabel = field && el.menu ? named || (row?.textContent ?? '').trim() || field : '';
    const dir = el.dataset['kind'] === 'sort' ? this.direction() : null;
    if (el.dataset['kind'] === 'sort') {
      this.#host.set('data-icon-start', dir === null ? ORGANISE_ICONS.sortNone
        : dir === 'desc' ? ORGANISE_ICONS.sortDesc : ORGANISE_ICONS.sortAsc);
    }
    // The tip says the column, and for a sort which WAY. Will, TODO 125.
    // Its words are in its template: before the stamp, the draw on connect says the way.
    const way = dir && el.hasRendered ? this.#host.word(dir) : '';
    // …led by its own name: a narrow bar shows only its icon. Will, TODO 680
    const answer = el.current ? [says.valueLabel, way].filter(Boolean).join(', ') : '';
    says.said([el.dataset['label'] ?? '', answer].filter(Boolean).join(': '));
  }

  /** GROUP or SORT: no column, and no way — FORGOTTEN, not written: the chip
   *  answers `asc` for one with none. TODO 424 · TRAP T-one-cycle-for-one-value */
  clear(): void {
    const { el } = this.#host;
    this.#host.set('data-current', null);
    this.#host.set('data-direction', null);
    this.#host.set('data-column', null);
    for (const input of el.querySelectorAll<HTMLInputElement>('input')) input.checked = false;
  }
}
