/**
 * @element sherpa-layout-grid
 * @category shell
 * @description Main page content grid. Use it inside an app shell to hold
 *   the page header, optional side rails, and the primary content area.
 *   Slotted <sherpa-container data-variant="resizable"> children take grid
 *   spans from their data-col-span / data-row-span attributes.
 *
 *   Replaces the legacy `.sherpa-content-area` CSS class with a real
 *   web component so the grid setup, breakpoints, and span rules are
 *   shadow-scoped and don't leak into consumer CSS.
 *
 * @attr {string}  [data-row-height] — CSS length for grid-auto-rows (default: 160px)
 * @attr {enum}    [data-content]    — "static" — stacks children vertically instead of using the CSS grid
 * @attr {enum}    [data-fill]       — "viewport" — clamps the layout to the viewport height
 * @attr {boolean} [data-pad]        — Adds padding inside the content surface
 * @attr {enum}    [data-gap]        — sm | base | lg — gap between stacked children in static mode
 * @attr {boolean} [data-editable]   — Enables drag-to-reposition for slotted containers
 *
 * @slot view-header      — Optional sherpa-view-header above the content surface
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
 * @cssprop --row-height  — Row height (default 160px, registered)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaLayoutGrid extends SherpaElement {
  static override get htmlUrl(): string {
    return new URL("./sherpa-layout-grid.html", import.meta.url).href;
  }

  static override get cssUrl(): string {
    return new URL("./sherpa-layout-grid.css", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-row-height",
      "data-editable",
    ];
  }

  #dragSource: Element | null = null;

  override onRender(): void {
    this.#syncRowHeight();
    this.#syncEditable();
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
  }

  #syncRowHeight() {
    const value = this.dataset["rowHeight"];
    if (value) {
      this.style.setProperty("--row-height", value);
    } else {
      this.style.removeProperty("--row-height");
    }
  }

  #syncEditable() {
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

  #onDragStart = (e: DragEvent) => {
    const src = this.#containerFor(e.target);
    if (!src || src.parentElement !== this) return;
    this.#dragSource = src;
    src.setAttribute('data-dragging', '');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  };

  #onDragOver = (e: DragEvent) => {
    if (!this.#dragSource) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = this.#containerFor(e.target);
    for (const c of this.children) c.removeAttribute('data-drop-target');
    if (target && target !== this.#dragSource) target.setAttribute('data-drop-target', '');
  };

  #onDragLeave = (e: DragEvent) => {
    const target = this.#containerFor(e.target);
    if (target) target.removeAttribute('data-drop-target');
  };

  #onDrop = (e: DragEvent) => {
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

  #onDragEnd = () => {
    for (const c of this.children) {
      c.removeAttribute('data-dragging');
      c.removeAttribute('data-drop-target');
    }
    this.#dragSource = null;
  };
}

customElements.define("sherpa-layout-grid", SherpaLayoutGrid);
