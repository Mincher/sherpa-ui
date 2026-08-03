/**
 * FloatingBehavior — Mixin that adds top-layer floating capability to a
 * SherpaElement subclass via the native Popover API.
 *
 * Activation:
 *   Set the native `popover` attribute ("auto" or "manual") on the host.
 *   When absent the component behaves as a normal in-flow container.
 *
 * Declarative wiring (zero JS):
 *   <button popovertarget="my-menu">Open</button>
 *   <sherpa-container id="my-menu" popover="auto" anchor="my-menu">
 *
 * Imperative API:
 *   container.show(anchorEl)  — open and anchor-position relative to element
 *   container.hide()          — close and return focus to source
 *
 * Anchor positioning (CSS Anchor Positioning, Chrome 125+):
 *   If the `anchor` attribute is set, the mixin resolves that id to a DOM
 *   element and sets the CSS `anchor-name` + `position-anchor` properties.
 *   Falls back to getBoundingClientRect positioning on unsupported browsers.
 *   sherpa-anchor.css (loaded via SherpaElement.useAnchor = true) provides
 *   all `data-placement` / `data-flip` / `data-offset` CSS rules.
 *
 * Rounding overrides (edge-panel use case):
 *   data-rounding-start="none"  — zero radius on inline-start edge
 *   data-rounding-end="none"    — zero radius on inline-end edge
 *   data-rounding-top="none"    — zero radius on block-start edge
 *   data-rounding-bottom="none" — zero radius on block-end edge
 *   CSS selects these to zero the appropriate corner radii.
 *
 * Events (all bubbles + composed):
 *   container-open    — fired after showPopover()
 *   container-close   — fired after hidePopover()
 *   container-select  — fired when a sherpa-overlay-item inside is activated
 *     detail: { item, action, value, label, selection, checked, group, data }
 *
 * Menu item API (when used as a menu surface):
 *   populate(data)              — build items from flat/section data or { items, options }
 *   setMenuItems(items, opts)   — underlying builder
 *   getSelectedValues()         — values of checked items
 *   clearSelection()            — uncheck all items
 *
 * Static API:
 *   getContentTemplate(id)      — return a registered light-DOM content template HTML string
 *   ready                       — Promise that resolves when content templates are loaded
 */

import { parseTemplates } from './sherpa-element/sherpa-element.js';
import type { MenuItem, MenuItems, MenuSection, MenuOptions } from './types.js';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Constructor<T = object> = new (...args: any[]) => T;

/** Public instance surface of the FloatingBehavior mixin. */
export interface FloatingBehaviorInterface {
  open: boolean;
  floatSource: HTMLElement | null;
  _initFloating(): void;
  _doShow(anchor?: Element): void;
  _renderMenuData(source: unknown): void;
  _syncPageIndicator(): void;
  show(anchor?: Element): void;
  hide(): void;
  page: number;
  pages: number;
  setPage(index: number): void;
  nextPage(): void;
  prevPage(): void;
  setMenuItems(items: MenuItems, opts?: Partial<MenuOptions>): void;
  getSelectedValues(): string[];
  clearSelection(): void;
  rendered: Promise<void>;
}

/** Static surface of the FloatingBehavior mixin. */
export interface FloatingBehaviorStatics {
  preloadTemplates(htmlUrl: string): void;
  getContentTemplate(htmlUrl: string, id: string): string;
  templatesReady(htmlUrl: string): Promise<void>;
}

interface SherpaElementLike extends HTMLElement {
  emit(name: string, detail: Record<string, unknown>): void;
  $(sel: string): Element | null;
  dataset: DOMStringMap;
  rendered: Promise<void>;
}

const supportsAnchor = CSS.supports?.('anchor-name', '--test') ?? false;

/* ── Light-DOM content templates (loaded once per HTML URL) ─────── */

const _templatesByUrl = new Map<string, Map<string, string>>();
const _promisesByUrl  = new Map<string, Promise<void>>();

function _ensureTemplates(htmlUrl: string): Promise<void> {
  if (!_promisesByUrl.has(htmlUrl)) {
    const p = fetch(htmlUrl)
      .then(r => r.ok ? r.text() : '')
      .then(html => { _templatesByUrl.set(htmlUrl, parseTemplates(html) ?? new Map()); })
      .catch(() => { _templatesByUrl.set(htmlUrl, new Map()); });
    _promisesByUrl.set(htmlUrl, p);
  }
  return _promisesByUrl.get(htmlUrl)!;
}

export function FloatingBehavior<T extends Constructor<SherpaElementLike>>(
  Base: T,
): T & Constructor<FloatingBehaviorInterface> {
  return class FloatingBehaviorClass extends Base implements FloatingBehaviorInterface {

    /* ── Static template registry ───────────────────────────────── */

    /**
     * Trigger template pre-loading for a given HTML URL. Call once at
     * module init from the subclass:
     *   FloatingBehavior.preloadTemplates(MY_HTML_URL);
     */
    static preloadTemplates(htmlUrl: string): void {
      _ensureTemplates(htmlUrl);
    }

    /** Get a registered light-DOM content template HTML string by id. */
    static getContentTemplate(htmlUrl: string, id: string): string {
      return _templatesByUrl.get(htmlUrl)?.get(id) ?? '';
    }

    /** Promise that resolves once content templates are loaded. */
    static templatesReady(htmlUrl: string): Promise<void> {
      return _ensureTemplates(htmlUrl);
    }

    /* ── State ──────────────────────────────────────────────────── */

    get open(): boolean {
      return this.hasAttribute('open');
    }

    public floatSource: HTMLElement | null = null;
    #hiding = false;
    #toggleBound = false;

    /* ── Floating lifecycle setup (call from onRender) ──────────── */

    _initFloating(): void {
      if (!this.hasAttribute('popover')) return;

      if (!this.#toggleBound) {
        this.addEventListener('toggle', this.#onToggle as EventListener);
        this.addEventListener('click',  this.#onFloatClick as EventListener);
        this.addEventListener('keydown', this.#onFloatKeyDown as EventListener);
        this.#wirePageButtons();
        this.#toggleBound = true;
      }

      // Sync declarative anchor attribute on first render
      const anchorId = this.getAttribute('anchor');
      if (anchorId && this.hasAttribute('data-open')) {
        this.#resolveAndApplyAnchor(anchorId);
      }
    }

    /* ── Show / hide ────────────────────────────────────────────── */

    show(anchor?: Element): void {
      if (!this.hasAttribute('popover')) return;
      void this.rendered.then(async () => {
        // Also wait for any slotted sherpa-overlay-item children to bootstrap
        // their shadow DOMs — they render text via an internal slot so they
        // appear empty until their own connectedCallback completes.
        interface HasRendered { readonly rendered: Promise<void>; }
        const items = [...this.querySelectorAll('sherpa-overlay-item')] as (Element & HasRendered)[];
        if (items.length) await Promise.all(items.map(i => i.rendered));
        this._doShow(anchor);
      });
    }

    _doShow(anchor?: Element): void {
      if (!this.hasAttribute('popover')) return;

      this._initFloating();

      const anchorEl: HTMLElement | null =
        anchor as HTMLElement ??
        (this.getAttribute('anchor')
          ? document.getElementById(this.getAttribute('anchor')!)
          : null);

      if (anchorEl) {
        this.floatSource = anchorEl;
        anchorEl.setAttribute('aria-expanded', 'true');
        const placement = anchorEl.dataset?.['menuPosition'] ?? this.dataset['placement'];
        if (placement) this.dataset['placement'] = placement;
        this.#applyAnchorPosition(anchorEl);
      }

      this.setAttribute('open', '');
      try { this.showPopover(); } catch { /* already open */ }
      this.emit('container-open', {});

      // Auto-focus first focusable overlay item for menu-style surfaces
      if (this.dataset['layout'] === 'menu') {
        requestAnimationFrame(() => {
          this.querySelector<HTMLElement>(
            'sherpa-overlay-item:not([disabled]):not([hidden]):not([data-type="heading"])',
          )?.focus();
        });
      }
    }

    hide(): void {
      if (!this.open || this.#hiding) return;
      this.#hiding = true;
      this.removeAttribute('open');
      this.removeAttribute('data-open');
      try { this.hidePopover(); } catch { /* already closed */ }
      this.floatSource?.focus?.();
      this.floatSource?.setAttribute('aria-expanded', 'false');
      this.floatSource = null;
      this.emit('container-close', {});
      this.#hiding = false;
    }

    /* ── Anchor positioning ─────────────────────────────────────── */

    #resolveAndApplyAnchor(id: string): void {
      const el = document.getElementById(id);
      if (el) this.#applyAnchorPosition(el);
    }

    #applyAnchorPosition(anchor: HTMLElement): void {
      const anchorRoot = anchor.getRootNode();
      const sameScope = anchorRoot === this.getRootNode()
        && !(anchorRoot instanceof ShadowRoot);

      if (supportsAnchor && sameScope) {
        let anchorName = anchor.style.getPropertyValue('anchor-name');
        if (!anchorName) {
          anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
          anchor.style.setProperty('anchor-name', anchorName);
        }
        this.style.setProperty('--_sherpa-anchor', anchorName);
        this.style.setProperty('position-anchor', anchorName);
        this.style.removeProperty('position');
        this.style.removeProperty('top');
        this.style.removeProperty('left');
        this.style.removeProperty('right');
        this.style.removeProperty('bottom');
      } else {
        this.#positionFallback(anchor);
      }
    }

    #positionFallback(anchor: HTMLElement): void {
      const rect = anchor.getBoundingClientRect();
      const gap  = 4;
      const placement = this.dataset['placement'] ?? 'bottom-start';

      // Force fixed positioning — sherpa-anchor.css sets position:absolute when
      // anchor-name is supported, which would misplace the menu.
      this.style.setProperty('position', 'fixed');
      this.style.removeProperty('position-anchor');

      if (placement.startsWith('bottom')) {
        this.style.setProperty('top', `${rect.bottom + gap}px`);
        this.style.removeProperty('bottom');
      } else if (placement.startsWith('top')) {
        this.style.setProperty('bottom', `${window.innerHeight - rect.top + gap}px`);
        this.style.removeProperty('top');
      } else if (placement === 'inline-end' || placement.startsWith('inline-end')) {
        this.style.setProperty('left', `${rect.right + gap}px`);
        this.style.setProperty('top', `${rect.top}px`);
        this.style.removeProperty('bottom');
      } else if (placement === 'inline-start' || placement.startsWith('inline-start')) {
        this.style.setProperty('right', `${document.documentElement.clientWidth - rect.left + gap}px`);
        this.style.setProperty('top', `${rect.top}px`);
        this.style.removeProperty('bottom');
      }

      if (placement.endsWith('-end')) {
        this.style.setProperty('right', `${document.documentElement.clientWidth - rect.right}px`);
        this.style.removeProperty('left');
        this.style.removeProperty('translate');
      } else if (placement === 'bottom' || placement === 'top') {
        this.style.setProperty('left', `${rect.left + rect.width / 2}px`);
        this.style.setProperty('translate', '-50% 0');
        this.style.removeProperty('right');
      } else if (!placement.startsWith('inline-')) {
        this.style.setProperty('left', `${rect.left}px`);
        this.style.removeProperty('right');
        this.style.removeProperty('translate');
      }
    }

    /* ── Event handlers ─────────────────────────────────────────── */

    #onToggle = (e: ToggleEvent): void => {
      if (e.newState === 'closed' && this.open && !this.#hiding) {
        this.hide();
      }
    };

    #onFloatClick = (e: Event): void => {
      const item = (e.target as Element).closest?.('sherpa-overlay-item') as HTMLElement | null;
      if (!item || item.hasAttribute('disabled')) return;

      const selection = item.dataset['selection'];
      if (selection === 'checkbox' || selection === 'toggle') {
        item.toggleAttribute('checked');
      }
      if (selection === 'radio') {
        const group = item.dataset['group'];
        const siblings = group
          ? this.querySelectorAll(`sherpa-overlay-item[data-group="${CSS.escape(group)}"]`)
          : (item.closest('ul')?.querySelectorAll('sherpa-overlay-item[data-selection="radio"]') ?? [item]);
        siblings.forEach(s => s.removeAttribute('checked'));
        item.setAttribute('checked', '');
      }

      this.#dispatchSelect(item);

      if (!item.hasAttribute('data-keep-open') && selection !== 'toggle') {
        this.hide();
      }
    };

    #onFloatKeyDown = (e: KeyboardEvent): void => {
      const items = this.#focusableItems();
      if (!items.length) return;
      const active = document.activeElement;
      const idx = active instanceof HTMLElement ? items.indexOf(active) : -1;

      switch (e.key) {
        case 'ArrowDown': e.preventDefault(); items[(idx + 1) % items.length]?.focus(); break;
        case 'ArrowUp':   e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); break;
        case 'Home':      e.preventDefault(); items[0]?.focus(); break;
        case 'End':       e.preventDefault(); items.at(-1)?.focus(); break;
        case 'Enter':
        case ' ':
          e.preventDefault();
          (e.target as Element | null)?.closest?.('sherpa-overlay-item')?.dispatchEvent(
            new MouseEvent('click', { bubbles: true }),
          );
          break;
        case 'Escape':    e.preventDefault(); this.hide(); break;
      }
    };

    #focusableItems(): HTMLElement[] {
      return [...this.querySelectorAll<HTMLElement>(
        'sherpa-overlay-item:not([disabled]):not([hidden]):not([data-type="heading"])',
      )];
    }

    #dispatchSelect(item: HTMLElement): void {
      const detail = {
        item,
        action:    item.dataset['action']    || undefined,
        value:     item.getAttribute('value') ?? undefined,
        label:     item.textContent?.trim()  ?? '',
        selection: item.dataset['selection'] || undefined,
        checked:   item.hasAttribute('checked'),
        group:     item.dataset['group'] || item.closest('ul')?.getAttribute('data-group') || undefined,
        data:      { ...item.dataset },
      };
      this.emit('container-select', detail as Record<string, unknown>);
      const eventName = item.dataset['event'];
      if (eventName) {
        this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail }));
      }
    }

    /* ── Paged navigation ───────────────────────────────────────── */

    get page(): number {
      return parseInt(this.dataset['page'] ?? '0', 10) || 0;
    }
    get pages(): number {
      const explicit = parseInt(this.dataset['pages'] ?? '', 10);
      if (Number.isFinite(explicit) && explicit > 0) return explicit;
      return this.querySelectorAll('section[data-page]').length || 1;
    }
    setPage(index: number): void {
      const next = Math.max(0, Math.min(this.pages - 1, Number(index) || 0));
      this.dataset['page'] = String(next);
      this.emit('container-page-change', { page: next, total: this.pages });
      this._syncPageIndicator();
    }
    nextPage(): void { this.setPage(this.page + 1); }
    prevPage(): void { this.setPage(this.page - 1); }

    #wirePageButtons(): void {
      const back = this.$('.page-back');
      const next = this.$('.page-next');
      if (back) back.addEventListener('click', () => this.prevPage());
      if (next) next.addEventListener('click', () => {
        if (this.page >= this.pages - 1) {
          this.emit('container-page-finish', { page: this.page, total: this.pages });
        } else {
          this.nextPage();
        }
      });
    }

    _syncPageIndicator(): void {
      const ind  = this.$('.page-indicator');
      if (!ind) return;
      const total = this.pages;
      ind.textContent = total > 1 ? `${this.page + 1} ⁄ ${total}` : '';
      const next = this.$('.page-next');
      if (next) next.textContent = this.page >= total - 1 ? 'Done' : 'Next';
    }

    /* ── Menu item building ─────────────────────────────────────── */

    _renderMenuData(source: unknown): void {
      if (source != null && typeof source === 'object' && !Array.isArray(source) && 'items' in source) {
        const { items, options } = source as { items: MenuItems; options?: Partial<MenuOptions> };
        this.setMenuItems(items, options ?? {});
        return;
      }
      this.setMenuItems(source as MenuItems);
    }

    setMenuItems(items: MenuItems, opts: Partial<MenuOptions> = {}): void {
      if (!this.$('template.menu-item-tpl')) {
        void Promise.resolve(this.rendered).then(() => {
          if (this.$('template.menu-item-tpl')) {
            this.#buildMenuItemsNow(items, opts);
          } else {
            console.warn('sherpa-container: setMenuItems() requires data-layout="menu"');
          }
        });
        return;
      }
      this.#buildMenuItemsNow(items, opts);
    }

    #buildMenuItemsNow(items: MenuItems, opts: Partial<MenuOptions> = {}): void {
      const { marker } = opts;
      if (marker) {
        this.querySelectorAll(`[data-menu-marker="${marker}"]`).forEach(el => el.remove());
      } else if (!opts.append) {
        this.replaceChildren();
      }
      if (!items?.length) return;

      const before = new Set(this.children);
      if ('heading' in (items[0] || {})) {
        this.#buildSections(items as MenuSection[]);
      } else {
        this.#buildFlatList(items as MenuItem[], opts);
      }
      if (marker) {
        for (const child of this.children) {
          if (!before.has(child)) child.setAttribute('data-menu-marker', marker);
        }
      }
    }

    #buildFlatList(items: MenuItem[], opts: Partial<MenuOptions> = {}): void {
      const ul = (this.$('template.menu-list-tpl') as HTMLTemplateElement | null)
        ?.content.firstElementChild?.cloneNode(true) as HTMLUListElement | undefined;
      if (!ul) return;
      if (opts.group) ul.dataset['group'] = opts.group;
      for (const item of items) ul.appendChild(this.#buildMenuItem(item, opts));
      this.appendChild(ul);
    }

    #buildSections(sections: MenuSection[]): void {
      for (const section of sections) {
        if (section.heading) {
          const heading = (this.$('template.menu-heading-tpl') as HTMLTemplateElement | null)
            ?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
          if (heading) {
            heading.textContent = section.heading;
            if (section.style) heading.setAttribute('style', section.style);
            this.appendChild(heading);
          }
        }
        if (section.items?.length) {
          const ul = (this.$('template.menu-list-tpl') as HTMLTemplateElement | null)
            ?.content.firstElementChild?.cloneNode(true) as HTMLUListElement | undefined;
          if (!ul) continue;
          if (section.group) ul.dataset['group'] = section.group;
          if (section.style) ul.setAttribute('style', section.style);
          const sectionOpts = { selection: section.selection, group: section.group };
          for (const item of section.items) ul.appendChild(this.#buildMenuItem(item, sectionOpts));
          this.appendChild(ul);
        }
      }
    }

    #buildMenuItem(item: MenuItem, opts: Partial<MenuOptions> = {}): HTMLLIElement {
      const li = ((this.$('template.menu-item-tpl') as HTMLTemplateElement | null)
        ?.content.firstElementChild?.cloneNode(true) as HTMLLIElement | undefined)
        ?? document.createElement('li');
      const menuItem = li.querySelector('sherpa-overlay-item');
      if (!menuItem) return li;
      menuItem.setAttribute('value', item.value ?? '');
      menuItem.textContent = item.text ?? item.value ?? '';
      const selection = item.selection || opts.selection;
      if (selection) menuItem.setAttribute('data-selection', selection);
      if (selection === 'radio' && (item.group || opts.group)) {
        menuItem.setAttribute('data-group', item.group || opts.group || '');
      }
      if (item.selected || item.checked) menuItem.setAttribute('checked', '');
      if (item.disabled) menuItem.setAttribute('disabled', '');
      if (item.description) menuItem.setAttribute('data-description', item.description);
      if (item.keepOpen || selection === 'checkbox') menuItem.setAttribute('data-keep-open', '');
      if (item.data) {
        for (const [k, v] of Object.entries(item.data)) menuItem.setAttribute(`data-${k}`, v);
      }
      return li;
    }

    getSelectedValues(): string[] {
      return Array.from(
        this.querySelectorAll('sherpa-overlay-item[checked]'),
        item => item.getAttribute('value') ?? '',
      ).filter(Boolean);
    }

    clearSelection(): void {
      for (const item of this.querySelectorAll('sherpa-overlay-item[checked]')) {
        item.removeAttribute('checked');
      }
    }
  };
}
