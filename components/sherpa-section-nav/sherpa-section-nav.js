/**
 * @element sherpa-section-nav
 * @description Secondary navigation panel: a heading with optional back
 *   button, followed by a vertical list of grouped, selectable items.
 *   Designed for Settings-style layouts where the panel sits beside a
 *   content area and switches what is rendered there.
 *
 * Items can be supplied in two ways:
 *   1. Programmatically via `setSections([{ label, items }])` (preferred).
 *   2. Declaratively via the `data-sections` attribute, which holds the
 *      same shape as a JSON-encoded string.
 *
 * Section / item shape:
 *   { label: string, items: Array<{
 *       id?:          string,   // unique selection id
 *       label:        string,   // text shown to the user
 *       type?:        "item" | "header",
 *       description?: string,   // shown beneath label when type="header"
 *       icon?:        string,   // FontAwesome class (e.g. "fa-regular fa-…")
 *       action?:      string,   // dispatched in detail when clicked
 *       href?:        string,   // optional anchor href
 *       disabled?:    boolean,
 *   }>}
 *
 * @attr {string}  [data-heading]       — Panel heading text
 * @attr {string}  [data-show-back]     — "true" reveals the back button
 * @attr {string}  [data-active-id]     — Currently active item id
 * @attr {string}  [data-sections]      — JSON-encoded sections array
 *
 * @slot header-end — Trailing slot in the header (e.g. icon button)
 *
 * @fires section-nav-back
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @fires section-nav-select
 *   bubbles: true, composed: true
 *   detail: { id: string, action?: string, item: object }
 *
 * @method setSections(sections)  — Replace the rendered groups + items
 * @method setActive(id)          — Mark the item with the given id active
 * @method getActiveId()          — Returns the currently active id
 *
 * @cssparts
 *   header     — Outer header row
 *   back       — Back button
 *   heading    — Panel title
 *   header-end — Header trailing slot wrapper
 *   sections   — Scrollable list region
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaSectionNav extends SherpaElement {
  static get cssUrl() {
    return new URL("./sherpa-section-nav.css", import.meta.url).href;
  }

  static get htmlUrl() {
    return new URL("./sherpa-section-nav.html", import.meta.url).href;
  }

  static get observedAttributes() {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-show-back",
      "data-active-id",
      "data-sections",
    ];
  }

  /** @type {Array<{label: string, items: Array<object>}>} */
  #sections = [];

  /** @type {HTMLElement|null} */ #headingEl = null;
  /** @type {HTMLButtonElement|null} */ #backEl = null;
  /** @type {HTMLElement|null} */ #sectionsEl = null;

  /* ── lifecycle ───────────────────────────────────────────── */

  onRender() {
    this.#headingEl = this.$(".heading");
    this.#backEl = this.$(".back");
    this.#sectionsEl = this.$(".sections");

    this.#syncHeading();
    this.#syncBack();
    this.#syncFromAttribute();
    this.#renderSections();

    this.#backEl?.addEventListener("click", this.#onBack);
    this.#sectionsEl?.addEventListener("click", this.#onClick);
    this.#sectionsEl?.addEventListener("keydown", this.#onKeydown);
  }

  onDisconnect() {
    this.#backEl?.removeEventListener("click", this.#onBack);
    this.#sectionsEl?.removeEventListener("click", this.#onClick);
    this.#sectionsEl?.removeEventListener("keydown", this.#onKeydown);
  }

  onAttributeChanged(name) {
    switch (name) {
      case "data-heading":
        this.#syncHeading();
        break;
      case "data-show-back":
        this.#syncBack();
        break;
      case "data-active-id":
        this.#syncActiveState();
        break;
      case "data-sections":
        this.#syncFromAttribute();
        this.#renderSections();
        break;
    }
  }

  /* ── public API ──────────────────────────────────────────── */

  /**
   * Replace the rendered groups + items.
   * @param {Array<{label: string, items: Array<object>}>} sections
   */
  setSections(sections) {
    this.#sections = Array.isArray(sections) ? sections : [];
    this.#renderSections();
  }

  /** Mark the item with the given id as active. */
  setActive(id) {
    if (id) this.setAttribute("data-active-id", id);
    else this.removeAttribute("data-active-id");
  }

  /** @returns {string|null} The currently active item id. */
  getActiveId() {
    return this.getAttribute("data-active-id");
  }

  /* ── internal: rendering ─────────────────────────────────── */

  #syncHeading() {
    if (this.#headingEl) {
      this.#headingEl.textContent = this.dataset.heading || "";
    }
  }

  #syncBack() {
    if (!this.#backEl) return;
    const show = this.dataset.showBack === "true" || this.hasAttribute("data-show-back-default");
    this.#backEl.hidden = !show;
  }

  #syncFromAttribute() {
    const raw = this.getAttribute("data-sections");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.#sections = parsed;
    } catch {
      /* ignore malformed JSON */
    }
  }

  #renderSections() {
    if (!this.#sectionsEl) return;
    const activeId = this.getAttribute("data-active-id");

    const html = this.#sections
      .map((group) => this.#renderGroup(group, activeId))
      .join("");

    this.#sectionsEl.innerHTML = html;
  }

  #renderGroup(group, activeId) {
    const label = group?.label ? `
      <h3 class="group-label text-label-group">${escapeHtml(group.label)}</h3>
    ` : "";
    const items = (group?.items || [])
      .map((it) => this.#renderItem(it, activeId))
      .join("");
    return `
      <section class="group">
        ${label}
        <ul class="group-list">${items}</ul>
      </section>
    `;
  }

  #renderItem(item, activeId) {
    if (!item) return "";

    if (item.type === "header") {
      return `
        <li class="header-item">
          <span class="header-item-name text-body">${escapeHtml(item.label || "")}</span>
          ${item.description ? `<span class="header-item-description text-body-sm">${escapeHtml(item.description)}</span>` : ""}
        </li>
      `;
    }

    const id = item.id || "";
    const isActive = id && id === activeId;
    const iconHtml = item.icon
      ? `<i class="item-icon ${escapeAttr(item.icon)}" aria-hidden="true"></i>`
      : "";
    const ariaCurrent = isActive ? `aria-current="page"` : "";
    const dataActive = isActive ? `data-active="true"` : "";
    const dataAction = item.action ? `data-action="${escapeAttr(item.action)}"` : "";
    const dataDisabled = item.disabled ? "disabled" : "";

    return `
      <li>
        <button
          type="button"
          class="item text-body"
          data-id="${escapeAttr(id)}"
          ${dataAction}
          ${ariaCurrent}
          ${dataActive}
          ${dataDisabled}
        >
          <span class="item-label">${escapeHtml(item.label || "")}</span>
          ${iconHtml}
        </button>
      </li>
    `;
  }

  #syncActiveState() {
    if (!this.#sectionsEl) return;
    const activeId = this.getAttribute("data-active-id");
    for (const btn of this.#sectionsEl.querySelectorAll(".item")) {
      const isActive = btn.dataset.id && btn.dataset.id === activeId;
      btn.toggleAttribute("data-active", !!isActive);
      if (isActive) btn.setAttribute("aria-current", "page");
      else btn.removeAttribute("aria-current");
    }
  }

  /* ── internal: events ────────────────────────────────────── */

  #onBack = () => {
    this.dispatchEvent(
      new CustomEvent("section-nav-back", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  #onClick = (e) => {
    const btn = e.target.closest?.(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    this.#dispatchSelect(btn);
  };

  #onKeydown = (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = e.target.closest?.(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    e.preventDefault();
    this.#dispatchSelect(btn);
  };

  #dispatchSelect(btn) {
    const id = btn.dataset.id || "";
    const action = btn.dataset.action || undefined;
    const item = this.#findItem(id);
    if (!action) this.setActive(id);
    this.dispatchEvent(
      new CustomEvent("section-nav-select", {
        bubbles: true,
        composed: true,
        detail: { id, action, item },
      }),
    );
  }

  #findItem(id) {
    for (const g of this.#sections) {
      const found = (g.items || []).find((it) => it.id === id);
      if (found) return found;
    }
    return null;
  }
}

/* ── Helpers ───────────────────────────────────────────────── */

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  }[c]));
}

function escapeAttr(value) {
  return escapeHtml(value);
}

customElements.define("sherpa-section-nav", SherpaSectionNav);
