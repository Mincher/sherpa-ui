/**
 * sherpa-nav — the side navigation rail: a five-mode machine (Figma Navigation 32:937).
 * Fill it with populate(config), a NavConfig.
 *
 * TRAP T-nav-state-writes-only-the-attribute
 * TRAP T-a-rail-may-stay-shut
 *
 * Map:
 * - NavRowInfo — What a stamped row shows.
 * - NavEntry — An AREA when it has `children` (it toggles, never navigates); a CONTEXT when it has an `href`.
 * - NavSection — A SECTION: a label and divider over its entries.
 * - QuickEntry — A quick row: a NavEntry whose label may be left out — it is then the nav's own default row of that id.
 * - NavConfig — the whole nav as data: product, quick items, sections, and the Settings sections
 * - NavState — The five Figma Navigation modes.
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { hasIcon, renderIcon } from '../../core/ui/render-icon.js';
import { hiddenRows } from '../../core/ui/tree-rows.js';
import '../sherpa-nav-item/sherpa-nav-item.js';
import type { SherpaNavItem } from '../sherpa-nav-item/sherpa-nav-item.js';
import { report } from '../../core/data/report.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-menu/sherpa-menu.js';
import type { MenuItem, SherpaMenu } from '../sherpa-menu/sherpa-menu.js';

/** What a stamped row shows. `icon` is undefined on a child row. */
export interface NavRowInfo {
  id: string;
  label: string | undefined;
  icon: string | undefined;
}

/** An AREA when it has `children` (it toggles, never navigates); a CONTEXT when it has an `href`. */
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

/** A SECTION: a label and divider over its entries. Visual only. */
export interface NavSection {
  label?: string;
  items: NavEntry[];
}

/** A quick row: a NavEntry whose label may be left out — it is then the nav's own default row of that id. */
export type QuickEntry = Omit<NavEntry, 'label'> & { label?: string };

export interface NavConfig {
  product?: { name?: string; icon?: string };
  quickItems?: QuickEntry[];
  sections?: NavSection[];
  /** Shown instead of `sections` in SETTINGS mode. Omit it to keep the main list. */
  settingsSections?: NavSection[];
}

/** The five Figma Navigation modes. */
export type NavState = 'collapsed' | 'hover' | 'default' | 'pinned' | 'settings';


/** Modes in which the rail is open, i.e. not the 40px icon rail. */
const OPEN: ReadonlySet<string> = new Set<NavState>(['hover', 'default', 'pinned', 'settings']);
/** Modes that latch the rail open — a pointer leave must not collapse these. */
const LATCHED: ReadonlySet<string> = new Set<NavState>(['pinned', 'settings']);
/** How long a pointer rests on a parent row before its menu opens: one crossing the rail to a menu must not swap it. */
const FLYOUT_OPENS_AFTER = 120;
/** How long a pointer may be off both the row and its menu. */
const FLYOUT_SHUTS_AFTER = 200;

export class SherpaNav extends SherpaElement {
  static override css = new URL('./sherpa-nav.css', import.meta.url);
  static override html = new URL('./sherpa-nav.html', import.meta.url);
  static override props = {
    /* The PHONE's menu — written by openMenu() / closeMenu(). TRAP T-the-nav-is-a-menu-on-a-phone */
    'data-menu': { type: 'boolean', kind: 'visibility' },
    /* Hover off: the rail opens only to its Pin. TRAP T-a-rail-may-stay-shut */
    'data-no-hover': { type: 'boolean', kind: 'visibility' },
    /* Large nav: sizes double, text steps up. The `navLarge` setting. */
    'data-large': { type: 'boolean', kind: 'style' },
    'data-current-id': { type: 'string', kind: 'behaviour' },
    // A host may set it; a product turns it on.
    'data-searchable': { type: 'boolean', kind: 'visibility' },
    'data-nav-state': { type: 'enum', kind: 'style', values: ['collapsed', 'hover', 'default', 'pinned', 'settings'] },
  } as const;
  static override observed = ['data-current-id', 'data-nav-state'];

  /** The nav as data, normalised. */
  #config: NavConfig = {};
  /** The mode Settings was entered from, so leaving it goes back there. */
  #beforeSettings: NavState = 'collapsed';
  /** The parent row whose children the menu lists now. */
  #flyoutRow: HTMLElement | null = null;
  /** The menu's next open or shut, while the pointer settles. */
  #flyoutTimer: ReturnType<typeof setTimeout> | undefined;

  override onRender(): void {
    // Delegated — rows come and go, these listeners stay.
    this.$('.rail')?.addEventListener('item-select', this.#onItemClick as EventListener);
    this.$('.rail')?.addEventListener('item-expand', this.#onItemExpand as EventListener);
    // Capture: a shut rail's parent row opens its menu, and must not toggle.
    this.$('.rail')?.addEventListener('click', this.#onParentClick, true);
    this.$('.rail')?.addEventListener('pointerover', this.#onRailOver);
    this.$('.search')?.addEventListener('click', this.#onSearchIcon);
    const flyout = this.$('.flyout');
    flyout?.addEventListener('pointerover', this.#holdFlyout);
    flyout?.addEventListener('menu-select', this.#onFlyoutPick);
    flyout?.addEventListener('menu-close', this.#onFlyoutClose);
    this.$<HTMLInputElement>('.search-input')?.addEventListener('input', this.#onSearch);
    this.$('.search-clear')?.addEventListener('click', this.#onSearchClear);
    this.$('.pin')?.addEventListener('click', this.#onPin);
    this.$('.settings')?.addEventListener('click', this.#onSettings);
    this.$('.menu-settings')?.addEventListener('item-select', this.#onSettings);
    this.$('.menu-cancel')?.addEventListener('button-click', () => this.closeMenu());
    this.addEventListener('keydown', (event) => { if (event.key === 'Escape') this.closeMenu(); });

    this.addEventListener('pointerenter', this.#onEnter);
    this.addEventListener('pointerleave', this.#onLeave);
    // Focus gives a keyboard user the same reveal as a pointer.
    this.addEventListener('focusin', this.#onEnter);
    this.addEventListener('focusout', this.#onFocusOut);

    this.#applyState();
    if (this.#hasContent()) this.#render();
  }

  override onChange(name: string, oldValue: string | null, newValue: string | null): void {
    if (name === 'data-current-id') this.#applyActive();
    if (name === 'data-no-hover') {
      // Turned off under the pointer: an open rail does not wait for it to leave.
      if (newValue !== null && this.state === 'hover') this.#setState('collapsed');
      this.#applyState();
    }
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

  /**
   * openMenu() — the PHONE's menu: the nav over the whole screen, open, with no
   * Pin; Settings at the bottom and Cancel. A Context row closes it as it goes.
   * TRAP T-the-nav-is-a-menu-on-a-phone
   */
  openMenu(): void {
    if (this.hasAttribute('data-menu')) return;
    this.set('data-menu', true);
    // The top layer: over the shell and its overlay, whatever contains them.
    this.popover = 'manual';
    this.showPopover();
    if (!OPEN.has(this.state) || this.state === 'hover') this.#setState('default');
    this.emit('nav-menu-change', { open: true });
  }

  /** closeMenu() — back to the rail, going nowhere. Settings stays open. */
  closeMenu(): void {
    if (!this.hasAttribute('data-menu')) return;
    if (this.matches(':popover-open')) this.hidePopover();
    this.removeAttribute('popover');
    this.set('data-menu', null);
    if (this.state !== 'settings') this.#setState('collapsed');
    this.emit('nav-menu-change', { open: false });
  }

  get pinned(): boolean {
    return this.state === 'pinned';
  }
  set pinned(value: boolean) {
    this.#setState(value ? 'pinned' : 'collapsed');
  }

  /** populate(config) — the nav content, a NavConfig. */
  protected override renderData(data: unknown): void {
    this.#config = this.#normalise(data);
    this.#render();
  }

  /* ── State machine ─────────────────────────────────────────────── */

  /** Every transition funnels through here. */
  #setState(next: NavState): void {
    const previous = this.state;
    if (previous === next) return;
    if (next === 'settings') this.#beforeSettings = previous;
    // Writing the attribute is the ONLY step; onChange owns the re-render.
    this.set('data-nav-state', next);
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
        state === 'settings' ? this.word('settings') : (this.#config.product?.name ?? '');
    }
    this.$('.rail')?.setAttribute('aria-expanded', String(OPEN.has(state)));
    // Shut, Settings and Pin are a column.
    const shut = this.#staysShut();
    this.$('.settings')?.setAttribute('data-group', shut ? 'vertical-start' : 'start');
    this.$('.pin')?.setAttribute('data-group', shut ? 'vertical-end' : 'end');
    if (!shut) this.#shutFlyout();
    this.#applyActive();
  }

  /** The pointer arrived: open to hover, unless pinned, in Settings, or hover is off. */
  #onEnter = (): void => {
    if (!LATCHED.has(this.state) && !this.hasAttribute('data-no-hover')) this.#setState('hover');
  };

  /** The pointer left: collapse — or, with hover off, its menu goes. */
  #onLeave = (event: Event): void => {
    if (!this.hasAttribute('data-no-hover')) this.#collapse();
    else if ((event as PointerEvent).pointerType !== 'touch') this.#flyoutLater(this.#shutFlyout, FLYOUT_SHUTS_AFTER);
  };

  /** Focus left the nav: collapse. */
  #onFocusOut = (event: FocusEvent): void => {
    const next = event.relatedTarget as Node | null;
    if (next && this.contains(next)) return;
    this.#collapse();
  };

  /** Back to the icons, unless pinned, in Settings, or a menu. */
  #collapse(): void {
    if (!LATCHED.has(this.state) && !this.hasAttribute('data-menu')) this.#setState('collapsed');
  }

  /** Where the rail goes when Settings lets go: hover, as the pointer is on it — if it may. */
  #released(): NavState {
    return this.hasAttribute('data-no-hover') ? 'collapsed' : 'hover';
  }

  /** Pin or unpin — and from Settings, let go. */
  #onPin = (): void => {
    if (this.state === 'settings') {
      this.#setState(this.#released());
      return;
    }
    this.#setState(this.state === 'pinned' ? 'collapsed' : 'pinned');
  };

  /** Enter Settings, or leave it. */
  #onSettings = (): void => {
    if (this.state !== 'settings') {
      this.#setState('settings');
      return;
    }
    this.#setState(this.#beforeSettings === 'pinned' ? 'pinned' : this.#released());
  };

  /* ── Hover off: a rail that stays shut ──────────────────────────────── */

  /** Hover is off and the rail is shut: icons only, until its Pin. */
  #staysShut(): boolean {
    return this.hasAttribute('data-no-hover') && this.state === 'collapsed';
  }

  /** The search icon opens the rail to type in; focus leaving shuts it. */
  #onSearchIcon = (): void => {
    if (!this.#staysShut()) return;
    this.#setState('hover');
    this.$<HTMLInputElement>('.search-input')?.focus();
  };

  /** The row an event landed on, when it has children to list. */
  #parentRowOf(event: Event): HTMLElement | null {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    return row?.querySelector('sherpa-nav-item[data-expandable]') ? row : null;
  }

  /** Act once the pointer has settled, unless a later move overtakes this. */
  #flyoutLater(act: () => void, after: number): void {
    clearTimeout(this.#flyoutTimer);
    this.#flyoutTimer = setTimeout(act, after);
  }

  /** The pointer moved on the rail: a parent row's menu opens; anywhere else, it goes. */
  #onRailOver = (event: Event): void => {
    if (!this.#staysShut() || (event as PointerEvent).pointerType === 'touch') return;
    const row = this.#parentRowOf(event);
    if (row && row === this.#flyoutRow) clearTimeout(this.#flyoutTimer);
    else if (row) this.#flyoutLater(() => this.#openFlyout(row), FLYOUT_OPENS_AFTER);
    else this.#flyoutLater(this.#shutFlyout, FLYOUT_SHUTS_AFTER);
  };

  /** A parent row pressed: a thumb and a keyboard have no hover. A keyboard's press
   *  goes into the menu, and Escape back, as every menu's does. TRAP T-a-menu-is-reached-by-keys-from-its-trigger */
  #onParentClick = (event: Event): void => {
    const row = this.#staysShut() ? this.#parentRowOf(event) : null;
    if (!row) return;
    event.stopPropagation();
    this.#openFlyout(row);
  };

  /** List a parent row's children in the menu beside it. */
  #openFlyout(row: HTMLElement): void {
    const flyout = this.$<SherpaMenu>('.flyout');
    if (!flyout || !this.#staysShut()) return;
    clearTimeout(this.#flyoutTimer);
    this.#flyoutRow = row;
    flyout.dataset['heading'] = row.querySelector<HTMLElement>('sherpa-nav-item')?.dataset['label'] ?? '';
    flyout.items(this.#childItems(row.dataset['id'] ?? ''));
    flyout.show(row);
  }

  /** The rows under a parent, as menu rows. An Area among them heads its own, as a section. */
  #childItems(parent: string, section?: string): MenuItem[] {
    return this.$$<HTMLElement>('.nav-row').filter((row) => row.dataset['parent'] === parent).flatMap((row): MenuItem[] => {
      const id = row.dataset['id'] ?? '';
      const item = row.querySelector<HTMLElement>('sherpa-nav-item');
      const label = item?.dataset['label'] ?? '';
      if (item?.hasAttribute('data-expandable')) return this.#childItems(id, label);
      return [{ value: id, label, action: true, current: id === this.dataset['currentId'], ...(section ? { section } : {}) }];
    });
  }

  /** The pointer reached the menu: it stays, and no other row's opens. */
  #holdFlyout = (): void => {
    clearTimeout(this.#flyoutTimer);
  };

  /** Shut the menu, if it is open. */
  #shutFlyout = (): void => {
    const flyout = this.$<SherpaMenu>('.flyout');
    if (flyout?.open) flyout.hide();
  };

  /** A menu row chosen: the real row is pressed, so a pick and a click are one route. */
  #onFlyoutPick = (event: Event): void => {
    const id = (event as CustomEvent<{ value: string }>).detail.value;
    this.$$<HTMLElement>('.nav-row').find((row) => row.dataset['id'] === id)
      ?.querySelector<SherpaNavItem>('sherpa-nav-item')?.press();
  };

  /** The menu shut: it lists no row's children now. */
  #onFlyoutClose = (): void => {
    this.#flyoutRow = null;
  };

  override onDisconnect(): void {
    clearTimeout(this.#flyoutTimer);
  }

  /* ── Content ────────────────────────────────────────────────────── */

  /** A NavConfig, or nothing. */
  #normalise(data: unknown): NavConfig {
    return data && typeof data === 'object' && !Array.isArray(data) ? data as NavConfig : {};
  }

  /** Is there anything configured to draw. */
  #hasContent(): boolean {
    return !!(this.#config.product || this.#config.quickItems?.length || this.#config.sections?.length);
  }

  /** Draw the brand, the quick items and the sections, then mark the current row. */
  #render(): void {
    this.#renderBrand();
    this.#renderQuick();
    this.#renderSections();
    this.#applyActive();
    this.#applyState();
  }

  /** The product name and icon — a slotted icon wins. */
  #renderBrand(): void {
    const iconSlot = this.$('.brand-icon');
    // A slotted icon wins over the configured one — it is in the LIGHT DOM.
    if (iconSlot && this.#config.product?.icon && !this.querySelector(':scope > [slot="icon"]')) {
      this.#applyIcon(iconSlot, this.#config.product.icon);
    }
    // A product name implies a full nav, which has search.
    if (this.#config.product) this.set('data-searchable', true);
  }

  /** The quick items above the sections; none in Settings. */
  #renderQuick(): void {
    const list = this.$('.quick');
    if (!list) return;
    list.replaceChildren();
    if (this.state === 'settings') return;
    const defaults = this.#defaultQuick();
    // A quick row of only an id takes its default's words and glyph.
    const quick = this.#config.quickItems?.map((e): NavEntry => {
      if (e.label != null) return e as NavEntry;
      const base = defaults.find((d) => d.id === e.id);
      if (!base) report({ code: 'nav-row-unnamed', message: `sherpa-nav: quick row "${e.id}" has no label and no default.`, at: { id: e.id } });
      const icon = e.icon ?? base?.icon;
      return { ...e, ...(icon ? { icon } : {}), label: base?.label ?? '' };
    }) ?? defaults;
    for (const entry of quick) for (const row of this.#buildRows(entry, 1)) list.appendChild(row);
  }

  /** The quick rows its markup holds, as data. */
  #defaultQuick(): NavEntry[] {
    const rows = this.$<HTMLTemplateElement>('template.quick-default-tpl')?.content.querySelectorAll<HTMLElement>('[data-id]') ?? [];
    return [...rows].map((r) => ({ id: r.dataset['id']!, label: r.textContent?.trim() ?? '', ...(r.dataset['icon'] ? { icon: r.dataset['icon'] } : {}) }));
  }

  /** Stamp each section and its rows, keeping any hand-authored content. */
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
      const el = this.clone(sectionTpl);
      if (!el) break;
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
    // An OPEN Area stays open across a populate; the config may open more. Will, TODO 116
    const open = this.#opened.get(entry.id) === true || !!entry.expanded;
    this.#opened.set(entry.id, open);
    if (open) item.dataset['expanded'] = '';
    row.dataset['expanded'] = String(open);

    const childDepth = Math.min(depth + 1, 3) as 1 | 2 | 3;
    for (const kid of kids) rows.push(...this.#buildRows(kid, childDepth, entry.id));
    return rows;
  }

  /**
   * Draw an icon NAME, or print a raw glyph character.
   *
   * ASK THE ICON SET, never the string's shape. This tested `/\bfa-/`, so once
   * the names lost that prefix every one of them fell through to the text
   * branch and the brand tile printed the word "group".
   * TRAP T-an-icon-is-known-by-the-set-not-its-spelling
   *
   * NOT `writeIcon` — the host's `<slot>` fallback must be emptied first.
   * TRAP T-brand-icon-must-empty-its-host.
   */
  #applyIcon(host: Element, value: string): void {
    host.replaceChildren();
    if (hasIcon(value)) {
      const box = this.clone('template.brand-icon-tpl');
      if (!box) return;
      host.appendChild(box);
      renderIcon(box, value);
    } else {
      // A raw glyph character — an emoji or a letter mark.
      host.textContent = value;
    }
  }

  /** Mark the row `data-current-id` names. */
  #applyActive(): void {
    let active = this.dataset['currentId'];
    const rows = this.$$('.nav-row');
    // A rail that stays shut shows no child row, so its top row lights for it.
    if (this.#staysShut()) {
      const parents = new Map(rows.map((row) => [row.dataset['id'], row.dataset['parent']]));
      while (active && parents.get(active)) active = parents.get(active);
    }
    for (const row of rows) {
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
    const id = this.dataset['currentId'];
    return id ? this.entry(id) : null;
  }

  /** The current row's id — the name every one-of-many host shares (the tabs'
   *  too). Setting it is silent. */
  get currentId(): string {
    return this.dataset['currentId'] ?? '';
  }
  set currentId(id: string) {
    if (id) this.set('data-current-id', id);
    else this.set('data-current-id', null);
  }

  /** A row was clicked: make it current and report it. */
  #onItemClick = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    const id = row?.dataset['id'];
    if (!id) return;
    this.set('data-current-id', id);
    this.emit('nav-select', { id, ...this.entry(id) });
    // A CONTEXT row goes, so the menu goes; an Area only opens. TRAP T-the-nav-is-a-menu-on-a-phone
    if (row?.querySelector('sherpa-nav-item')?.hasAttribute('data-href')) this.closeMenu();
  };

  /** The Areas a reader has open, by id. A populate keeps them, so a host
   *  need not read them back. TRAP T-a-shadow-reach-is-a-missing-door */
  get expandedIds(): string[] {
    return [...this.$$<HTMLElement>('.nav-row[data-expanded="true"]')].map((row) => row.dataset['id'] ?? '').filter(Boolean);
  }

  /** An Area opened or closed: show or hide its children, and remember it. */
  #onItemExpand = (event: Event): void => {
    const row = (event.target as HTMLElement).closest<HTMLElement>('.nav-row');
    if (!row?.dataset['id']) return;
    const open = !!(event as CustomEvent).detail?.expanded;
    row.dataset['expanded'] = String(open);
    this.#opened.set(row.dataset['id'], open);
    this.#syncRowVisibility();
  };

  /** Each Area's open or shut, by id — the nav's own state, kept across a
   *  populate as the grid keeps its scroll. Will, TODO 116 */
  #opened = new Map<string, boolean>();

  /**
   * Write `data-hidden` on rows under a closed parent, for CSS to act on.
   *
   * Up `data-parent`, by `hiddenRows`; `:has()` on flat siblings would hide
   * unrelated branches. TRAP T-parent-chain-walk-not-a-selector.
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

    const hidden = hiddenRows(parent.keys(), parent, open);
    for (const row of rows) {
      const id = row.dataset['id'];
      if (id) row.toggleAttribute('data-hidden', hidden.has(id));
    }
  }

  /** Typing in the search: filter the rows and report the query. */
  #onSearch = (event: Event): void => {
    const query = (event.target as HTMLInputElement).value;
    this.toggleState('has-query', query.length > 0);
    this.#filter(query);
    this.emit('nav-search', { query });
  };

  /** Clear the search and show every row again. */
  #onSearchClear = (): void => {
    const input = this.$<HTMLInputElement>('.search-input');
    if (input) input.value = '';
    this.toggleState('has-query', false);
    this.#filter('');
    this.emit('nav-search', { query: '' });
    input?.focus();
  };

  /* ── Search ─────────────────────────────────────────────────────── */

  /** Show only the rows whose label matches, highlighting the match. */
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

    this.toggleState('searching', !!query);
  }

}

define('sherpa-nav', SherpaNav);
