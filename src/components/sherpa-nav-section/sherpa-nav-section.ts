/**
 * sherpa-nav-section — grouped nav items in a settings-style panel.
 *
 * Give it data with populate([{ label, items: [{ id, label, icon? }] }]) and it
 * draws the labelled groups and their items. data-active-id marks which item is
 * currently active, and CSS highlights it. Clicking an item fires item-select.
 *
 * Public API:
 *   data-heading    optional panel heading text
 *   data-active-id  id of the currently active item
 *
 * @tier sub-component
 * @fires item-select — detail: { id }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface NavSectionItem {
  id: string;
  label: string;
  icon?: string;
}

export interface NavSectionGroup {
  label?: string;
  items: NavSectionItem[];
}

export class SherpaNavSection extends SherpaElement {
  static override css = new URL('./sherpa-nav-section.css', import.meta.url);
  static override html = new URL('./sherpa-nav-section.html', import.meta.url);
  static override tier = 'sub-component' as const;
  static override observed = ['data-heading', 'data-active-id'];

  #groups: NavSectionGroup[] = [];

  override onRender(): void {
    this.#syncHeading();
    // One delegated listener for the whole panel — rows come and go, this stays.
    this.$('.groups')?.addEventListener('click', this.#onClick);
    if (this.#groups.length) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'data-active-id') this.#applyActive();
  }

  /** populate([{ label, items: [{ id, label, icon? }] }]) — the grouped items. */
  protected override renderData(data: unknown): void {
    this.#groups = Array.isArray(data) ? (data as NavSectionGroup[]) : [];
    this.#render();
  }

  /* ── Rendering ────────────────────────────────────────────────── */

  #syncHeading(): void {
    const el = this.$('.heading');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #render(): void {
    const container = this.$('.groups');
    const groupTpl = this.$<HTMLTemplateElement>('template.group-tpl');
    const itemTpl = this.$<HTMLTemplateElement>('template.item-tpl');
    if (!container || !groupTpl || !itemTpl) return;

    container.replaceChildren();
    for (const group of this.#groups) {
      const section = groupTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      const groupLabel = section.querySelector('.group-label')!;
      groupLabel.textContent = group.label ?? '';
      if (!group.label) section.setAttribute('data-no-label', '');

      const list = section.querySelector('.group-list')!;
      for (const item of group.items ?? []) {
        const row = itemTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        row.dataset['id'] = item.id;
        row.querySelector('.item-label')!.textContent = item.label;
        const icon = row.querySelector('.item-icon')!;
        if (item.icon) icon.textContent = item.icon;
        list.appendChild(row);
      }
      container.appendChild(section);
    }
    this.#applyActive();
  }

  /** Reflect data-active-id onto the matching row (CSS styles data-current). */
  #applyActive(): void {
    const active = this.dataset['activeId'];
    for (const row of this.$$('.item-row')) {
      const on = row.dataset['id'] === active;
      row.toggleAttribute('data-current', on);
      const btn = row.querySelector('.item');
      if (btn) {
        if (on) btn.setAttribute('aria-current', 'page');
        else btn.removeAttribute('aria-current');
      }
    }
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #onClick = (event: Event): void => {
    // Composed target retargets at the shadow boundary — walk the composed path.
    const row = event
      .composedPath()
      .find(
        (n): n is HTMLElement => n instanceof HTMLElement && n.classList.contains('item-row'),
      );
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    this.emit('item-select', { id });
  };
}

customElements.define('sherpa-nav-section', SherpaNavSection);
