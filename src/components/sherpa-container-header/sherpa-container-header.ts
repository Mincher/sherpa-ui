/**
 * sherpa-container-header — the header strip inside a container.
 *
 * Figma's `accordion` variant is NOT a data-type here: it is this header with
 * `data-collapsible` and no `data-dismissible`.
 *
 * @tier sub-component — renders inside sherpa-container; excluded from the public catalog.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { SHOW_AS, SHOW_AS_HTML, showAs } from '../../core/ui/show-as-menu.js';
import '../sherpa-button/sherpa-button.js';
// Show as's markup holds it.
import '../sherpa-menu/sherpa-menu.js';

export class SherpaContainerHeader extends SherpaElement {
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = [SHOW_AS_HTML, new URL('./sherpa-container-header.html', import.meta.url)];
  static override props = {
    'data-collapsible': { type: 'boolean', kind: 'style' },
    'data-dismissible': { type: 'boolean', kind: 'style' },
    'data-bordered-close': { type: 'boolean', kind: 'style' },
    'data-draggable': { type: 'boolean', kind: 'style' },
    'data-type': { type: 'enum', kind: 'style', values: ['default', 'panel'] },
    'data-heading': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    // Beside the icon slot, never in it: a slotted icon wins by CSS. TRAP T-slot-guards-only-when-filled
    'data-icon': { type: 'string', kind: 'content' },
    'data-collapsed': { type: 'boolean', kind: 'style' },
    // Show as, and what the card shows: a pick is a REQUEST, its provider writes this. Will, TODO 548
    'data-presentation': { type: 'enum', kind: 'behaviour', values: [...SHOW_AS, 'off'] },
    // What Default draws: the menu's first row names it. Its provider writes this. Will, TODO 620
    'data-presentation-default': { type: 'string', kind: 'behaviour' },
    // Its card's filter toolbar: a press is a REQUEST, its provider writes this. `panel`:
    // the panel shows it, so the button is inactive. Will, TODOs 629, 672
    'data-filter-toolbar': { type: 'enum', kind: 'behaviour', values: ['shown', 'shut', 'panel', 'off'] },
  } as const;
  static override observed = ['data-presentation', 'data-presentation-default', 'data-filter-toolbar'];

  override onChange(name: string): void {
    if (name === 'data-presentation' || name === 'data-presentation-default') this.#showAs();
    // A press would hide the panel by accident. Will, TODO 672
    if (name === 'data-filter-toolbar') this.$('.toolbar-toggle')?.toggleAttribute('disabled', this.dataset['filterToolbar'] === 'panel');
  }

  /** Show as: a pick is a request; its provider writes what the card shows. */
  #showAs(): void {
    showAs(this.root, this.dataset['presentation'], (kind) => {
      if (kind !== this.dataset['presentation']) this.emit('presentation-change', { kind });
    }, true, this.dataset['presentationDefault']);
  }

  override onRender(): void {
    this.#showAs();
    // `button-click`, not `click` — a disabled sherpa-button suppresses its own event.
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
    this.$('.toggle')?.addEventListener('button-click', this.#onToggle);
    this.$('.toolbar-toggle')?.addEventListener('button-click', this.#onToolbarToggle);
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

  /** Ask for its card's filter toolbar, shown or shut. */
  #onToolbarToggle = (): void => {
    this.emit('filter-toolbar-change', { shown: this.dataset['filterToolbar'] !== 'shown' });
  };

  /** The drag handle was grabbed. */
  #onDrag = (): void => { this.emit('header-drag'); };
}

define('sherpa-container-header', SherpaContainerHeader);
