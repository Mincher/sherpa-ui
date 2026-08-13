/**
 * sherpa-container-header — the header bar for a container's `header` slot.
 *
 * A title (from data-title, or a slotted heading), an optional description, and a
 * trailing actions slot. Designed to be slotted as slot="header" inside a
 * sherpa-container, but works inside any host. Everything visible is CSS off
 * data-* and the base class's data-has-{slot} reflection — JS only writes the
 * title/description text.
 *
 * @element sherpa-container-header
 * @attr {string} data-title       — heading text (or use the `heading` slot)
 * @attr {string} data-description — secondary text below the heading
 *
 * @slot heading — custom heading element (replaces the default .title)
 * @slot actions — trailing action controls (reflects data-has-actions)
 *
 * Fires: nothing — it's a static header row. Slotted controls emit their own events.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaContainerHeader extends SherpaElement {
  static override css = new URL('./sherpa-container-header.css', import.meta.url);
  static override html = new URL('./sherpa-container-header.html', import.meta.url);
  static override observed = ['data-title', 'data-description'];

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
  }

  override onChange(name: string): void {
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
  }

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.description');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }
}

customElements.define('sherpa-container-header', SherpaContainerHeader);
