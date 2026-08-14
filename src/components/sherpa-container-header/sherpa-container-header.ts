/**
 * sherpa-container-header — the header bar for a container's `header` slot.
 *
 * Rebuilt to match the Figma "Container Header": an optional drag handle + icon
 * lead a title + optional description, then a trailing actions region with an
 * optional collapse toggle and a dismiss button. Designed to slot as
 * slot="header" inside a sherpa-container, but works in any host.
 *
 * Everything visible is CSS off data-* + slot presence; JS writes the
 * title/description/icon text, reflects the collapsed state onto the toggle, and
 * wires the header's own events.
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
