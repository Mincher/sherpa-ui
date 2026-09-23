/**
 * sherpa-layout-grid — the layout grid, with its row count measured for it.
 *
 * The tracks are CSS (`.sherpa-grid`, projected from Figma). This file supplies
 * only `--_fit-rows`, which `data-rows="fit"` cannot work out in CSS, and binds
 * it for the lifetime of the element.
 *
 * Fires: nothing — a grid has no interactions of its own.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { bindFitGrid } from './fit-grid.js';

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
      values: ['1', '2', '3', '4', '5', '6', '8', '10', '12'],
    },
    'data-rows': { type: 'enum', kind: 'style', values: ['fit', 'fixed'] },
    /**
     * Every container reads as ONE stitched object: no gutters, and only the
     * four outer corners round. The JS writes each child's `data-group` from
     * its LAID-OUT position, because a wrapping span hides its own row.
     * TRAP T-a-wrapping-span-hides-its-own-row
     */
    'data-grouped': { type: 'boolean', kind: 'style' },
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
    // The one number CSS cannot work out. TRAP T-a-fit-grid-needs-its-row-count
    bindFitGrid(this, { signal: this.signal });
  }
}

customElements.define('sherpa-layout-grid', SherpaLayoutGrid);
