/**
 * sherpa-layout-grid — the layout grid, with its grouped positions measured.
 *
 * The tracks are CSS (`.sherpa-grid`, projected from Figma). This file supplies
 * only each child's `data-group`, which `data-grouped` cannot work out in CSS.
 *
 * Fires: layout-change — a child was resized from a gutter. detail: { layout }
 */
import { SherpaElement } from '../../core/ui/sherpa-element.js';
import { resizeByEdge } from '../../core/ui/edge-resize.js';
import { measureGroupedGrid, watchGrid } from './grouped-grid.js';
import {
  gridHandles, handleValues, moveHandle, readGrid, readLayout, writeLayout,
  type GridHandle, type GridLayout, type GridModel,
} from './grid-resize.js';

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

  /**
   * The layout dragged into it: each child's counted spans, per column count.
   * SET puts one back — or none, the authored layout — silently.
   * TRAP T-a-dragged-layout-is-kept-per-column-count
   */
  get layout(): GridLayout {
    return readLayout(this);
  }

  set layout(next: GridLayout | null) {
    writeLayout(this, next);
  }

  /** The handle keys last stamped. */
  #keys = '';

  /** The gesture in hand, planned from the grid as it was when it began. */
  #gesture: { model: GridModel; handle: GridHandle; start: number; pitch: number; before: string } | null = null;

  /** A handle as the grid is drawn now. */
  #now(key: string): { model: GridModel; handle: GridHandle; pitch: number } | null {
    const model = readGrid(this);
    const handle = model && gridHandles(model).find((h) => h.key === key);
    return model && handle ? { model, handle, pitch: handle.axis === 'x' ? model.pitchX : model.pitchY } : null;
  }

  /** A handle moved: plan it from the gesture's start, write the spans; report on release. */
  #move(key: string, px: number, done: boolean): void {
    if (this.#gesture?.handle.key !== key) {
      const at = this.#now(key);
      if (!at) return;
      const span = at.handle.segs[at.handle.line]!.span;
      this.#gesture = { ...at, start: span * at.pitch, before: JSON.stringify(readLayout(this)) };
    }
    const g = this.#gesture!;
    moveHandle(g.model, g.handle, Math.round((px - g.start) / g.pitch));
    if (!done) return;
    this.#gesture = null;
    const layout = readLayout(this);
    if (JSON.stringify(layout) !== g.before) this.emit('layout-change', { layout });
    // Re-stamped once the handle is let go. TRAP T-a-handle-is-never-restamped-mid-drag
    requestAnimationFrame(() => this.#drawHandles());
  }

  /** Wire one handle: it looks its line up by key, as a handle moves in place. */
  #wire(node: HTMLElement, h: GridHandle): void {
    const key = h.key;
    const span = (): { now: number; min: number; max: number; pitch: number } | null => {
      const at = this.#now(key);
      if (!at) return null;
      const told = handleValues(at.handle, at.model.count);
      return { ...told, pitch: at.pitch };
    };
    resizeByEdge(node, {
      axis: h.axis,
      grows: 1,
      step: () => span()?.pitch ?? 0,
      measure: () => { const s = span(); return s ? s.now * s.pitch : 0; },
      min: () => { const s = span(); return s ? s.min * s.pitch : 0; },
      max: () => { const s = span(); return s ? s.max * s.pitch : 0; },
      describe: () => { const at = this.#now(key); return at ? handleValues(at.handle, at.model.count) : { now: 0 }; },
      apply: (px, done) => this.#move(key, px, done),
      signal: this.signal,
    });
  }
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
      this.renderItems('.handles', 'template.handle-tpl', handles, {
        after: (node, h) => {
          place(node, h);
          this.#wire(node, h);
        },
      });
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
