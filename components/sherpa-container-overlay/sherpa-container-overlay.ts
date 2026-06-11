/**
 * sherpa-container-overlay.ts
 * SherpaContainerOverlay — Floating overlay surface.
 *
 * Unifies sherpa-popover (declarative anchor + paged content) and
 * sherpa-menu (imperative show/hide + structured item selection).
 *
 * @element sherpa-container-overlay
 * @category overlay
 * @description Floating overlay surface that unifies contextual menus and richer popover content.
 *   Use the menu variant for contextual action lists — attach it to a sherpa-button via
 *   data-menu="true", or call show(anchor) programmatically. Use the popover variant for richer
 *   content such as paged multi-step flows or detailed tooltip bodies. Populate with
 *   sherpa-overlay-item children. Listen to overlay-open and overlay-close to react to
 *   visibility changes.
 *
 * @attr {enum}    data-variant      — popover (default) | menu
 * @attr {boolean} data-open         — Declarative open/close
 * @attr {string}  data-anchor       — CSS anchor name for declarative positioning
 * @attr {enum}    data-placement    — bottom-start (default for menu) | bottom (default for popover) |
 *                                       bottom-end | top-start | top-end | top | inline-start | inline-end
 * @attr {string}  data-heading      — Header title text (popover variant)
 * @attr {boolean} data-loading      — Show loading spinner (menu variant)
 * @attr {string}  data-loading-text — Loading caption
 * @attr {enum}    data-layout       — default | actions (menu variant horizontal mode)
 * @attr {enum}    data-animation    — none | slide
 * @attr {enum}    data-template     — paged (override: switches to paged popover template)
 * @attr {number}  data-page         — Active 0-based page index (paged mode)
 * @attr {number}  data-pages        — Total page count (paged mode)
 *
 * @slot           — Body content / menu items
 * @slot icon      — Header leading icon (popover variant)
 * @slot header-end — Header trailing content (popover variant)
 *
 * @fires overlay-open
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @fires overlay-close
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @fires overlay-select
 *   bubbles: true, composed: true
 *   detail: { item, action, value, label, selection, checked, group, data }
 *
 * @fires overlay-page-change
 *   bubbles: true, composed: true
 *   detail: { page: number, total: number }
 *
 * @fires overlay-page-finish
 *   bubbles: true, composed: true
 *   detail: { page: number, total: number }
 *
 * @method show(anchor?)       — Open and position relative to anchor element
 * @method hide()              — Close
 * @method nextPage()          — (paged) Advance to next page
 * @method prevPage()          — (paged) Step back to previous page
 * @method setPage(index)      — (paged) Jump to specific 0-based page
 * @method getSelectedValues() — Get values of all checked items
 * @method clearSelection()    — Uncheck all items
 *
 * @prop {boolean}  open    — Whether the overlay is currently visible
 * @prop {Element}  source  — The anchor element that opened the overlay
 *
 * Static API (used by sherpa-button):
 * @method getOverlayTemplate(id) — Return light-DOM content template HTML by id
 * @prop   ready                  — Promise that resolves when templates are loaded
 */

import '../sherpa-overlay-item/sherpa-overlay-item.js';
import {
  SherpaElement,
  parseTemplates,
} from '../utilities/sherpa-element/sherpa-element.js';
import { clearElementCache } from '../utilities/element-cache.js';
import { PageNavigationMixin } from '../utilities/page-navigation-mixin.js';
import type { EventHandler } from '../utilities/types.js';

const supportsAnchor = CSS.supports?.('anchor-name', '--test') ?? false;

/* ── Light-DOM content templates (loaded once at module init) ─────── */

const OVERLAY_HTML_URL = new URL('./sherpa-container-overlay.html', import.meta.url).href;
let _overlayTemplates: Map<string, string> | null = null;
let _overlayTemplatesPromise: Promise<void> | null = null;

function _ensureTemplates(): Promise<void> {
  if (!_overlayTemplatesPromise) {
    _overlayTemplatesPromise = fetch(OVERLAY_HTML_URL)
      .then((r) => (r.ok ? r.text() : ''))
      .then((html) => { _overlayTemplates = parseTemplates(html); })
      .catch(() => { _overlayTemplates = new Map(); });
  }
  return _overlayTemplatesPromise;
}

_ensureTemplates();

/* ══════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════ */

export class SherpaContainerOverlay extends PageNavigationMixin(SherpaElement) {
  static override get cssUrl(): string {
    return new URL('./sherpa-container-overlay.css', import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return OVERLAY_HTML_URL;
  }
  public static override useAnchor = true;

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      'data-variant',
      'data-open',
      'data-anchor',
      'data-heading',
      'data-template',
      'data-page',
      'data-pages',
      'data-loading-text',
    ];
  }

  /**
   * Get a light-DOM content template HTML string by id.
   * Returns "" if not found. Call after awaiting SherpaContainerOverlay.ready.
   */
  static getOverlayTemplate(id: string): string {
    return _overlayTemplates?.get(id) ?? '';
  }

  /** Promise that resolves once overlay templates are loaded and parsed. */
  static get ready(): Promise<void> {
    return _ensureTemplates();
  }

  /* ── Variant ─────────────────────────────────────────────────── */

  get variant(): 'popover' | 'menu' {
    return (this.dataset['variant'] as 'popover' | 'menu') || 'popover';
  }

  override get templateId(): string {
    if (this.dataset['template'] === 'paged') return 'paged';
    return this.variant === 'menu' ? 'menu' : 'default';
  }

  /* ── State ───────────────────────────────────────────────────── */

  get open(): boolean {
    return this.hasAttribute('open');
  }

  public source: HTMLElement | null = null;
  #hiding = false;
  #bound = false;

  /* ── Cached elements ─────────────────────────────────────────── */

  public els = this.cacheElements({
    heading: '.overlay-heading',
    closeBtn: { selector: '.close-btn', type: HTMLButtonElement },
    loadingText: '.overlay-loader-text',
  });

  /* ── Lifecycle ───────────────────────────────────────────────── */

  override onRender(): void {
    if (!this.hasAttribute('popover')) {
      this.setAttribute('popover', 'auto');
    }

    if (!this.dataset['placement']) {
      this.dataset['placement'] = this.variant === 'menu' ? 'bottom-start' : 'bottom';
    }

    if (!this.#bound) {
      this.els.closeBtn?.addEventListener('click', this.#onClose);
      this.#wirePageButtons();
      this.addEventListener('click', this.#onClick);
      this.addEventListener('keydown', this.#onKeyDown);
      this.addEventListener('toggle', this.#onToggle);
      this.#bound = true;
    }

    this.#syncHeading();
    this.#syncLoadingText();
    this.#syncPageIndicator();
  }

  override onAttributeChanged(name: string, _old: string | null, _new: string | null): void {
    switch (name) {
      case 'data-heading':
        this.#syncHeading();
        break;
      case 'data-open':
        if (this.hasAttribute('data-open')) {
          this.show();
        } else {
          this.hide();
        }
        break;
      case 'data-anchor':
        if (this.hasAttribute('data-open')) this.#syncDeclarativeAnchor();
        break;
      case 'data-variant':
      case 'data-template':
        this.renderTemplate(this.templateId).then(() => {
          this.#bound = false;
          clearElementCache(this);
          this.els.closeBtn?.addEventListener('click', this.#onClose);
          this.#wirePageButtons();
          this.#bound = true;
          this.#syncHeading();
          this.#syncPageIndicator();
        });
        break;
      case 'data-page':
      case 'data-pages':
        this.#syncPageIndicator();
        if (name === 'data-page') {
          this.emit('overlay-page-change', { page: this.page, total: this.pages });
        }
        break;
      case 'data-loading-text':
        this.#syncLoadingText();
        break;
    }
  }

  /* ── Page buttons ────────────────────────────────────────────── */

  #wirePageButtons(): void {
    const back = this.$('.page-back');
    const next = this.$('.page-next');
    if (back) back.addEventListener('click', () => this.prevPage());
    if (next) next.addEventListener('click', () => {
      if (this.page >= this.pages - 1) {
        this.emit('overlay-page-finish', { page: this.page, total: this.pages });
      } else {
        this.nextPage();
      }
    });
  }

  #syncPageIndicator(): void {
    const ind = this.$('.page-indicator');
    if (!ind) return;
    const total = this.pages;
    ind.textContent = total > 1 ? `${this.page + 1} ⁄ ${total}` : '';
    const next = this.$('.page-next');
    if (next) next.textContent = this.page >= total - 1 ? 'Done' : 'Next';
  }

  /* ── Sync helpers ────────────────────────────────────────────── */

  #syncHeading(): void {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset['heading'] || '';
    }
  }

  #syncLoadingText(): void {
    if (this.els.loadingText) {
      this.els.loadingText.textContent = this.dataset['loadingText'] || '';
    }
  }

  #syncDeclarativeAnchor(): void {
    const anchorName = this.dataset['anchor'];
    if (anchorName) {
      this.style.setProperty('--_sherpa-anchor', `--${anchorName}`);
    }
  }

  /* ── Event handlers ──────────────────────────────────────────── */

  #onClose = (): void => {
    this.hide();
  };

  #onClick: EventHandler<MouseEvent> = (e: Event): void => {
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
      siblings.forEach((s) => s.removeAttribute('checked'));
      item.setAttribute('checked', '');
    }

    this.#dispatchSelect(item);

    if (!item.hasAttribute('data-keep-open') && selection !== 'toggle') {
      this.hide();
    }
  };

  #onKeyDown: EventHandler<KeyboardEvent> = (e: KeyboardEvent): void => {
    const items = this.#focusableItems();
    if (!items.length) return;

    const active = document.activeElement;
    const idx = active instanceof HTMLElement ? items.indexOf(active) : -1;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case 'ArrowUp':
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case 'Home':
        e.preventDefault();
        items[0]?.focus();
        break;
      case 'End':
        e.preventDefault();
        items.at(-1)?.focus();
        break;
      case 'Enter':
      case ' ':
        e.preventDefault();
        (e.target as Element | null)?.closest?.('sherpa-overlay-item')?.dispatchEvent(
          new MouseEvent('click', { bubbles: true }),
        );
        break;
      case 'Escape':
        e.preventDefault();
        this.hide();
        break;
    }
  };

  #onToggle: EventHandler<ToggleEvent> = (e: Event): void => {
    if ((e as ToggleEvent).newState === 'closed' && this.open && !this.#hiding) {
      this.hide();
    }
  };

  #focusableItems(): HTMLElement[] {
    return [
      ...this.querySelectorAll<HTMLElement>(
        'sherpa-overlay-item:not([disabled]):not([hidden]):not([data-type="heading"])',
      ),
    ];
  }

  #dispatchSelect(item: HTMLElement): void {
    const detail = {
      item,
      action: item.dataset['action'] || undefined,
      value: item.getAttribute('value') ?? undefined,
      label: item.textContent?.trim() ?? '',
      selection: item.dataset['selection'] || undefined,
      checked: item.hasAttribute('checked'),
      group: item.dataset['group'] || item.closest('ul')?.getAttribute('data-group') || undefined,
      data: { ...item.dataset },
    };

    this.dispatchEvent(
      new CustomEvent('overlay-select', { bubbles: true, composed: true, detail }),
    );

    const eventName = item.dataset['event'];
    if (eventName) {
      this.dispatchEvent(new CustomEvent(eventName, { bubbles: true, composed: true, detail }));
    }
  }

  /* ── Show / hide ─────────────────────────────────────────────── */

  show(anchor?: Element): void {
    // Resolve anchor from data-anchor if not provided imperatively
    if (!anchor && this.dataset['anchor']) {
      anchor = document.querySelector(`[style*="anchor-name: --${this.dataset['anchor']}"]`) ?? undefined;
    }

    if (anchor) {
      this.source = anchor as HTMLElement;
      (anchor as HTMLElement).setAttribute?.('aria-expanded', 'true');

      const position = (anchor as HTMLElement).dataset?.['menuPosition'] || this.dataset['placement'];
      if (position) this.dataset['placement'] = position;

      this.#positionRelativeTo(anchor as HTMLElement);
    }

    this.setAttribute('open', '');

    try {
      this.showPopover();
    } catch {
      // Already open
    }

    this.emit('overlay-open', {});

    if (this.variant === 'menu') {
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

    try {
      this.hidePopover();
    } catch {
      // Already closed
    }

    this.source?.focus?.();
    this.source?.setAttribute('aria-expanded', 'false');
    this.source = null;
    this.emit('overlay-close', {});
    this.#hiding = false;
  }

  /* ── Positioning ─────────────────────────────────────────────── */

  #positionRelativeTo(anchor: HTMLElement): void {
    const sameTreeScope = anchor.getRootNode() === this.getRootNode();

    if (supportsAnchor && sameTreeScope) {
      let anchorName = anchor.style.getPropertyValue('anchor-name');
      if (!anchorName) {
        anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
        anchor.style.setProperty('anchor-name', anchorName);
      }
      this.style.setProperty('--_sherpa-anchor', anchorName);
      this.style.setProperty('position-anchor', anchorName);
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
    const gap = 4;
    const placement = this.dataset['placement'] || 'bottom-start';

    this.style.removeProperty('position-anchor');

    if (placement.startsWith('bottom')) {
      this.style.setProperty('top', `${rect.bottom + gap}px`);
      this.style.removeProperty('bottom');
    } else if (placement.startsWith('top')) {
      this.style.setProperty('bottom', `${window.innerHeight - rect.top + gap}px`);
      this.style.removeProperty('top');
    }

    if (placement.endsWith('-end')) {
      this.style.setProperty('right', `${document.documentElement.clientWidth - rect.right}px`);
      this.style.removeProperty('left');
      this.style.removeProperty('translate');
    } else if (placement === 'bottom' || placement === 'top') {
      this.style.setProperty('left', `${rect.left + rect.width / 2}px`);
      this.style.setProperty('translate', '-50% 0');
      this.style.removeProperty('right');
    } else {
      this.style.setProperty('left', `${rect.left}px`);
      this.style.removeProperty('right');
      this.style.removeProperty('translate');
    }
  }

  /* ── Selection helpers ───────────────────────────────────────── */

  getSelectedValues(): string[] {
    const checked = this.querySelectorAll('sherpa-overlay-item[checked]');
    return Array.from(checked, (item) => item.getAttribute('value') ?? '').filter(Boolean);
  }

  clearSelection(): void {
    for (const item of this.querySelectorAll('sherpa-overlay-item[checked]')) {
      item.removeAttribute('checked');
    }
  }
}

customElements.define('sherpa-container-overlay', SherpaContainerOverlay);
export default SherpaContainerOverlay;
