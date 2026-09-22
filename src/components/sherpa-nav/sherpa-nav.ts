/**
 * sherpa-nav — the side navigation rail: a five-mode machine (Figma Navigation 32:937).
 * Fill it with populate(config) — a NavConfig, or a NavEntry[] treated as one section.
 *
 * TRAP T-nav-state-writes-only-the-attribute
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

/** What a stamped row shows. `icon` is undefined on a child row. */
export interface NavRowInfo {
  id: string;
  label: string | undefined;
  icon: string | undefined;
}

export interface NavEntry {
  id: string;
  label: string;
  /** FA class list. TOP-LEVEL rows only — a child's icon is dropped. */
  icon?: string;
  href?: string;
  badge?: string;
  indicator?: boolean;
  /** Nested items. Prefer this over a hand-set `tier`. */
  children?: NavEntry[];
  /** Indent tier 1–3. Derived from `children`; set it only for a flat list. */
  tier?: 1 | 2 | 3;
  /** Parents are collapsed by default. */
  expanded?: boolean;
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
  /** Shown instead of `sections` in SETTINGS mode. Omit it to keep the main list. */
  settingsSections?: NavSection[];
}

/** The five Figma Navigation modes. */
export type NavState = 'collapsed' | 'hover' | 'default' | 'pinned' | 'settings';

/** The quick rows a nav opens with, unless config.quickItems overrides them. */
const DEFAULT_QUICK: NavEntry[] = [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'recent', label: 'Recent', icon: 'fa-solid fa-clock-rotate-left' },
  { id: 'favorites', label: 'Favorites', icon: 'fa-solid fa-star' },
];

/** Modes in which the rail is open, i.e. not the 40px icon rail. */
const OPEN: ReadonlySet<string> = new Set<NavState>(['hover', 'default', 'pinned', 'settings']);
/** Modes that latch the rail open — a pointer leave must not collapse these. */
const LATCHED: ReadonlySet<string> = new Set<NavState>(['pinned', 'settings']);

export class SherpaNav extends SherpaElement {
  static override css = new URL('./sherpa-nav.css', import.meta.url);
  static override html = new URL('./sherpa-nav.html', import.meta.url);
  static override observed = ['data-active-id', 'data-nav-state'];

  #config: NavConfig = {};

  override onRender(): void {
    if (!this.dataset['navState']) this.dataset['navState'] = 'collapsed';

    // Delegated — rows come and go, these listeners stay.
    this.$('.rail')?.addEventListener('item-click', this.#onItemClick as EventListener);
    this.$('.rail')?.addEventListener('item-expand', this.#onItemExpand as EventListener);
    this.$<HTMLInputElement>('.search-input')?.addEventListener('input', this.#onSearch);
    this.$('.search-clear')?.addEventListener('click', this.#onSearchClear);
    this.$('.pin')?.addEventListener('click', this.#onPin);
    this.$('.settings')?.addEventListener('click', this.#onSettings);

    this.addEventListener('pointerenter', this.#onEnter);
    this.addEventListener('pointerleave', this.#onLeave);
    // Focus gives a keyboard user the same reveal as a pointer.
    this.addEventListener('focusin', this.#onEnter);
    this.addEventListener('focusout', this.#onFocusOut);

    this.#applyState();
    if (this.#hasContent()) this.#render();
  }

  override onDisconnect(): void {
    this.removeEventListener('pointerenter', this.#onEnter);
    this.removeEventListener('pointerleave', this.#onLeave);
    this.removeEventListener('focusin', this.#onEnter);
    this.removeEventListener('focusout', this.#onFocusOut);
  }

  override onChange(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'data-active-id') this.#applyActive();
    if (name === 'data-nav-state') {
      this.#applyState();
      // Only the settings edge re-stamps; every other mode is CSS.
      const was = oldValue === 'settings';
      const now = newValue === 'settings';
      if (was !== now && this.#hasContent()) {
        this.#renderQuick();
        this.#renderSections();
        this.#applyActive();
      }
    }
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  get state(): NavState {
    return (this.dataset['navState'] as NavState) ?? 'collapsed';
  }
  set state(value: NavState) {
    this.#setState(value);
  }

  get pinned(): boolean {
    return this.state === 'pinned';
  }
  set pinned(value: boolean) {
    this.#setState(value ? 'pinned' : 'collapsed');
  }

  /** populate(config) — the nav content. Accepts NavConfig or a legacy NavEntry[]. */
  protected override renderData(data: unknown): void {
    this.#config = this.#normalise(data);
    this.#render();
  }

  /* ── State machine ─────────────────────────────────────────────── */

  /** Every transition funnels through here. */
  #setState(next: NavState): void {
    const previous = this.state;
    if (previous === next) return;
    // Writing the attribute is the ONLY step; onChange owns the re-render.
    this.dataset['navState'] = next;
    this.emit('nav-state-change', { state: next });
  }

  /** Mirror the mode onto the two header buttons and the rail's aria-expanded. */
  #applyState(): void {
    const state = this.state;
    const pinActive = state === 'pinned' || state === 'settings' || state === 'default';
    const settingsActive = state === 'settings';
    this.$('.pin')?.setAttribute('aria-pressed', String(pinActive));
    this.$('.settings')?.setAttribute('aria-pressed', String(settingsActive));
    const product = this.$('.product');
    if (product) {
      product.textContent =
        state === 'settings' ? 'Settings' : (this.#config.product?.name ?? '');
    }
    this.$('.rail')?.setAttribute('aria-expanded', String(OPEN.has(state)));
  }

  #onEnter = (): void => {
    if (!LATCHED.has(this.state)) this.#setState('hover');
  };

  #onLeave = (): void => {
    if (!LATCHED.has(this.state)) this.#setState('collapsed');
  };

  #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    this.#onLeave();
  };

  #onPin = (): void => {
    // Leaving settings goes to hover, not collapsed — the pointer is still on the rail.
    if (this.state === 'settings') {
      this.#setState('hover');
      return;
    }
    this.#setState(this.state === 'pinned' ? 'collapsed' : 'pinned');
  };

  #onSettings = (): void => {
    this.#setState(this.state === 'settings' ? 'pinned' : 'settings');
  };

  /* ── Content ────────────────────────────────────────────────────── */

  #normalise(data: unknown): NavConfig {
    if (Array.isArray(data)) return { sections: [{ items: data as NavEntry[] }] };
    if (data && typeof data === 'object') return data as NavConfig;
    return {};
  }

  #hasContent(): boolean {
    return !!(this.#config.product || this.#config.quickItems?.length || this.#config.sections?.length);
  }

  #render(): void {
    this.#renderBrand();
    this.#renderQuick();
    this.#renderSections();
    this.#applyActive();
    this.#applyState();
  }

  #renderBrand(): void {
    const iconSlot = this.$('.brand-icon');
    // A slotted icon wins over the configured one.
    if (iconSlot && this.#config.product?.icon && !iconSlot.querySelector('[slot]')) {
      this.#applyIcon(iconSlot, this.#config.product.icon);
    }
    // A product name implies a full nav, which has search.
    if (this.#config.product) this.toggleAttribute('data-searchable', true);
  }

  #renderQuick(): void {
    const list = this.$('.quick');
    if (!list) return;
    list.replaceChildren();
    if (this.state === 'settings') return;
    const quick = this.#config.quickItems ?? DEFAULT_QUICK;
    for (const entry of quick) for (const row of this.#buildRows(entry, 1)) list.appendChild(row);
  }

  #renderSections(): void {
    const content = this.$('.content');
    const sectionTpl = this.$<HTMLTemplateElement>('template.section-tpl');
    if (!content || !sectionTpl) return;

    // Clear stamped sections only — the <slot> keeps hand-authored content.
    for (const s of this.$$('.section')) s.remove();

    const sections =
      this.state === 'settings' && this.#config.settingsSections?.length
        ? this.#config.settingsSections
        : this.#config.sections;

    for (const section of sections ?? []) {
      const el = sectionTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      el.querySelector('.section-label')!.textContent = section.label ?? '';
      const items = el.querySelector('.section-items')!;
      for (const entry of section.items ?? []) {
        for (const row of this.#buildRows(entry, 1)) items.appendChild(row);
      }
      content.appendChild(el);
    }
    // Parents start closed, so their children must start hidden.
    this.#syncRowVisibility();
  }

  /**
   * Stamp an entry and its descendants into a FLAT list of rows.
   * `data-parent` / `data-depth` are what make depth recoverable afterwards.
   */
  #buildRows(entry: NavEntry, depth: 1 | 2 | 3, parentId?: string): HTMLElement[] {
    const row = this.clone('template.item-tpl');
    if (!row) throw new Error('sherpa-nav: template.item-tpl is missing or empty');
    row.dataset['id'] = entry.id;
    row.dataset['depth'] = String(depth);
    if (parentId) row.dataset['parent'] = parentId;

    const item = row.querySelector('sherpa-nav-item') as HTMLElement;
    item.dataset['label'] = entry.label;
    // Top level only — TRAP T-nav-child-rows-carry-no-icon.
    if (entry.icon && depth === 1) item.dataset['icon'] = entry.icon;
    if (entry.href) item.dataset['href'] = entry.href;
    if (entry.badge) item.dataset['badge'] = entry.badge;
    if (entry.indicator) item.dataset['statusDot'] = '';
    const tier = entry.tier ?? depth;
    if (tier > 1) item.dataset['tier'] = String(tier);

    const kids = entry.children ?? [];
    const rows = [row];
    if (!kids.length) return rows;

    item.dataset['expandable'] = '';
    if (entry.expanded) item.dataset['expanded'] = '';
    row.dataset['expanded'] = entry.expanded ? 'true' : 'false';

    const childDepth = Math.min(depth + 1, 3) as 1 | 2 | 3;
    for (const kid of kids) rows.push(...this.#buildRows(kid, childDepth, entry.id));
    return rows;
  }

  /**
   * Set an icon as FA classes when it looks like one, else as a text glyph.
   *
   * NOT `writeIcon` — the host's `<slot>` fallback must be emptied first.
   * TRAP T-brand-icon-must-empty-its-host.
   */
  #applyIcon(host: Element, value: string): void {
    if (/\bfa-/.test(value)) {
      host.replaceChildren();
      const i = document.createElement('i');
      i.className = value;
      i.setAttribute('aria-hidden', 'true');
      host.appendChild(i);
    } else {
      host.textContent = value;
    }
  }

  #applyActive(): void {
    const active = this.dataset['activeId'];
    for (const row of this.$$('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item');
      item?.toggleAttribute('data-current', row.dataset['id'] === active);
    }
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  /** What a row shows. Read off the stamped ROW, so hand-authored rows work too. */
  entry(id: string): NavRowInfo | null {
    const row = this.$$<HTMLElement>('.nav-row').find((r) => r.dataset['id'] === id);
    const item = row?.querySelector<HTMLElement>('sherpa-nav-item');
    if (!item) return null;
    return { id, label: item.dataset['label'], icon: item.dataset['icon'] };
  }

  get activeEntry(): NavRowInfo | null {
    const id = this.dataset['activeId'];
    return id ? this.entry(id) : null;
  }

  #onItemClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    this.emit('nav-select', { id, ...this.entry(id) });
  };

  #onItemExpand = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    if (!row?.dataset['id']) return;
    row.dataset['expanded'] = String(!!(event as CustomEvent).detail?.expanded);
    this.#syncRowVisibility();
  };

  /**
   * Write `data-hidden` on rows under a closed parent, for CSS to act on.
   *
   * Walks up `data-parent`; `:has()` on flat siblings would hide unrelated
   * branches. TRAP T-parent-chain-walk-not-a-selector.
   */
  #syncRowVisibility(): void {
    const rows = this.$$<HTMLElement>('.nav-row');
    // Absent from `open` = not a parent.
    const open = new Map<string, boolean>();
    const parent = new Map<string, string>();
    for (const row of rows) {
      const id = row.dataset['id'];
      if (!id) continue;
      if (row.dataset['expanded'] !== undefined) open.set(id, row.dataset['expanded'] === 'true');
      const p = row.dataset['parent'];
      if (p) parent.set(id, p);
    }

    for (const row of rows) {
      const id = row.dataset['id'];
      if (!id) continue;
      let hidden = false;
      for (let p = parent.get(id); p !== undefined; p = parent.get(p)) {
        if (open.get(p) === false) { hidden = true; break; }
      }
      if (hidden) row.dataset['hidden'] = '';
      else delete row.dataset['hidden'];
    }
  }

  #onSearch = (event: Event): void => {
    const query = (event.target as HTMLInputElement).value;
    this.toggleAttribute('data-has-query', query.length > 0);
    this.#filter(query);
    this.emit('nav-search', { query });
  };

  #onSearchClear = (): void => {
    const input = this.$<HTMLInputElement>('.search-input');
    if (input) input.value = '';
    this.removeAttribute('data-has-query');
    this.#filter('');
    this.emit('nav-search', { query: '' });
    input?.focus();
  };

  /* ── Search ─────────────────────────────────────────────────────── */

  #filter(rawQuery: string): void {
    const query = rawQuery.trim().toLowerCase();

    for (const row of this.$$<HTMLElement>('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item') as (HTMLElement & {
        highlight?: (q: string | null) => void;
      }) | null;
      const label = item?.dataset['label'] ?? '';
      const match = !query || label.toLowerCase().includes(query);
      // Each row highlights its OWN label — a custom highlight only paints inside
      // the tree it is registered in. TRAP T-nav-search-uses-a-real-highlight.
      row.toggleAttribute('data-filtered-out', !match);
      item?.highlight?.(match ? query : null);
    }

    // A section with no surviving rows hides its label and rule too.
    for (const section of this.$$<HTMLElement>('.section')) {
      const rows = Array.from(section.querySelectorAll('.nav-row'));
      const anyVisible = rows.some((r) => !(r as HTMLElement).hasAttribute('data-filtered-out'));
      section.toggleAttribute('data-filtered-out', rows.length > 0 && !anyVisible);
    }

    this.toggleAttribute('data-searching', !!query);
  }

}

customElements.define('sherpa-nav', SherpaNav);
