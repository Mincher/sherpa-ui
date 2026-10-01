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
import { moveLine } from './grid-lines.js';

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
    // Re-stamped, so the handles are wired to THIS connection. TRAP T-abort-controller-per-connect
    this.#keys = '';
    this.#gesture = null;
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

  /** The handles' own listeners: let go with each re-stamp, not held by the grid's. */
  #stamp = new AbortController();

  /** The gesture in hand, planned from the grid as it was when it began — and what it found. */
  #gesture: {
    model: GridModel; handle: GridHandle; start: number; pitch: number; before: string;
    kept: Map<HTMLElement, [string, string][]>; rowCount: string;
  } | null = null;

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
      const counted = (k: HTMLElement): [string, string][] => k.getAttributeNames()
        .filter((n) => /^data-(col|row)-span-\d+$/.test(n)).map((n) => [n, k.getAttribute(n) ?? '']);
      this.#gesture = {
        ...at, start: handleValues(at.handle, at.model.count).now * at.pitch,
        before: JSON.stringify(readLayout(this)),
        kept: new Map(at.model.bands.flatMap((b) => b.kids).map((k) => [k, counted(k)])),
        rowCount: this.style.getPropertyValue('--_row-count'),
      };
    }
    const g = this.#gesture!;
    const steps = Math.round((px - g.start) / g.pitch);
    moveHandle(g.model, g.handle, steps);
    if (!done) return;
    this.#gesture = null;
    // Let go where it began: what it found is put back, and nothing is reported.
    if (moveLine(g.handle.segs, g.handle.line, steps).every((n, i) => n === g.handle.segs[i]!.span)) {
      for (const [kid, attrs] of g.kept) {
        for (const n of kid.getAttributeNames()) if (/^data-(col|row)-span-\d+$/.test(n)) kid.removeAttribute(n);
        for (const [n, v] of attrs) kid.setAttribute(n, v);
      }
      if (g.rowCount) this.style.setProperty('--_row-count', g.rowCount);
      else this.style.removeProperty('--_row-count');
    }
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
      // Gone mid-gesture: it says what it last said.
      describe: () => { const at = this.#now(key); return at ? handleValues(at.handle, at.model.count) : null; },
      apply: (px, done) => this.#move(key, px, done),
      signal: this.#stamp.signal,
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
      const held = this.shadowRoot?.activeElement as HTMLElement | null;
      const focused = held?.dataset['key'];
      const was = held?.getBoundingClientRect();
      this.#stamp.abort();
      this.#stamp = new AbortController();
      this.renderItems('.handles', 'template.handle-tpl', handles, {
        after: (node, h) => {
          place(node, h);
          this.#wire(node, h);
        },
      });
      this.#keys = keys;
      if (!focused || !was) return;
      // Its own handle, else the nearest one the same way: focus never falls to the page.
      const nodes = this.$$<HTMLElement>(`.handle[aria-orientation="${held!.getAttribute('aria-orientation')}"]`);
      const by = (n: HTMLElement): number => {
        const r = n.getBoundingClientRect();
        return Math.hypot(r.x - was.x, r.y - was.y);
      };
      (this.$<HTMLElement>(`.handle[data-key="${CSS.escape(focused)}"]`)
        ?? nodes.sort((a, b) => by(a) - by(b))[0])?.focus();
      return;
    }
    for (const h of handles) {
      const node = this.$<HTMLElement>(`.handle[data-key="${CSS.escape(h.key)}"]`);
      if (node) place(node, h);
    }
  }
}

customElements.define('sherpa-layout-grid', SherpaLayoutGrid);
