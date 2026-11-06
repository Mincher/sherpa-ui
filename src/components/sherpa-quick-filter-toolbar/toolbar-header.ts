/**
 * toolbar-header.ts — a filter toolbar's header actions, ONE for the bar and its
 * column: the Saved menu, a set ticked there, and the acts both send. Each is
 * told its own selectors. TODO 415
 *
 * Map:
 * - HeaderEvent — What the header says: its toolbar's own events.
 * - HeaderHost — What the header asks of its toolbar.
 * - ToolbarHeader — The Saved menu, its pick, its Save, and the shared filter acts.
 * - .drawSaved — The Saved menu, where the app splits it from Filters: the sets, the save rows, Manage.
 * - .pick — A set ticked in the Saved or Filters menu adds its chip; unticked, takes it off.
 * - .drawSave — Save, off while the filters are the View's own.
 * - .act — A filter act both templates send; false for one that is not.
 */
import { menuFor } from '../../core/ui/filter-menu.js';
import { MANAGE_SETS, savedMenuDef, type SavedSets } from '../../core/ui/filters-button.js';
import { drawSaveActions } from '../../core/ui/more-menu.js';

/** What the header says: its toolbar's own events, named so a checker reads them. */
export type HeaderEvent = 'filters-apply' | 'filters-dismiss' | 'view-reset' | 'filters-save'
  | 'filters-save-as' | typeof MANAGE_SETS;

/** What the header asks of its toolbar. */
export interface HeaderHost {
  el: HTMLElement;
  root(): ShadowRoot;
  /** Where its buttons are, where they are not in its own root: a panel's header. */
  header?(): ParentNode;
  emit(name: HeaderEvent, detail?: unknown, options?: { cancelable?: boolean }): void;
  toggleState(name: string, on: boolean): void;
}

/** The Saved menu, its pick, its Save, and the shared filter acts. */
export class ToolbarHeader {
  constructor(
    private readonly host: HeaderHost,
    private readonly saved: SavedSets,
    /** Its Saved button and its Save button. */
    private readonly at: { saved: string; saveAs: string },
  ) {}

  /** THE SAVED MENU, where the app splits it from Filters: the sets — a tick
   *  adds one — then the save rows, then Manage. Will, TODO 436 */
  drawSaved(): void {
    const { el } = this.host;
    this.host.toggleState('has-sets', this.saved.listed.length > 0);
    const btn = this.#find(this.at.saved);
    btn?.querySelector('sherpa-menu')?.remove();
    if (!btn) return;
    const { menu, items } = menuFor(this.host.root(), savedMenuDef(this.saved.listed));
    menu.setAttribute('data-align', 'end');
    btn.append(menu);
    menu.items?.(items);
    drawSaveActions(el, this.host.root(), menu);
  }

  /** A saved set ticked adds its chip; unticked, takes it off. Its rows leave `values`:
   *  what is left is the fields' answer. TODOs 436, 597, 605 */
  pick(values: Set<string>): void {
    const { apply, dismiss } = this.saved.pick(values);
    for (const id of dismiss) this.host.emit('filters-dismiss', { id });
    for (const id of apply) this.host.emit('filters-apply', { id });
  }

  /** One of its buttons: in its root, else in its panel's header. */
  #find(selector: string): Element | null {
    return this.host.root().querySelector(selector) ?? this.host.header?.().querySelector(selector) ?? null;
  }

  /** Save is off while the filters are the View's own, as Reset all is. Will, 382 */
  drawSave(): void {
    this.#find(this.at.saveAs)?.toggleAttribute('disabled', this.host.el.hasAttribute('data-at-default'));
  }

  /** A filter act both templates send; false for one that is not. Reset is each
   *  template's own: the bar clears its chips, the column asks per scope. */
  act(act: string): boolean {
    // The View's OWN filters — only its provider knows them; CANCELABLE.
    // TRAP T-reset-to-default-is-the-views-own
    if (act === 'reset-default') this.host.emit('view-reset', {}, { cancelable: true });
    else if (act === 'filters-save' || act === 'filters-save-as' || act === MANAGE_SETS) this.host.emit(act);
    else return false;
    return true;
  }
}
