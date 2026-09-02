/**
 * sherpa-list-item — one row inside a sherpa-list.
 *
 * From left to right: a leading area (drag handle, expand toggle, checkbox or
 * radio, icon), then a heading and description, then a trailing slot. Each leading
 * bit is turned on with a data-* flag and shown by CSS. JS writes the text and
 * icon, keeps the expand and select states in sync, handles clicks and keyboard,
 * and fires the matching events.
 *
 * Set data-interactive to make the row clickable: clicking it (or pressing Enter
 * or Space) marks it the current row and fires item-click.
 *
 * Public API:
 *   data-heading / data-description text
 *   data-icon                       leading icon glyph
 *   data-current                    current-row visual state
 *   data-interactive                enable hover + click behaviour
 *   data-draggable / data-expandable / data-expanded
 *   data-selectable / data-selected
 *   disabled                        disabled state
 *
 * @tier sub-component
 * @fires item-click  — detail: { heading }
 * @fires item-expand — detail: { expanded }
 * @fires item-select — detail: { selected }
 * @fires item-drag   — detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override tier = 'sub-component' as const;
  static override observed = ['data-heading', 'data-description', 'data-icon', 'data-interactive', 'data-expanded'];

  override onRender(): void {
    this.#syncHeading();
    this.#syncDescription();
    this.#syncIcon();
    this.#syncInteractive();
    this.#syncExpanded();
    this.addEventListener('click', this.#onClick);
    this.addEventListener('keydown', this.#onKeyDown);
    this.$('.expand')?.addEventListener('click', this.#onExpand);
    this.$('.control')?.addEventListener('click', this.#onSelect);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    if (name === 'data-heading') this.#syncHeading();
    else if (name === 'data-description') this.#syncDescription();
    else if (name === 'data-icon') this.#syncIcon();
    else if (name === 'data-interactive') this.#syncInteractive();
    else if (name === 'data-expanded') this.#syncExpanded();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get current(): boolean { return this.hasAttribute('data-current'); }
  set current(v: boolean) { this.toggleAttribute('data-current', v); }

  get selected(): boolean { return this.hasAttribute('data-selected'); }
  set selected(v: boolean) { this.toggleAttribute('data-selected', v); }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncHeading(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['heading'] ?? '';
  }

  #syncDescription(): void {
    const el = this.$('.description');
    if (el) el.textContent = this.dataset['description'] ?? '';
  }

  #syncIcon(): void {
    const el = this.$('.icon');
    if (el) el.textContent = this.dataset['icon'] ?? '';
  }

  /** Interactive rows are keyboard-reachable; non-interactive ones are not. */
  #syncInteractive(): void {
    if (this.dataset['interactive'] !== undefined) {
      if (!this.hasAttribute('tabindex')) this.setAttribute('tabindex', '0');
    } else {
      this.removeAttribute('tabindex');
    }
  }

  #syncExpanded(): void {
    this.$('.expand')?.setAttribute('aria-expanded', String(this.hasAttribute('data-expanded')));
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
    this.current = true;
    this.emit('item-click', { heading: this.dataset['heading'] ?? '' });
  }

  #onClick = (event: Event): void => {
    // A click on a leading affordance handles itself; don't also activate the row.
    const path = event.composedPath();
    if (path.some((n) => n instanceof HTMLElement && (n.classList.contains('expand') || n.classList.contains('control') || n.classList.contains('drag')))) {
      return;
    }
    this.#activate();
  };

  #onKeyDown = (event: KeyboardEvent): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
      event.preventDefault();
      this.#activate();
    }
  };

  #onExpand = (event: Event): void => {
    event.stopPropagation();
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  };

  #onSelect = (event: Event): void => {
    event.stopPropagation();
    if (this.hasAttribute('disabled')) return;
    const selected = !this.selected;
    this.selected = selected;
    this.emit('item-select', { selected });
  };

  #onDrag = (): void => { this.emit('item-drag', {}); };
}

customElements.define('sherpa-list-item', SherpaListItem);
