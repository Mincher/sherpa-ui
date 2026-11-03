/**
 * grid-actions.ts — a grid's row actions: one shared menu, opened from a row's
 * trigger, and the actions a selection of a size may take. A module of
 * sherpa-data-grid, not an element. TRAP T-one-actions-menu-for-every-row
 *
 * Map:
 * - ActionsHost — What the row actions ask of their grid.
 * - GridActions — The actions each row offers, and the one menu that offers them.
 * - .list — The actions, as populated.
 * - .take — The actions a populate gave.
 * - .click — A click in the body: an actions trigger opens the menu for its row.
 * - .select — A menu row was chosen: reported, never acted on.
 * - .shut — The menu shut, picked or not: each trigger says so.
 * - .for — The actions for a selection of this size.
 */
import type { Row } from '../../core/data/store.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { GridAction } from './sherpa-data-grid.js';
import type { GridHost } from './grid-host.js';

/** What the row actions ask of their grid. */
export interface ActionsHost extends GridHost {
  /** Stamp the menu's rows, one per action. */
  stamp(actions: readonly GridAction[]): void;
  /** An action was chosen for these records: the grid reports it. */
  chosen(id: string, records: Row[]): void;
}

/** The actions each row offers, and the one menu that offers them. */
export class GridActions {
  /** Its grid. */
  readonly #host: ActionsHost;
  /** The per-row actions, which reveal the pinned actions column. */
  #actions: GridAction[] = [];
  /** The row whose menu is open. A RECORD, because an index moves on a sort. */
  #row: Row | null = null;

  constructor(host: ActionsHost) {
    this.#host = host;
  }

  /** The actions, as populated. */
  get list(): readonly GridAction[] {
    return this.#actions;
  }

  /** The actions a populate gave. */
  take(actions: unknown): void {
    this.#actions = Array.isArray(actions) ? actions as GridAction[] : [];
  }

  /** A click inside the body: an actions trigger opens the menu for its row. It
   *  stops here, as a HOST listener has no guard against it. */
  click = (event: Event): void => {
    const trigger = (event.target as HTMLElement).closest<HTMLElement>('.actions-trigger');
    if (!trigger) return;
    event.stopPropagation();
    this.#open(trigger);
  };

  /** Open the shared menu for one row, its rows stamped again. SLOTTED light-DOM
   *  buttons give Enter, Space and focus for nothing. TRAP T-menu-rows-stay-native-controls */
  #open(trigger: HTMLElement): void {
    const record = this.#host.recordFor(trigger);
    const menu = this.#host.$<SherpaMenu>('.actions-menu');
    if (!record || !this.#actions.length || !menu) return;
    this.#row = record;
    this.#host.stamp(this.#actions);
    trigger.setAttribute('aria-expanded', 'true');
    menu.show?.(trigger);
  }

  /** A menu row was chosen. REPORTS, never acts — deleting a record is the host's
   *  decision. TRAP T-grid-reports-never-combines */
  select = (event: Event): void => {
    const id = (event as CustomEvent).detail?.['value'] as string | undefined;
    const record = this.#row;
    this.#row = null;
    this.#host.$<SherpaMenu>('.actions-menu')?.hide?.();
    if (id && record) this.#host.chosen(id, [record]);
  };

  /** The menu shut, picked or not — Escape, a click outside: each trigger says so. TODO 523 */
  shut = (): void => {
    for (const t of this.#host.$$('.actions-trigger')) t.setAttribute('aria-expanded', 'false');
  };

  /** The actions for a selection of this size — one row: all; two or more: only
   *  `multi`. TRAP T-grid-actions-are-declared-once-used-twice */
  for(count: number): GridAction[] {
    if (count <= 0) return [];
    return count === 1 ? [...this.#actions] : this.#actions.filter((a) => a.multi);
  }
}
