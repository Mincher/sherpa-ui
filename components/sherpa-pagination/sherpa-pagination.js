/**
 * SherpaPagination — Standalone pagination bar.
 *
 * Attributes:
 *   data-page          — Current 1-based page (default 1)
 *   data-page-size     — Rows per page (default 25)
 *   data-total-rows    — Total row count (required for page calculations)
 *   data-allowed-sizes — Comma-separated page-size options (default "10,25,50,100")
 *
 * Events:
 *   pagechange — Dispatched when page or page-size changes.
 *                detail: { page, pageSize, totalPages }
 *
 * Usage:
 *   <sherpa-pagination data-page="1" data-page-size="25"
 *     data-total-rows="238" data-allowed-sizes="10,25,50,100">
 *   </sherpa-pagination>
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaPagination extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-pagination.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-pagination.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-page",
      "data-page-size",
      "data-total-rows",
      "data-allowed-sizes",
      "data-density",
    ];
  }

  /* ══════════════════════════════════════════════════════════════
     Computed Properties
     ══════════════════════════════════════════════════════════════ */

  get page() {
    return Math.max(1, parseInt(this.getAttribute("data-page"), 10) || 1);
  }

  set page(v) {
    this.setAttribute("data-page", String(Math.max(1, parseInt(v, 10) || 1)));
  }

  get pageSize() {
    return Math.max(1, parseInt(this.getAttribute("data-page-size"), 10) || 25);
  }

  set pageSize(v) {
    this.setAttribute(
      "data-page-size",
      String(Math.max(1, parseInt(v, 10) || 25)),
    );
  }

  get totalRows() {
    return Math.max(0, parseInt(this.getAttribute("data-total-rows"), 10) || 0);
  }

  set totalRows(v) {
    this.setAttribute(
      "data-total-rows",
      String(Math.max(0, parseInt(v, 10) || 0)),
    );
  }

  get totalPages() {
    return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
  }

  get allowedSizes() {
    const raw = this.getAttribute("data-allowed-sizes");
    if (!raw) return [10, 25, 50, 100];
    return raw
      .split(",")
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => n > 0);
  }

  /* ══════════════════════════════════════════════════════════════
     Lifecycle
     ══════════════════════════════════════════════════════════════ */

  onConnect() {
    this.addEventListener("click", (e) => this.#onHostClick(e));

    const select = this.$(".page-size-select");
    select?.addEventListener("change", (e) => {
      const newSize = parseInt(e.target.value, 10);
      if (newSize > 0) {
        // Recalculate page to keep first visible row in view
        const firstRow = (this.page - 1) * this.pageSize;
        const newPage = Math.floor(firstRow / newSize) + 1;
        this.setAttribute("data-page-size", String(newSize));
        this.setAttribute("data-page", String(newPage));
        this.#update();
        this.#emitChange();
      }
    });

    this.#populateSizeOptions();
    this.#update();
  }

  onAttributeChanged(name, oldValue, newValue) {
    if (oldValue === newValue) return;
    if (name === "data-allowed-sizes") {
      this.#populateSizeOptions();
    }
    this.#update();
  }

  /* ══════════════════════════════════════════════════════════════
     Internal Updates
     ══════════════════════════════════════════════════════════════ */

  /** Populate the page-size <select> with allowed values. */
  #populateSizeOptions() {
    const select = this.$(".page-size-select");
    if (!select) return;

    const sizes = this.allowedSizes;
    const currentSize = this.pageSize;
    const optTpl = this.$("template.option-tpl");

    select.replaceChildren();
    for (const size of sizes) {
      const opt = optTpl.content.cloneNode(true).querySelector("option");
      opt.value = size;
      opt.textContent = size;
      if (size === currentSize) opt.selected = true;
      select.appendChild(opt);
    }

    // If the current pageSize isn't in allowed sizes, add it
    if (!sizes.includes(currentSize)) {
      const opt = optTpl.content.cloneNode(true).querySelector("option");
      opt.value = currentSize;
      opt.textContent = currentSize;
      opt.selected = true;
      select.appendChild(opt);
    }
  }

  /** Sync all display elements to current state. */
  #update() {
    const page = Math.min(this.page, this.totalPages);
    const totalPages = this.totalPages;
    const totalRows = this.totalRows;
    const pageSize = this.pageSize;

    // Page indicator
    const pageCurrent = this.$(".page-current");
    const pageTotal = this.$(".page-total");
    if (pageCurrent) pageCurrent.textContent = page;
    if (pageTotal) pageTotal.textContent = totalPages;

    // Row range
    const rangeEl = this.$(".row-range");
    if (rangeEl) {
      if (totalRows === 0) {
        rangeEl.textContent = "0 rows";
      } else {
        const start = (page - 1) * pageSize + 1;
        const end = Math.min(page * pageSize, totalRows);
        rangeEl.textContent = `${start}\u2013${end} of ${totalRows}`;
      }
    }

    // Select sync
    const select = this.$(".page-size-select");
    if (select && parseInt(select.value, 10) !== pageSize) {
      select.value = pageSize;
    }

    // Button states
    const isFirst = page <= 1;
    const isLast = page >= totalPages;

    const firstBtn = this.$(".page-first");
    const prevBtn = this.$(".page-prev");
    const nextBtn = this.$(".page-next");
    const lastBtn = this.$(".page-last");

    if (firstBtn) firstBtn.disabled = isFirst;
    if (prevBtn) prevBtn.disabled = isFirst;
    if (nextBtn) nextBtn.disabled = isLast;
    if (lastBtn) lastBtn.disabled = isLast;
  }

  /* ══════════════════════════════════════════════════════════════
     Click Handling
     ══════════════════════════════════════════════════════════════ */

  #onHostClick(e) {
    const btn = e
      .composedPath()
      .find(
        (n) => n instanceof HTMLElement && n.classList?.contains("page-btn"),
      );
    if (!btn || btn.disabled) return;

    const page = this.page;
    const totalPages = this.totalPages;
    let newPage = page;

    if (btn.classList.contains("page-first")) newPage = 1;
    else if (btn.classList.contains("page-prev"))
      newPage = Math.max(1, page - 1);
    else if (btn.classList.contains("page-next"))
      newPage = Math.min(totalPages, page + 1);
    else if (btn.classList.contains("page-last")) newPage = totalPages;

    if (newPage !== page) {
      this.setAttribute("data-page", String(newPage));
      this.#update();
      this.#emitChange();
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════════ */

  #emitChange() {
    this.dispatchEvent(
      new CustomEvent("pagechange", {
        bubbles: true,
        detail: {
          page: this.page,
          pageSize: this.pageSize,
          totalPages: this.totalPages,
        },
      }),
    );
  }

  /* ══════════════════════════════════════════════════════════════
     Public API
     ══════════════════════════════════════════════════════════════ */

  /** Go to a specific page (clamped to valid range). */
  goToPage(n) {
    const clamped = Math.max(
      1,
      Math.min(parseInt(n, 10) || 1, this.totalPages),
    );
    this.setAttribute("data-page", String(clamped));
    this.#update();
    this.#emitChange();
  }

  /** Update total rows (e.g. after filtering). */
  setTotalRows(count) {
    this.setAttribute(
      "data-total-rows",
      String(Math.max(0, parseInt(count, 10) || 0)),
    );
    // Clamp page if needed
    if (this.page > this.totalPages) {
      this.setAttribute("data-page", String(this.totalPages));
    }
    this.#update();
  }
}

customElements.define("sherpa-pagination", SherpaPagination);
