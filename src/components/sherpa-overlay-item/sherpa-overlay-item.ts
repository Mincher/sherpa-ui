/**
 * sherpa-overlay-item — a menu option row for floating menus / overlays.
 *
 * The host is the interactive menu item: a leading icon (data-icon), a label
 * (data-label), and an optional trailing shortcut (data-shortcut) or slotted
 * trailing content. A checkable item (data-checked) shows a leading check mark
 * and toggles on activation. All presentation is CSS off data-*; JS writes the
 * text fields, keeps ARIA in sync, and emits the select event.
 *
 * Public API:
 *   data-icon      leading icon glyph
 *   data-label     option label text
 *   data-shortcut  trailing shortcut hint text
 *   data-checked   checked / selected state
 *   data-active    highlighted (keyboard-focused) row
 *   data-variant   "danger" for destructive treatment
 *   disabled       disabled state
 *
 * @fires overlay-item-select — detail: { label, checked }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaOverlayItem extends SherpaElement {
  static override css = new URL('./sherpa-overlay-item.css', import.meta.url);
  static override html = new URL('./sherpa-overlay-item.html', import.meta.url);
  static override observed = ['data-icon', 'data-label', 'data-shortcut', 'data-checked', 'disabled'];

  override onRender(): void {
    this.#sync();
    if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '-1');
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get checked(): boolean {
    return this.hasAttribute('data-checked');
  }
  set checked(v: boolean) {
    this.toggleAttribute('data-checked', v);
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #sync(): void {
    const icon = this.$('.icon');
    if (icon) icon.textContent = this.dataset['icon'] ?? '';

    const label = this.$('.label');
    if (label) label.textContent = this.dataset['label'] ?? '';

    const shortcut = this.$('.shortcut');
    if (shortcut) shortcut.textContent = this.dataset['shortcut'] ?? '';

    // ARIA: a checkable item is a menuitemcheckbox, otherwise a plain menuitem.
    const checkable = this.hasAttribute('data-checked') || this.dataset['checkable'] !== undefined;
    this.setAttribute('role', checkable ? 'menuitemcheckbox' : 'menuitem');
    if (checkable) this.setAttribute('aria-checked', String(this.checked));
    else this.removeAttribute('aria-checked');
    this.setAttribute('aria-disabled', String(this.hasAttribute('disabled')));
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.hasAttribute('disabled')) return;
    if (this.dataset['checkable'] !== undefined) this.checked = !this.checked;
    this.emit('overlay-item-select', {
      label: this.dataset['label'] ?? '',
      checked: this.checked,
    });
  }

  #onClick = (): void => {
    this.#activate();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter' && event.key !== ' ') return;
    if (this.hasAttribute('disabled')) return;
    event.preventDefault();
    this.#activate();
  };
}

customElements.define('sherpa-overlay-item', SherpaOverlayItem);
