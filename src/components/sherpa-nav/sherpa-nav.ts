/**
 * sherpa-nav — the primary application navigation rail.
 *
 * Rebuilt to match the Figma "Primary Navigation": a fixed header (brand row +
 * search + quick items) over a scrolling area of grouped sections, plus a footer.
 * Rows are stamped as <sherpa-nav-item> children (composition — the same
 * component the Figma nests), so item look/behaviour lives in one place.
 *
 * populate(config) accepts the rich shape:
 *   {
 *     product?:    { name?, icon? },
 *     quickItems?: NavEntry[],
 *     sections?:   [{ label?, items: NavEntry[] }],
 *   }
 * where NavEntry = { id, label, icon?, href?, badge? }.
 * A plain NavEntry[] is still accepted (legacy) and treated as one unlabelled
 * section — the old populate([{ id, label, icon?, href? }]) callers keep working.
 *
 * Active state is data-active-id on the host (reflected onto the matching item).
 * Clicking an item fires nav-select; typing in search fires nav-search.
 *
 * @fires nav-select — detail: { id }
 * @fires nav-search — detail: { query }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface NavEntry {
  id: string;
  label: string;
  icon?: string;
  href?: string;
  badge?: string;
}

/** @deprecated Renamed to NavEntry (kept as an alias for existing imports). */
export type NavItem = NavEntry;

export interface NavSection {
  label?: string;
  items: NavEntry[];
}

export interface NavConfig {
  product?: { name?: string; icon?: string };
  quickItems?: NavEntry[];
  sections?: NavSection[];
}

export class SherpaNav extends SherpaElement {
  static override css = new URL('./sherpa-nav.css', import.meta.url);
  static override html = new URL('./sherpa-nav.html', import.meta.url);
  static override observed = ['data-active-id'];

  #config: NavConfig = {};

  override onRender(): void {
    // One delegated listener for every stamped item — rows come and go, this stays.
    this.$('.rail')?.addEventListener('nav-item-click', this.#onItemClick as EventListener);
    const search = this.$<HTMLInputElement>('.search-input');
    search?.addEventListener('input', this.#onSearch);
    if (this.#hasContent()) this.#render();
  }

  override onChange(name: string): void {
    if (name === 'data-active-id') this.#applyActive();
  }

  /** populate(config) — the nav content. Accepts NavConfig or a legacy NavEntry[]. */
  protected override renderData(data: unknown): void {
    this.#config = this.#normalise(data);
    this.#render();
  }

  /** Coerce a legacy array or a partial object into a full NavConfig. */
  #normalise(data: unknown): NavConfig {
    if (Array.isArray(data)) return { sections: [{ items: data as NavEntry[] }] };
    if (data && typeof data === 'object') return data as NavConfig;
    return {};
  }

  #hasContent(): boolean {
    return !!(this.#config.product || this.#config.quickItems?.length || this.#config.sections?.length);
  }

  /* ── Render ─────────────────────────────────────────────────────── */

  #render(): void {
    this.#renderBrand();
    this.#renderQuick();
    this.#renderSections();
    this.#applyActive();
  }

  #renderBrand(): void {
    const product = this.$('.product');
    if (product) product.textContent = this.#config.product?.name ?? '';
    const iconSlot = this.$('.brand-icon');
    // A product icon may be a glyph string; a slotted icon element takes precedence.
    if (iconSlot && this.#config.product?.icon && !iconSlot.querySelector('[slot]')) {
      iconSlot.textContent = this.#config.product.icon;
    }
    // Search is shown when the nav is a full product nav (has a product or explicit flag).
    if (this.#config.product) this.toggleAttribute('data-searchable', true);
  }

  #renderQuick(): void {
    const list = this.$('.quick');
    if (!list) return;
    list.replaceChildren();
    for (const entry of this.#config.quickItems ?? []) list.appendChild(this.#buildItem(entry));
  }

  #renderSections(): void {
    const content = this.$('.content');
    const sectionTpl = this.$<HTMLTemplateElement>('template.section-tpl');
    if (!content || !sectionTpl) return;

    // Clear previously-stamped sections (keep the <slot> for hand-authored content).
    for (const s of this.$$('.section')) s.remove();

    for (const section of this.#config.sections ?? []) {
      const el = sectionTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      el.querySelector('.section-label')!.textContent = section.label ?? '';
      const items = el.querySelector('.section-items')!;
      for (const entry of section.items ?? []) items.appendChild(this.#buildItem(entry));
      content.appendChild(el);
    }
  }

  /** Stamp one <li><sherpa-nav-item> row from an entry. */
  #buildItem(entry: NavEntry): HTMLElement {
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl')!;
    const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset['id'] = entry.id;
    const item = row.querySelector('sherpa-nav-item') as HTMLElement;
    item.dataset['label'] = entry.label;
    if (entry.icon) item.dataset['icon'] = entry.icon;
    if (entry.href) item.dataset['href'] = entry.href;
    if (entry.badge) item.dataset['badge'] = entry.badge;
    return row;
  }

  /** Reflect data-active-id onto the matching row's item. */
  #applyActive(): void {
    const active = this.dataset['activeId'];
    for (const row of this.$$('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item');
      item?.toggleAttribute('data-active', row.dataset['id'] === active);
    }
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  #onItemClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    this.emit('nav-select', { id });
  };

  #onSearch = (event: Event): void => {
    const query = (event.target as HTMLInputElement).value;
    this.emit('nav-search', { query });
  };
}

customElements.define('sherpa-nav', SherpaNav);
