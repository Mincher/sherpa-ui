/**
 * sherpa-menu.js — Menu component (per-instance, no singleton).
 *
 * Light DOM <ul>/<li>/<sherpa-menu-item> content projected through <slot>.
 * Event delegation handles click + keyboard on slotted items.
 * Dispatches `menu-select` with detail:
 *   { item, action, value, label, selection, checked, group, data }
 *
 * Each sherpa-button[menu] creates and owns its own <sherpa-menu> instance.
 * Uses popover="auto" for top-layer promotion and light-dismiss.
 * CSS anchor positioning (with JS fallback) for placement.
 */

import '../sherpa-menu-item/sherpa-menu-item.js';
import { AuxElement } from '../utilities/sherpa-element/sherpa-element.js';

const supportsAnchor = CSS.supports?.('anchor-name', '--test') ?? false;

/* ══════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════ */

export class AuxMenu extends AuxElement {

  static get cssUrl()  { return new URL('./sherpa-menu.css', import.meta.url).href; }
  static get htmlUrl() { return new URL('./sherpa-menu.html', import.meta.url).href; }

  source = null;
  #hiding = false;

  get open() { return this.hasAttribute('open'); }

  onConnect() {
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeydown);
    this.addEventListener('toggle', this.#onToggle);
  }

  onDisconnect() {
    this.removeEventListener('click', this.#onClick);
    this.removeEventListener('keydown', this.#onKeydown);
    this.removeEventListener('toggle', this.#onToggle);
  }

  /* ── Event delegation ──────────────────────────────────────── */

  #onClick = (e) => {
    const item = e.target.closest?.('sherpa-menu-item');
    if (!item || item.hasAttribute('disabled')) return;

    const selection = item.dataset.selection;

    if (selection === 'checkbox' || selection === 'toggle') {
      item.toggleAttribute('checked');
    }
    if (selection === 'radio') {
      this.#selectRadio(item);
    }

    this.#dispatchSelect(item);

    if (!item.hasAttribute('data-keep-open') && selection !== 'toggle') {
      this.hide();
    }
  };

  #onKeydown = (e) => {
    const items = this.#focusableItems();
    if (!items.length) return;

    const idx = items.indexOf(document.activeElement);

    switch (e.key) {
      case 'ArrowDown': e.preventDefault(); items[(idx + 1) % items.length]?.focus(); break;
      case 'ArrowUp':   e.preventDefault(); items[(idx - 1 + items.length) % items.length]?.focus(); break;
      case 'Home':      e.preventDefault(); items[0]?.focus(); break;
      case 'End':       e.preventDefault(); items.at(-1)?.focus(); break;
      case 'Enter':
      case ' ':         e.preventDefault(); e.target.closest?.('sherpa-menu-item')?.click(); break;
      case 'Escape':    e.preventDefault(); this.hide(); break;
    }
  };

  #focusableItems() {
    return [...this.querySelectorAll('sherpa-menu-item:not([disabled]):not([hidden]):not([data-type="heading"])')];
  }

  /* ── Radio logic ───────────────────────────────────────────── */

  #selectRadio(item) {
    const group = item.dataset.group;
    const siblings = group
      ? this.querySelectorAll(`sherpa-menu-item[data-group="${CSS.escape(group)}"]`)
      : (item.closest('ul')?.querySelectorAll('sherpa-menu-item[data-selection="radio"]') ?? [item]);

    siblings.forEach(s => s.removeAttribute('checked'));
    item.setAttribute('checked', '');
  }

  /* ── Dispatch ──────────────────────────────────────────────── */

  #dispatchSelect(item) {
    this.dispatchEvent(new CustomEvent('menu-select', {
      bubbles: true,
      composed: true,
      detail: {
        item,
        action:    item.dataset.action || undefined,
        value:     item.getAttribute('value') ?? undefined,
        label:     item.textContent.trim(),
        selection: item.dataset.selection || undefined,
        checked:   item.hasAttribute('checked'),
        group:     item.dataset.group || item.closest('ul')?.dataset.group || undefined,
        data:      { ...item.dataset }
      }
    }));
  }

  /* ── Show / hide ───────────────────────────────────────────── */

  show(anchor) {
    if (!anchor) return;
    this.source = anchor;

    // Position via CSS anchor or JS fallback
    if (supportsAnchor) {
      let anchorName = anchor.style.getPropertyValue('anchor-name');
      if (!anchorName) {
        anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
        anchor.style.setProperty('anchor-name', anchorName);
      }
      this.style.setProperty('--sherpa-menu-anchor', anchorName);
      this.style.removeProperty('top');
      this.style.removeProperty('left');
    } else {
      const rect = anchor.getBoundingClientRect();
      this.style.setProperty('top', `${rect.bottom + 4}px`);
      this.style.setProperty('left', `${rect.left}px`);
    }

    this.setAttribute('open', '');

    if (this.hasAttribute('popover')) {
      try { this.showPopover(); } catch { /* already open */ }
    }

    requestAnimationFrame(() => {
      this.querySelector('sherpa-menu-item:not([disabled]):not([hidden]):not([type="heading"])')?.focus();
    });
  }

  hide() {
    if (!this.open || this.#hiding) return;
    this.#hiding = true;
    this.removeAttribute('open');
    if (this.hasAttribute('popover')) {
      try { this.hidePopover(); } catch { /* already closed */ }
    }
    this.source?.focus?.();
    this.source = null;
    this.dispatchEvent(new CustomEvent('menu-close', { bubbles: true }));
    this.#hiding = false;
  }

  /* ── Popover light-dismiss ─────────────────────────────────── */

  #onToggle = (e) => {
    // popover="auto" light-dismiss: browser closed us externally
    if (e.newState === 'closed' && this.open && !this.#hiding) {
      this.hide();
    }
  };
}

customElements.define('sherpa-menu', AuxMenu);

export default AuxMenu;
