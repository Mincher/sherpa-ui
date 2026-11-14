/**
 * toolbar-header.ts — a filter toolbar's header actions, ONE for the bar and its
 * column: Save, and the acts both send. Each is told its own selector. TODO 415
 *
 * Map:
 * - HeaderEvent — What the header says: its toolbar's own events.
 * - HeaderHost — What the header asks of its toolbar.
 * - ToolbarHeader — Its Save, and the shared filter acts.
 * - .drawSave — Save, off while the filters are the View's own.
 * - .act — A filter act both templates send; false for one that is not.
 */

/** What the header says: its toolbar's own events, named so a checker reads them. */
export type HeaderEvent = 'view-reset' | 'filters-save' | 'filters-save-as';

/** What the header asks of its toolbar. */
export interface HeaderHost {
  el: HTMLElement;
  root(): ShadowRoot;
  /** Where its buttons are, where they are not in its own root: a panel's header. */
  header?(): ParentNode;
  emit(name: HeaderEvent, detail?: unknown, options?: { cancelable?: boolean }): void;
}

/** Its Save, and the shared filter acts. */
export class ToolbarHeader {
  constructor(
    private readonly host: HeaderHost,
    /** Its Save button. */
    private readonly saveAs: string,
  ) {}

  /** Save is off while the filters are the View's own, as Reset all is. Will, 382 */
  drawSave(): void {
    const save = this.host.root().querySelector(this.saveAs) ?? this.host.header?.().querySelector(this.saveAs);
    save?.toggleAttribute('disabled', this.host.el.hasAttribute('data-at-default'));
  }

  /** A filter act both templates send; false for one that is not. Reset is each
   *  template's own: the bar clears its chips, the column asks per scope. */
  act(act: string): boolean {
    // The View's OWN filters — only its provider knows them; CANCELABLE.
    // TRAP T-reset-to-default-is-the-views-own
    if (act === 'reset-default') this.host.emit('view-reset', {}, { cancelable: true });
    else if (act === 'filters-save' || act === 'filters-save-as') this.host.emit(act);
    else return false;
    return true;
  }
}
