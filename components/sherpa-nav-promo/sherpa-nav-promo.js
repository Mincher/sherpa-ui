/**
 * SherpaNavPromo — Promotional callout for the navigation footer.
 *
 * Shadow-DOM component (extends SherpaElement).
 * Self-configures from data attributes on the host:
 *   data-promo-title, data-promo-message, data-promo-link-text, data-promo-link-url
 * Also accepts config imperatively via setConfig({ title, message, link: { text, url } }).
 * Emits 'dismiss' event when the close button is clicked.
 * Dismissed state tracked via [data-dismissed] attribute on the host.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import "../sherpa-button/sherpa-button.js";

export class SherpaNavPromo extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-nav-promo.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return new URL("./sherpa-nav-promo.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-promo-title",
      "data-promo-message",
      "data-promo-link-text",
      "data-promo-link-url",
    ];
  }

  #config = null;
  #ready = false;

  attributeChangedCallback(name, oldValue, newValue) {
    super.attributeChangedCallback?.(name, oldValue, newValue);
    if (name.startsWith("data-promo-") && oldValue !== newValue) {
      this.#configFromAttributes();
    }
  }

  onRender() {
    this.$(".promo-close")?.addEventListener("click", () => {
      this.dataset.dismissed = "";
      this.dispatchEvent(new CustomEvent("dismiss", { bubbles: true }));
    });
    this.#ready = true;
    // If setConfig was called before render, apply it; otherwise read attributes
    if (this.#config) {
      this.#applyConfig();
    } else {
      this.#configFromAttributes();
    }
  }

  /** @param {{ title?: string, message?: string, link?: { text: string, url: string } }} config */
  setConfig(config) {
    this.#config = config;
    if (this.#ready) this.#applyConfig();
  }

  /** Read data-promo-* attributes and apply as config. */
  #configFromAttributes() {
    const title = this.dataset.promoTitle;
    const message = this.dataset.promoMessage;
    const linkText = this.dataset.promoLinkText;
    const linkUrl = this.dataset.promoLinkUrl;
    if (title || message || linkText) {
      this.#config = {
        title: title || "",
        message: message || "",
        link: { text: linkText || "", url: linkUrl || "" },
      };
      if (this.#ready) this.#applyConfig();
    }
  }

  #applyConfig() {
    if (!this.#config) return;
    const { title, message, link } = this.#config;

    const titleEl = this.$(".promo-title");
    const textEl = this.$(".promo-text");
    const linkEl = this.$(".promo-link");

    if (titleEl) titleEl.textContent = title || "";
    if (textEl) textEl.textContent = message || "";
    if (linkEl) {
      linkEl.textContent = link?.text || "";
      if (link?.url) linkEl.dataset.url = link.url;
    }
  }
}

customElements.define("sherpa-nav-promo", SherpaNavPromo);
