/**
 * sherpa-tabs.js
 * SherpaTabs — Tabbed content switcher with accessible keyboard navigation.
 *
 * Each direct light-DOM child with a data-tab-label attribute becomes a tab.
 * The component creates shadow-DOM tab buttons from a cloning prototype and
 * manages panel visibility by setting data-tab-active on the matching child.
 *
 * @element sherpa-tabs
 * @category content
 * @description Tabbed panel switcher for organising mutually exclusive views within one surface.
 *   Each direct child with a data-tab-label attribute becomes a tab panel. Use
 *   data-load-mode="lazy" when tab content is expensive to fetch or render, so panels are only
 *   populated on first activation via the tab-load event. Prefer tabs over accordions when the
 *   user switches frequently between views at the same scroll position.
 *
 * @attr {number}  data-active-tab — Zero-based index of the selected tab
 * @attr {enum}    data-load-mode  — eager (default, all panels rendered) | lazy (panels populated on first activation)
 *
 * @slot         — Default slot for tab panel children (each must have data-tab-label)
 * @slot detail  — Trailing content shown to the right of the tab strip (badges, actions)
 *
 * @fires tab-change — Fired when the active tab changes
 *   bubbles: true, composed: true
 *   detail: { index: number, label: string, previousIndex: number }
 *
 * @fires tab-load — (lazy) Fired the first time a tab becomes active. Consumers
 *   should populate the panel synchronously or asynchronously.
 *   bubbles: true, composed: true
 *   detail: { index: number, label: string, panel: HTMLElement }
 *
 * @method selectTab(index) — Programmatically select a tab by index
 *   @param {number} index — Zero-based tab index
 *   @returns {void}
 *
 * @prop {number} activeTab — Currently selected tab index (read/write)
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';
import type { EventHandler } from '../utilities/types.js';

export class SherpaTabs extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-tabs.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-tabs.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-active-tab', 'data-load-mode'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  #stripEl: HTMLElement | null   = null;
  #tabTpl: HTMLTemplateElement | null = null;
  #tabs: HTMLElement[]      = [];   // shadow DOM button elements
  #panels: HTMLElement[]    = [];   // light DOM panel children
  #initialized = false;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    this.#stripEl = this.$<HTMLElement>('.tab-strip');
    this.#tabTpl  = this.$<HTMLTemplateElement>('.tab-tpl');

    if (!this.#initialized) {
      if (!this.hasAttribute('data-active-tab')) {
        this.dataset["activeTab"] = '0';
      }
      this.#initialized = true;
    }

    this.#buildTabs();
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-active-tab') {
      this.#syncActiveTab();
    }
  }

  /**
   * When slotted content changes (panels added/removed), rebuild tabs.
   */
  override onSlotChange(): void {
    this.#buildTabs();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /** The currently active tab index. */
  get activeTab() { return parseInt(this.dataset["activeTab"] || "", 10) || 0; }
  set activeTab(v: number) { this.dataset["activeTab"] = String(v); }

  /** Select a tab by index. */
  selectTab(index: number) {
    const prev = this.activeTab;
    if (index === prev) return;
    if (index < 0 || index >= this.#panels.length) return;
    // Skip inactive tabs
    if (this.#panels[index]?.hasAttribute('data-tab-inactive')) return;

    this.dataset["activeTab"] = String(index);
    this.#emitTabChange(index, prev);
  }

  /* ── Private — build tabs from slotted children ───────────────── */

  #buildTabs() {
    if (!this.#stripEl || !this.#tabTpl) return;

    // Collect panel children (those with data-tab-label)
    const slot = this.$<HTMLSlotElement>('slot:not([name])');
    const assigned = slot ? slot.assignedElements() : [];
    this.#panels = assigned.filter((el): el is HTMLElement =>
      el instanceof HTMLElement && el.hasAttribute('data-tab-label'));

    // Remove existing tab buttons (keep the template)
    this.#tabs.forEach((btn) => btn.remove());
    this.#tabs = [];

    const strip = this.#stripEl;
    const tabTpl = this.#tabTpl;

    // Clone prototype for each panel
    this.#panels.forEach((panel, i) => {
      const tpl = tabTpl.content.cloneNode(true) as DocumentFragment;
      const btn = tpl.querySelector<HTMLElement>('.tab');
      if (!btn) return;
      const label = btn.querySelector('.tab-label');

      if (label) label.textContent = panel.dataset["tabLabel"] || `Tab ${i + 1}`;
      btn.dataset["index"] = String(i);

      if (panel.hasAttribute('data-tab-inactive')) {
        btn.setAttribute('data-inactive', '');
        btn.setAttribute('aria-disabled', 'true');
      }

      btn.addEventListener('click', this.#onTabClick);
      btn.addEventListener('keydown', this.#onTabKeyDown);

      strip.appendChild(btn);
      this.#tabs.push(btn);
    });

    this.#syncActiveTab();
  }

  #syncActiveTab() {
    const index = this.activeTab;

    // Update tab buttons
    this.#tabs.forEach((btn, i) => {
      const isActive = i === index;
      btn.setAttribute('aria-selected', String(isActive));
      btn.setAttribute('tabindex', isActive ? '0' : '-1');
    });

    // Update panel visibility
    this.#panels.forEach((panel, i) => {
      panel.toggleAttribute('data-tab-active', i === index);
    });

    // Lazy load: fire tab-load the first time a panel becomes active.
    if (this.dataset["loadMode"] === 'lazy') {
      const panel = this.#panels[index];
      if (panel && !panel.hasAttribute('data-tab-loaded')) {
        panel.setAttribute('data-tab-loaded', '');
        this.emit('tab-load', { index, label: panel.dataset["tabLabel"] || '', panel });
      }
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTabClick: EventHandler<MouseEvent> = (e: Event) => {
    const btn = e.currentTarget as HTMLElement;
    const index = parseInt(btn.dataset["index"] || "", 10);
    this.selectTab(index);
  };

  #onTabKeyDown: EventHandler<KeyboardEvent> = (e: KeyboardEvent) => {
    const current = parseInt((e.currentTarget as HTMLElement).dataset["index"] || '0', 10);
    let next = current;

    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowDown':
        e.preventDefault();
        next = this.#findNextTab(current, 1);
        break;
      case 'ArrowLeft':
      case 'ArrowUp':
        e.preventDefault();
        next = this.#findNextTab(current, -1);
        break;
      case 'Home':
        e.preventDefault();
        next = this.#findNextTab(-1, 1);
        break;
      case 'End':
        e.preventDefault();
        next = this.#findNextTab(this.#tabs.length, -1);
        break;
      default:
        return;
    }

    if (next !== current) {
      this.selectTab(next);
      this.#tabs[next]?.focus();
    }
  };

  /** Find the next non-inactive tab in a given direction. */
  #findNextTab(from: number, direction: number): number {
    let i = from + direction;
    while (i >= 0 && i < this.#tabs.length) {
      if (!this.#panels[i]?.hasAttribute('data-tab-inactive')) return i;
      i += direction;
    }
    return from; // no available tab found
  }

  #emitTabChange(index: number, previousIndex: number) {
    this.emit('tab-change', {
      index,
      label: this.#panels[index]?.dataset["tabLabel"] || '',
      previousIndex,
    });
  }
}

customElements.define('sherpa-tabs', SherpaTabs);
