/**
 * @element sherpa-list
 * @category content
 * @description Vertical container for a homogeneous list of sherpa-list-item children. Provides
 *   variant styling (default, bordered, divided), density control, an optional heading with
 *   actions, and an automatic empty-state when no items are present. Use when displaying a
 *   structured list where consistent row spacing and optional dividers are needed. For
 *   searchable lists inside a panel, enable the panel's built-in data-search flag.
 *
 * @attr {enum}   data-variant=default   default | bordered | divided
 * @attr {enum}   data-density=default   compact | default | comfortable
 * @attr {string} data-heading           Optional list heading text
 * @attr {string} data-empty             Empty-state message (shown when no
 *                                         sherpa-list-item children present)
 *
 * @slot (default) — sherpa-list-item children
 * @slot actions   — Header actions (buttons / menu)
 *
 * @prop {sherpa-list-item[]} items — Live list of light-DOM list items (getter-only)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaList extends SherpaElement {
  static override get cssUrl(): string  { return new URL('./sherpa-list.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-list.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-heading', 'data-empty'];
  }

  public els = this.cacheElements({
    heading: '.list-heading',
    empty: '.list-empty'
  });

  #observer: MutationObserver | null = null;
  #bound = false;

  #onItemClick = (e: Event): void => {
    const clicked = (e.target as HTMLElement | null)?.closest('sherpa-list-item');
    if (!clicked) return;
    this.items.forEach((item: Element) => {
      if (item !== clicked) (item as HTMLElement & { active?: boolean }).active = false;
    });
  };

  override onRender(): void {

    if (!this.#bound) {
      this.#observer = new MutationObserver(() => this.#syncEmpty());
      this.#observer.observe(this, { childList: true });
      this.addEventListener('list-item-click', this.#onItemClick);
      this.#bound = true;
    }

    this.#syncHeading();
    this.#syncEmpty();
  }

  override onAttributeChanged(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    if (name === 'data-empty')   this.#syncEmpty();
  }

  get items(): Element[] {
    return Array.from(this.querySelectorAll(':scope > sherpa-list-item'));
  }

  #syncHeading(): void {
    if (this.els.heading) this.els.heading.textContent = this.dataset["heading"] || '';
  }

  #syncEmpty(): void {
    const message = this.dataset["empty"] || '';
    if (this.els.empty) this.els.empty.textContent = message;
    const hasItems = this.items.length > 0;
    this.toggleAttribute('data-empty-visible', !hasItems && !!message);
  }
}

customElements.define('sherpa-list', SherpaList);
