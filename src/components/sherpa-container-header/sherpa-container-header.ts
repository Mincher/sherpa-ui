/**
 * sherpa-container-header — the header strip inside a container.
 *
 * Figma's `accordion` variant is NOT a data-type here: it is this header with
 * `data-collapsible` and no `data-dismissible`.
 *
 * @tier sub-component — renders inside sherpa-container; excluded from the public catalog.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaContainerHeader extends SherpaElement {
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = new URL('./sherpa-container-header.html', import.meta.url);
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
  } as const;

  override onRender(): void {
    this.#syncCollapsed();
    // `button-click`, not `click` — a disabled sherpa-button suppresses its own event.
    this.$('.close')?.addEventListener('button-click', this.#onDismiss);
    this.$('.toggle')?.addEventListener('button-click', this.#onToggle);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    if (name === 'data-collapsed') this.#syncCollapsed();
  }

  /** Reflect collapsed onto the toggle's aria-expanded / label. */
  #syncCollapsed(): void {
    const collapsed = this.hasAttribute('data-collapsed');
    const toggle = this.$('.toggle');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  }

  /** The dismiss button. */
  #onDismiss = (): void => { this.emit('header-dismiss'); };

  /** Collapse or expand, and report it. */
  #onToggle = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('header-collapse', { collapsed });
  };

  /** The drag handle was grabbed. */
  #onDrag = (): void => { this.emit('header-drag'); };
}

define('sherpa-container-header', SherpaContainerHeader);
