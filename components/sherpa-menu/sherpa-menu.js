/**
 * sherpa-menu.js — Menu component (per-instance, no singleton).
 *
 * Light DOM <ul>/<li>/<sherpa-menu-item> content projected through <slot>.
 * Event delegation handles click + keyboard on slotted items.
 * Dispatches `menu-select` with detail:
 *   { item, action, value, label, selection, checked, group, data }
 *
 * If the selected item has a `data-event` attribute, an additional
 * CustomEvent with that name is dispatched (bubbles, composed) carrying
 * the same detail. This lets menu items fire semantic domain events
 * (e.g. "containerexport") without a translation layer.
 *
 * Each sherpa-button[menu] creates and owns its own <sherpa-menu> instance.
 * Uses popover="auto" for top-layer promotion and light-dismiss.
 * CSS anchor positioning (with JS fallback) for placement.
 *
 * Menu content templates:
 *   All menu templates are centralised in sherpa-menu.html and loaded
 *   once at module init. Components access them via the static API:
 *     await SherpaMenu.ready;
 *     const html = SherpaMenu.getMenuTemplate("container");
 *
 *   Available template ids:
 *     container  — Container overflow menu (resize, data, export)
 *     sort       — Sort column picker (filter chip)
 *     filter     — Value filter picker (filter chip)
 *     segment    — Segment column picker (filter chip)
 *     timeframe  — Time range presets (filter chip)
 */

import "../sherpa-menu-item/sherpa-menu-item.js";
import {
  SherpaElement,
  parseTemplates,
} from "../utilities/sherpa-element/sherpa-element.js";

const supportsAnchor = CSS.supports?.("anchor-name", "--test") ?? false;

/* ── Menu content templates (loaded once at module init) ───────── */

const MENU_HTML_URL = new URL("./sherpa-menu.html", import.meta.url).href;
let _menuTemplates = null; // Map<id, htmlString> — populated by _ensureTemplates()
let _menuTemplatesPromise = null;

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
  static get cssUrl() {
    return new URL("./sherpa-menu.css", import.meta.url).href;
  }
  static get htmlUrl() {
    return MENU_HTML_URL;
  }

  /**
   * Get a menu content template by id.
   * Returns the HTML string, or "" if not found.
   * Call after awaiting SherpaMenu.ready to guarantee availability.
   * @param {string} id — template id (e.g. "container", "sort")
   * @returns {string}
   */
  static getMenuTemplate(id) {
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

  source = null;
  #hiding = false;

  get open() {
    return this.hasAttribute("open");
  }

  onConnect() {
    this.addEventListener("click", this.#onClick);
    this.addEventListener("keydown", this.#onKeydown);
    this.addEventListener("toggle", this.#onToggle);
  }

  onDisconnect() {
    this.removeEventListener("click", this.#onClick);
    this.removeEventListener("keydown", this.#onKeydown);
    this.removeEventListener("toggle", this.#onToggle);
  }

  /* ── Event delegation ──────────────────────────────────────── */

  #onClick = (e) => {
    const item = e.target.closest?.("sherpa-menu-item");
    if (!item || item.hasAttribute("disabled")) return;

    const selection = item.dataset.selection;

    if (selection === "checkbox" || selection === "toggle") {
      item.toggleAttribute("checked");
    }
    if (selection === "radio") {
      this.#selectRadio(item);
    }

    this.#dispatchSelect(item);

    if (!item.hasAttribute("data-keep-open") && selection !== "toggle") {
      this.hide();
    }
  };

  #onKeydown = (e) => {
    const items = this.#focusableItems();
    if (!items.length) return;

    const idx = items.indexOf(document.activeElement);

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
        e.target.closest?.("sherpa-menu-item")?.click();
        break;
      case "Escape":
        e.preventDefault();
        this.hide();
        break;
    }
  };

  #focusableItems() {
    return [
      ...this.querySelectorAll(
        'sherpa-menu-item:not([disabled]):not([hidden]):not([data-type="heading"])',
      ),
    ];
  }

  /* ── Radio logic ───────────────────────────────────────────── */

  #selectRadio(item) {
    const group = item.dataset.group;
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

  /* ── Dispatch ──────────────────────────────────────────────── */

  #dispatchSelect(item) {
    const detail = {
      item,
      action: item.dataset.action || undefined,
      value: item.getAttribute("value") ?? undefined,
      label: item.textContent.trim(),
      selection: item.dataset.selection || undefined,
      checked: item.hasAttribute("checked"),
      group:
        item.dataset.group || item.closest("ul")?.dataset.group || undefined,
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
    const eventName = item.dataset.event;
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

  show(anchor) {
    if (!anchor) return;
    this.source = anchor;

    // Position via CSS anchor or JS fallback
    if (supportsAnchor) {
      let anchorName = anchor.style.getPropertyValue("anchor-name");
      if (!anchorName) {
        anchorName = `--sherpa-anchor-${Math.random().toString(36).slice(2, 9)}`;
        anchor.style.setProperty("anchor-name", anchorName);
      }
      this.style.setProperty("--sherpa-menu-anchor", anchorName);
      this.style.removeProperty("top");
      this.style.removeProperty("left");
    } else {
      const rect = anchor.getBoundingClientRect();
      this.style.setProperty("top", `${rect.bottom + 4}px`);
      this.style.setProperty("left", `${rect.left}px`);
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
      this.querySelector(
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
    this.source = null;
    this.dispatchEvent(new CustomEvent("menu-close", { bubbles: true }));
    this.#hiding = false;
  }

  /* ── Popover light-dismiss ─────────────────────────────────── */

  #onToggle = (e) => {
    // popover="auto" light-dismiss: browser closed us externally
    if (e.newState === "closed" && this.open && !this.#hiding) {
      this.hide();
    }
  };
}

customElements.define("sherpa-menu", SherpaMenu);

export default SherpaMenu;
