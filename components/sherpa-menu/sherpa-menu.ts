/**
 * @element sherpa-menu
 * @category overlay
 * @description Menu component (per-instance, no singleton). Light DOM
 *   <ul>/<li>/<sherpa-menu-item> content projected through <slot>.
 *   Uses popover="auto" for top-layer promotion and light-dismiss.
 *   CSS anchor positioning with JS fallback.
 *
 * @attr {enum}    [data-layout]       — "default" (vertical) | "actions" (compact horizontal row)
 * @attr {boolean} [data-loading]      — Show a spinner instead of slot content
 * @attr {string}  [data-loading-text] — Optional caption shown next to the spinner
 * @attr {enum}    [data-position]     — bottom-start (default) | bottom-end | top-start | top-end
 *
 * @slot (default) — Menu content: <ul>/<li>/<sherpa-menu-item> elements
 *
 * @fires menu-select
 *   bubbles: true, composed: true
 *   detail: { item: Element, action: string, value: string, label: string,
 *             selection: string, checked: boolean, group: string, data: * }
 * @fires menu-close
 *   bubbles: true, composed: true
 *   detail: none
 *
 * @method show(anchor)  — Open and position the menu relative to anchor element
 * @method hide()        — Close the menu
 * @method getSelectedValues() — Get values of all checked menu items
 * @method clearSelection()    — Uncheck all menu items
 * @method getMenuTemplate(id) — (static) Return menu template HTML by id
 *
 * @prop {boolean}  open   — Whether the menu is currently visible
 * @prop {Element}  source — The anchor element that opened the menu
 * @prop {Promise}  ready  — (static) Resolves when menu templates are loaded
 */

import "../sherpa-menu-item/sherpa-menu-item.js";
import {
  SherpaElement,
  parseTemplates,
} from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

const supportsAnchor = CSS.supports?.("anchor-name", "--test") ?? false;

/* ── Menu content templates (loaded once at module init) ───────── */

const MENU_HTML_URL = new URL("./sherpa-menu.html", import.meta.url).href;
let _menuTemplates: Map<string, string> | null = null; // populated by _ensureTemplates()
let _menuTemplatesPromise: Promise<void> | null = null;

function _ensureTemplates() {
  if (!_menuTemplatesPromise) {
    _menuTemplatesPromise = fetch(MENU_HTML_URL)
      .then((r) => (r.ok ? r.text() : ""))
      .then((html) => {
        _menuTemplates = parseTemplates(html);
      })
      .catch(() => {
        _menuTemplates = new Map();
      });
  }
  return _menuTemplatesPromise;
}

// Kick off the fetch immediately when the module loads
_ensureTemplates();

/* ══════════════════════════════════════════════════════════════════
   Component
   ══════════════════════════════════════════════════════════════════ */

export class SherpaMenu extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-menu.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return MENU_HTML_URL;
  }

  /**
   * Get a menu content template by id.
   * Returns the HTML string, or "" if not found.
   * Call after awaiting SherpaMenu.ready to guarantee availability.
   * @param {string} id — template id (e.g. "container", "sort")
   * @returns {string}
   */
  static getMenuTemplate(id: string): string {
    return _menuTemplates?.get(id) ?? "";
  }

  /**
   * Promise that resolves once menu templates are loaded and parsed.
   * Consumers can `await SherpaMenu.ready` before calling getMenuTemplate().
   * @type {Promise<void>}
   */
  static get ready() {
    return _ensureTemplates();
  }

  source: HTMLElement | null = null;
  #hiding = false;

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, 'data-loading-text'];
  }

  get open() {
    return this.hasAttribute("open");
  }

  override onRender(): void {
    this.#syncLoadingText();
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeyDown);
    this.addEventListener("toggle", this.#onToggle);
  }

  override onAttributeChanged(name: string) {
    if (name === 'data-loading-text') this.#syncLoadingText();
  }

  #syncLoadingText() {
    const el = this.$('.menu-loader-text');
    if (el) el.textContent = this.dataset["loadingText"] || '';
  }

  /* ── Event delegation ──────────────────────────────────────── */

  #onClick: EventHandler<MouseEvent> = (e: Event) => {
    const item = (e.target as Element).closest?.<HTMLElement>("sherpa-menu-item");
    if (!item || item.hasAttribute("disabled")) return;

    const selection = item.dataset["selection"];

    if (selection === "checkbox" || selection === "toggle") {
      item.toggleAttribute("checked");
    }
    if (selection === "radio") {
      // Uncheck siblings in the same group, then check this item
      const group = item.dataset["group"];
      const siblings = group
        ? this.querySelectorAll(
            `sherpa-menu-item[data-group="${CSS.escape(group)}"]`,
          )
        : (item
            .closest("ul")
            ?.querySelectorAll('sherpa-menu-item[data-selection="radio"]') ?? [
            item,
          ]);
      siblings.forEach((s) => s.removeAttribute("checked"));
      item.setAttribute("checked", "");
    }

    this.#dispatchSelect(item);

    if (!item.hasAttribute("data-keep-open") && selection !== "toggle") {
      this.hide();
    }
  };

  #onKeyDown: EventHandler<KeyboardEvent> = (e: KeyboardEvent) => {
    const items = this.#focusableItems();
    if (!items.length) return;

    const active = document.activeElement;
    const idx = active instanceof HTMLElement ? items.indexOf(active) : -1;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        items[(idx + 1) % items.length]?.focus();
        break;
      case "ArrowUp":
        e.preventDefault();
        items[(idx - 1 + items.length) % items.length]?.focus();
        break;
      case "Home":
        e.preventDefault();
        items[0]?.focus();
        break;
      case "End":
        e.preventDefault();
        items.at(-1)?.focus();
        break;
      case "Enter":
      case " ":
        e.preventDefault();
        (e.target as Element | null)?.closest?.<HTMLElement>("sherpa-menu-item")?.click();
        break;
      case "Escape":
        e.preventDefault();
        this.hide();
        break;
    }
  };

  #focusableItems(): HTMLElement[] {
    return [
      ...this.querySelectorAll<HTMLElement>(
        'sherpa-menu-item:not([disabled]):not([hidden]):not([data-type="heading"])',
      ),
    ];
  }

  /* ── Dispatch ──────────────────────────────────────────────── */

  #dispatchSelect(item: HTMLElement) {
    const detail = {
      item,
      action: item.dataset["action"] || undefined,
      value: item.getAttribute("value") ?? undefined,
      label: item.textContent?.trim() ?? "",
      selection: item.dataset["selection"] || undefined,
      checked: item.hasAttribute("checked"),
      group:
        item.dataset["group"] || item.closest("ul")?.dataset["group"] || undefined,
      data: { ...item.dataset },
    };

    this.dispatchEvent(
      new CustomEvent("menu-select", {
        bubbles: true,
        composed: true,
        detail,
      }),
    );

    // Auto-dispatch a named domain event when data-event is set on the item
    const eventName = item.dataset["event"];
    if (eventName) {
      this.dispatchEvent(
        new CustomEvent(eventName, {
          bubbles: true,
          composed: true,
          detail,
        }),
      );
    }
  }

  /* ── Show / hide ───────────────────────────────────────────── */

  show(anchor: HTMLElement): void {
    if (!anchor) return;
    this.source = anchor;
    anchor.setAttribute('aria-expanded', 'true');

    // Read preferred placement from the anchor (e.g. data-menu-position)
    const position = anchor.dataset?.["menuPosition"] || "bottom-start";
    this.dataset["position"] = position;

    // Position via CSS anchor or JS fallback.
    //
    // CSS anchor positioning resolves `anchor-name` only within the same
    // tree scope as the positioned element. When the trigger lives in a
    // host's shadow root and the menu is slotted from light DOM (e.g.
    // sherpa-product-bar-v2's system menu), the anchor lookup fails
    // silently and the menu lands at 0,0. Detect that case and use the
    // getBoundingClientRect fallback even on browsers that support
    // CSS anchor positioning.
    const sameTreeScope = anchor.getRootNode() === this.getRootNode();
    if (supportsAnchor && sameTreeScope) {
      let anchorName = anchor.style.getPropertyValue("anchor-name");
      if (!anchorName) {
        anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
        anchor.style.setProperty("anchor-name", anchorName);
      }
      // Set position-anchor as inline style so anchor-name and
      // position-anchor resolve in the same tree scope — avoids
      // cross-shadow-root lookup failures with CSS anchor positioning.
      this.style.setProperty("position-anchor", anchorName);
      this.style.removeProperty("top");
      this.style.removeProperty("left");
      this.style.removeProperty("right");
      this.style.removeProperty("bottom");
    } else {
      const rect = anchor.getBoundingClientRect();
      const gap = 4;
      if (position.endsWith("-end")) {
        this.style.setProperty("top", `${rect.bottom + gap}px`);
        this.style.setProperty("right", `${document.documentElement.clientWidth - rect.right}px`);
        this.style.removeProperty("left");
      } else {
        this.style.setProperty("top", `${rect.bottom + gap}px`);
        this.style.setProperty("left", `${rect.left}px`);
        this.style.removeProperty("right");
      }
    }

    this.setAttribute("open", "");

    if (this.hasAttribute("popover")) {
      try {
        this.showPopover();
      } catch {
        /* already open */
      }
    }

    requestAnimationFrame(() => {
      this.querySelector<HTMLElement>(
        'sherpa-menu-item:not([disabled]):not([hidden]):not([type="heading"])',
      )?.focus();
    });
  }

  hide() {
    if (!this.open || this.#hiding) return;
    this.#hiding = true;
    this.removeAttribute("open");
    if (this.hasAttribute("popover")) {
      try {
        this.hidePopover();
      } catch {
        /* already closed */
      }
    }
    this.source?.focus?.();
    this.source?.setAttribute('aria-expanded', 'false');
    this.source = null;
    this.dispatchEvent(new CustomEvent("menu-close", { bubbles: true }));
    this.#hiding = false;
  }

  /* ── Popover light-dismiss ─────────────────────────────────── */

  #onToggle: EventHandler<ToggleEvent> = (e: Event) => {
    // popover="auto" light-dismiss: browser closed us externally
    if ((e as ToggleEvent).newState === "closed" && this.open && !this.#hiding) {
      this.hide();
    }
  };
  /** Get values of all checked menu items. */
  getSelectedValues(): string[] {
    const checked = this.querySelectorAll('sherpa-menu-item[checked]');
    return Array.from(checked, (item) => item.getAttribute('value') ?? '').filter(Boolean);
  }

  /** Uncheck all menu items. */
  clearSelection(): void {
    for (const item of this.querySelectorAll('sherpa-menu-item[checked]')) {
      item.removeAttribute('checked');
    }
  }
}

customElements.define("sherpa-menu", SherpaMenu);

export default SherpaMenu;
