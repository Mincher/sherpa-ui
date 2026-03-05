/**
 * sherpa-button.js
 * SherpaButton — Web Component extending SherpaElement base class.
 *
 * The host element IS the button — no inner <button>. The host gets
 * role="button", tabindex="0", and handles click / keyboard natively.
 *
 * Icons:
 *   Rendered as <i> elements in the HTML template with the .sherpa-icon
 *   utility class. JS mirrors data-icon-start / data-icon-end attribute
 *   values to the element textContent. CSS shows/hides them via :host
 *   attribute selectors. Values are FA unicode characters (e.g. &#xf067;).
 *
 * Label:
 *   Set via data-label attribute. JS mirrors it to a <span> textContent.
 *   Buttons without data-label are auto-detected as icon-only — CSS hides
 *   the label and forces square aspect-ratio. Icon-only buttons should have
 *   an explicit aria-label attribute for accessibility.
 *
 * Menu:
 *   Add `data-menu="true"` to mark as menu trigger. On click, the button
 *   creates its own <sherpa-menu popover="auto"> instance (as a DOM sibling).
 *
 *   If `data-menu-template` is set (e.g. "container"), the button stamps
 *   the matching template from SherpaMenu.getMenuTemplate(id) into the
 *   menu, then dispatches `menu-populate` so consumers can inject dynamic
 *   items. Without `data-menu-template`, consumers populate on `menu-open`.
 *
 *   Re-dispatches `menu-select` and `menu-close` on the button.
 *   Named `data-event` events from sherpa-menu also bubble through.
 *
 * Attributes:
 *   data-label, data-variant, data-size, data-active, disabled,
 *   data-status, data-icon-start, data-icon-end, data-icon-weight,
 *   data-menu, data-menu-position, data-menu-template
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { SherpaMenu } from "../sherpa-menu/sherpa-menu.js";

export class SherpaButton extends SherpaElement {
  /* ── Config ───────────────────────────────────────────────────── */

  static get cssUrl() {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-menu",
      "data-menu-position",
    ];
  }

  /* ── Private state ────────────────────────────────────────────── */

  #labelEl = null;
  #iconStartEl = null;
  #iconEndEl = null;
  #menuClosedAt = 0;
  #menuEl = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    if (!this.hasAttribute("role")) this.setAttribute("role", "button");
    if (!this.hasAttribute("tabindex")) this.setAttribute("tabindex", "0");

    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");
    this.#iconEndEl = this.$(".icon-end");

    if (!this.dataset.variant) {
      this.dataset.variant = "primary";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
      this.setAttribute("tabindex", "-1");
    }

    // Render label and icons from attributes
    this.#syncLabel();
    this.#syncIcons();
  }

  onConnect() {
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
  }

  onDisconnect() {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeyDown);

    if (this.#menuEl) {
      if (this.#menuEl.open) this.#menuEl.hide();
      this.#menuEl.remove();
      this.#menuEl = null;
    }
  }

  onAttributeChanged(name, _oldValue, newValue) {
    switch (name) {
      case "disabled":
        if (newValue !== null) {
          this.setAttribute("aria-disabled", "true");
          this.setAttribute("tabindex", "-1");
        } else {
          this.removeAttribute("aria-disabled");
          this.setAttribute("tabindex", "0");
        }
        break;

      case "data-label":
        this.#syncLabel();
        break;

      case "data-icon-start":
      case "data-icon-end":
        this.#syncIcons();
        break;
    }
  }

  /* ── Label ────────────────────────────────────────────────────── */

  #syncLabel() {
    if (!this.#labelEl) return;
    this.#labelEl.textContent = this.dataset.label ?? "";
  }

  /* ── Icons ─────────────────────────────────────────────────────── */

  #syncIcons() {
    if (this.#iconStartEl) {
      this.#iconStartEl.textContent = this.dataset.iconStart ?? "";
    }
    if (this.#iconEndEl) {
      this.#iconEndEl.textContent = this.dataset.iconEnd ?? "";
    }
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onClick = (e) => {
    if (this.disabled) {
      e.preventDefault();
      return;
    }

    if (this.dataset.menu === "true") {
      e.stopPropagation();
      // Light-dismiss closes the menu before this handler runs,
      // so check the timestamp to avoid immediately reopening.
      if (this.#menuEl?.open || Date.now() - this.#menuClosedAt < 50) {
        this.#menuEl?.hide();
      } else {
        this.#showMenu();
      }
    }
  };

  #onKeyDown = (e) => {
    if (this.disabled) return;
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      this.click();
    }
  };

  /* ── Menu ─────────────────────────────────────────────────────── */

  /** The button's own <sherpa-menu> element (created lazily). */
  get menuElement() {
    return this.#ensureMenu();
  }

  /**
   * Lazily create and wire up the per-button menu instance.
   * Inserted as a sibling so CSS anchor positioning resolves
   * in the same tree scope.
   */
  #ensureMenu() {
    if (this.#menuEl) return this.#menuEl;

    const menu = document.createElement("sherpa-menu");
    menu.setAttribute("popover", "auto");
    this.after(menu);

    menu.addEventListener("menu-select", (e) => {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("menu-select", {
          bubbles: true,
          composed: true,
          detail: e.detail,
        }),
      );
    });

    menu.addEventListener("menu-close", (e) => {
      e.stopPropagation();
      this.active = false;
      this.#menuClosedAt = Date.now();
      this.dispatchEvent(
        new CustomEvent("menu-close", { bubbles: true, composed: true }),
      );
    });

    this.#menuEl = menu;
    return menu;
  }

  /**
   * Show the button's menu.
   * If data-menu-template is set, stamps the matching template from
   * SherpaMenu's template registry, then fires `menu-populate` for
   * dynamic content injection. Also fires `menu-open`.
   */
  async #showMenu() {
    this.active = true;
    const menu = this.#ensureMenu();

    // Stamp static template from the menu template registry (if set)
    const tplId = this.dataset.menuTemplate;
    if (tplId) {
      await SherpaMenu.ready;
      const html = SherpaMenu.getMenuTemplate(tplId);
      if (html) {
        const frag = document.createRange().createContextualFragment(html);
        menu.replaceChildren(frag);
      }
    }

    // Let consumers populate / modify the menu before showing
    this.dispatchEvent(
      new CustomEvent("menu-populate", {
        bubbles: true,
        composed: true,
        detail: { menu },
      }),
    );
    this.dispatchEvent(
      new CustomEvent("menu-open", { bubbles: true, composed: true }),
    );

    await menu.rendered;
    menu.show(this);
  }

  /* ── Convenience properties ───────────────────────────────────── */

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(val) {
    val ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active() {
    return this.dataset.active === "true";
  }
  set active(val) {
    this.dataset.active = val ? "true" : "false";
  }

  get label() {
    return this.dataset.label ?? "";
  }
  set label(val) {
    this.dataset.label = val;
  }

  setActive(isActive) {
    this.active = !!isActive;
  }
}

customElements.define("sherpa-button", SherpaButton);
