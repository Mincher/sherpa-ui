/**
 * @element sherpa-product-bar-v2
 * @category shell
 * @description Top product branding bar (2026 redesign). Place once per app inside the
 *   sherpa-app-shell "product-bar" slot. Provides a clickable system-name trigger (which can
 *   open an org/scope picker via the system-menu slot), optional product sub-navigation tabs,
 *   a central search field, and right-aligned action buttons. Set data-show-system-menu="false"
 *   to disable the system-name dropdown in single-org applications.
 *
 * @attr {string}  data-product-name       — System / product display name
 * @attr {string}  data-time               — Time string ("09:00")
 * @attr {string}  data-show-system        — "false" hides the brand stack
 * @attr {string}  data-show-time          — "false" hides the time line
 * @attr {string}  data-show-system-menu   — "false" hides the dropdown caret
 *                                             and disables the trigger menu
 *
 * @slot tabs        — Optional product sub-nav (sets data-has-tabs when populated)
 * @slot search      — Search control; falls back to a default sherpa-input-search
 * @slot actions     — Right-aligned icon buttons + Ask N-zo entry point
 * @slot system-menu — Organisation / scope picker shown when the system-name
 *                     trigger is activated. Pass a single <sherpa-container-overlay data-variant="menu">
 *                     with a flat list of <sherpa-overlay-item> children — do NOT
 *                     wrap items in <ul data-group="…"> groups. The org
 *                     picker is a single, non-grouped list.
 *
 *   @example
 *     <sherpa-product-bar-v2 data-product-name="Acme Corp">
 *       <sherpa-container-overlay data-variant="menu" slot="system-menu">
 *         <sherpa-overlay-item value="acme">Acme Corp</sherpa-overlay-item>
 *         <sherpa-overlay-item value="globex">Globex</sherpa-overlay-item>
 *         <sherpa-overlay-item value="initech">Initech</sherpa-overlay-item>
 *       </sherpa-container-overlay>
 *     </sherpa-product-bar-v2>
 *
 * @fires system-trigger-click
 *   bubbles: true, composed: true
 *   detail: { name: string }
 *   Fired when the system-name trigger is activated. Hosts can open a
 *   scope picker (System / Customer / Site) in response.
 */

import "../sherpa-input-search/sherpa-input-search.js";
import "../sherpa-container-overlay/sherpa-container-overlay.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

/** Structural type for the slotted <sherpa-container-overlay> element. */
interface SystemMenuElement extends HTMLElement {
  show?(anchor?: HTMLElement | null): void;
  hide?(): void;
}

class SherpaProductBarV2 extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-product-bar-v2.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-product-bar-v2.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-product-name",
      "data-time",
    ];
  }

  els = this.cacheElements({
    name: { selector: '.system-name', type: HTMLSpanElement },
    time: { selector: '.system-time-value', type: HTMLSpanElement },
    trigger: { selector: '.system-trigger', type: HTMLButtonElement }
  });

  #bound = false;
  #slotBound = false;

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {

    if (!this.hasAttribute("role")) this.setAttribute("role", "banner");

    this.#syncName();
    this.#syncTime();
    this.#syncSlotState();

    if (!this.#bound) {
      if (this.dataset["showSystemMenu"] !== "false") {
        this.els.trigger?.addEventListener("click", this.#onTriggerClick);
        this.addEventListener("overlay-close", this.#onMenuClose);
      } else {
        this.els.trigger?.removeAttribute("aria-haspopup");
        this.els.trigger?.removeAttribute("aria-expanded");
      }
      this.#bound = true;
    }
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case "data-product-name":
        this.#syncName();
        break;
      case "data-time":
        this.#syncTime();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncName() {
    if (this.els.name) {
      this.els.name.textContent = this.dataset["productName"] || "";
    }
  }

  #syncTime() {
    if (this.els.time) {
      this.els.time.textContent = this.dataset["time"] || "--:--";
    }
  }

  #onTriggerClick = () => {
    const expanded = this.els.trigger?.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    this.els.trigger?.setAttribute("aria-expanded", next ? "true" : "false");

    const menu = this.#getSystemMenu();
    if (menu) {
      if (next) {
        menu.show?.(this.els.trigger);
      } else {
        menu.hide?.();
      }
    }

    this.dispatchEvent(
      new CustomEvent("system-trigger-click", {
        bubbles: true,
        composed: true,
        detail: { name: this.dataset["productName"] || "" },
      }),
    );
  };

  /** Resolve the slotted <sherpa-container-overlay> in the system-menu slot, if any. */
  #getSystemMenu(): SystemMenuElement | null {
    const slot = this.shadowRoot?.querySelector<HTMLSlotElement>('slot[name="system-menu"]');
    const nodes = slot?.assignedElements?.({ flatten: true }) || [];
    return (nodes.find((n) => n.tagName?.toLowerCase() === "sherpa-container-overlay") as SystemMenuElement | undefined) || null;
  }

  #onMenuClose = () => {
    this.els.trigger?.setAttribute("aria-expanded", "false");
  };

  /**
   * Reflect whether the tabs / actions slots have any assigned nodes onto
   * host attributes (`data-has-tabs` / `data-has-actions`) so the
   * component CSS can collapse the corresponding regions.
   */
  #syncSlotState() {
    const root = this.shadowRoot;
    if (!root) return;

    const update = (slotName: string, attr: string) => {
      const slot = root.querySelector<HTMLSlotElement>(`slot[name="${slotName}"]`);
      if (!slot) return;
      const has = slot.assignedNodes({ flatten: true }).some((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
        return n.nodeType === Node.TEXT_NODE && (n.textContent?.trim().length ?? 0) > 0;
      });
      this.toggleAttribute(attr, has);
    };

    const tabsSlot = root.querySelector('slot[name="tabs"]');
    const actionsSlot = root.querySelector('slot[name="actions"]');

    update("tabs", "data-has-tabs");
    update("actions", "data-has-actions");

    if (!this.#slotBound) {
      tabsSlot?.addEventListener("slotchange", () =>
        update("tabs", "data-has-tabs"),
      );
      actionsSlot?.addEventListener("slotchange", () =>
        update("actions", "data-has-actions"),
      );
      this.#slotBound = true;
    }
  }
}

customElements.define("sherpa-product-bar-v2", SherpaProductBarV2);
export { SherpaProductBarV2 };
