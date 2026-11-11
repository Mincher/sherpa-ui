/**
 * sherpa-node-stage — one stage of a workflow: a column across a sherpa-layout-canvas, its bar at the top and its band
 * down the view. It owns no place: its host writes its edge and width, and it reports its menu and its moves. Will,
 * 2026-11-10 · TODO 893
 */
import { DATA_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
// Defined before the template stamps them.
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';

/** What More offers. */
const ACTIONS = ['edit', 'add-before', 'add-after', 'remove'];

export class SherpaNodeStage extends SherpaElement {
  static override css = new URL('./sherpa-node-stage.css', import.meta.url);
  static override html = new URL('./sherpa-node-stage.html', import.meta.url);

  static override props = {
    'data-heading': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-colour': { type: 'string', kind: 'behaviour' },
    'data-x': { type: 'number', kind: 'behaviour' },
    'data-w': { type: 'number', kind: 'behaviour' },
    'data-removable': { type: 'boolean', kind: 'style' },
    'data-first': { type: 'boolean', kind: 'behaviour' },
    'data-last': { type: 'boolean', kind: 'behaviour' },
    'data-locked': DATA_PROPS['data-locked'],
  } as const;
  static override observed = ['data-x', 'data-w', 'data-colour'];

  override onRender(): void {
    this.$('.more')?.addEventListener('menu-select', this.#onMenu);
    for (const [cls, by] of [['.move-left', -1], ['.move-right', 1]] as const) {
      this.$(cls)?.addEventListener('button-click', () => this.emit('stage-move', { by }));
    }
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** Where the canvas draws it, its colour, and which way it can move. */
  #sync(): void {
    this.style.setProperty('--x', `${this.num('data-x', 0)}px`);
    this.style.setProperty('--width', `${this.num('data-w', 320)}px`);
    const colour = this.getAttribute('data-colour');
    if (colour) this.style.setProperty('--_colour', colour);
    else this.style.removeProperty('--_colour');
    this.$('.move-left')?.toggleAttribute('disabled', this.hasAttribute('data-first'));
    this.$('.move-right')?.toggleAttribute('disabled', this.hasAttribute('data-last'));
  }

  /** More's pick. Reported once the menu has shut: what the host does next may hide the button it hangs from, and a menu
   *  hidden while it shuts stays open in name. */
  #onMenu = (event: Event): void => {
    event.stopPropagation();
    const action = (event as CustomEvent<{ value?: string }>).detail?.value;
    if (!action || !ACTIONS.includes(action) || (action === 'remove' && !this.hasAttribute('data-removable'))) return;
    queueMicrotask(() => this.emit('stage-menu-select', { action }));
  };
}

define('sherpa-node-stage', SherpaNodeStage);
