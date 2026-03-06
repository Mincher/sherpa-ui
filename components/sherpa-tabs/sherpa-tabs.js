/**
 * sherpa-tabs.js
 * SherpaTabs — Tabbed content switcher with accessible keyboard navigation.
 *
 * Each direct light-DOM child with a `data-tab-label` attribute becomes a tab.
 * The component creates shadow-DOM tab buttons from a cloning prototype and
 * manages panel visibility by setting `data-tab-active` on the matching child.
 *
 * Usage:
 *   <sherpa-tabs data-active-tab="0">
 *     <div data-tab-label="Overview">Overview content…</div>
 *     <div data-tab-label="Details">Details content…</div>
 *     <div data-tab-label="History">History content…</div>
 *   </sherpa-tabs>
 *
 *   <!-- Inactive tab -->
 *   <sherpa-tabs>
 *     <div data-tab-label="Active">Content</div>
 *     <div data-tab-label="Disabled" data-tab-inactive>Disabled panel</div>
 *   </sherpa-tabs>
 *
 * Slots:
 *   - (default): Tab panel children. Each must have `data-tab-label`.
 *
 * Attributes:
 *   - data-active-tab: Zero-based index of the selected tab (default: 0)
 *
 * @fires tab-change — { index: number, label: string, previousIndex: number }
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaTabs extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl()  { return new URL('./sherpa-tabs.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-tabs.html', import.meta.url).href; }

  static get observedAttributes() {
    return [...super.observedAttributes, 'data-active-tab'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  #stripEl   = null;
  #tabTpl    = null;
  #tabs      = [];   // shadow DOM button elements
  #panels    = [];   // light DOM panel children

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#stripEl = this.$('.tab-strip');
    this.#tabTpl  = this.$('.tab-tpl');
  }

  onConnect() {
    if (!this.hasAttribute('data-active-tab')) {
      this.dataset.activeTab = '0';
    }
    this.#buildTabs();
  }

  onAttributeChanged(name) {
    if (name === 'data-active-tab') {
      this.#syncActiveTab();
    }
  }

  /**
   * When slotted content changes (panels added/removed), rebuild tabs.
   */
  onSlotChange() {
    this.#buildTabs();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  /** The currently active tab index. */
  get activeTab() { return parseInt(this.dataset.activeTab, 10) || 0; }
  set activeTab(v) { this.dataset.activeTab = String(v); }

  /** Select a tab by index. */
  selectTab(index) {
    const prev = this.activeTab;
    if (index === prev) return;
    if (index < 0 || index >= this.#panels.length) return;
    // Skip inactive tabs
    if (this.#panels[index]?.hasAttribute('data-tab-inactive')) return;

    this.dataset.activeTab = String(index);
    this.#emitTabChange(index, prev);
  }

  /* ── Private — build tabs from slotted children ───────────────── */

  #buildTabs() {
    if (!this.#stripEl || !this.#tabTpl) return;

    // Collect panel children (those with data-tab-label)
    const slot = this.$('slot:not([name])');
    const assigned = slot ? slot.assignedElements() : [];
    this.#panels = assigned.filter(el => el.hasAttribute('data-tab-label'));

    // Remove existing tab buttons (keep the template)
    this.#tabs.forEach(btn => btn.remove());
    this.#tabs = [];

    // Clone prototype for each panel
    this.#panels.forEach((panel, i) => {
      const tpl = this.#tabTpl.content.cloneNode(true);
      const btn = tpl.querySelector('.tab');
      const label = btn.querySelector('.tab-label');

      label.textContent = panel.dataset.tabLabel || `Tab ${i + 1}`;
      btn.dataset.index = String(i);

      if (panel.hasAttribute('data-tab-inactive')) {
        btn.setAttribute('data-inactive', '');
        btn.setAttribute('aria-disabled', 'true');
      }

      btn.addEventListener('click', this.#handleTabClick);
      btn.addEventListener('keydown', this.#handleTabKeydown);

      this.#stripEl.appendChild(btn);
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
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #handleTabClick = (e) => {
    const btn = e.currentTarget;
    const index = parseInt(btn.dataset.index, 10);
    this.selectTab(index);
  };

  #handleTabKeydown = (e) => {
    const current = parseInt(e.currentTarget.dataset.index, 10);
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
  #findNextTab(from, direction) {
    let i = from + direction;
    while (i >= 0 && i < this.#tabs.length) {
      if (!this.#panels[i]?.hasAttribute('data-tab-inactive')) return i;
      i += direction;
    }
    return from; // no available tab found
  }

  #emitTabChange(index, previousIndex) {
    this.dispatchEvent(new CustomEvent('tab-change', {
      bubbles: true,
      composed: true,
      detail: {
        index,
        label: this.#panels[index]?.dataset.tabLabel || '',
        previousIndex,
      },
    }));
  }
}

customElements.define('sherpa-tabs', SherpaTabs);
