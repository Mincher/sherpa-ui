/**
 * sherpa-container-header — the header strip inside a container.
 *
 * From left to right: an optional drag handle and icon, then a title and
 * optional description, then a row of actions on the right with an optional
 * collapse toggle and a close button. It's meant to slot into a sherpa-container
 * as the header, but it works anywhere.
 *
 * CSS handles the look. JS writes the title, description, and icon text, keeps
 * the collapse toggle in sync, and fires the header's events.
 *
 * @element sherpa-container-header
 * @attr {string}  data-title        — heading text (or use the `heading` slot)
 * @attr {string}  data-description  — secondary text below the heading
 * @attr {string}  data-icon         — a glyph before the title
 * @attr {boolean} data-draggable    — show the drag handle
 * @attr {boolean} data-dismissible  — show the close button
 * @attr {boolean} data-collapsible  — show the collapse toggle
 * @attr {boolean} data-collapsed    — collapsed state
 *
 * @slot heading — custom heading element (replaces the default .title)
 * @slot icon    — custom icon element
 * @slot actions — extra trailing action controls
 *
 * @fires container-header-dismiss — detail: {}
 * @fires container-header-toggle  — detail: { collapsed }
 * @fires container-header-drag    — detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaContainerHeader extends SherpaElement {
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = new URL('./sherpa-container-header.html', import.meta.url);
  static override observed = ['data-title', 'data-description', 'data-icon', 'data-collapsed'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
    this.#syncIcon();
    this.#syncCollapsed();
    this.$('.close')?.addEventListener('click', this.#onDismiss);
    this.$('.toggle')?.addEventListener('click', this.#onToggle);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
    else if (name === 'data-icon') this.#syncIcon();
    else if (name === 'data-collapsed') this.#syncCollapsed();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.description');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }

  /** A glyph in data-icon renders into the icon span (a slotted icon wins). */
  #syncIcon(): void {
    const el = this.$('.icon');
    if (el && !el.querySelector('[slot]')) el.textContent = this.dataset['icon'] ?? '';
  }

  /** Reflect collapsed onto the toggle's aria-expanded / label. */
  #syncCollapsed(): void {
    const collapsed = this.hasAttribute('data-collapsed');
    const toggle = this.$('.toggle');
    toggle?.setAttribute('aria-expanded', String(!collapsed));
    toggle?.setAttribute('aria-label', collapsed ? 'Expand' : 'Collapse');
  }

  /* ── Events ─────────────────────────────────────────────────────── */

  #onDismiss = (): void => { this.emit('container-header-dismiss', {}); };

  #onToggle = (): void => {
    const collapsed = !this.hasAttribute('data-collapsed');
    this.toggleAttribute('data-collapsed', collapsed);
    this.emit('container-header-toggle', { collapsed });
  };

  #onDrag = (): void => { this.emit('container-header-drag', {}); };
}

customElements.define('sherpa-container-header', SherpaContainerHeader);
