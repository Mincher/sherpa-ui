/**
 * sherpa-group — a row, column or grid of controls that reads as ONE object.
 *
 * CSS derives every position. This file only turns `data-col-count` into the
 * private `--_cols` the grid maths reads, because a count has to be a number
 * and an attribute is a string.
 *
 * Fires: nothing — a group has no interactions of its own.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';

/** The column counts the layout grid offers, so the two agree. */
const COL_COUNTS = ['2', '3', '4', '5', '6', '8', '10', '12'] as const;

export class SherpaGroup extends SherpaElement {
  static override css = new URL('./sherpa-group.css', import.meta.url);
  static override html = new URL('./sherpa-group.html', import.meta.url);
  static override props = {
    'data-direction': { type: 'enum', kind: 'style', values: ['row', 'column', 'grid'] },
    'data-col-count': { type: 'enum', kind: 'style', values: [...COL_COUNTS] },
  } as const;

  override onRender(): void {
    this.#syncCols();
  }

  override onChange(name: string): void {
    if (name === 'data-col-count') this.#syncCols();
  }

  /** `data-col-count="4"` → `--_cols: 4`, which the grid maths divides by. */
  #syncCols(): void {
    const count = this.dataset['colCount'];
    if (count && (COL_COUNTS as readonly string[]).includes(count)) {
      this.style.setProperty('--_cols', count);
    } else {
      this.style.removeProperty('--_cols');
    }
  }
}

customElements.define('sherpa-group', SherpaGroup);
