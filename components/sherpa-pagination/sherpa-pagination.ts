/**
 * @element sherpa-pagination
 * @category control
 * @description Standalone pagination controls for navigating multi-page datasets. Place below
 *   a list, grid, or table. Always set data-total-rows so the component can compute the total
 *   page count and disable forward navigation at the boundary. Bind the page-change event to
 *   re-fetch or re-slice your data. The page-size selector is built in; control the available
 *   sizes via data-allowed-sizes.
 *
 * @attr {number}  data-page=1          — Current 1-based page
 * @attr {number}  data-page-size=25    — Rows per page
 * @attr {number}  data-total-rows      — Total row count (required)
 * @attr {string}  data-allowed-sizes   — Comma-separated page-size options (default: "10,25,50,100")
 * @attr {enum}    data-density          — Display density
 *
 * @fires page-change
 *   bubbles: true
 *   detail: { page: number, pageSize: number, totalPages: number }
 *
 * @method goToPage(n)       — Navigate to specific page (clamped)
 * @method setTotalRows(n)   — Update total rows + clamp page
 *
 * @prop {number}   page         — Current page (getter/setter)
 * @prop {number}   pageSize     — Rows per page (getter/setter)
 * @prop {number}   totalRows    — Total row count (getter/setter)
 * @prop {number}   totalPages   — Computed total pages (getter-only)
 * @prop {number[]} allowedSizes — Parsed page-size options (getter-only)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

export class SherpaPagination extends SherpaElement {

  static override get cssUrl(): string {
    return new URL("./sherpa-pagination.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-pagination.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-page",
      "data-page-size",
      "data-total-rows",
      "data-allowed-sizes",
      "data-density",
    ];
  }

  #bound = false;

  /* ══════════════════════════════════════════════════════════════
     Computed Properties
     ══════════════════════════════════════════════════════════════ */

  get page(): number {
    return Math.max(1, parseInt(this.getAttribute("data-page") || "", 10) || 1);
  }

  set page(v: number) {
    this.setAttribute("data-page", String(Math.max(1, parseInt(String(v), 10) || 1)));
  }

  get pageSize(): number {
    return Math.max(1, parseInt(this.getAttribute("data-page-size") || "", 10) || 25);
  }

  set pageSize(v: number) {
    this.setAttribute(
      "data-page-size",
      String(Math.max(1, parseInt(String(v), 10) || 25)),
    );
  }

  get totalRows(): number {
    return Math.max(0, parseInt(this.getAttribute("data-total-rows") || "", 10) || 0);
  }

  set totalRows(v: number) {
    this.setAttribute(
      "data-total-rows",
      String(Math.max(0, parseInt(String(v), 10) || 0)),
    );
  }

  get totalPages(): number {
    return Math.max(1, Math.ceil(this.totalRows / this.pageSize));
  }

  get allowedSizes(): number[] {
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

  override onRender(): void {
    if (!this.#bound) {
      this.addEventListener("click", this.#onHostClick);

      const select = this.$(".page-size-select");
      select?.addEventListener("change", this.#onPageSizeChange);
      this.#bound = true;
    }

    this.#populateSizeOptions();
    this.#update();
  }

  override onAttributeChanged(name: string, oldValue: string | null, newValue: string | null): void {
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
  #populateSizeOptions(): void {
    const select = this.$(".page-size-select");
    if (!select) return;

    const sizes = this.allowedSizes;
    if (!this.hasAttribute("data-page-size")) {
      this.setAttribute("data-page-size", String(sizes[0]));
    }
    const currentSize = this.pageSize;

    const makeOption = (size: number, selected: boolean): HTMLOptionElement | null => {
      // Bind value/label/selected via the Sherpa template binder.
      const frag = this.renderFragment('.option-tpl', {
        value: String(size),
        label: String(size),
        selected: selected ? true : null,
      });
      return frag.querySelector<HTMLOptionElement>("option");
    };

    select.replaceChildren();
    for (const size of sizes) {
      const opt = makeOption(size, size === currentSize);
      if (opt) select.appendChild(opt);
    }

    // If the current pageSize isn't in allowed sizes, add it
    if (!sizes.includes(currentSize)) {
      const opt = makeOption(currentSize, true);
      if (opt) select.appendChild(opt);
    }
  }

  /** Sync all display elements to current state. */
  #update(): void {
    const page = Math.min(this.page, this.totalPages);
    const totalPages = this.totalPages;
    const totalRows = this.totalRows;
    const pageSize = this.pageSize;

    // Page indicator
    const pageCurrent = this.$(".page-current");
    const pageTotal = this.$(".page-total");
    if (pageCurrent) pageCurrent.textContent = String(page);
    if (pageTotal) pageTotal.textContent = String(totalPages);

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
    const select = this.$<HTMLSelectElement>(".page-size-select");
    if (select && parseInt(select.value, 10) !== pageSize) {
      select.value = String(pageSize);
    }

    // Button states
    const isFirst = page <= 1;
    const isLast = page >= totalPages;

    const firstBtn = this.$<HTMLButtonElement>(".page-first");
    const prevBtn = this.$<HTMLButtonElement>(".page-prev");
    const nextBtn = this.$<HTMLButtonElement>(".page-next");
    const lastBtn = this.$<HTMLButtonElement>(".page-last");

    if (firstBtn) firstBtn.disabled = isFirst;
    if (prevBtn) prevBtn.disabled = isFirst;
    if (nextBtn) nextBtn.disabled = isLast;
    if (lastBtn) lastBtn.disabled = isLast;

    this.#renderPageNumbers(page, totalPages);
  }

  /** Build a windowed list of numbered page buttons: 1 … p-1 [p] p+1 … N. */
  #renderPageNumbers(page: number, totalPages: number): void {
    const host = this.$('.page-numbers');
    if (!host) return;
    host.replaceChildren();
    if (totalPages <= 1) return;

    // Window of pages to show around the current one, always incl. 1 and N.
    const pages = new Set<number>([1, totalPages, page, page - 1, page + 1]);
    const sorted = [...pages].filter((n) => n >= 1 && n <= totalPages).sort((a, b) => a - b);

    let prev = 0;
    for (const n of sorted) {
      if (n - prev > 1) {
        const gap = this.$<HTMLTemplateElement>('.page-gap-tpl')?.content.firstElementChild?.cloneNode(true);
        if (gap) host.appendChild(gap);
      }
      const frag = this.renderFragment('.page-num-tpl', {
        label: String(n),
        page: String(n),
        current: n === page ? 'page' : null,
        isCurrent: n === page ? true : null,
      });
      host.appendChild(frag);
      prev = n;
    }
  }

  /* ══════════════════════════════════════════════════════════════
     Click Handling
     ══════════════════════════════════════════════════════════════ */

  #onHostClick: EventHandler<MouseEvent> = (e: Event) => {
    const btn = e
      .composedPath()
      .find(
        (n) => n instanceof HTMLElement && n.dataset?.["action"],
      ) as (HTMLElement & { disabled?: boolean }) | undefined;
    if (!btn || btn.disabled) return;

    const page = this.page;
    const totalPages = this.totalPages;
    let newPage = page;

    switch (btn.dataset["action"]) {
      case "first": newPage = 1; break;
      case "prev":  newPage = Math.max(1, page - 1); break;
      case "next":  newPage = Math.min(totalPages, page + 1); break;
      case "last":  newPage = totalPages; break;
      case "page": {
        const n = parseInt(btn.dataset["page"] ?? "", 10);
        if (!Number.isNaN(n)) newPage = Math.min(totalPages, Math.max(1, n));
        break;
      }
    }

    if (newPage !== page) {
      this.setAttribute("data-page", String(newPage));
      this.#update();
      this.#emitChange();
    }
  };

  #onPageSizeChange: EventHandler<Event> = (e: Event) => {
    const newSize = parseInt((e.target as HTMLSelectElement).value, 10);
    if (newSize <= 0) return;

    // Recalculate page to keep first visible row in view
    const firstRow = (this.page - 1) * this.pageSize;
    const newPage = Math.floor(firstRow / newSize) + 1;
    this.setAttribute("data-page-size", String(newSize));
    this.setAttribute("data-page", String(newPage));
    this.#update();
    this.#emitChange();
  };

  /* ══════════════════════════════════════════════════════════════
     Events
     ══════════════════════════════════════════════════════════════ */

  #emitChange(): void {
    this.dispatchEvent(
      new CustomEvent("page-change", {
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
  goToPage(n: number): void {
    const clamped = Math.max(
      1,
      Math.min(Math.trunc(n) || 1, this.totalPages),
    );
    this.setAttribute("data-page", String(clamped));
    this.#update();
    this.#emitChange();
  }

  /** Update total rows (e.g. after filtering). */
  setTotalRows(count: number): void {
    this.setAttribute(
      "data-total-rows",
      String(Math.max(0, Math.trunc(count) || 0)),
    );
    // Clamp page if needed
    if (this.page > this.totalPages) {
      this.setAttribute("data-page", String(this.totalPages));
    }
    this.#update();
  }
}

customElements.define("sherpa-pagination", SherpaPagination);
