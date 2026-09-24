/**
 * sherpa-layout-grid — the layout grid, with its grouped positions measured.
 *
 * The tracks are CSS (`.sherpa-grid`, projected from Figma). This file supplies
 * only each child's `data-group`, which `data-grouped` cannot work out in CSS.
 *
 * Fires: nothing — a grid has no interactions of its own.
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { bindGroupedGrid } from './grouped-grid.js';

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
    // TRAP T-a-wrapping-span-hides-its-own-row
    bindGroupedGrid(this, { signal: this.signal });
  }
}

customElements.define('sherpa-layout-grid', SherpaLayoutGrid);
