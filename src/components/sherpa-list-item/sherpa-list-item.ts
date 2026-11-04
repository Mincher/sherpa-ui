/**
 * sherpa-list-item — one row inside a sherpa-list.
 *
 * Each leading affordance is turned on with a data-* flag and shown by CSS.
 *
 * Public API:
 *   data-label / data-description   text
 *   data-icon                       leading icon glyph
 *   data-current                    current-row visual state
 *   data-interactive                enable hover + click behaviour
 *   data-draggable / data-expandable / data-expanded
 *   data-selectable / data-selected
 *   disabled                        disabled state
 *
 * @tier sub-component
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';

export class SherpaListItem extends SherpaElement {
  static override css = new URL('./sherpa-list-item.css', import.meta.url);
  static override html = new URL('./sherpa-list-item.html', import.meta.url);
  static override props = {
    'data-draggable': { type: 'boolean', kind: 'style' },
    'data-expandable': { type: 'boolean', kind: 'style' },
    'data-interactive': { type: 'boolean', kind: 'style' },
    'data-selectable': { type: 'boolean', kind: 'style' },
    'data-label': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-icon': { type: 'string', kind: 'content' },
    /* Current-row state. Written by the row AND set by a host. */
    'data-current': { type: 'boolean', kind: 'style', accessor: 'current' },
    'data-expanded': { type: 'boolean', kind: 'style' },
    'data-selected': { type: 'boolean', kind: 'style', accessor: 'selected' },
  } as const;

  /** Installed by `define()` from the props' `accessor`. */
  declare current: boolean;
  declare selected: boolean;

  /** The event label. */
  #labelText(): string { return this.dataset['label'] ?? ''; }

  override onRender(): void {
    this.#syncSelected();
    this.addEventListener('click', this.#onClick);
    this.$('.expand')?.addEventListener('click', this.#onExpand);
    this.$('.checkbox')?.addEventListener('change', this.#onSelect);
    this.$('.drag')?.addEventListener('pointerdown', this.#onDrag);
  }

  override onChange(name: string): void {
    // Not a textContent write, so the declared props cannot do it.
    if (name === 'data-selected') this.#syncSelected();
  }

  /* ── Sync ─────────────────────────────────────────────────────── */

  /** Mirror data-selected onto the native checkbox. */
  #syncSelected(): void {
    const box = this.$<HTMLInputElement>('.checkbox');
    if (box) box.checked = this.hasAttribute('data-selected');
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  /** Make an interactive row current and report it. */
  #activate(): void {
    if (this.dataset['interactive'] === undefined || this.hasAttribute('disabled')) return;
    this.current = true;
    this.emit('item-select', { label: this.#labelText() });
  }

  /** A click on the row — unless it landed on its expand, select or drag control. */
  #onClick = (event: Event): void => {
    // A leading affordance handles its own click; don't also activate the row.
    if (this.pathFind(event, '.expand, .control, .drag')) return;
    this.#activate();
  };

  /** Expand or collapse the row. */
  #onExpand = (event: Event): void => {
    event.stopPropagation();
    const expanded = !this.hasAttribute('data-expanded');
    this.set('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  };

  /** Tick or untick the row. */
  #onSelect = (event: Event): void => {
    event.stopPropagation();
    if (this.hasAttribute('disabled')) return;
    const selected = (event.target as HTMLInputElement).checked;
    this.selected = selected;
    this.emit('selection-change', { selected });
  };

  /** The drag handle was grabbed. */
  #onDrag = (): void => { this.emit('item-drag'); };
}

define('sherpa-list-item', SherpaListItem);
