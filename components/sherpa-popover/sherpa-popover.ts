/**
 * sherpa-popover.js
 * SherpaPopover — General-purpose floating content container with header.
 *
 * @element sherpa-popover
 * @category overlay
 *
 * @attr {string}  data-heading    — Header title text
 * @attr {boolean} data-open       — Shows the popover
 * @attr {string}  data-anchor     — CSS anchor name to position against
 * @attr {enum}    data-position   — top | bottom | left | right
 * @attr {enum}    data-template   — default | paged
 * @attr {number}  data-page       — (paged) Active 0-based page index
 * @attr {number}  data-pages      — (paged) Total page count for the indicator
 * @attr {enum}    data-animation  — none (default) | slide
 *
 * @slot         — Default slot for body content (paged: <section data-page="N">)
 * @slot icon    — Header icon slot
 * @slot header-end — Header trailing content slot
 *
 * @fires popover-close — Fired when close button or click-outside dismisses
 *   bubbles: true, composed: true
 *   detail: { }
 *
 * @fires popover-page-change — (paged) Fired after the active page changes.
 *   bubbles: true, composed: true
 *   detail: { page: number, total: number }
 *
 * @method nextPage()      — (paged) Advance to the next page if available.
 * @method prevPage()      — (paged) Step back to the previous page if available.
 * @method setPage(index)  — (paged) Jump to a specific 0-based page.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaPopover extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-popover.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-popover.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-open",
      "data-anchor",
      "data-template",
      "data-page",
      "data-pages",
    ];
  }

  override get templateId(): string {
    return this.dataset["template"] === 'paged' ? 'paged' : 'default';
  }

  els = this.cacheElements({
    heading: '.header-title',
    closeBtn: { selector: '.close-btn', type: HTMLButtonElement }
  });

  /** @type {AbortController|null} */
  #outsideController = null;
  #bound = false;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {

    // Defaults
    if (!this.dataset["position"]) this.dataset["position"] = "bottom";

    if (!this.#bound) {
      this.els.closeBtn?.addEventListener("click", this.#onClose);
      this.#wirePageButtons();
      this.#bound = true;
    }

    this.#syncHeading();
    this.#syncAnchor();
    this.#syncPageIndicator();
  }

  override onDisconnect(): void {
    this.#teardownOutsideClick();
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case "data-heading":
        this.#syncHeading();
        break;
      case "data-open":
        this.#syncOpen();
        break;
      case "data-anchor":
        this.#syncAnchor();
        break;
      case "data-template":
        this.renderTemplate(this.templateId).then(() => {
          this.#bound = false;
          // @ts-expect-error - TODO: Fix type
          this.els.heading  = this.$(".header-title");
          // @ts-expect-error - TODO: Fix type
          this.els.closeBtn = this.$(".close-btn");
          this.els.closeBtn?.addEventListener("click", this.#onClose);
          this.#wirePageButtons();
          this.#bound = true;
          this.#syncHeading();
          this.#syncPageIndicator();
        });
        break;
      case "data-page":
      case "data-pages":
        this.#syncPageIndicator();
        if (name === 'data-page') {
          this.dispatchEvent(new CustomEvent('popover-page-change', {
            bubbles: true, composed: true,
            detail: { page: this.page, total: this.pages },
          }));
        }
        break;
    }
  }

  /* ── Paged API ─────────────────────────────────── */

  get page()  { return parseInt(this.dataset["page"]  || '0', 10) || 0; }
  get pages() {
    const explicit = parseInt(this.dataset["pages"] || '', 10);
    if (Number.isFinite(explicit) && explicit > 0) return explicit;
    return this.querySelectorAll('section[data-page]').length || 1;
  }

  // @ts-expect-error - TODO: Fix type
  setPage(index) {
    const total = this.pages;
    const next = Math.max(0, Math.min(total - 1, Number(index) || 0));
    this.dataset["page"] = String(next);
  }
  nextPage() { this.setPage(this.page + 1); }
  prevPage() { this.setPage(this.page - 1); }

  #wirePageButtons() {
    const back = this.$('.page-back');
    const next = this.$('.page-next');
    if (back) back.addEventListener('click', () => this.prevPage());
    if (next) next.addEventListener('click', () => {
      if (this.page >= this.pages - 1) {
        this.dispatchEvent(new CustomEvent('popover-page-finish', {
          bubbles: true, composed: true,
          detail: { page: this.page, total: this.pages },
        }));
      } else {
        this.nextPage();
      }
    });
  }

  #syncPageIndicator() {
    const ind = this.$('.page-indicator');
    if (!ind) return;
    const total = this.pages;
    ind.textContent = total > 1 ? `${this.page + 1} ⁄ ${total}` : '';
    const next = this.$('.page-next');
    if (next) next.textContent = (this.page >= total - 1) ? 'Done' : 'Next';
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onClose = () => {
    delete this.dataset["open"];
    this.dispatchEvent(
      new CustomEvent("popover-close", { bubbles: true, composed: true })
    );
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncHeading() {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || "";
    }
  }

  #syncAnchor() {
    if (this.dataset["anchor"]) {
      this.style.setProperty("--_popover-anchor", `--${this.dataset["anchor"]}`);
    }
  }

  #syncOpen() {
    const open = this.hasAttribute("data-open");

    if (open) {
      // Fallback positioning when CSS anchor positioning is not supported
      this.#positionFallback();
      // Click-outside to close
      this.#setupOutsideClick();
    } else {
      this.#teardownOutsideClick();
    }
  }

  /* ── click-outside ───────────────────────────────────────── */

  #setupOutsideClick() {
    this.#teardownOutsideClick();
    // @ts-expect-error - TODO: Fix type
    this.#outsideController = new AbortController();

    // Delay to avoid catching the opening click
    requestAnimationFrame(() => {
      document.addEventListener(
        "pointerdown",
        (e) => {
          // @ts-expect-error - TODO: Fix type
          if (!this.contains(e.target) && !e.composedPath().includes(this)) {
            this.#onClose();
          }
        },
        // @ts-expect-error - TODO: Fix type
        { signal: this.#outsideController.signal }
      );
    });
  }

  #teardownOutsideClick() {
    // @ts-expect-error - TODO: Fix type
    this.#outsideController?.abort();
    this.#outsideController = null;
  }

  /* ── fallback positioning ────────────────────────────────── */

  #positionFallback() {
    // Only run if CSS anchor positioning is NOT supported
    if (CSS.supports?.("anchor-name: --test")) return;

    const anchorName = this.dataset["anchor"];
    if (!anchorName) return;

    // Find the trigger element by anchor-name custom property
    const trigger = document.querySelector(
      `[style*="anchor-name: --${anchorName}"]`
    );
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const pos = this.dataset["position"] || "bottom";

    switch (pos) {
      case "bottom":
        this.style.top = `${rect.bottom + 8}px`;
        this.style.left = `${rect.left + rect.width / 2}px`;
        this.style.translate = "-50% 0";
        break;
      case "top":
        this.style.bottom = `${window.innerHeight - rect.top + 8}px`;
        this.style.left = `${rect.left + rect.width / 2}px`;
        this.style.translate = "-50% 0";
        break;
      case "left":
        this.style.right = `${window.innerWidth - rect.left + 8}px`;
        this.style.top = `${rect.top + rect.height / 2}px`;
        this.style.translate = "0 -50%";
        break;
      case "right":
        this.style.left = `${rect.right + 8}px`;
        this.style.top = `${rect.top + rect.height / 2}px`;
        this.style.translate = "0 -50%";
        break;
    }
  }
}

customElements.define("sherpa-popover", SherpaPopover);
export { SherpaPopover };
