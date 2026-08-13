/**
 * sherpa-nav — a vertical navigation rail.
 *
 * Renders a flat item list from populate([{ id, label, icon?, href? }]) by cloning
 * an <template class="item-tpl"> prototype (the only structural DOM this component
 * creates — data-driven rows, which the golden rules allow). Active state is
 * data-active-id on the host (pure CSS); a click delegates to nav-select.
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface NavItem {
  id: string;
  label: string;
  icon?: string;
  href?: string;
}

export class SherpaNav extends SherpaElement {
  static override css = new URL('./sherpa-nav.css', import.meta.url);
  static override html = new URL('./sherpa-nav.html', import.meta.url);
  static override observed = ['data-active-id'];

  #items: NavItem[] = [];

  override onRender(): void {
    // One delegated listener for the whole list — rows come and go, this stays.
    this.$('.items')?.addEventListener('click', this.#onClick);
    if (this.#items.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-active-id') this.#applyActive();
  }

  /** populate([{ id, label, icon?, href? }]) — the item list. */
  protected override renderData(data: unknown): void {
    this.#items = Array.isArray(data) ? (data as NavItem[]) : [];
    this.#render();
  }

  #render(): void {
    const list = this.$('.items');
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl');
    if (!list || !tpl) return;

    list.replaceChildren();
    for (const item of this.#items) {
      const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      row.dataset['id'] = item.id;
      const link = row.querySelector<HTMLAnchorElement>('.link')!;
      if (item.href) link.href = item.href;
      row.querySelector('.label')!.textContent = item.label;
      const icon = row.querySelector('.icon')!;
      if (item.icon) icon.textContent = item.icon;
      list.appendChild(row);
    }
    this.#applyActive();
  }

  /** Reflect data-active-id onto the matching row (CSS styles data-active). */
  #applyActive(): void {
    const active = this.dataset['activeId'];
    for (const row of this.$$('.item')) {
      row.toggleAttribute('data-active', row.dataset['id'] === active);
    }
  }

  #onClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.item');
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    this.emit('nav-select', { id });
  };
}

customElements.define('sherpa-nav', SherpaNav);
