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
 * @element sherpa-nav
 * @attr {enum}    data-nav-state  collapsed (default) | hover | default | pinned | settings
 * @attr {string}  data-active-id  id of the current item
 * @attr {boolean} data-searchable show the search field (auto-set with a product)
 *
 * @fires nav-select       — detail: { id }
 * @fires nav-search       — detail: { query }
 * @fires nav-state-change — detail: { state }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export interface NavEntry {
  id: string;
  label: string;
  /**
   * Leading icon — a Font Awesome class list. EVERY top-level item has one; CHILD
   * items do not (the design distinguishes a child by its indent, not by a second
   * icon column). The rail drops an icon set on a child rather than rendering it.
   */
  icon?: string;
  href?: string;
  badge?: string;
  /** Show the trailing indicator dot (Figma "Indicator (atom)"). */
  indicator?: boolean;
  /**
   * Nested items. A parent gets the Figma hasChildren chevron, and its children are
   * stamped one tier deeper. Prefer this over setting `tier` by hand: the rail can
   * then collapse the children with the parent and hide them in the 40px rail,
   * which a flat list of hand-tiered rows cannot express.
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

  override onChange(name: string): void {
    if (name === 'data-active-id') this.#applyActive();
    if (name === 'data-nav-state') this.#applyState();
  }

  /* ── Public API ──────────────────────────────────────────────────── */

  /** The current rail mode (one of the five Figma Navigation modes). */
  get state(): NavState {
    return (this.dataset['navState'] as NavState) ?? 'collapsed';
  }
  set state(value: NavState) {
    this.dataset['navState'] = value;
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
     Every transition funnels through #setState so the event fires once and the
     header buttons stay in step with the attribute. */

  #setState(next: NavState): void {
    const previous = this.state;
    if (previous === next) return;
    this.dataset['navState'] = next;
    // Entering or leaving SETTINGS swaps which section list the rail shows, AND
    // whether the quick items are there at all — settings has none.
    if ((previous === 'settings') !== (next === 'settings')) {
      this.#renderQuick();
      this.#renderSections();
      this.#applyActive();
    }
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
    // Un-pinning from SETTINGS hands the rail back to hover — the pointer is still
    // over it, so collapsing under the cursor would feel broken. Un-pinning from
    // the pinned rail drops it back to the icon rail.
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
    // A product icon may be an FA class list or a glyph; a slotted icon wins.
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
    // SETTINGS mode has no quick items. Home / Recent / Favorites are shortcuts
    // into the PRODUCT tree, and settings is a different place — offering them
    // there would jump the user out of the section they are configuring.
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
    this.#syncRowVisibility();
  }

  /**
   * Stamp an entry and all of its descendants into a FLAT list of rows.
   *
   * Flat, not nested, because the Figma rail is one flat column of 24-tall rows and
   * indentation alone conveys depth — there is no nested container to draw. Each row
   * records `data-parent` and `data-depth` so the rail can hide a child when its
   * parent is collapsed, and hide every child in the 40px rail.
   */
  #buildRows(entry: NavEntry, depth: 1 | 2 | 3, parentId?: string): HTMLElement[] {
    const tpl = this.$<HTMLTemplateElement>('template.item-tpl')!;
    const row = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
    row.dataset['id'] = entry.id;
    row.dataset['depth'] = String(depth);
    if (parentId) row.dataset['parent'] = parentId;

    const item = row.querySelector('sherpa-nav-item') as HTMLElement;
    item.dataset['label'] = entry.label;
    // EVERY top-level item carries an icon; a CHILD never does — the design tells a
    // child apart by its indent, so a second icon column would only add noise. An
    // icon set on a child entry is deliberately dropped rather than honoured.
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

  /** Set an icon as FA classes when it looks like one, else as a text glyph. */
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

  #onItemClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    const id = row?.dataset['id'];
    if (!id) return;
    this.setAttribute('data-active-id', id);
    this.emit('nav-select', { id });
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
   * A row shows when EVERY ancestor above it is expanded. That is a walk up the
   * data-parent chain, not something a selector can express: the children are flat
   * siblings of their parent, so `:has()` could only tell that SOME sibling is shut
   * and would hide unrelated branches. Deriving it here also means a closed
   * grandparent correctly hides a grandchild whose own parent is open, with no
   * cascade of extra state to keep in step.
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
     Typing narrows the rail to matching rows and highlights the matched text with
     the CSS Custom Highlight API — a real Highlight of Ranges, styled by
     ::highlight(sherpa-nav-match). No marker elements are injected, so the rows'
     own DOM and their FA icons are untouched. */

  #filter(rawQuery: string): void {
    const query = rawQuery.trim().toLowerCase();

    for (const row of this.$$<HTMLElement>('.nav-row')) {
      const item = row.querySelector('sherpa-nav-item') as (HTMLElement & {
        highlight?: (q: string | null) => void;
      }) | null;
      const label = item?.dataset['label'] ?? '';
      const match = !query || label.toLowerCase().includes(query);
      // CSS owns the hiding; JS only marks the row.
      row.toggleAttribute('data-filtered-out', !match);
      // Each row highlights its OWN label: a custom highlight is not painted for
      // shadow text unless it is registered and styled inside that same tree.
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
