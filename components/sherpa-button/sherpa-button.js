/**
 * sherpa-button.js
 * Multi-template button web component.
 *
 * Four templates (selected via data-type → get templateId()):
 *   default       — Standard button: icon(s) + label + badge
 *   icon          — Icon-only square button
 *   button-select — Button + native <select> side by side (control group)
 *   icon-select   — Icon-only <select> (action picker / menu trigger)
 *
 * The button is self-managing for its own visual state and broadcasts
 * events so parent components (filter-bar, container) can orchestrate.
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
 * Events dispatched:
 *   buttonclick    — Trigger button clicked. detail: { }
 *   selectchange   — Select value changed.  detail: { value, values }
 *   chipremove     — Close button clicked.   detail: { }
 *   change         — Re-dispatched native change (bubbles, does not compose)
 *   menu-open      — Menu is about to show. detail: { }
 *   menu-close     — Menu was dismissed. detail: { }
 *   menu-select    — Menu item selected. detail: { item, action, ... }
 *   menu-populate  — Menu is ready for dynamic items. detail: { menu }
 *
 * Attributes:
 *   data-type, data-label, data-variant, data-size, data-active,
 *   data-status, data-icon-start, data-icon-end, data-icon-weight,
 *   data-closeable, data-count, disabled,
 *   data-menu, data-menu-position, data-menu-template
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import { SherpaMenu } from "../sherpa-menu/sherpa-menu.js";

/* ── Component ─────────────────────────────────────────────────── */

export class SherpaButton extends SherpaElement {
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
      "data-icon-start",
      "data-icon-end",
      "data-closeable",
      "data-count",
      "data-menu",
      "data-menu-position",
      "data-menu-template",
    ];
  }

  /* ── Template selection ───────────────────────────────────────── */

  get templateId() {
    return this.dataset.type || "default";
  }

  /* ── Private refs ─────────────────────────────────────────────── */

  #triggerEl = null;
  #labelEl = null;
  #iconStartEl = null;
  #iconEndEl = null;
  #badgeEl = null;
  #selectEl = null;
  #closeEl = null;
  #menuEl = null;
  #menuClosedAt = 0;
  #lightDomObserver = null;

  /* ── Lifecycle ────────────────────────────────────────────────── */

  onRender() {
    this.#triggerEl = this.$(".trigger");
    this.#labelEl = this.$(".label");
    this.#iconStartEl = this.$(".icon-start");
    this.#iconEndEl = this.$(".icon-end");
    this.#badgeEl = this.$(".badge");
    this.#selectEl = this.$(".select");
    this.#closeEl = this.$(".close");

    // Default variant for standard buttons (not button-select / icon-select)
    const type = this.dataset.type;
    if (!type && !this.dataset.variant) {
      this.dataset.variant = "primary";
    }

    if (this.hasAttribute("disabled")) {
      this.setAttribute("aria-disabled", "true");
    }

    this.#syncLabel();
    this.#syncIcons();
    this.#syncBadge();
    this.#initLightDomOptions();
  }

  onConnect() {
    this.#triggerEl?.addEventListener("click", this.#onTriggerClick);
    this.#selectEl?.addEventListener("change", this.#onSelectChange);
    this.#closeEl?.addEventListener("click", this.#onCloseClick);
    this.#observeLightDomOptions();
  }

  onDisconnect() {
    this.#triggerEl?.removeEventListener("click", this.#onTriggerClick);
    this.#selectEl?.removeEventListener("change", this.#onSelectChange);
    this.#closeEl?.removeEventListener("click", this.#onCloseClick);

    if (this.#lightDomObserver) {
      this.#lightDomObserver.disconnect();
      this.#lightDomObserver = null;
    }

    if (this.#menuEl) {
      if (this.#menuEl.open) this.#menuEl.hide();
      this.#menuEl.remove();
      this.#menuEl = null;
    }
  }

  onAttributeChanged(name, _old, newValue) {
    switch (name) {
      case "disabled":
        this.setAttribute("aria-disabled", newValue !== null ? "true" : "false");
        if (this.#selectEl) this.#selectEl.disabled = newValue !== null;
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

  #syncLabel() {
    if (!this.#labelEl) return;
    this.#labelEl.textContent = this.dataset.label ?? "";
  }

  /* ── Icons sync ───────────────────────────────────────────────── */

  #syncIcons() {
    if (this.#iconStartEl) {
      this.#iconStartEl.textContent = this.dataset.iconStart ?? "";
    }
    if (this.#iconEndEl) {
      this.#iconEndEl.textContent = this.dataset.iconEnd ?? "";
    }
  }

  /* ── Badge sync ───────────────────────────────────────────────── */

  #syncBadge() {
    if (!this.#badgeEl) return;
    this.#badgeEl.textContent = this.dataset.count ?? "";
  }

  /* ── Light DOM options import ───────────────────────────────────
   *
   * For any select-bearing template (button-select, icon-select),
   * import <option>, <optgroup>, <hr> from light DOM into the
   * shadow <select>. Consumers declare options declaratively as
   * children of the host element:
   *
   *   <sherpa-button data-type="button-select" data-label="Sort">
   *     <option value="">None</option>
   *     <option value="name">Name</option>
   *     <option value="date">Date</option>
   *   </sherpa-button>
   *
   * A MutationObserver watches for options added after initial
   * render so consumer code can append options at any time.
   * ─────────────────────────────────────────────────────────────── */

  #initLightDomOptions() {
    if (!this.#selectEl) return;
    this.#importLightDomOptions();
  }

  /** Copy light-DOM option/optgroup/hr children into the shadow select. */
  #importLightDomOptions() {
    if (!this.#selectEl) return;
    const nodes = this.querySelectorAll(
      ":scope > option, :scope > optgroup, :scope > hr",
    );
    if (!nodes.length) return;
    for (const el of nodes) {
      this.#selectEl.appendChild(el.cloneNode(true));
    }
  }

  /**
   * Watch for option/optgroup children added or removed after render.
   * When mutations occur, re-sync the shadow select from light DOM.
   */
  #observeLightDomOptions() {
    if (!this.#selectEl) return;

    const optionTags = new Set(["OPTION", "OPTGROUP", "HR"]);
    this.#lightDomObserver = new MutationObserver((mutations) => {
      const relevant = mutations.some((m) =>
        [...m.addedNodes, ...m.removedNodes].some(
          (n) => n.nodeType === 1 && optionTags.has(n.tagName),
        ),
      );
      if (!relevant) return;
      this.#selectEl.replaceChildren();
      this.#importLightDomOptions();
    });

    this.#lightDomObserver.observe(this, {
      childList: true,
      subtree: false,
    });
  }

  /* ── Event handlers ───────────────────────────────────────────── */

  #onTriggerClick = (e) => {
    if (this.disabled) return;

    if (this.dataset.menu === "true") {
      e.stopPropagation();
      // Light-dismiss closes the menu before this handler runs,
      // so check the timestamp to avoid immediately reopening.
      if (this.#menuEl?.open || Date.now() - this.#menuClosedAt < 50) {
        this.#menuEl?.hide();
      } else {
        this.#showMenu();
      }
      return;
    }

    this.dispatchEvent(
      new CustomEvent("buttonclick", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
  };

  #onSelectChange = (_e) => {
    if (this.disabled) return;
    const values = Array.from(
      this.#selectEl.selectedOptions,
      (o) => o.value,
    );
    this.dispatchEvent(
      new CustomEvent("selectchange", {
        bubbles: true,
        composed: true,
        detail: {
          value: this.#selectEl.value,
          values,
        },
      }),
    );
    // Re-dispatch change on host (native change doesn't cross shadow boundary)
    this.dispatchEvent(new Event("change", { bubbles: true }));
  };

  #onCloseClick = (e) => {
    e.stopPropagation();
    this.dispatchEvent(
      new CustomEvent("chipremove", {
        bubbles: true,
        composed: true,
        detail: {},
      }),
    );
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

    // Clear previous content to avoid duplicates on re-open
    menu.replaceChildren();

    // Stamp static template from the menu template registry (if set)
    const tplId = this.dataset.menuTemplate;
    if (tplId) {
      await SherpaMenu.ready;
      const html = SherpaMenu.getMenuTemplate(tplId);
      if (html) {
        const frag = document.createRange().createContextualFragment(html);
        menu.append(frag);
      }
    }

    // Collect <template data-menu> from ancestors (composed tree)
    this.#collectAncestorMenuTemplates(menu);

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

  /**
   * Walk the composed tree from this button upward, collecting
   * `<template data-menu>` elements and stamping their content
   * into the menu.
   */
  #collectAncestorMenuTemplates(menu) {
    let node = this.getRootNode()?.host ?? this.parentElement;
    while (node) {
      const templates = node.querySelectorAll?.(
        ":scope > template[data-menu]",
      );
      if (templates) {
        for (const tpl of templates) {
          menu.append(tpl.content.cloneNode(true));
        }
      }
      node = node.getRootNode?.()?.host ?? node.parentElement;
    }
  }

  /* ── Public API ──────────────────────────────────────────────── */

  get disabled() {
    return this.hasAttribute("disabled");
  }
  set disabled(v) {
    v ? this.setAttribute("disabled", "") : this.removeAttribute("disabled");
  }

  get active() {
    return this.hasAttribute("data-active");
  }
  set active(val) {
    this.toggleAttribute("data-active", !!val);
  }

  get label() {
    return this.dataset.label ?? "";
  }
  set label(val) {
    this.dataset.label = val;
  }

  /** The native <select> element in shadow DOM (button-select / icon-select). */
  get selectElement() {
    return this.#selectEl;
  }

  /** Current select value (single-select). */
  get value() {
    return this.#selectEl?.value ?? "";
  }
  set value(v) {
    if (this.#selectEl) this.#selectEl.value = v;
  }

  /**
   * Programmatically set options on the select.
   * If the button hasn't rendered yet, defers until render completes.
   * @param {Array<{value, text, selected?, disabled?}>} options
   */
  setOptions(options) {
    if (!this.#selectEl) {
      // Button hasn't rendered yet — defer until render completes
      this.rendered.then(() => this.setOptions(options));
      return;
    }
    this.#selectEl.replaceChildren();
    for (const o of options) {
      const opt = document.createElement("option");
      opt.value = o.value ?? "";
      opt.textContent = o.text ?? o.value ?? "";
      if (o.selected) opt.selected = true;
      if (o.disabled) opt.disabled = true;
      this.#selectEl.appendChild(opt);
    }
  }

  /**
   * Programmatically set option groups on the select.
   * If the button hasn't rendered yet, defers until render completes.
   * @param {Array<{label, options: Array<{value, text}>}>} groups
   */
  setOptionGroups(groups) {
    if (!this.#selectEl) {
      // Button hasn't rendered yet — defer until render completes
      this.rendered.then(() => this.setOptionGroups(groups));
      return;
    }
    this.#selectEl.replaceChildren();
    for (const g of groups) {
      const optgroup = document.createElement("optgroup");
      optgroup.label = g.label ?? "";
      for (const o of g.options || []) {
        const opt = document.createElement("option");
        opt.value = o.value ?? "";
        opt.textContent = o.text ?? o.value ?? "";
        if (o.selected) opt.selected = true;
        optgroup.appendChild(opt);
      }
      this.#selectEl.appendChild(optgroup);
    }
  }
}

customElements.define("sherpa-button", SherpaButton);
