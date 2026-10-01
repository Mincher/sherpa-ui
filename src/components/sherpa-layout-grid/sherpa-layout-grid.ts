/**
 * sherpa-layout-grid — the layout grid, with its grouped positions measured.
 *
 * The tracks are CSS (`.sherpa-grid`, projected from Figma). This file supplies
 * only each child's `data-group`, which `data-grouped` cannot work out in CSS.
 *
 * Fires: nothing — a grid has no interactions of its own.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { measureGroupedGrid, watchGrid } from './grouped-grid.js';
import { gridHandles, handleValues, readGrid, type GridHandle } from './grid-resize.js';

export class SherpaLayoutGrid extends SherpaElement {
  static override css = new URL('./sherpa-layout-grid.css', import.meta.url);
  static override html = new URL('./sherpa-layout-grid.html', import.meta.url);
  static override props = {
    'data-col-count': {
      type: 'enum', kind: 'style',
      values: ['1', '2', '3', '4', '5', '6', '8', '10', '12'],
    },
    'data-row-count': {
      type: 'enum', kind: 'style',
      values: ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12'],
    },
    'data-rows': { type: 'enum', kind: 'style', values: ['fit', 'fixed'] },
    /**
     * Every container reads as ONE stitched object: no gutters, and only the
     * four outer corners round. The JS writes each child's `data-group` from
     * its LAID-OUT position, because a wrapping span hides its own row.
     * TRAP T-a-wrapping-span-hides-its-own-row
     */
    'data-grouped': { type: 'boolean', kind: 'style' },
    /** A handle in each gutter resizes the children. TRAP T-a-gutter-moves-a-line */
    'data-resizable': { type: 'boolean', kind: 'visibility' },
  } as const;

  override onRender(): void {
    /* The host WEARS the document class, so every projected rule — the tracks,
       the gaps, the named spans on its children — applies with no copy here.
       TRAP T-a-document-class-cannot-reach-a-shadow-root */
    this.classList.add('sherpa-grid');
  }

  /* onConnect, NOT onRender: `signal` is a fresh AbortController on every
     re-connect, and onRender fires once. Bound in onRender, a grid that a
     router detaches and re-attaches kept a signal already aborted and silently
     stopped re-measuring. TRAP T-abort-controller-per-connect */
  override onConnect(): void {
    // TRAP T-a-wrapping-span-hides-its-own-row
    const layout = (): void => {
      measureGroupedGrid(this);
      this.#drawHandles();
    };
    layout();
    watchGrid(this, layout, { signal: this.signal });
  }

  /** The handle keys last stamped. */
  #keys = '';
  /** Children with no id are named once per grid. */
  #warned = false;

  /**
   * Draw the gutter handles. A changed set is re-stamped — never while one is
   * held, as that ends the drag; the rest move in place.
   * TRAP T-a-handle-is-never-restamped-mid-drag
   */
  #drawHandles(): void {
    const model = readGrid(this);
    if (model?.missing.length && !this.#warned) {
      this.#warned = true;
      console.warn('[sherpa-layout-grid] data-resizable needs an id on every child; these have none:', model.missing);
    }
    const handles = model ? gridHandles(model) : [];
    const keys = handles.map((h) => h.key).join(' ');
    const place = (node: HTMLElement, h: GridHandle): void => {
      for (const [k, v] of [['--_x', h.x], ['--_y', h.y], ['--_w', h.w], ['--_h', h.h]] as const) {
        node.style.setProperty(k, `${v}px`);
      }
      const told = handleValues(h, model!.count);
      node.setAttribute('aria-valuenow', String(told.now));
      node.setAttribute('aria-valuemin', String(told.min));
      node.setAttribute('aria-valuemax', String(told.max));
      node.setAttribute('aria-valuetext', told.text);
    };
    if (keys !== this.#keys && !this.$('.handle[data-dragging]')) {
      const focused = (this.shadowRoot?.activeElement as HTMLElement | null)?.dataset['key'];
      this.renderItems('.handles', 'template.handle-tpl', handles, { after: place });
      this.#keys = keys;
      if (focused) this.$<HTMLElement>(`.handle[data-key="${CSS.escape(focused)}"]`)?.focus();
      return;
    }
    for (const h of handles) {
      const node = this.$<HTMLElement>(`.handle[data-key="${CSS.escape(h.key)}"]`);
      if (node) place(node, h);
    }
  }
}

customElements.define('sherpa-layout-grid', SherpaLayoutGrid);
