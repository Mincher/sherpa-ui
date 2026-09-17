/**
 * sherpa-nav — the main navigation rail down the side of the app.
 *
 * The rail is the FIVE-MODE state machine from the Figma Navigation collection
 * (32:937): collapsed · hover · default · pinned · settings. It starts COLLAPSED
 * (a 40px icon rail). Pointer in → hover (opens, lifts). Pointer out → back to
 * collapsed, unless the pin has latched it. Pin → pinned. Settings → settings.
 *
 * This file only ever writes `data-nav-state`; the CSS + the projected Navigation
 * token region own every visual (width, surface, shadow, label visibility, indents).
 *
 * Fill it with populate(config):
 *   {
 *     product?:    { name?, icon? },
 *     quickItems?: NavEntry[],   // omitted → Home · Recent · Favorites
 *     sections?:   [{ label?, items: NavEntry[] }],
 *   }
 * where NavEntry = { id, label, icon?, href?, badge?, indicator?, children?, expanded? }.
 * You can also pass a plain list of items, and it's treated as one group.
 *
 * Nest with `children`. A parent gets the Figma hasChildren chevron and starts
 * closed; its children indent to the next tier, carry NO icon (only top-level rows
 * do), and are hidden entirely in the 40px collapsed rail.
 *
 */
import { SherpaElement } from '../../core/sherpa-element.js';

/** What a stamped row actually shows. `icon` is undefined on a child row —
 *  TRAP T-nav-child-rows-carry-no-icon. */
export interface NavRowInfo {
  id: string;
  label: string | undefined;
  icon: string | undefined;
}

export interface NavEntry {
  id: string;
  label: string;
  /**
   * Leading icon — a Font Awesome class list, on TOP-LEVEL items only.
   * TRAP T-nav-child-rows-carry-no-icon — a child's icon is dropped.
   */
  icon?: string;
  href?: string;
  badge?: string;
  /** Show the trailing indicator dot (Figma "Indicator (atom)"). */
  indicator?: boolean;
  /**
   * Nested items. A parent gets the Figma hasChildren chevron, and its children
   * are stamped one tier deeper. Prefer this over a hand-set `tier` —
   * TRAP T-nav-child-rows-carry-no-icon.
   */
  children?: NavEntry[];
  /**
   * Nesting depth 1–3 → the Figma indent tiers (8 / 32 / 48). Derived from
   * `children` nesting; set it directly only for a flat list you tier yourself.
   */
  tier?: 1 | 2 | 3;
  /** Start a parent expanded. Parents are collapsed by default. */
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
  /**
   * The section list shown while the rail is in SETTINGS mode. The settings button
   * swaps the whole rail over to these — settings pages are a different place, not a
   * nav item in the product tree. Omit it and the settings mode keeps the main list.
   */
  settingsSections?: NavSection[];
}

/** The five Figma Navigation modes. */
export type NavState = 'collapsed' | 'hover' | 'default' | 'pinned' | 'settings';

/**
 * The quick-nav row every product nav opens with (Figma shows three icon rows
 * above the section list). Overridable via config.quickItems.
 */
const DEFAULT_QUICK: NavEntry[] = [
  { id: 'home', label: 'Home', icon: 'fa-solid fa-house' },
  { id: 'recent', label: 'Recent', icon: 'fa-solid fa-clock-rotate-left' },
  { id: 'favorites', label: 'Favorites', icon: 'fa-solid fa-star' },
];

/** Modes in which the rail is open (i.e. NOT the 40px icon rail). */
const OPEN: ReadonlySet<string> = new Set<NavState>(['hover', 'default', 'pinned', 'settings']);
/** Modes that latch the rail open — a pointer leave must not collapse these. */
const LATCHED: ReadonlySet<string> = new Set<NavState>(['pinned', 'settings']);

export class SherpaNav extends SherpaElement {
  static override css = new URL('./sherpa-nav.css', import.meta.url);
  static override html = new URL('./sherpa-nav.html', import.meta.url);
  static override observed = ['data-active-id', 'data-nav-state'];

  #config: NavConfig = {};

  override onRender(): void {
    // The rail starts collapsed unless the author pinned it up front.
    if (!this.dataset['navState']) this.dataset['navState'] = 'collapsed';

    // One delegated listener for every stamped item — rows come and go, this stays.
    this.$('.rail')?.addEventListener('item-click', this.#onItemClick as EventListener);
    this.$('.rail')?.addEventListener('item-expand', this.#onItemExpand as EventListener);
    this.$<HTMLInputElement>('.search-input')?.addEventListener('input', this.#onSearch);
    this.$('.search-clear')?.addEventListener('click', this.#onSearchClear);
    this.$('.pin')?.addEventListener('click', this.#onPin);
    this.$('.settings')?.addEventListener('click', this.#onSettings);

    // Hover opens the rail; leaving returns it to collapsed unless it is latched.
    this.addEventListener('pointerenter', this.#onEnter);
    this.addEventListener('pointerleave', this.#onLeave);
    // Keyboard users get the same reveal when focus lands inside the collapsed rail.
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
      // Only the SETTINGS EDGE re-stamps — TRAP
      // T-nav-state-writes-only-the-attribute.
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

  /** The current rail mode (one of the five Figma Navigation modes). */
  get state(): NavState {
    return (this.dataset['navState'] as NavState) ?? 'collapsed';
  }
  set state(value: NavState) {
    // Through the state machine — TRAP T-nav-state-writes-only-the-attribute.
    this.#setState(value);
  }

  /** True while the rail is latched open by the pin. */
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

  /* ── State machine ──────────────────────────────────────────────────
     Every transition funnels through #setState — TRAP
     T-nav-state-writes-only-the-attribute. */

  #setState(next: NavState): void {
    const previous = this.state;
    if (previous === next) return;
    // Writing the attribute is the ONLY step; onChange owns the re-render.
    this.dataset['navState'] = next;
    this.emit('nav-state-change', { state: next });
  }

  /** Mirror the projected per-mode button switches onto the two header buttons. */
  #applyState(): void {
    const state = this.state;
    // Figma nav-container-pin-button / -setting-button: which look each button takes.
    const pinActive = state === 'pinned' || state === 'settings' || state === 'default';
    const settingsActive = state === 'settings';
    this.$('.pin')?.setAttribute('aria-pressed', String(pinActive));
    this.$('.settings')?.setAttribute('aria-pressed', String(settingsActive));
    // The header label is a Figma STRING token; only settings changes it.
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

  /** Focus leaving the rail entirely behaves like a pointer leave. */
  #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    this.#onLeave();
  };

  #onPin = (): void => {
    // Un-pinning from SETTINGS hands the rail back to hover: the pointer is
    // still over it, so collapsing under the cursor would feel broken.
    if (this.state === 'settings') {
      this.#setState('hover');
      return;
    }
    this.#setState(this.state === 'pinned' ? 'collapsed' : 'pinned');
  };

  #onSettings = (): void => {
    // Settings is its own latched mode; clicking it again returns to the pinned rail.
    this.#setState(this.state === 'settings' ? 'pinned' : 'settings');
  };

  /* ── Content ────────────────────────────────────────────────────── */

  /** Coerce a legacy array or a partial object into a full NavConfig. */
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
    // A slotted icon wins — TRAP T-brand-icon-must-empty-its-host.
    if (iconSlot && this.#config.product?.icon && !iconSlot.querySelector('[slot]')) {
      this.#applyIcon(iconSlot, this.#config.product.icon);
    }
    // Search belongs to a full product nav (a product name implies one).
    if (this.#config.product) this.toggleAttribute('data-searchable', true);
  }

  #renderQuick(): void {
    const list = this.$('.quick');
    if (!list) return;
    list.replaceChildren();
    // SETTINGS mode has NO quick items — TRAP
    // T-nav-state-writes-only-the-attribute.
    if (this.state === 'settings') return;
    const quick = this.#config.quickItems ?? DEFAULT_QUICK;
    for (const entry of quick) for (const row of this.#buildRows(entry, 1)) list.appendChild(row);
  }

  #renderSections(): void {
    const content = this.$('.content');
    const sectionTpl = this.$<HTMLTemplateElement>('template.section-tpl');
    if (!content || !sectionTpl) return;

    // Clear previously-stamped sections (keep the <slot> for hand-authored content).
    for (const s of this.$$('.section')) s.remove();

    // SETTINGS mode shows its own list of settings pages, not the product tree.
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
    // TRAP T-parent-chain-walk-not-a-selector
    this.#syncRowVisibility();
  }

  /**
   * Stamp an entry and all of its descendants into a FLAT list of rows.
   *
   * TRAP T-parent-chain-walk-not-a-selector — flat because the Figma rail is,
   * and `data-parent` / `data-depth` are what make depth recoverable.
   */
  #buildRows(entry: NavEntry, depth: 1 | 2 | 3, parentId?: string): HTMLElement[] {
    const row = this.clone('template.item-tpl');
    if (!row) throw new Error('sherpa-nav: template.item-tpl is missing or empty');
    row.dataset['id'] = entry.id;
    row.dataset['depth'] = String(depth);
    if (parentId) row.dataset['parent'] = parentId;

    const item = row.querySelector('sherpa-nav-item') as HTMLElement;
    item.dataset['label'] = entry.label;
    // depth === 1 only — TRAP T-nav-child-rows-carry-no-icon.
    if (entry.icon && depth === 1) item.dataset['icon'] = entry.icon;
    if (entry.href) item.dataset['href'] = entry.href;
    if (entry.badge) item.dataset['badge'] = entry.badge;
    if (entry.indicator) item.dataset['statusDot'] = '';
    // Depth → the Figma indent tier the item's CSS reads (tier 1 needs no attr).
    const tier = entry.tier ?? depth;
    if (tier > 1) item.dataset['tier'] = String(tier);

    const kids = entry.children ?? [];
    const rows = [row];
    if (!kids.length) return rows;

    // A parent gets the Figma hasChildren chevron, and starts CLOSED unless asked.
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
   * TRAP T-brand-icon-must-empty-its-host — NOT `writeIcon`: the wrapper holds
   * a `<slot>` with a fallback `<i>`, so it must be emptied first.
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

  /** Reflect data-active-id onto the matching row's item. */
  #applyActive(): void {
    const active = this.dataset['activeId'];
    for (const row of this.$$('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item');
      item?.toggleAttribute('data-current', row.dataset['id'] === active);
    }
  }

  /* ── Interaction ────────────────────────────────────────────────── */

  /**
   * What a row shows: its label, and its icon if it has one.
   *
   * Read back off the stamped ROW, not off the config, so it is true for a rail
   * filled any way — populate(), or hand-authored rows in the light DOM.
   * TRAP T-nav-child-rows-carry-no-icon — `icon` is undefined on a child row.
   */
  entry(id: string): NavRowInfo | null {
    const row = this.$$<HTMLElement>('.nav-row').find((r) => r.dataset['id'] === id);
    const item = row?.querySelector<HTMLElement>('sherpa-nav-item');
    if (!item) return null;
    return { id, label: item.dataset['label'], icon: item.dataset['icon'] };
  }

  /** The row that is current, per data-active-id. */
  get activeEntry(): NavRowInfo | null {
    const id = this.dataset['activeId'];
    return id ? this.entry(id) : null;
  }

  #onItemClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    // The label and the icon ride along — TRAP T-nav-child-rows-carry-no-icon.
    this.emit('nav-select', { id, ...this.entry(id) });
  };

  /** A parent row's chevron was toggled — record it, then re-derive visibility. */
  #onItemExpand = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    if (!row?.dataset['id']) return;
    row.dataset['expanded'] = String(!!(event as CustomEvent).detail?.expanded);
    this.#syncRowVisibility();
  };

  /**
   * Decide which child rows are showing, and write `data-hidden` for CSS to act on.
   *
   * TRAP T-parent-chain-walk-not-a-selector — a walk up `data-parent`, because
   * `:has()` on flat siblings would hide unrelated branches.
   */
  #syncRowVisibility(): void {
    const rows = this.$$<HTMLElement>('.nav-row');
    // id → is that row expanded (absent = not a parent, so irrelevant)
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
    // CSS shows the clear button off this flag.
    this.toggleAttribute('data-has-query', query.length > 0);
    this.#filter(query);
    this.emit('nav-search', { query });
  };

  /** Clear the search box, restore every row, and hand focus back to the field. */
  #onSearchClear = (): void => {
    const input = this.$<HTMLInputElement>('.search-input');
    if (input) input.value = '';
    this.removeAttribute('data-has-query');
    this.#filter('');
    this.emit('nav-search', { query: '' });
    input?.focus();
  };

  /* ── Search filtering + native highlighting ──────────────────────────
     TRAP T-nav-search-uses-a-real-highlight — the CSS Custom Highlight API, and
     why each row has to highlight its own label. */

  #filter(rawQuery: string): void {
    const query = rawQuery.trim().toLowerCase();

    for (const row of this.$$<HTMLElement>('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item') as (HTMLElement & {
        highlight?: (q: string | null) => void;
      }) | null;
      const label = item?.dataset['label'] ?? '';
      const match = !query || label.toLowerCase().includes(query);
      // CSS owns the hiding; JS only marks the row. Each row highlights its own
      // label — TRAP T-nav-search-uses-a-real-highlight.
      row.toggleAttribute('data-filtered-out', !match);
      item?.highlight?.(match ? query : null);
    }

    // A section with no surviving rows hides its label + rule too.
    for (const section of this.$$<HTMLElement>('.section')) {
      const rows = Array.from(section.querySelectorAll('.nav-row'));
      const anyVisible = rows.some((r) => !(r as HTMLElement).hasAttribute('data-filtered-out'));
      section.toggleAttribute('data-filtered-out', rows.length > 0 && !anyVisible);
    }

    this.toggleAttribute('data-searching', !!query);
  }

}

customElements.define('sherpa-nav', SherpaNav);
