/**
 * SherpaContainer — Dashboard card with header, metrics, and content area.
 *
 * Extends SherpaElement via ResizeBehavior mixin with full shadow DOM
 * encapsulation. The shadow template defines structural layout: header,
 * filter bar, metrics slot, and a default slot for consumer viz children.
 *
 * Content is supplied via inline child elements. Metrics use a named
 * slot (`slot="metrics"`), viz children use the default slot. The
 * container is content-agnostic — it never imports or creates viz
 * components directly. All content components auto-load their own data
 * via ContentAttributesMixin.
 *
 * Metric visibility is CSS-driven via data-col-span (no JS needed).
 * The metrics area auto-hides when no metric has a data-label attribute.
 *
 * Menu items:
 *   The overflow menu is assembled from light-DOM `<template data-menu>`
 *   children found on the host. ResizeBehavior injects Width/Height
 *   resize items (gated by --_editable-display). Consumer view templates
 *   add action items (e.g. Export) via their own `<template data-menu>`.
 *
 * Resize (via ResizeBehavior mixin):
 *   Column stops: 3 → 6 → 9 → 12, row span: 1–6.
 *   Resize menu items are visible only when --_editable-display is set.
 *
 * Architecture — decoupled peer events:
 *   Container owns layout only. All data concerns are handled by the
 *   content components themselves:
 *     vizready             — viz child → filter bar (columns/rows)
 *     containerfilterchange — filter bar → viz children (scoped)
 *     globalfilterchange   — document → viz children (direct)
 *     sortchange           — viz child → filter bar (sort chip sync)
 *     presentationchange   — viz child → sherpa-data-viz (view switch)
 *
 *   Menu items are assembled from light-DOM `<template data-menu>`
 *   children by sherpa-button's composed-tree walking. ResizeBehavior
 *   injects resize items; consumers add action items in view HTML.
 *   Menu events bubble harmlessly if no listener is present.
 *
 * Attributes:
 *   data-variant      — Layout variant: "fit" (default), "resizable", "fill"
 *   data-title        — Container heading text
 *   data-description  — Container description
 *   data-col-span     — Column span (3, 6, 9, 12) — resizable variant only
 *   data-row-span     — Row span (1–6) — resizable variant only
 *   data-menu-open    — Menu state (set by menu-open/menu-close events)
 *   data-editable     — Edit mode (enables CSS resize grip)
 *
 * Slots:
 *   metrics   — Up to 4 sherpa-metric children
 *   (default) — Consumer viz children (sherpa-data-viz wrappers)
 */

import "../sherpa-header/sherpa-header.js";
import "../sherpa-filter-bar/sherpa-filter-bar.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { ResizeBehavior } from "../utilities/resize-behavior.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaContainer extends ResizeBehavior(SherpaElement) {
  static get htmlUrl() {
    return new URL("./sherpa-container.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container.css", import.meta.url).href;
  }

  static get observedAttributes() {
    return [...super.observedAttributes, "data-title", "data-description"];
  }

  /* ── SherpaElement lifecycle hooks ───────────────────────────── */

  onRender() {
    if (!this.dataset.variant) this.dataset.variant = "fit";
    this.#syncHeader();
  }

  onConnect() {
    super.onConnect();
    this.addEventListener("menu-open", this.#onMenuOpen);
    this.addEventListener("menu-close", this.#onMenuClose);
  }

  onDisconnect() {
    super.onDisconnect();
    this.removeEventListener("menu-open", this.#onMenuOpen);
    this.removeEventListener("menu-close", this.#onMenuClose);
  }

  onAttributeChanged(name, _oldValue, newValue) {
    if (name === "data-title" || name === "data-description") {
      this.#syncHeader();
    }
  }

  /* ── Private ─────────────────────────────────────────────────── */

  #syncHeader() {
    const header = this.$("sherpa-header");
    if (!header) return;
    header.heading = this.dataset.title || "";
    header.description = this.dataset.description || "";
  }

  #onMenuOpen = () => {
    this.dataset.menuOpen = "true";
  };

  #onMenuClose = () => {
    delete this.dataset.menuOpen;
  };
}

customElements.define("sherpa-container", SherpaContainer);
