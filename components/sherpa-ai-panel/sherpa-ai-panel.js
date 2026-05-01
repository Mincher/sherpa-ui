/**
 * sherpa-ai-panel.js
 * SherpaAIPanel — Standalone chrome for AI / chat surfaces.
 *
 * @element sherpa-ai-panel
 *
 * @attr {enum}    data-variant     "inline" | "overlay" (default "overlay")
 * @attr {enum}    data-position    "left" | "right"     (default "right")
 * @attr {flag}    data-expanded    Visible state.
 * @attr {string}  data-heading     Header title (default "Ask AI").
 * @attr {string}  data-width       Custom width (CSS value).
 * @attr {flag}    data-can-archive Enables archive button.
 * @attr {flag}    data-busy        Disables new-chat + archive.
 *
 * @fires ai-panel-new-chat — Fired when the "new chat" button is clicked.
 *   bubbles: true, composed: true. Detail: { }.
 * @fires ai-panel-archive  — Fired when the "archive" button is clicked.
 *   bubbles: true, composed: true. Detail: { }.
 * @fires panel-close       — Fired when the close button is clicked.
 *   (Same event name as sherpa-panel for cross-family consistency.)
 *   bubbles: true, composed: true. Detail: { }.
 * @fires panel-toggle      — Fired when data-expanded changes.
 *   bubbles: true, composed: true. Detail: { expanded: boolean }.
 *
 * @prop {boolean} expanded  — Getter/setter for data-expanded.
 *
 * @method open()   — Set data-expanded.
 * @method close()  — Remove data-expanded (and dispatch panel-close).
 * @method toggle() — Toggle data-expanded.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaAIPanel extends SherpaElement {
  static get cssUrl()  { return new URL("./sherpa-ai-panel.css", import.meta.url).href; }
  static get htmlUrl() { return new URL("./sherpa-ai-panel.html", import.meta.url).href; }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-expanded",
      "data-width",
      "data-can-archive",
      "data-busy",
    ];
  }

  /** @type {HTMLElement|null} */ #titleEl    = null;
  /** @type {HTMLButtonElement|null} */ #newChatBtn = null;
  /** @type {HTMLButtonElement|null} */ #archiveBtn = null;
  /** @type {HTMLButtonElement|null} */ #closeBtn   = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#titleEl    = this.$(".ai-panel-title");
    this.#newChatBtn = this.$('[part="new-chat-btn"]');
    this.#archiveBtn = this.$('[part="archive-btn"]');
    this.#closeBtn   = this.$('[part="close-btn"]');

    // Defaults
    if (!this.dataset.variant)  this.dataset.variant  = "overlay";
    if (!this.dataset.position) this.dataset.position = "right";
    if (!this.dataset.heading)  this.dataset.heading  = "Ask AI";

    this.#newChatBtn?.addEventListener("click", this.#onNewChat);
    this.#archiveBtn?.addEventListener("click", this.#onArchive);
    this.#closeBtn?.addEventListener("click",   this.#onClose);

    this.#syncHeading();
    this.#syncWidth();
    this.#syncArchive();
    this.#syncBusy();
  }

  onDisconnect() {
    this.#newChatBtn?.removeEventListener("click", this.#onNewChat);
    this.#archiveBtn?.removeEventListener("click", this.#onArchive);
    this.#closeBtn?.removeEventListener("click",   this.#onClose);
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-heading":     this.#syncHeading(); break;
      case "data-width":       this.#syncWidth();   break;
      case "data-can-archive": this.#syncArchive(); break;
      case "data-busy":        this.#syncBusy();    break;
      case "data-expanded":    this.#syncExpanded();break;
    }
  }

  /* ── handlers ────────────────────────────────────────────── */

  #onNewChat = () => {
    if (this.hasAttribute("data-busy")) return;
    this.dispatchEvent(new CustomEvent("ai-panel-new-chat", {
      bubbles: true, composed: true,
    }));
  };

  #onArchive = () => {
    if (this.hasAttribute("data-busy")) return;
    if (!this.hasAttribute("data-can-archive")) return;
    this.dispatchEvent(new CustomEvent("ai-panel-archive", {
      bubbles: true, composed: true,
    }));
  };

  #onClose = () => {
    delete this.dataset.expanded;
    this.dispatchEvent(new CustomEvent("panel-close", {
      bubbles: true, composed: true,
    }));
  };

  /* ── sync helpers ────────────────────────────────────────── */

  #syncHeading() {
    if (this.#titleEl) this.#titleEl.textContent = this.dataset.heading || "";
  }
  #syncWidth() {
    if (this.dataset.width) this.style.setProperty("--_panel-width", this.dataset.width);
    else                    this.style.removeProperty("--_panel-width");
  }
  #syncArchive() {
    if (!this.#archiveBtn) return;
    this.#archiveBtn.disabled = !this.hasAttribute("data-can-archive")
                              ||  this.hasAttribute("data-busy");
  }
  #syncBusy() {
    const busy = this.hasAttribute("data-busy");
    if (this.#newChatBtn) this.#newChatBtn.disabled = busy;
    this.#syncArchive();
  }
  #syncExpanded() {
    this.dispatchEvent(new CustomEvent("panel-toggle", {
      bubbles: true, composed: true,
      detail: { expanded: this.hasAttribute("data-expanded") },
    }));
  }

  /* ── public API ──────────────────────────────────────────── */

  get expanded()  { return this.hasAttribute("data-expanded"); }
  set expanded(v) { v ? this.setAttribute("data-expanded", "") : this.removeAttribute("data-expanded"); }

  open()   { this.expanded = true; }
  close()  { this.#onClose(); }
  toggle() { this.expanded = !this.expanded; }
}

customElements.define("sherpa-ai-panel", SherpaAIPanel);
export { SherpaAIPanel };
