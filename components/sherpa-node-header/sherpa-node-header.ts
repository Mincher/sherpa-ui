/**
 * sherpa-node-header.js — 48-tall header for sherpa-node.
 *
 * @deprecated since v2.1.0 — Will be removed in v3.0.0
 *
 * Use <sherpa-node-row data-variant="header"> instead.
 * This component is maintained for backward compatibility only.
 * New code should use the unified sherpa-node-row component.
 *
 * Migration:
 *   <sherpa-node-header data-icon="fa-home">Title</sherpa-node-header>
 *   →
 *   <sherpa-node-row data-variant="header" data-icon="fa-home">Title</sherpa-node-row>
 *
 * All attributes and slots remain identical. See:
 * docs/migrations/node-header-to-node-row.md
 *
 * Provides:
 *   • Built-in icon shorthand via data-icon="fa-..." (FontAwesome class)
 *   • Built-in drill-down button via data-drill-down (used by Group nodes)
 *
 * @element sherpa-node-header
 * @category content
 *
 * @attr {string}  data-icon        — FontAwesome class (e.g. "fa-solid fa-cube")
 * @attr {boolean} data-drill-down  — Show built-in drill-down button
 *
 * @fires sherpa-node-drilldown
 *   bubbles: true, composed: true
 *   detail: { nodeId | null }
 *
 * @slot icon          — Custom leading icon (overrides data-icon)
 * @slot title         — Header title text
 * @slot actions       — Trailing icons/buttons
 * @slot input-socket  — Slot in left gutter (control-flow input)
 * @slot output-socket — Slot in right gutter (control-flow output)
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaNodeHeader extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-node-header.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-header.html", import.meta.url).href; }

  /** Adopt the sherpa-node family tokens into every shadow root. */
  static override get sharedStyles() {
    return [
      ...super.sharedStyles,
      new URL("../sherpa-node/sherpa-node-tokens.css", import.meta.url).href,
    ];
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-icon",
      "data-drill-down",
    ];
  }

  els = this.cacheElements({
    iconBuiltIn: '.icon-built-in',
    iconWrap: '.icon',
    drillBtn: '.drill-down'
  });

  #bound = false;

  override onRender(): void {
    if (!this.#bound) {
      this.els.drillBtn?.addEventListener("click", this.#onDrillClick);
      this.#bound = true;
    }

    this.#syncIcon();
  }

  override onAttributeChanged(name: string) {
    if (name === "data-icon") this.#syncIcon();
  }

  /* ── Internals ─────────────────────────────────────────────────── */

  #syncIcon() {
    if (!this.els.iconBuiltIn || !this.els.iconWrap) return;
    const cls = this.dataset["icon"];
    if (cls) {
      this.els.iconBuiltIn.className = `icon-built-in ${cls}`;
      this.els.iconWrap.toggleAttribute("data-has-built-in", true);
    } else {
      this.els.iconBuiltIn.className = "icon-built-in";
      this.els.iconWrap.toggleAttribute("data-has-built-in", false);
    }
  }

  #onDrillClick = (e: Event) => {
    e.stopPropagation();
    const node = this.closest<HTMLElement>("sherpa-node");
    this.emit("sherpa-node-drilldown", { nodeId: node?.dataset?.["nodeId"] || null });
  };
}

if (!customElements.get("sherpa-node-header")) {
  customElements.define("sherpa-node-header", SherpaNodeHeader);
}
