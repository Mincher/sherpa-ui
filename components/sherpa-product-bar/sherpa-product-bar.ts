/**
 * @element sherpa-product-bar
 * @category shell
 * @description **DEPRECATED — use `sherpa-product-bar-v2` instead.** Top-level product branding bar with icon, name, navigation, and actions.
 *
 * @deprecated Use sherpa-product-bar-v2 instead. This v1 component is kept for
 * backwards compatibility and will be removed in a future major release.
 *
 * @attr {string}  [data-product-name]  — Product display name
 * @attr {string}  [data-product-icon]  — Font Awesome icon class (e.g. "fa-cube")
 *
 * @slot icon     — Custom product icon content
 * @slot (default) — Navigation items
 * @slot actions  — Right-aligned action buttons
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProductBar extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-product-bar.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-product-bar.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-product-name",
      "data-product-icon",
    ];
  }

  els = this.cacheElements({
    name: '.product-name',
    icon: '.product-icon'
  });

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {

    // ARIA
    if (!this.hasAttribute("role")) this.setAttribute("role", "banner");

    this.#syncName();
    this.#syncIcon();
    this.#syncSlotState();
  }

  override onAttributeChanged(name: string) {
    switch (name) {
      case "data-product-name":
        this.#syncName();
        break;
      case "data-product-icon":
        this.#syncIcon();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncName() {
    if (this.els.name) {
      this.els.name.textContent = this.dataset["productName"] || "";
    }
  }

  #syncIcon() {
    if (!this.els.icon) return;

    const iconClass = this.dataset["productIcon"];
    const iconEl = this.els.icon.querySelector(".auto-icon");

    if (iconClass && iconEl) {
      iconEl.className = `auto-icon fa-solid ${iconClass}`;
    }
    this.toggleAttribute("data-has-icon", !!iconClass);
  }

  /**
   * Reflect whether the default and `actions` slots have any assigned
   * nodes onto host attributes (`data-has-default` / `data-has-actions`),
   * which the component CSS uses to collapse the divider/actions area.
   */
  #syncSlotState() {
    const root = this.shadowRoot;
    if (!root) return;

    // @ts-expect-error - TODO: Fix type
    const update = (slotName, attr) => {
      const slot = slotName
        ? root.querySelector(`slot[name="${slotName}"]`)
        : root.querySelector("slot:not([name])");
      if (!slot) return;
      // @ts-expect-error - TODO: Fix type
      const has = slot.assignedNodes({ flatten: true }).some((n) => {
        if (n.nodeType === Node.ELEMENT_NODE) return true;
        return n.nodeType === Node.TEXT_NODE && n.textContent.trim().length > 0;
      });
      this.toggleAttribute(attr, has);
    };

    const defaultSlot = root.querySelector("slot:not([name])");
    const actionsSlot = root.querySelector('slot[name="actions"]');

    update(null, "data-has-default");
    update("actions", "data-has-actions");

    defaultSlot?.addEventListener("slotchange", () =>
      update(null, "data-has-default"),
    );
    actionsSlot?.addEventListener("slotchange", () =>
      update("actions", "data-has-actions"),
    );
  }
}

customElements.define("sherpa-product-bar", SherpaProductBar);
export { SherpaProductBar };
