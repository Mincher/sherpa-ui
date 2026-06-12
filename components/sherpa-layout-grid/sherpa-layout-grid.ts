/**
 * @element sherpa-layout-grid
 * @category shell
 * @description The main 12-column CSS grid that orchestrates a dashboard page layout. Place
 *   inside an app shell's default slot. Slotted sherpa-container tiles declare their span via
 *   data-col-span and data-row-span. Use data-content="static" for non-grid stacked layouts
 *   (forms, settings pages) and data-fill="viewport" to clamp the grid to viewport height.
 *   Dedicated slots for a view header, tab row, side panels, and a full-width banner strip.
 *
 * @attr {string}  data-row-height — CSS length for grid-auto-rows (default: 64px)
 * @attr {enum}    data-content    — "static" — stacks children vertically instead of using the CSS grid
 * @attr {enum}    data-fill       — "viewport" — clamps the layout to the viewport height
 * @attr {boolean} data-pad        — Adds padding inside the content surface
 * @attr {enum}    data-gap        — sm | base | lg — gap between stacked children in static mode
 * @attr {boolean} data-editable   — Enables drag-to-reposition for slotted containers
 *
 * @slot view-header      — Optional sherpa-view-header; grouped with tab-row into a seamless header band
 * @slot tab-row          — Optional sherpa-tabs row displayed below the view-header in the same grouped band
 * @slot banner           — Optional full-width messaging area (alert, notice) rendered above the grid containers
 * @slot side-panel-start — Leading side rail
 * @slot side-panel-end   — Trailing side rail
 * @slot (default)        — Main page content (sherpa-container tiles, filters, tables, charts, and similar content)
 *
 * @fires layout-reorder — Fires after a successful reposition.
 *   bubbles: true, composed: true
 *   detail: { from: number, to: number, order: string[] }  // order is the
 *   list of moved-container ids/keys (data-container-id where present, else index)
 *
 * @cssprop --maxColCount — Integer column count (default 12, registered)
 * @cssprop --row-height  — Row height (default 64px, registered)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaLayoutGrid extends SherpaElement {
  static override get htmlUrl(): string {
    return new URL("./sherpa-layout-grid.html", import.meta.url).href;
  }

  static override get cssUrl(): string {
    return new URL("./sherpa-layout-grid.css", import.meta.url).href;
  }

  static override get sharedStyles(): string[] {
    return [
      ...super.sharedStyles,
      new URL("../../css/styles/sherpa-utility-classes.css", import.meta.url).href,
    ];
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-row-height",
      "data-editable",
    ];
  }

  #dragSource: Element | null = null;
  #autoSpanObserver: ResizeObserver | null = null;

  override onRender(): void {
    this.#syncRowHeight();
    this.#syncEditable();
    this.#initAutoSpan();
  }

  override onAttributeChanged(name: string, _old: string | null, _new: string | null): void {
    if (name === "data-row-height") this.#syncRowHeight();
    if (name === "data-editable") this.#syncEditable();
  }

  override onDisconnect(): void {
    this.removeEventListener('dragstart', this.#onDragStart);
    this.removeEventListener('dragover', this.#onDragOver);
    this.removeEventListener('dragleave', this.#onDragLeave);
    this.removeEventListener('drop', this.#onDrop);
    this.removeEventListener('dragend', this.#onDragEnd);
    this.#autoSpanObserver?.disconnect();
    this.#autoSpanObserver = null;
  }

  #initAutoSpan(): void {
    this.#autoSpanObserver = new ResizeObserver(entries => {
      for (const entry of entries) {
        this.#updateAutoSpan(entry.target as HTMLElement);
      }
    });
    const slot = this.$<HTMLSlotElement>('slot:not([name])');
    slot?.addEventListener('slotchange', () => this.#syncAutoSpanTargets());
    requestAnimationFrame(() => this.#syncAutoSpanTargets());

    // Re-measure after data loads. dataset-filtered is dispatched on this
    // element (it carries data-dataset) with bubbles:false.
    this.addEventListener('dataset-filtered', () => {
      this.#waitAndRemeasure();
    });
    // dataset-filtered often fires before components finish bootstrapping.
    // dispatchDataset() always caches records on ._filtered before the event,
    // so if it's already set we missed the event.  Await the data grid's
    // `rendered` promise so rows are painted before we measure scrollHeight.
    if ((this as unknown as Record<string, unknown>)['_filtered']) {
      this.#waitAndRemeasure();
    }
  }

  /**
   * Wait for each auto-span container's key components (data grid, header)
   * to finish bootstrapping before measuring.  `tc.scrollHeight` is 0 until
   * the data grid's shadow DOM is set up and `onConnect` has called `setData`.
   */
  async #waitAndRemeasure(): Promise<void> {
    interface WithRendered { rendered?: Promise<void> }
    const slot = this.$<HTMLSlotElement>('slot:not([name])');
    for (const el of slot?.assignedElements() ?? []) {
      if (!(el instanceof HTMLElement) || el.dataset['rowSpan'] !== 'auto') continue;
      // Await any data grid and header in the container so their shadow DOMs
      // (and row data via ContentAttributesMixin.onConnect) are ready.
      const waits: Promise<void>[] = [];
      for (const child of el.querySelectorAll('sherpa-data-grid, [slot="header"]')) {
        const r = (child as unknown as WithRendered).rendered;
        if (r) waits.push(r);
      }
      if (waits.length) await Promise.all(waits);
      this.#updateAutoSpan(el);
    }
  }

  #syncAutoSpanTargets(): void {
    const slot = this.$<HTMLSlotElement>('slot:not([name])');
    for (const el of slot?.assignedElements() ?? []) {
      if (el instanceof HTMLElement && el.dataset['rowSpan'] === 'auto') {
        this.#autoSpanObserver?.observe(el);
      }
    }
  }

  #updateAutoSpan(el: HTMLElement): void {
    const surface = this.$<HTMLElement>('.grid-surface');
    if (!surface) return;
    const style = getComputedStyle(surface);
    const rowHeight = parseFloat(style.getPropertyValue('--row-height')) || 64;
    const rowGap = parseFloat(style.rowGap) || 16;
    const rowUnit = rowHeight + rowGap;

    // Measure the element's natural content height.  getBoundingClientRect()
    // reflects the constrained grid span, not the content.  height:max-content
    // doesn't cross scroll-container boundaries — overflow:auto/clip on the
    // card-content or data-grid stops the intrinsic-size walk.  Instead we
    // sum the heights of the non-scrollable chrome (container header) and the
    // scrollHeight of the innermost scroll container (table-container inside
    // sherpa-data-grid), which always reflects the full unclipped row height.
    const contentH = this.#measureNaturalHeight(el);
    const spans = Math.min(8, Math.max(1, Math.ceil((contentH + rowGap) / rowUnit)));
    el.style.setProperty('--_auto-row-span', String(spans));
  }

  #measureNaturalHeight(el: HTMLElement): number {
    // 1. Non-scrollable header chrome (slotted container-header in light DOM).
    const headerSlot = el.querySelector<HTMLElement>('[slot="header"]');
    const headerH = headerSlot?.getBoundingClientRect().height ?? 0;

    // 2. Scrollable body: look for a data grid inside the container's
    //    default slot.  The innermost scroll container (.table-container) holds
    //    all rendered rows and its scrollHeight gives the true content height
    //    even when the element is visually clipped to a small grid span.
    const dataGrid = el.querySelector<HTMLElement>('sherpa-data-grid');
    if (dataGrid?.shadowRoot) {
      const sr = dataGrid.shadowRoot;
      const dgHeader = sr.querySelector<HTMLElement>('.grid-header, .grid-toolbar');
      const tableContainer = sr.querySelector<HTMLElement>('.table-container');
      const pagination = sr.querySelector<HTMLElement>('sherpa-pagination');
      const dgHeaderH = dgHeader?.getBoundingClientRect().height ?? 0;
      const bodyH = tableContainer?.scrollHeight ?? 0;
      const paginationH = pagination?.getBoundingClientRect().height ?? 0;
      return headerH + dgHeaderH + bodyH + paginationH;
    }

    // 3. Fallback for non-data-grid content: height:max-content works for
    //    content without scroll containers (charts, metrics, etc.).
    el.style.setProperty('height', 'max-content', 'important');
    const h = el.getBoundingClientRect().height;
    el.style.removeProperty('height');
    return h;
  }

  #syncRowHeight(): void {
    const surface = this.$<HTMLElement>(".grid-surface");
    if (!surface) return;
    const value = this.dataset["rowHeight"];
    if (value) {
      surface.style.setProperty("--row-height", value);
    } else {
      surface.style.removeProperty("--row-height");
    }
  }

  #syncEditable(): void {
    const editable = this.hasAttribute('data-editable');
    for (const child of this.children) {
      if (child.tagName?.toLowerCase() === 'sherpa-container') {
        if (editable) child.setAttribute('draggable', 'true');
        else child.removeAttribute('draggable');
      }
    }
    if (editable) {
      this.addEventListener('dragstart', this.#onDragStart);
      this.addEventListener('dragover',  this.#onDragOver);
      this.addEventListener('dragleave', this.#onDragLeave);
      this.addEventListener('drop',      this.#onDrop);
      this.addEventListener('dragend',   this.#onDragEnd);
    } else {
      this.removeEventListener('dragstart', this.#onDragStart);
      this.removeEventListener('dragover',  this.#onDragOver);
      this.removeEventListener('dragleave', this.#onDragLeave);
      this.removeEventListener('drop',      this.#onDrop);
      this.removeEventListener('dragend',   this.#onDragEnd);
    }
  }

  #containerFor(target: EventTarget | null): Element | null {
    return (target as Element | null)?.closest?.('sherpa-container') ?? null;
  }

  #onDragStart = (e: DragEvent): void => {
    const src = this.#containerFor(e.target);
    if (!src || src.parentElement !== this) return;
    this.#dragSource = src;
    src.setAttribute('data-dragging', '');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  };

  #onDragOver = (e: DragEvent): void => {
    if (!this.#dragSource) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = this.#containerFor(e.target);
    for (const c of this.children) c.removeAttribute('data-drop-target');
    if (target && target !== this.#dragSource) target.setAttribute('data-drop-target', '');
  };

  #onDragLeave = (e: DragEvent): void => {
    const target = this.#containerFor(e.target);
    if (target) target.removeAttribute('data-drop-target');
  };

  #onDrop = (e: DragEvent): void => {
    if (!this.#dragSource) return;
    e.preventDefault();
    const target = this.#containerFor(e.target);
    if (!target || target === this.#dragSource) return;

    const children = Array.from(this.children);
    const fromIdx = children.indexOf(this.#dragSource);
    const toIdx   = children.indexOf(target);
    if (fromIdx < 0 || toIdx < 0) return;

    if (fromIdx < toIdx) target.after(this.#dragSource);
    else target.before(this.#dragSource);

    const order = Array.from(this.children).map((c, i) => (c as HTMLElement).dataset["containerId"] || String(i));
    this.emit('layout-reorder', { from: fromIdx, to: toIdx, order });
  };

  #onDragEnd = (): void => {
    for (const c of this.children) {
      c.removeAttribute('data-dragging');
      c.removeAttribute('data-drop-target');
    }
    this.#dragSource = null;
  };
}

customElements.define("sherpa-layout-grid", SherpaLayoutGrid);
