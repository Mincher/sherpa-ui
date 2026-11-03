/**
 * grid-widths.ts — a grid's column widths: each column's `<col>`, the frozen
 * offset and the slack a wide card shares, from one layout read, and a heading's
 * resize grip. A module of sherpa-data-grid, not an element.
 * TRAP T-col-width-not-inline-size · TRAP T-grid-pin-offset-is-measured
 *
 * Map:
 * - WidthsHost — What the widths ask of their grid.
 * - GridWidths — Each column's drawn width, measured once per change, and the drag that sets one.
 * - .measure — The frozen offset and the column widths, from ONE layout read, when what it reads moved.
 * - .stamp — One `<col>` per shown column, stamped again only when they change.
 * - .grip — A resize grip grabbed: the drag starts.
 * - .swallowed — Is this the click a finished drag synthesised? Eaten, once.
 */
import { clampNum } from '../../core/ui/sherpa-element.js';
import type { GridColumn } from './sherpa-data-grid.js';
import type { GridHost } from './grid-host.js';

/** What the widths ask of their grid. */
export interface WidthsHost extends GridHost {
  /** A column's width when nothing says one. */
  readonly fallback: number;
  /** The columns it draws, in order. */
  shown(): GridColumn[];
  /** Does it hold rows, and offer actions? Each moves an edge. */
  hasRows(): boolean;
  hasActions(): boolean;
  /** Stamp the `<col>`s from its template, keeping its own fixed ones. */
  stampCols(shown: readonly GridColumn[], after: (col: HTMLElement, column: GridColumn) => void): void;
  /** A drag ended at this width: the grid reports it. */
  resized(field: string, width: number | undefined): void;
}

/** Each column's drawn width, measured once per change, and the drag that sets one. */
export class GridWidths {
  /** Its grid. */
  readonly #host: WidthsHost;
  /** A column's narrowest and widest, in px: `.col-bounds` sets them in `ch`. Will, TODO 575 */
  #bounds = { min: 96, max: 440 };
  /** Have the bounds been read off CSS? */
  #boundsRead = false;
  /** Widths the USER has dragged, keyed by field. Survive a re-populate. */
  #dragged = new Map<string, number>();
  /** What the widths and offset were last measured for. */
  #measuredFor = '';
  /** The shown columns the `<col>`s were last stamped for. */
  #colsFor = '';
  /** A drag in flight — one object, so a stray pointermove has one thing to test. */
  #drag: { field: string; startX: number; startWidth: number } | null = null;
  /** Eat exactly one click — the one a finished resize drag synthesises. */
  #swallow = false;

  constructor(host: WidthsHost) {
    this.#host = host;
  }

  /**
   * The frozen offset and the column widths, from ONE layout read — and only
   * when what it reads moved: the columns, their widths, the select column, the
   * actions. `force`: the box was resized, or a column dragged. A card WIDER
   * than its columns gives the slack to the columns the reader has not dragged,
   * in proportion; narrower, each keeps its own width and the box scrolls.
   * Will, TODO 96 (A). TODO 355 C4. TRAP T-a-grid-draws-once-per-moment
   */
  measure(force = false): void {
    const host = this.#host;
    const box = host.$('.scroller');
    if (!box) return;
    // Read when its box resized — a font or a density moved — never per draw: it forces a style pass.
    if (force || !this.#boundsRead) this.#readBounds();
    const selectable = host.el.hasAttribute('data-selectable');
    const shown = host.shown();
    const base = shown.map((col) => this.#widthFor(col));
    const key = JSON.stringify([shown.map((c) => c.field), base, [...this.#dragged], selectable,
      host.hasRows(), host.hasActions(), this.#bounds.max]);
    if (!force && key === this.#measuredFor) return;
    // READ, all at once. TRAP T-grid-pin-offset-needs-subpixel — offsetWidth rounds the
    // 0.5px-bordered 32px cell and leaves a hairline under the pin.
    const probe = host.$('.head-row > .select-cell');
    const offset = selectable && probe ? probe.getBoundingClientRect().width : 0;
    const edges = host.$$('.head-row > .select-cell, .head-row > .actions-cell')
      .reduce((sum, cell) => sum + cell.getBoundingClientRect().width, 0);
    const room = box.clientWidth;
    const head = host.$('.head')?.getBoundingClientRect().height ?? 0;
    // …then WRITE.
    host.el.style.setProperty('--_pin-offset', `${offset}px`);
    // The header's foot: where the shadow over the scrolled rows hangs. TRAP T-a-stuck-header-casts-a-shadow
    host.el.style.setProperty('--_head-h', `${head}px`);
    const free = shown.map((col) => !this.#dragged.has(col.field));
    const share = base.reduce((sum, w, i) => sum + (free[i] ? w : 0), 0);
    const slack = room - edges - base.reduce((sum, w) => sum + w, 0);
    const widths = shown.map((col, i) => {
      const el = host.$<HTMLElement>(`.cols > .col[data-field="${CSS.escape(col.field)}"]`);
      const grow = slack > 0 && free[i] && share > 0 ? Math.floor((slack * base[i]!) / share) : 0;
      // A share of a wide card stops at the maximum: the room left stays empty. Will, TODO 575
      const width = Math.min(base[i]! + grow, this.#bounds.max);
      if (el) el.style.width = `${width}px`;
      return width;
    });
    // A sideways scroll's start edge sits past the pinned columns. TRAP T-a-sideways-scroll-shadow-is-its-frames
    host.el.style.setProperty('--_scroll-inset-start', `${offset + (widths[0] ?? 0)}px`);
    // Drawn while hidden, it measured nothing: it measures again when shown.
    this.#measuredFor = !room || (selectable && !offset) ? '' : key;
  }

  /** Drawn width: a dragged width wins, then the config, then the default. */
  #widthFor(col: GridColumn): number {
    return this.#clamp(this.#dragged.get(col.field) ?? col.width ?? this.#host.fallback);
  }

  /** A column width held between the minimum and the maximum. */
  #clamp(n: number): number {
    if (!Number.isFinite(n)) return this.#host.fallback;
    return clampNum(Math.round(n), this.#bounds);
  }

  /** The bounds, read off `.col-bounds` as px: CSS owns them, in `ch`. */
  #readBounds(): void {
    const probe = this.#host.$('.col-bounds');
    if (!probe) return;
    const { minInlineSize, maxInlineSize } = getComputedStyle(probe);
    const min = parseFloat(minInlineSize);
    const max = parseFloat(maxInlineSize);
    this.#boundsRead = min > 0 && max > 0;
    this.#bounds = { min: min || this.#bounds.min, max: max || this.#bounds.max };
  }

  /** Stamp one `<col>` per shown column — BEFORE the header cells are rebuilt. The
   *  same columns keep theirs, and the widths `measure` shared out. */
  stamp(): void {
    const shown = this.#host.shown();
    const key = JSON.stringify(shown.map((c) => [c.field, this.#widthFor(c)]));
    if (key === this.#colsFor && this.#host.$('.cols > .col')) return;
    this.#colsFor = key;
    this.#measuredFor = '';
    // TRAP T-col-width-not-inline-size — `width`, never `inline-size`.
    this.#host.stampCols(shown, (el, col) => { el.style.width = `${this.#widthFor(col)}px`; });
  }

  /** A resize grip was grabbed: the drag starts. TRAP T-grid-grip-captures-the-pointer —
   *  neither default nor propagation stops the synthetic click (the end does); capture
   *  holds a fast drag. */
  grip = (event: PointerEvent): void => {
    const grip = (event.target as HTMLElement | null)?.closest?.<HTMLElement>('.resize-grip');
    const th = grip?.closest<HTMLElement>('.head-cell');
    const field = th?.dataset['field'];
    if (!grip || !th || !field) return;
    event.preventDefault();
    event.stopPropagation();
    this.#drag = { field, startX: event.clientX, startWidth: th.getBoundingClientRect().width };
    this.#host.toggleState('resizing', true);
    grip.setPointerCapture(event.pointerId);
    grip.addEventListener('pointermove', this.#move);
    grip.addEventListener('pointerup', this.#up, { once: true });
    grip.addEventListener('pointercancel', this.#up, { once: true });
  };

  /** Dragging a grip: the COLGROUP only, sized live — a render per pointermove
   *  rebuilds the body 60x/s. The columns not dragged re-share what is left. */
  #move = (event: PointerEvent): void => {
    if (!this.#drag) return;
    const { field, startX, startWidth } = this.#drag;
    this.#dragged.set(field, this.#clamp(startWidth + (event.clientX - startX)));
    this.measure(true);
  };

  /** The grip was let go: the width kept, and reported. TRAP T-swallow-flag-not-listener —
   *  the click the browser synthesises on this pointerup is eaten by a FLAG, never a
   *  rival listener. */
  #up = (event: PointerEvent): void => {
    const drag = this.#drag;
    this.#drag = null;
    this.#host.toggleState('resizing', false);
    this.#swallow = true;
    this.#host.$('.head-row')?.addEventListener('click', () => { this.#swallow = false; }, { capture: false, once: true });
    (event.target as HTMLElement | null)?.removeEventListener?.('pointermove', this.#move);
    if (!drag) return;
    // The frozen column's offset is MEASURED, so a resize moves the later pins.
    this.measure(true);
    this.#host.resized(drag.field, this.#dragged.get(drag.field));
  };

  /** Is this the click a finished drag synthesised? Eaten, once. */
  swallowed(event: Event): boolean {
    if (!this.#swallow) return false;
    this.#swallow = false;
    event.stopPropagation();
    event.preventDefault();
    return true;
  }
}
