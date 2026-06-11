/**
 * @element sherpa-list-item
 * @category content
 * @description An individual row inside a sherpa-list with leading (icon/avatar), content
 *   (label and description), and trailing (action buttons) areas. Add data-interactive to
 *   enable hover styling and a list-item-click event. Use data-draggable to show a drag handle
 *   for reorderable lists. For navigation items inside sherpa-nav, use sherpa-nav-item instead.
 *
 * @attr {string}  data-label       — Primary text
 * @attr {string}  data-description — Secondary helper text
 * @attr {string}  data-icon        — FontAwesome class for leading icon
 * @attr {boolean} data-active      — Active/selected visual state
 * @attr {boolean} data-interactive — Enables hover/click behaviour
 * @attr {boolean} data-draggable   — Shows drag handle
 * @attr {boolean} disabled         — Disabled state
 *
 * @slot leading  — Custom leading content (avatar, icon override)
 * @slot (default) — Custom content below label/description
 * @slot trailing — Trailing action buttons or badges
 *
 * @fires list-item-click
 *   bubbles: true, composed: true
 *   detail: { label: string }
 *
 * @prop {string}  label       — Getter/setter for data-label
 * @prop {string}  description — Getter/setter for data-description
 * @prop {boolean} active      — Getter/setter for data-active
 */

import { SherpaElement } from '../utilities/sherpa-element/sherpa-element.js';

export class SherpaListItem extends SherpaElement {

  /* ── Config ───────────────────────────────────────────────────── */

  static override get cssUrl(): string  { return new URL('./sherpa-list-item.css', import.meta.url).href; }
  static override get htmlUrl(): string { return new URL('./sherpa-list-item.html', import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-label', 'data-description', 'data-icon', 'data-active', 'data-interactive', 'disabled'];
  }

  /* ── Cached refs ──────────────────────────────────────────────── */

  public els = this.cacheElements({
    label: '.label',
    description: '.description',
    icon: '.icon'
  });

  #bound = false;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  public override onRender(): void {
    if (!this.#bound) {
      this.addEventListener('click', this.#onClick);
      this.addEventListener('keydown', this.#onKeyDown);
      this.#bound = true;
    }

    this.#syncLabel();
    this.#syncDescription();
    this.#syncIcon();

    if (this.dataset["interactive"] !== undefined) {
      this.#updateInteractive();
    }
  }

  override onAttributeChanged(name: string): void {
    switch (name) {
      case 'data-label':       this.#syncLabel(); break;
      case 'data-description': this.#syncDescription(); break;
      case 'data-icon':        this.#syncIcon(); break;
      case 'data-interactive': this.#updateInteractive(); break;
    }
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get label(): string       { return this.dataset["label"] || ''; }
  set label(v: string)      { if (v) { this.dataset["label"] = v; } else { delete this.dataset["label"]; } }

  get description(): string { return this.dataset["description"] || ''; }
  set description(v: string){ if (v) { this.dataset["description"] = v; } else { delete this.dataset["description"]; } }

  get active(): boolean      { return this.hasAttribute('data-active'); }
  set active(v: boolean)     { this.toggleAttribute('data-active', Boolean(v)); }

  /* ── Sync methods ─────────────────────────────────────────────── */

  #syncLabel(): void {
    if (this.els.label) this.els.label.textContent = this.dataset["label"] || '';
  }

  #syncDescription(): void {
    if (this.els.description) this.els.description.textContent = this.dataset["description"] || '';
  }

  #syncIcon(): void {
    if (!this.els.icon) return;
    const icon = (this.dataset["icon"] || '').trim();
    this.els.icon.className = icon ? `icon ${icon}` : 'icon';
  }

  #updateInteractive(): void {
    if (this.dataset["interactive"] !== undefined) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onClick = (): void => {
    if (this.dataset["interactive"] === undefined || this.hasAttribute('disabled')) return;
    this.active = true;
    this.emit('list-item-click', { label: this.label });
  };

  #onKeyDown = (e: KeyboardEvent): void => {
    if (this.dataset["interactive"] === undefined || this.hasAttribute('disabled')) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      this.#onClick();
    }
  };
}

customElements.define('sherpa-list-item', SherpaListItem);
