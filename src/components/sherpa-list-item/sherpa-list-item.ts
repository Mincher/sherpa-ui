/**
 * sherpa-list-item — a single row inside a sherpa-list.
 *
 * Rebuilt to match the Figma "Menu List Item": a leading region (drag handle,
 * expand toggle, selection control, icon), a content column (title +
 * description), and a trailing slot. Each leading affordance is CSS-toggled off
 * a data-* flag; JS writes the text/icon, reflects expand/select state, handles
 * the interactive click/keyboard behaviour, and emits the affordance events.
 *
 * When data-interactive is set the row is focusable; clicking (or Enter/Space)
 * marks it active and emits list-item-click.
 *
 * Public API:
 *   data-title / data-description   text
 *   data-icon                       leading icon glyph
 *   data-active                     active/selected visual state
 *   data-interactive                enable hover + click behaviour
 *   data-draggable / data-expandable / data-expanded
 *   data-selectable / data-selected
 *   disabled                        disabled state
 *
 * @fires list-item-click  — detail: { title }
 * @fires list-item-expand — detail: { expanded }
 * @fires list-item-select — detail: { selected }
 * @fires list-item-drag   — detail: {}
 */
import { SherpaElement } from '../../core/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override observed = ['data-title', 'data-description', 'data-icon', 'data-interactive', 'data-expanded'];

  override onRender(): void {
    this.#syncTitle();
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
    if (name === 'data-title') this.#syncTitle();
    else if (name === 'data-description') this.#syncDescription();
    else if (name === 'data-icon') this.#syncIcon();
    else if (name === 'data-interactive') this.#syncInteractive();
    else if (name === 'data-expanded') this.#syncExpanded();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get active(): boolean { return this.hasAttribute('data-active'); }
  set active(v: boolean) { this.toggleAttribute('data-active', v); }

  get selected(): boolean { return this.hasAttribute('data-selected'); }
  set selected(v: boolean) { this.toggleAttribute('data-selected', v); }

  /* ── Sync ─────────────────────────────────────────────────────── */

  #syncTitle(): void {
    const el = this.$('.title');
    if (el) el.textContent = this.dataset['title'] ?? '';
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
    this.active = true;
    this.emit('list-item-click', { title: this.dataset['title'] ?? '' });
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
    this.emit('list-item-expand', { expanded });
  };

  #onSelect = (event: Event): void => {
    event.stopPropagation();
    if (this.hasAttribute('disabled')) return;
    const selected = !this.selected;
    this.selected = selected;
    this.emit('list-item-select', { selected });
  };

  #onDrag = (): void => { this.emit('list-item-drag', {}); };
}

customElements.define('sherpa-list-item', SherpaListItem);
