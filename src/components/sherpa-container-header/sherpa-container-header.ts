/**
 * sherpa-container-header — the header strip inside a container.
 *
 * Drag handle, icon, title/description, then actions, collapse toggle and close.
 * `data-type="panel"` selects a second look; the look itself is all CSS.
 *
 * Figma's `accordion` variant is deliberately NOT a data-type value — it is this
 * header with `data-collapsible` and no `data-dismissible`. A self-contained
 * disclosure card is the separate `sherpa-accordion`.
 *
 * @tier sub-component — renders inside sherpa-container; excluded from the public catalog.
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-button/sherpa-button.js';

export class SherpaContainerHeader extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = new URL('./sherpa-container-header.html', import.meta.url);
  static override props = {
    'data-heading': { type: 'string', kind: 'content', to: '.title' },
    'data-description': { type: 'string', kind: 'content', to: '.description' },
    // A slotted icon wins over the data-icon glyph.
    'data-icon': { type: 'string', kind: 'content', to: '.icon', skipWhen: '[slot]', as: 'icon' },
  } as const;

  static override observed = ['data-collapsed'];

  override onRender(): void {
    this.#syncCollapsed();
    // `button-click`, not `click` — a disabled sherpa-button suppresses its own
    // event, where a raw click listener would still fire.
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

  #onDismiss = (): void => { this.emit('header-dismiss', {}); };

  #onToggle = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('header-collapse', { collapsed });
  };

  #onDrag = (): void => { this.emit('header-drag', {}); };
}

customElements.define('sherpa-container-header', SherpaContainerHeader);
