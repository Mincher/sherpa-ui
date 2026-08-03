/**
 * sherpa-button.ts
 * SherpaButton — Multi-template button web component.
 *
 * Two templates (selected via data-type → get templateId()):
 *   default       — Standard button: icon(s) + label + badge
 *   icon          — Icon-only square button
 *
 * For compound button patterns (split, dismissable chip), compose separate
 * sherpa-button elements inside a .grouped-component wrapper.
 *
 * The button is self-managing for its own visual state and broadcasts
 * events so parent components (filter-bar, container) can orchestrate.
 *
 * Menu behaviour:
 *   Any button with data-menu="true" acts as a menu trigger.
 *   If data-menu-template is set, stamps the matching template from
 *   SherpaMenu.getMenuTemplate(id) then dispatches menu-populate.
 *
 * @element sherpa-button
 * @category control
 * @description The primary interactive trigger for any user action. Use for form submissions,
 *   opening dialogs, triggering navigation, and executing commands. Choose data-variant="primary"
 *   for the main action on a surface, "secondary" for supporting actions, and "tertiary" for
 *   low-emphasis inline actions. Set data-type="icon" for toolbar icon-only buttons. Add
 *   data-menu="true" to any button type to turn it into an integrated dropdown menu trigger —
 *   no separate overlay element is needed for simple menus.
 *   NOTE: Button text is set via the `data-label` attribute only — text placed between the
 *   component's opening and closing tags is never rendered.
 *
 * @attr {enum}    data-type            — default | icon
 * @attr {string}  data-label           — Button text label
 * @attr {enum}    data-variant         — primary | secondary | tertiary | tertiary-on-color
 * @attr {enum}    data-size            — 2x-small | x-small | small | base | large (default: base)
 * @attr {boolean} data-active          — Active/pressed toggle state
 * @attr {enum}    data-status          — critical | warning | success | info | urgent
 * @attr {string}  data-icon-start      — Leading icon (Font Awesome unicode)
 * @attr {string}  data-icon-end        — Trailing icon (Font Awesome unicode)
 * @attr {enum}    data-icon-weight     — fa-solid | fa-regular | fa-light
 * @attr {number}  data-count           — Badge count
 * @attr {boolean} data-menu            — Enable menu trigger on any button type
 * @attr {enum}    data-menu-position   — Menu placement (top | bottom | left | right)
 * @attr {string}  data-menu-template   — Menu template id to stamp from SherpaMenu
 * @attr {boolean} disabled             — Native disabled state
 *
 * @fires button-click — Main button area clicked
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-open — Menu is about to show
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-close — Menu was dismissed
 *   bubbles: true, composed: true
 *   detail: { }
 * @fires menu-select — Menu item selected
 *   bubbles: true, composed: true
 *   detail: { item: Element, action: string }
 * @fires menu-populate — Menu stamped and ready for dynamic items
 *   bubbles: true, composed: true
 *   detail: { menu: SherpaContainer }
 *
 * @data {array} [{ value, text, selected?, disabled?, keepOpen? }] — Menu items (flat), or
 *   sections [{ heading, items:[...] }], or a { items, options } wrapper to also pass MenuOptions.
 * @method populate(data) — Canonical menu data entry (items, sections, or { items, options })
 * @method setMenuItems(items, opts) — Populate menu with items array (called by populate())
 *   @param {Array} items — Flat array or sections format
 *   @param {object} [opts] — Options
 *   @returns {void}
 * @method getSelectedValues() — Get checked menu item values
 *   @returns {string[]}
 * @method clearSelection() — Clear all checked menu items
 *   @returns {void}
 *
 * @prop {boolean} disabled — Disabled state (read/write)
 * @prop {boolean} active — Active/pressed state (read/write)
 * @prop {string} label — Button text label (read/write)
 * @prop {string} templateId — Active template id (read-only)
 * @prop {SherpaContainer} menuElement — The floating container menu instance (read-only)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { SherpaContainer } from "../sherpa-container/sherpa-container.js";
import type { MenuItems, MenuOptions } from "../utilities/types.js";

/* ── Type Definitions ─────────────────────────────────────────────── */

/** Button-specific event details */
interface ButtonClickEventDetail {
  timestamp: number;
}

/* ── Component ─────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("./sherpa-button.css", import.meta.url).href;
  }
  static override get htmlUrl(): string {
    return new URL("./sherpa-button.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-variant",
      "data-size",
      "data-active",
      "disabled",
      "data-icon-start",
      "data-icon-end",
      "data-count",
      "data-menu",
      "data-menu-position",
      "data-menu-template",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  override get templateId(): string {
    const type = this.dataset["type"];
    // button-menu → default, icon-menu → icon for backward compat
    if (type === "button-menu") return "default";
    if (type === "icon-menu") return "icon";
    return type || "default";
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  // Cached shadow DOM elements
  public els = this.cacheElements({
    trigger: { selector: '.trigger', type: HTMLElement },
    label: '.label',
    iconStart: { selector: '.icon-start', type: HTMLElement },
    iconEnd: { selector: '.icon-end', type: HTMLElement },
    badge: '.badge',
  });

  // Menu container — created lazily; owns its own item-building.
  #menuEl: SherpaContainer | null = null;
  #menuClosedAt = 0;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  override onRender(): void {
    // Default variant for standard buttons
    const type = this.dataset["type"];
    if (!type && !this.dataset["variant"]) {
      this.dataset["variant"] = "primary";
    }
    if (!this.dataset["size"]) {
      this.dataset["size"] = "base";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
    this.els.trigger?.addEventListener("click", this.#onTriggerClick);
  }

  override onAttributeChanged(name: string, _old: string | null, newValue: string | null): void {
    switch (name) {
      case "disabled":
        this.setAttribute("aria-disabled", newValue !== null ? "true" : "false");
        break;

      case "data-label":
        this.#syncLabel();
        break;

      case "data-icon-start":
      case "data-icon-end":
        this.#syncIcons();
        break;

      case "data-count":
        this.#syncBadge();
        break;
    }
  }

  /* ── Label sync ───────────────────────────────────────────────── */

  #syncLabel(): void {
    if (!this.els.label) return;
    this.els.label.textContent = this.dataset["label"] ?? "";
  }

  /* ── Icons sync ───────────────────────────────────────────────── */

  // data-icon-start / data-icon-end accept a Font Awesome class string
  // (e.g. "fa-solid fa-star"). Legacy templates may still pass a single
  // FA unicode codepoint (e.g. "\uf005" via &#xf005;) — in that case the
  // value is rendered as textContent and the global font-family fallback
  // (set inline below) lets FA's @font-face show the glyph.
  #syncIcons(): void {
    if (this.els.iconStart) this.#applyIconValue(this.els.iconStart, 'icon-start', this.dataset["iconStart"]);
    if (this.els.iconEnd) this.#applyIconValue(this.els.iconEnd, 'icon-end', this.dataset["iconEnd"]);
  }

  #applyIconValue(el: HTMLElement, baseClass: string, value: string | undefined): void {
    const v = value || '';
    // FA class strings contain "fa-" tokens. Single-char or short non-class
    // values are treated as unicode glyphs rendered with the FA font.
    if (/\bfa-/.test(v)) {
      el.className = `${baseClass} ${v}`.trim();
      el.textContent = '';
      el.removeAttribute('data-unicode-icon');
    } else {
      el.className = baseClass;
      el.textContent = v;
      el.toggleAttribute('data-unicode-icon', !!v);
    }
  }

  /* ── Badge sync ───────────────────────────────────────────────── */

  #syncBadge(): void {
    if (!this.els.badge) return;
    this.els.badge.textContent = this.dataset["count"] ?? "";
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTriggerClick = (e: MouseEvent): void => {
    if (this.disabled) return;

    // Any button with data-menu="true" acts as a menu trigger
    if (this.dataset["menu"] === "true") {
      e.stopPropagation();
      this.#toggleMenu();
      return;
    }

    this.dispatchEvent(
      new CustomEvent<ButtonClickEventDetail>("button-click", {
        bubbles: true,
        composed: true,
        detail: { timestamp: Temporal.Now.instant().epochMilliseconds },
      }),
    );
  };

  /** Toggle the menu open/closed with debounce protection. */
  #toggleMenu(): void {
    if (this.#menuEl?.open || Temporal.Now.instant().epochMilliseconds - this.#menuClosedAt < 50) {
      this.#menuEl?.hide();
    } else {
      this.#showMenu();
    }
  }

  /* ── Menu ─────────────────────────────────────────────────────── */

  /** The button's own floating <sherpa-container> menu element (created lazily). */
  get menuElement(): SherpaContainer {
    return this.#ensureMenu();
  }

  /**
   * Lazily create and wire up the per-button floating container.
   * Inserted after the nearest light-DOM ancestor so that CSS anchor
   * positioning can resolve the anchor-name from the top layer.
   * anchor-name values are shadow-tree-scoped: if the button lives inside
   * a shadow root the container must be in the light DOM for the browser to
   * see the anchor once the popover is promoted to the top layer.
   */
  #ensureMenu(): SherpaContainer {
    if (this.#menuEl) return this.#menuEl;

    const menu = document.createElement("sherpa-container") as unknown as SherpaContainer;
    menu.setAttribute('popover', 'auto');
    menu.dataset['layout'] = 'menu';
    document.body.appendChild(menu);

    menu.addEventListener("container-select", (e: Event) => {
      e.stopPropagation();
      this.dispatchEvent(
        new CustomEvent("menu-select", {
          bubbles: true,
          composed: true,
          detail: (e as CustomEvent).detail,
        }),
      );
    });

    menu.addEventListener("container-close", (e: Event) => {
      e.stopPropagation();
      this.#menuClosedAt = Temporal.Now.instant().epochMilliseconds;
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
  async #showMenu(): Promise<void> {
    const menu = this.#ensureMenu();

    // Stamp static template from the overlay template registry (if set).
    // Only clear when stamping a template — setMenuItems() content persists.
    const tplId = this.dataset["menuTemplate"];
    if (tplId) {
      menu.replaceChildren();
      await SherpaContainer.ready;
      const html = SherpaContainer.getTemplate(tplId);
      if (html) {
        const frag = document.createRange().createContextualFragment(html);
        menu.append(frag);
      }
    }

    // Collect <template data-menu> from ancestors (composed tree)
    this.#collectAncestorMenuTemplates(menu);

    // Let consumers populate / modify the menu before showing.
    // menu-open fires synchronously — handlers can call setMenuItems() here
    // and items will be in the DOM before show() is called.
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

    const menuPosition = this.dataset["menuPosition"];
    if (menuPosition) menu.dataset['placement'] = menuPosition;
    // show() awaits container.rendered + all overlay-item.rendered internally
    menu.show(this);
  }

  /**
   * Walk the composed tree from this button upward, collecting
   * `<template data-menu>` elements and stamping their content
   * into the menu.
   *
   * When `data-menu-scope="shadow"` is set on the button, collection
   * stops at the immediate shadow host — ancestor templates beyond the
   * host component are not included. This prevents viz children from
   * inheriting their container's menu items.
   */
  #collectAncestorMenuTemplates(menu: SherpaContainer): void {
    // Remove items stamped from a previous open to prevent accumulation
    menu.querySelectorAll("[data-from-ancestor-tpl]").forEach((el: Element) => el.remove());

    // "none" — skip ancestor template collection entirely;
    // this button-menu uses only setMenuItems() content.
    if (this.dataset["menuScope"] === "none") return;

    const scopeToShadow = this.dataset["menuScope"] === "shadow";
    let node: Node | null = (this.getRootNode() as ShadowRoot)?.host ?? this.parentElement;
    while (node) {
      const element = node as Element;
      const templates = element.querySelectorAll?.(
        ":scope > template[data-menu]",
      );
      if (templates) {
        for (const tpl of templates) {
          if (!(tpl instanceof HTMLTemplateElement)) continue;
          const clone = tpl.content.cloneNode(true) as DocumentFragment;
          // Mark each top-level node so it can be removed on re-open
          for (const child of clone.children) {
            child.setAttribute("data-from-ancestor-tpl", "");
          }
          menu.append(clone);
        }
      }
      // Stop after the immediate shadow host when scoped
      if (scopeToShadow) break;
      const root = node.getRootNode?.();
      node = (root instanceof ShadowRoot ? root.host : null) ?? element.parentElement;
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */

  get disabled(): boolean {
    return this.hasAttribute("disabled");
  }
  set disabled(v: boolean) {
    if (v) { this.setAttribute("disabled", ""); } else { this.removeAttribute("disabled"); }
  }

  get active(): boolean {
    return this.hasAttribute("data-active");
  }
  set active(val: boolean) {
    this.toggleAttribute("data-active", !!val);
  }

  get label(): string {
    return this.dataset["label"] ?? "";
  }
  set label(val: string) {
    this.dataset["label"] = val;
  }

  /**
   * Programmatically populate the button's menu with items.
   * Creates <sherpa-overlay-item> elements inside the menu.
   *
   * Supports two formats:
   *
   * Flat array (simple list):
   *   setMenuItems([{ value, text, selected?, disabled?, keepOpen? }], { selection, group })
   *
   * Sections array (grouped with headings):
   *   setMenuItems([{ heading, items: [...], group?, selection? }])
   *   Each section produces a heading + <ul> with its items.
   *
   * Options:
   *   append  — if true, keep existing menu content (default: false)
   *   marker  — tag new elements for scoped cleanup on re-call; implies append
   */
  /**
   * Populate the button's menu. Dispatched from the unified `populate()` —
   * call `el.populate([{ value, text }])` (flat or sections), or a
   * `{ items, options }` wrapper. Item-building lives in the overlay; the
   * button just ensures the menu exists and delegates.
   */
  protected override renderData(source: unknown): void {
    this.#ensureMenu().populate(source as never);
  }

  /**
   * Populate the menu with items. Thin delegate to the overlay's own
   * `setMenuItems` — the single item-building implementation.
   */
  setMenuItems(items: MenuItems, opts: Partial<MenuOptions> = {}): void {
    this.#ensureMenu().setMenuItems(items, opts);
  }

  /**
   * Get values of all checked/selected menu items.
   */
  getSelectedValues(): string[] {
    return this.#menuEl?.getSelectedValues() ?? [];
  }

  /**
   * Clear all checked/selected menu items.
   */
  clearSelection(): void {
    this.#menuEl?.clearSelection();
  }
}

customElements.define("sherpa-button", SherpaButton);
