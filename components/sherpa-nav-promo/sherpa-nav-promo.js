/**
 * @element sherpa-nav-promo
 * @description Promotional callout for the navigation footer.
 *   Accepts config via data attributes or imperatively via setConfig().
 *
 * @attr {string}  [data-promo-title]     — Promo heading text
 * @attr {string}  [data-promo-message]   — Promo body message
 * @attr {string}  [data-promo-link-text] — CTA link label
 * @attr {string}  [data-promo-link-url]  — CTA link URL
 * @attr {boolean} [data-dismissed]       — Whether the promo has been dismissed
 *
 * @fires dismiss
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method setConfig(config) — Set promo content: { title, message, link: { text, url } }
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

  onAttributeChanged(name, oldValue, newValue) {
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
