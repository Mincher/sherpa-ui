/**
 * @element sherpa-layout-grid
 * @description Responsive dashboard grid. Slotted
 *   <sherpa-container data-variant="resizable"> children take grid spans
 *   from their data-col-span / data-row-span attributes.
 *
 *   Replaces the legacy `.sherpa-content-area` CSS class with a real
 *   web component so the grid setup, breakpoints, and span rules are
 *   shadow-scoped and don't leak into consumer CSS.
 *
 * @attr {string}  [data-row-height]      — CSS length for grid-auto-rows (default: 160px)
 * @attr {enum}    [data-content]         — "static" — opts out of grid; stacks children
 * @attr {boolean} [data-editable]        — Enables drag-to-reposition for slotted containers
 *
 * @slot (default) — sherpa-container children
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
  static get htmlUrl() {
    return new URL("./sherpa-layout-grid.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-layout-grid.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-row-height", "data-editable"];
  }

  /** @type {HTMLElement|null} */
  #dragSource = null;

  onRender() {
    this.#syncRowHeight();
    this.#syncEditable();
  }

  onAttributeChanged(name) {
    if (name === "data-row-height") this.#syncRowHeight();
    if (name === "data-editable") this.#syncEditable();
  }

  onDisconnect() {
    this.removeEventListener('dragstart', this.#onDragStart);
    this.removeEventListener('dragover', this.#onDragOver);
    this.removeEventListener('dragleave', this.#onDragLeave);
    this.removeEventListener('drop', this.#onDrop);
    this.removeEventListener('dragend', this.#onDragEnd);
  }

  #syncRowHeight() {
    const value = this.dataset.rowHeight;
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

  #containerFor(target) {
    return target?.closest?.('sherpa-container');
  }

  #onDragStart = (e) => {
    const src = this.#containerFor(e.target);
    if (!src || src.parentElement !== this) return;
    this.#dragSource = src;
    src.setAttribute('data-dragging', '');
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', '');
    }
  };

  #onDragOver = (e) => {
    if (!this.#dragSource) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const target = this.#containerFor(e.target);
    for (const c of this.children) c.removeAttribute('data-drop-target');
    if (target && target !== this.#dragSource) target.setAttribute('data-drop-target', '');
  };

  #onDragLeave = (e) => {
    const target = this.#containerFor(e.target);
    if (target) target.removeAttribute('data-drop-target');
  };

  #onDrop = (e) => {
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

    const order = Array.from(this.children).map((c, i) => c.dataset.containerId || String(i));
    this.dispatchEvent(new CustomEvent('layout-reorder', {
      bubbles: true, composed: true,
      detail: { from: fromIdx, to: toIdx, order },
    }));
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
