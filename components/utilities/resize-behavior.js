/**
 * ResizeBehavior — Mixin for grid-resizable containers.
 *
 * Provides column/row span adjustment via menu events dispatched by
 * the `data-event` mechanism on `sherpa-menu-item` elements.
 *
 * On connect, the mixin injects a `<template data-menu>` into the
 * host's light DOM containing Width and Height menu groups. These items
 * are gated by `--_editable-display` (visible only in edit mode).
 * The button's composed-tree template collection picks them up
 * automatically when the overflow menu opens.
 *
 * Consumed events (auto-dispatched from menu items via data-event):
 *   container-increase-cols — Step up to the next column stop
 *   container-decrease-cols — Step down to the previous column stop
 *   container-increase-rows — Increment row span (max 6)
 *   container-decrease-rows — Decrement row span (min 1)
 *
 * Column stops: 3, 6, 9, 12
 * Row span range: 1–6
 *
 * Usage:
 *   import { ResizeBehavior } from '../utilities/resize-behavior.js';
 *   class MyContainer extends ResizeBehavior(SherpaElement) { ... }
 */

/* ── Constants ─────────────────────────────────────────────────── */

const COL_STOPS = [3, 6, 9, 12];
const MIN_ROW_SPAN = 1;
const MAX_ROW_SPAN = 6;

/* ── Menu template markup ──────────────────────────────────────── */

const RESIZE_MENU_HTML = `
  <sherpa-menu-item
    data-type="heading"
    style="display: var(--_editable-display, none)"
    >Width</sherpa-menu-item
  >
  <ul data-group="width" style="display: var(--_editable-display, none)">
    <li>
      <sherpa-menu-item
        data-event="container-decrease-cols"
        data-icon="fa-solid fa-minus"
        >Decrease</sherpa-menu-item
      >
    </li>
    <li>
      <sherpa-menu-item
        data-event="container-increase-cols"
        data-icon="fa-solid fa-plus"
        >Increase</sherpa-menu-item
      >
    </li>
  </ul>
  <sherpa-menu-item
    data-type="heading"
    style="display: var(--_editable-display, none)"
    >Height</sherpa-menu-item
  >
  <ul data-group="height" style="display: var(--_editable-display, none)">
    <li>
      <sherpa-menu-item
        data-event="container-decrease-rows"
        data-icon="fa-solid fa-minus"
        >Decrease</sherpa-menu-item
      >
    </li>
    <li>
      <sherpa-menu-item
        data-event="container-increase-rows"
        data-icon="fa-solid fa-plus"
        >Increase</sherpa-menu-item
      >
    </li>
  </ul>
`;

/* ── Mixin ─────────────────────────────────────────────────────── */

/**
 * @param {typeof import('./sherpa-element/sherpa-element.js').SherpaElement} Base
 * @returns {typeof Base}
 */
export const ResizeBehavior = (Base) =>
  class extends Base {
    /** @type {HTMLTemplateElement|null} */
    #resizeMenuTpl = null;

    /* ── Lifecycle ──────────────────────────────────────────────── */

    onConnect() {
      super.onConnect();
      this.#injectResizeMenu();
      this.addEventListener("container-increase-cols", this.#onIncreaseCols);
      this.addEventListener("container-decrease-cols", this.#onDecreaseCols);
      this.addEventListener("container-increase-rows", this.#onIncreaseRows);
      this.addEventListener("container-decrease-rows", this.#onDecreaseRows);
    }

    onDisconnect() {
      super.onDisconnect();
      this.removeEventListener(
        "container-increase-cols",
        this.#onIncreaseCols,
      );
      this.removeEventListener(
        "container-decrease-cols",
        this.#onDecreaseCols,
      );
      this.removeEventListener(
        "container-increase-rows",
        this.#onIncreaseRows,
      );
      this.removeEventListener(
        "container-decrease-rows",
        this.#onDecreaseRows,
      );
      if (this.#resizeMenuTpl) {
        this.#resizeMenuTpl.remove();
        this.#resizeMenuTpl = null;
      }
    }

    /* ── Menu template injection ────────────────────────────────── */

    /**
     * Insert a `<template data-menu>` containing resize items into
     * the host's light DOM. The button's composed-tree template
     * collection picks this up when the overflow menu opens.
     */
    #injectResizeMenu() {
      // Avoid duplicates if reconnected
      if (this.querySelector(":scope > template[data-menu-resize]")) return;

      const tpl = document.createElement("template");
      tpl.setAttribute("data-menu", "");
      tpl.setAttribute("data-menu-resize", "");
      tpl.innerHTML = RESIZE_MENU_HTML;
      this.prepend(tpl);
      this.#resizeMenuTpl = tpl;
    }

    /* ── Resize handlers ────────────────────────────────────────── */

    #onIncreaseCols = () => {
      const current = parseInt(this.dataset.colSpan, 10) || COL_STOPS[0];
      const idx = COL_STOPS.indexOf(current);
      if (idx < COL_STOPS.length - 1) {
        this.dataset.colSpan = String(COL_STOPS[idx + 1]);
      }
    };

    #onDecreaseCols = () => {
      const current = parseInt(this.dataset.colSpan, 10) || COL_STOPS[0];
      const idx = COL_STOPS.indexOf(current);
      if (idx > 0) {
        this.dataset.colSpan = String(COL_STOPS[idx - 1]);
      }
    };

    #onIncreaseRows = () => {
      const current = parseInt(this.dataset.rowSpan, 10) || MIN_ROW_SPAN;
      if (current < MAX_ROW_SPAN) {
        this.dataset.rowSpan = String(current + 1);
      }
    };

    #onDecreaseRows = () => {
      const current = parseInt(this.dataset.rowSpan, 10) || MIN_ROW_SPAN;
      if (current > MIN_ROW_SPAN) {
        this.dataset.rowSpan = String(current - 1);
      }
    };
  };
