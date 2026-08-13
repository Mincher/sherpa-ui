/**
 * @element sherpa-nav-section
 * @category nav
 * @description Secondary navigation panel for Settings-style layouts where selecting an item
 *   switches the main content area. Populate item groups via populate([{ label, items }])
 *   or the data-sections JSON attribute. Use setActive(id) to highlight the current selection
 *   programmatically. Listen to nav-section-select to know which item was clicked and update
 *   the adjacent content area accordingly.
 *
 * Items can be supplied in two ways:
 *   1. Programmatically via `populate([{ label, items }])` (the canonical data entry;
 *      `setSections()` is a retained back-compat alias).
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
 * @data {array} [{ label, items: [{ id?, label, type?, description? }] }] — Section groups
 * @method populate(sections)     — Canonical data entry: [{ label, items }]
 * @method setSections(sections)  — Deprecated alias for populate()
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
      "data-active-id",
      "data-sections",
    ];
  }

  #sections: NavSectionGroup[] = [];

  public els = this.cacheElements({
    heading: '.heading',
    back: { selector: '.back', type: HTMLButtonElement },
    sections: { selector: '.sections', type: HTMLElement },
  });

  #bound = false;

  /* ── lifecycle ───────────────────────── */

  override onRender(): void {
    this.#syncHeading();
    // Populate from the attribute if present; otherwise render whatever
    // sections were set programmatically (or nothing).
    if (this.hasAttribute("data-sections")) this.#syncFromAttribute();
    else this.#renderSections();

    if (!this.#bound) {
      this.els.back?.addEventListener("click", this.#onBack);
      this.els.sections?.addEventListener("click", this.#onClick);
      this.els.sections?.addEventListener("keydown", this.#onKeyDown);
      this.#bound = true;
    }
  }

  override onAttributeChanged(name: string): void {
    switch (name) {
      case "data-heading":
        this.#syncHeading();
        break;
      case "data-active-id":
        this.#syncActiveState();
        break;
      case "data-sections":
        this.#syncFromAttribute();
        break;
    }
  }

  /* ── public API ──────────────────────────────────────────── */

  /**
   * Replace the rendered groups + items.
   * @param {Array<{label: string, items: Array<object>}>} sections
   */
  /**
   * Render section groups. Dispatched from the unified `populate()` —
   * call `el.populate([{ label, items }])`.
   */
  protected override renderData(source: unknown): void {
    this.#sections = Array.isArray(source) ? (source as NavSectionGroup[]) : [];
    this.#renderSections();
  }

  /** @deprecated Use {@link populate} — retained for back-compat. */
  setSections(sections: NavSectionGroup[]): void {
    this.populate(sections);
  }

  /** Mark the item with the given id as active. */
  setActive(id: string | null): void {
    if (id) this.setAttribute("data-active-id", id);
    else this.removeAttribute("data-active-id");
  }

  /** @returns {string|null} The currently active item id. */
  getActiveId(): string | null {
    return this.getAttribute("data-active-id");
  }

  /* ── internal: rendering ─────────────────────────────────── */

  #syncHeading(): void {
    if (this.els.heading) {
      this.els.heading.textContent = this.dataset["heading"] || "";
    }
  }


  /** Parse the data-sections JSON attribute and populate from it. */
  #syncFromAttribute(): void {
    const raw = this.getAttribute("data-sections");
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) this.populate(parsed);
    } catch {
      /* ignore malformed JSON */
    }
  }

  #renderSections(): void {
    if (!this.els.sections) return;
    const activeId = this.getAttribute("data-active-id");
    // Flatten each group + item into a view-model the .group-tpl binder consumes.
    const groups = this.#sections.map((group) => ({
      label: group?.label || '',
      hasLabel: group?.label ? true : null,
      items: (group?.items || []).map((it) => this.#itemViewModel(it, activeId)),
    }));
    this.renderInto('.sections', '.group-tpl', groups);
  }

  /** Precompute the per-item flags the template's data-bind-if/attr branches need. */
  #itemViewModel(item: NavSectionItem, activeId: string | null): Record<string, unknown> {
    const isHeader = item?.type === "header";
    if (isHeader) {
      return {
        isHeader: true,
        isItem: null,
        label: item.label || '',
        description: item.description || '',
        noDescription: item.description ? null : true,
      };
    }
    const id = item?.id || '';
    const active = id && id === activeId ? true : null;
    return {
      isHeader: null,
      isItem: true,
      id,
      action: item?.action || null,
      active,
      ariaCurrent: active ? 'page' : null,
      disabled: item?.disabled ? true : null,
      label: item?.label || '',
      iconClass: item?.icon || '',
      noIcon: item?.icon ? null : true,
    };
  }

  #syncActiveState(): void {
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

  #onBack = (): void => {
    this.dispatchEvent(
      new CustomEvent("nav-section-back", {
        bubbles: true,
        composed: true,
      }),
    );
  };

  #onClick = (e: Event): void => {
    const btn = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    this.#dispatchSelect(btn);
  };

  #onKeyDown = (e: KeyboardEvent): void => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const btn = (e.target as HTMLElement | null)?.closest?.<HTMLElement>(".item");
    if (!btn || btn.hasAttribute("disabled")) return;
    e.preventDefault();
    this.#dispatchSelect(btn);
  };

  #dispatchSelect(btn: HTMLElement): void {
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

  #findItem(id: string): NavSectionItem | null {
    for (const g of this.#sections) {
      const found = (g.items || []).find((it) => it.id === id);
      if (found) return found;
    }
    return null;
  }
}


customElements.define("sherpa-nav-section", SherpaNavSection);
