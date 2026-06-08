/**
 * @element sherpa-nav-section
 * @category nav
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
 * @attr {string}  data-heading       — Panel heading text
 * @attr {string}  data-show-back     — "true" reveals the back button
 * @attr {string}  data-active-id     — Currently active item id
 * @attr {string}  data-sections      — JSON-encoded sections array
 *
 * @slot header-end — Trailing slot in the header (e.g. icon button)
 *
 * @fires nav-section-back
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @fires nav-section-select
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

/** An item within a nav section (a link, header, or action). */
interface NavSectionItem {
  id?: string;
  type?: string;
  label?: string;
  description?: string;
  action?: string;
  icon?: string;
  disabled?: boolean;
}

/** A labelled group of nav-section items. */
interface NavSectionGroup {
  label?: string;
  items?: NavSectionItem[];
}

export class SherpaNavSection extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-nav-section.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("./sherpa-nav-section.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-heading",
      "data-show-back",
      "data-active-id",
      "data-sections",
    ];
  }

  #sections: NavSectionGroup[] = [];

  els = this.cacheElements({
    heading: '.heading',
    back: { selector: '.back', type: HTMLButtonElement },
    sections: { selector: '.sections', type: HTMLElement },
    groupTpl: { selector: 'template.group-tpl', type: HTMLTemplateElement },
    headerItemTpl: { selector: 'template.header-item-tpl', type: HTMLTemplateElement },
    itemTpl: { selector: 'template.item-tpl', type: HTMLTemplateElement }
  });

  #bound = false;

  /* ── lifecycle ───────────────────────── */

  override onRender(): void {
    this.#syncHeading();
    this.#syncBack();
    this.#syncFromAttribute();
    this.#renderSections();

    if (!this.#bound) {
      this.els.back?.addEventListener("click", this.#onBack);
      this.els.sections?.addEventListener("click", this.#onClick);
      this.els.sections?.addEventListener("keydown", this.#onKeyDown);
      this.#bound = true;
    }
  }

  override onAttributeChanged(name: string) {
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
  setSections(sections: NavSectionGroup[]) {
    this.#sections = Array.isArray(sections) ? sections : [];
    this.#renderSections();
  }

  /** Mark the item with the given id as active. */
  setActive(id: string | null) {
    if (id) this.setAttribute("data-active-id", id);
    else this.removeAttribute("data-active-id");
  }

  /** @returns {string|null} The currently active item id. */
  getActiveId() {
    return this.getAttribute("data-active-id");
  }

  /* ── internal: rendering ─────────────────────────────────── */

  #syncHeading() {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || "";
    }
  }

  #syncBack() {
    /* Visibility owned by CSS via :host([data-show-back="true"]) and
       :host([data-show-back-default]) selectors. No-op kept for symmetry
       with other #sync* methods. */
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
    if (!this.els.sections) return;
    const activeId = this.getAttribute("data-active-id");
    const groups = this.#sections
      .map((group) => this.#buildGroup(group, activeId))
      .filter((g): g is HTMLElement => g !== null);
    this.els.sections.replaceChildren(...groups);
  }

  #buildGroup(group: NavSectionGroup, activeId: string | null): HTMLElement | null {
    const node = this.els.groupTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return null;
    const labelEl = node.querySelector<HTMLElement>(".group-label");
    const listEl = node.querySelector(".group-list");
    if (group?.label && labelEl) {
      labelEl.textContent = group.label;
      node.toggleAttribute('data-has-label', true);
    }
    for (const it of group?.items || []) {
      const itemNode = this.#buildItem(it, activeId);
      if (itemNode) listEl?.appendChild(itemNode);
    }
    return node;
  }

  #buildItem(item: NavSectionItem, activeId: string | null): HTMLElement | null {
    if (!item) return null;

    if (item.type === "header") {
      const node = this.els.headerItemTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
      if (!node) return null;
      const nameEl = node.querySelector(".header-item-name");
      if (nameEl) nameEl.textContent = item.label || "";
      const desc = node.querySelector(".header-item-description");
      if (item.description && desc) {
        desc.textContent = item.description;
        desc.removeAttribute('hidden');
      }
      return node;
    }

    const node = this.els.itemTpl?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined;
    if (!node) return null;
    const btn = node.querySelector<HTMLElement>(".item");
    if (!btn) return node;
    const id = item.id || "";
    const isActive = id && id === activeId;

    btn.dataset["id"] = id;
    if (item.action) btn.dataset["action"] = item.action;
    if (isActive) {
      btn.dataset["active"] = "true";
      btn.setAttribute("aria-current", "page");
    }
    if (item.disabled) btn.setAttribute("disabled", "");

    const itemLabel = btn.querySelector(".item-label");
    if (itemLabel) itemLabel.textContent = item.label || "";
    const iconEl = btn.querySelector(".item-icon");
    if (item.icon && iconEl) {
      iconEl.className = `item-icon ${item.icon}`;
      iconEl.removeAttribute('hidden');
    }
    return node;
  }

  #syncActiveState() {
    if (!this.els.sections) return;
    const activeId = this.getAttribute("data-active-id");
    for (const btn of this.els.sections.querySelectorAll<HTMLElement>(".item")) {
      const isActive = btn.dataset["id"] && btn.dataset["id"] === activeId;
      if (isActive) {
        btn.dataset["active"] = "true";
        btn.setAttribute("aria-current", "page");
      } else {
        btn.removeAttribute("data-active");
        btn.removeAttribute("aria-current");
      }
    }
  }

  /* ── internal: events ────────────────────────────────────── */

  #onBack = () => {
    this.dispatchEvent(
      new CustomEvent("nav-section-back", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  #onClick = (e: Event) => {
    const btn = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    this.#dispatchSelect(btn);
  };

  #onKeyDown = (e: KeyboardEvent) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    e.preventDefault();
    this.#dispatchSelect(btn);
  };

  #dispatchSelect(btn: HTMLElement) {
    const id = btn.dataset["id"] || "";
    const action = btn.dataset["action"] || undefined;
    const item = this.#findItem(id);
    if (!action) this.setActive(id);
    this.dispatchEvent(
      new CustomEvent("nav-section-select", {
        bubbles: true,
        composed: true,
        detail: { id, action, item },
      }),
    );
  }

  #findItem(id: string) {
    for (const g of this.#sections) {
      const found = (g.items || []).find((it) => it.id === id);
      if (found) return found;
    }
    return null;
  }
}


customElements.define("sherpa-nav-section", SherpaNavSection);
