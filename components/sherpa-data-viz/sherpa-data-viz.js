/**
 * SherpaDataViz — Presentation-switching wrapper for data viz components.
 *
 * Wraps a single viz child (table, barchart, metric, data-grid) and owns
 * the view-switch lifecycle.  When the child dispatches `presentationchange`,
 * this component swaps the child for the requested type and transfers data
 * via getData() → setConfig() + setData().
 *
 * The wrapper is intentionally transparent — it adds no visual chrome and
 * uses `display: contents` so the child lays out as if it were a direct
 * child of the parent container.
 *
 * Imports all viz component definitions so `document.createElement(tag)`
 * works for any supported presentation type.
 *
 * Architecture:
 *   • Container places `<sherpa-data-viz>` inside `.section-content`.
 *   • The consumer puts a viz child (e.g. `<sherpa-base-table>`) inside
 *     `<sherpa-data-viz>` in the HTML.
 *   • On `presentationchange`, this wrapper removes the old child,
 *     creates the new one, and calls setConfig/setData with the
 *     transferable config from the outgoing child.
 *   • The `load()` method delegates to the active child so the
 *     container's initialisation loop works unchanged.
 *
 * Supported presentation types:
 *   table      → sherpa-base-table
 *   barchart   → sherpa-barchart
 *   kpi-metric → sherpa-metric
 *   data-grid  → sherpa-data-grid
 *
 * Events consumed (stopped at this boundary):
 *   presentationchange — from child viz. detail: { type, data }
 */

import "../sherpa-metric/sherpa-metric.js";
import "../sherpa-base-table/sherpa-base-table.js";
import "../sherpa-barchart/sherpa-barchart.js";
import "../sherpa-data-grid/sherpa-data-grid.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/* ── Tag lookup ────────────────────────────────────────────────── */

const TAG_MAP = {
  table: "sherpa-base-table",
  barchart: "sherpa-barchart",
  "kpi-metric": "sherpa-metric",
  "data-grid": "sherpa-data-grid",
};

/** Selector matching any supported viz child. */
const VIZ_SELECTOR = Object.values(TAG_MAP).join(", ");

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaDataViz extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-data-viz.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-data-viz.html", import.meta.url).href;
  }

  /* ── Lifecycle ─────────────────────────────────────────────── */

  onConnect() {
    this.addEventListener("presentationchange", (e) => {
      e.stopPropagation();
      const { type, data } = e.detail ?? {};
      if (type) this.#switchPresentation(type, data);
    });
  }

  /* ── Public API ────────────────────────────────────────────── */

  /** The currently active viz child element, or null. */
  get activeChild() {
    return this.querySelector(VIZ_SELECTOR);
  }

  /**
   * Delegate to the active viz child's `load()` method.
   * Called by the container's initialisation loop.
   * @param {Array} [initialFilters] - Pre-seeded global filters.
   */
  async load(initialFilters = []) {
    const child = this.activeChild;
    if (child && typeof child.load === "function") {
      return child.load(initialFilters);
    }
  }

  /* ── Presentation switching ────────────────────────────────── */

  /**
   * Swap the current viz child for a different presentation type.
   * Transfers the outgoing child's config to the new child.
   *
   * @param {string} type - Presentation type key (see TAG_MAP).
   * @param {Object} [transferData] - Config from the outgoing child's getData().
   */
  async #switchPresentation(type, transferData) {
    const current = this.activeChild;
    if (current) current.remove();

    const tag = TAG_MAP[type];
    if (!tag) return;

    const el = document.createElement(tag);

    // Append first so shadow DOM bootstraps (rendered promise resolves)
    this.appendChild(el);
    await el.rendered;

    if (transferData) {
      if (typeof el.setConfig === "function") el.setConfig(transferData);
      if (typeof el.setData === "function") el.setData(transferData);
    }
  }
}

customElements.define("sherpa-data-viz", SherpaDataViz);
