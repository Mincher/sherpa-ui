/**
 * toolbar-header.ts — a filter toolbar's header actions, ONE for the bar and its
 * column: the Saved menu, a set ticked there, "Save <name>", and the acts both
 * send. Each is told its own selectors. TODO 415
 *
 * Map:
 * - HeaderEvent — What the header says: its toolbar's own events.
 * - HeaderHost — What the header asks of its toolbar.
 * - ToolbarHeader — The Saved menu, its pick, Save <name>, and the shared filter acts.
 * - .drawSaved — The Saved menu, where the app splits it from Filters: the sets, the save rows, Manage.
 * - .pick — A set ticked in the Saved or Filters menu takes it; unticked, takes it off.
 * - .drawSave — "Save <name>" while a saved set is taken.
 * - .act — A filter act both templates send; false for one that is not.
 */
import { menuFor } from '../../core/ui/filter-menu.js';
import { MANAGE_SETS, savedMenuDef, saves, type SavedSets } from '../../core/ui/filters-button.js';
import { drawSaveActions } from '../../core/ui/more-menu.js';

/** What the header says: its toolbar's own events, named so a checker reads them. */
export type HeaderEvent = 'filters-apply' | 'filters-dismiss' | 'view-reset' | 'filters-delete' | 'filters-save'
  | 'filters-save-as' | typeof MANAGE_SETS;

/** What the header asks of its toolbar. */
export interface HeaderHost {
  el: HTMLElement;
  root(): ShadowRoot;
  emit(name: HeaderEvent, detail?: unknown, options?: { cancelable?: boolean }): void;
  toggleState(name: string, on: boolean): void;
}

/** The Saved menu, its pick, Save <name>, and the shared filter acts. */
export class ToolbarHeader {
  constructor(
    private readonly host: HeaderHost,
    private readonly saved: SavedSets,
    /** Its Saved button, its Save <name> button and its Save button. */
    private readonly at: { saved: string; save: string; saveAs: string },
  ) {}

  /** THE SAVED MENU, where the app splits it from Filters: the sets — a tick
   *  takes one — then the save rows, then Manage. Will, TODO 436 */
  drawSaved(): void {
    const { el } = this.host;
    this.host.toggleState('has-sets', this.saved.listed.length > 0);
    const btn = this.host.root().querySelector(this.at.saved);
    btn?.querySelector('sherpa-menu')?.remove();
    if (!btn || !el.hasAttribute('data-saved-menu')) return;
    const { menu, items } = menuFor(this.host.root(), savedMenuDef(this.saved.listed));
    menu.setAttribute('data-align', 'end');
    btn.append(menu);
    menu.items?.(items);
    const manage = saves(el) && this.saved.listed.some((s) => s.own);
    drawSaveActions(el, this.host.root(), menu, this.saved.applied, manage);
  }

  /** A saved set ticked takes it; unticked, takes it off. TODO 436 */
  pick(values: readonly string[]): void {
    const set = this.saved.pick(new Set(values));
    if (set.apply) this.host.emit('filters-apply', { id: set.apply });
    else if (set.dismiss) this.host.emit('filters-dismiss', { id: set.dismiss });
  }

  /** "Save <name>" while a saved set is taken; it and Save are off while the
   *  filters are the View's own, as Reset all is. Will, 366, 382 */
  drawSave(): void {
    const applied = this.saved.applied;
    this.host.toggleState('set-taken', !!applied);
    const save = this.host.root().querySelector(this.at.save);
    const name = save?.querySelector('.save-name');
    if (name) name.textContent = applied?.label ?? '';
    save?.toggleAttribute('data-status', false);
    if (applied) save?.setAttribute('data-status', 'active');
    const same = this.host.el.hasAttribute('data-at-default');
    for (const btn of [save, this.host.root().querySelector(this.at.saveAs)]) btn?.toggleAttribute('disabled', same);
  }

  /** A filter act both templates send; false for one that is not. Reset is each
   *  template's own: the bar clears its chips, the column asks per scope. */
  act(act: string): boolean {
    // The View's OWN filters — only its provider knows them; CANCELABLE.
    // TRAP T-reset-to-default-is-the-views-own
    if (act === 'reset-default') this.host.emit('view-reset', {}, { cancelable: true });
    else if (act === 'filters-delete') this.host.emit('filters-delete', { id: this.saved.applied?.id });
    else if (act === 'filters-save' || act === 'filters-save-as' || act === MANAGE_SETS) this.host.emit(act);
    else return false;
    return true;
  }
}
