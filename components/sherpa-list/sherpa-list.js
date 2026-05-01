/**
 * @element sherpa-list
 * @description Grouping container for sherpa-list-item children. Provides
 *   variant + density styling, an optional heading row with actions slot,
 *   and an automatic empty-state.
 *
 * @attr {enum}   [data-variant=default]   default | bordered | divided
 * @attr {enum}   [data-density=default]   compact | default | comfortable
 * @attr {string} [data-heading]           Optional list heading text
 * @attr {string} [data-empty]             Empty-state message (shown when no
 *                                         sherpa-list-item children present)
 *
 * @slot (default) — sherpa-list-item children
 * @slot actions   — Header actions (buttons / menu)
 *
 * @prop {sherpa-list-item[]} items — Live list of light-DOM list items (getter-only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaList extends SherpaElement {
  static get cssUrl()  { return new URL('./sherpa-list.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-list.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-heading', 'data-empty'];
  }

  /** @type {HTMLSpanElement|null} */
  #headingEl = null;
  /** @type {HTMLDivElement|null} */
  #emptyEl   = null;
  /** @type {MutationObserver|null} */
  #observer  = null;

  onRender() {
    this.#headingEl = this.$('.list-heading');
    this.#emptyEl   = this.$('.list-empty');
    this.#syncHeading();
    this.#syncEmpty();
  }

  onConnect() {
    this.#observer = new MutationObserver(() => this.#syncEmpty());
    this.#observer.observe(this, { childList: true });
  }

  onDisconnect() {
    this.#observer?.disconnect();
    this.#observer = null;
  }

  onAttributeChanged(name) {
    if (name === 'data-heading') this.#syncHeading();
    if (name === 'data-empty')   this.#syncEmpty();
  }

  get items() {
    return Array.from(this.querySelectorAll(':scope > sherpa-list-item'));
  }

  #syncHeading() {
    if (this.#headingEl) this.#headingEl.textContent = this.dataset.heading || '';
  }

  #syncEmpty() {
    const message = this.dataset.empty || '';
    if (this.#emptyEl) this.#emptyEl.textContent = message;
    const hasItems = this.items.length > 0;
    this.toggleAttribute('data-empty-visible', !hasItems && !!message);
  }
}

customElements.define('sherpa-list', SherpaList);
