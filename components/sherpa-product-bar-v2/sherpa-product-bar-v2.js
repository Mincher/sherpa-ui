/**
 * @element sherpa-product-bar-v2
 * @description Light-themed product bar (Apr 2026 redesign). System name
 *   trigger + time, optional tabs, central search, right-aligned actions.
 *
 * @attr {string}  [data-product-name]       — System / product display name
 * @attr {string}  [data-time]               — Time string ("09:00")
 * @attr {string}  [data-show-system]        — "false" hides the brand stack
 * @attr {string}  [data-show-time]          — "false" hides the time line
 *
 * @slot tabs    — Optional product sub-nav (sets data-has-tabs when populated)
 * @slot search  — Search control; falls back to a default sherpa-input-search
 * @slot actions — Right-aligned icon buttons + Ask N-zo entry point
 *
 * @fires systemtriggerclick
 *   bubbles: true, composed: true
 *   detail: { name: string }
 *   Fired when the system-name trigger is activated. Hosts can open a
 *   scope picker (System / Customer / Site) in response.
 */

import "../sherpa-input-search/sherpa-input-search.js";
import "../sherpa-menu/sherpa-menu.js";
import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProductBarV2 extends SherpaElement {
  static get cssUrl() {
    return new URL("sherpa-product-bar-v2.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("sherpa-product-bar-v2.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-product-name",
      "data-time",
    ];
  }

  /** @type {HTMLSpanElement|null} */ #nameEl = null;
  /** @type {HTMLSpanElement|null} */ #timeEl = null;
  /** @type {HTMLButtonElement|null} */ #triggerEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#nameEl = this.$(".system-name");
    this.#timeEl = this.$(".system-time-value");
    this.#triggerEl = this.$(".system-trigger");

    if (!this.hasAttribute("role")) this.setAttribute("role", "banner");

    this.#syncName();
    this.#syncTime();
    this.#syncSlotState();

    this.#triggerEl?.addEventListener("click", this.#onTriggerClick);
    this.addEventListener("menu-close", this.#onMenuClose);
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener("click", this.#onTriggerClick);
    this.removeEventListener("menu-close", this.#onMenuClose);
  }

  onAttributeChanged(name) {
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
    if (this.#nameEl) {
      this.#nameEl.textContent = this.dataset.productName || "";
    }
  }

  #syncTime() {
    if (this.#timeEl) {
      this.#timeEl.textContent = this.dataset.time || "--:--";
    }
  }

  #onTriggerClick = () => {
    const expanded = this.#triggerEl?.getAttribute("aria-expanded") === "true";
    const next = !expanded;
    this.#triggerEl?.setAttribute("aria-expanded", next ? "true" : "false");

    const menu = this.#getSystemMenu();
    if (menu) {
      if (next) {
        menu.show?.(this.#triggerEl);
      } else {
        menu.hide?.();
      }
    }

    this.dispatchEvent(
      new CustomEvent("systemtriggerclick", {
        bubbles: true,
        composed: true,
        detail: { name: this.dataset.productName || "" },
      }),
    );
  };

  /** Resolve the slotted <sherpa-menu> in the system-menu slot, if any. */
  #getSystemMenu() {
    const slot = this.shadowRoot?.querySelector('slot[name="system-menu"]');
    const nodes = slot?.assignedElements?.({ flatten: true }) || [];
    return nodes.find((n) => n.tagName?.toLowerCase() === "sherpa-menu") || null;
  }

  #onMenuClose = () => {
    this.#triggerEl?.setAttribute("aria-expanded", "false");
  };

  /**
   * Reflect whether the tabs / actions slots have any assigned nodes onto
   * host attributes (`data-has-tabs` / `data-has-actions`) so the
   * component CSS can collapse the corresponding regions.
   */
  #syncSlotState() {
    const root = this.shadowRoot;
    if (!root) return;

    const update = (slotName, attr) => {
      const slot = root.querySelector(`slot[name="${slotName}"]`);
      if (!slot) return;
      const has = slot.assignedNodes({ flatten: true }).some((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
        return n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0;
      });
      this.toggleAttribute(attr, has);
    };

    const tabsSlot = root.querySelector('slot[name="tabs"]');
    const actionsSlot = root.querySelector('slot[name="actions"]');

    update("tabs", "data-has-tabs");
    update("actions", "data-has-actions");

    tabsSlot?.addEventListener("slotchange", () =>
      update("tabs", "data-has-tabs"),
    );
    actionsSlot?.addEventListener("slotchange", () =>
      update("actions", "data-has-actions"),
    );
  }
}

customElements.define("sherpa-product-bar-v2", SherpaProductBarV2);
export { SherpaProductBarV2 };
