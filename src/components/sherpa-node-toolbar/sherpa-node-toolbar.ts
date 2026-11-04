/**
 * sherpa-node-toolbar — a graph editor's tools: Save, Undo and Redo, as icon buttons in one group.
 *
 * It does nothing itself. A press is `toolbar-select`; the editor that owns the history hears Undo
 * and Redo and says, in `data-can-undo` and `data-can-redo`, when each can be pressed. Save is a
 * placeholder, off until a host sets `data-can-save`. TRAP T-an-edit-is-a-step
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaNodeToolbar extends SherpaElement {
  static override css = new URL('./sherpa-node-toolbar.css', import.meta.url);
  static override html = new URL('./sherpa-node-toolbar.html', import.meta.url);

  static override props = {
    'data-can-save': { type: 'boolean', kind: 'behaviour' },
    'data-can-undo': { type: 'boolean', kind: 'behaviour' },
    'data-can-redo': { type: 'boolean', kind: 'behaviour' },
  } as const;

  override onRender(): void {
    toolbarKeys(this.$('.tools')!);
    this.on(this.root, 'button-click', this.#onPress as EventListener);
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Each tool can be pressed when its flag is set. */
  #sync(): void {
    for (const action of ['save', 'undo', 'redo']) {
      this.$(`.${action}`)?.toggleAttribute('disabled', !this.hasAttribute(`data-can-${action}`));
    }
  }

  /** A tool was pressed: say which, if it can be. */
  #onPress = (event: Event): void => {
    const action = (event.target as HTMLElement).closest<HTMLElement>('sherpa-button')?.dataset['action'];
    if (action && this.hasAttribute(`data-can-${action}`)) this.emit('toolbar-select', { action });
  };
}

define('sherpa-node-toolbar', SherpaNodeToolbar);
