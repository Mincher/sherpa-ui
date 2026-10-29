/**
 * sherpa-container-header — the header strip inside a container.
 *
 * Figma's `accordion` variant is NOT a data-type here: it is this header with
 * `data-collapsible` and no `data-dismissible`.
 *
 * @tier sub-component — renders inside sherpa-container; excluded from the public catalog.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { SHOW_AS, SHOW_AS_HTML, showAs } from '../../core/ui/show-as.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaContainerHeader extends SherpaElement {
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = [SHOW_AS_HTML, new URL('./sherpa-container-header.html', import.meta.url)];
  static override props = {
    'data-collapsible': { type: 'boolean', kind: 'style' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
    'data-draggable': { type: 'boolean', kind: 'style' },
    'data-type': { type: 'enum', kind: 'style', values: ['default', 'panel'] },
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // Beside the icon slot, never in it: a slotted icon wins by CSS. TRAP T-slot-guards-only-when-filled
    'data-icon': { type: 'string', kind: 'content', to: '.glyph', as: 'icon' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    // Show as, and what the card shows: a pick is a REQUEST, its provider writes this. Will, TODO 548
    'data-presentation': { type: 'enum', kind: 'behaviour', values: [...SHOW_AS] },
  } as const;

  override onChange(name: string): void {
    if (name === 'data-presentation') this.#showAs();
  }

  /** Show as: a pick is a request; its provider writes what the card shows. */
  #showAs(): void {
    showAs(this.root, this.dataset['presentation'], (kind) => {
      if (kind !== this.dataset['presentation']) this.emit('presentation-change', { kind });
    });
  }

  override onRender(): void {
    this.#showAs();
    // `button-click`, not `click` — a disabled sherpa-button suppresses its own event.
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
    this.$('.toggle')?.addEventListener('button-click', this.#onToggle);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  /** The dismiss button. */
  #onDismiss = (): void => { this.emit('header-dismiss'); };

  /** Collapse or expand, and report it. */
  #onToggle = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.set('data-collapsed', collapsed);
    this.emit('header-collapse', { collapsed });
  };

  /** The drag handle was grabbed. */
  #onDrag = (): void => { this.emit('header-drag'); };
}

define('sherpa-container-header', SherpaContainerHeader);
