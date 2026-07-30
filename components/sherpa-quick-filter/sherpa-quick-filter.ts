/**
 * sherpa-quick-filter.ts — A Quick Filter chip.
 *
 * The interactive chip used in sherpa-quick-filter-toolbar (and the App Shell
 * v2 header's filters slot). A funnel icon + label/value + an optional count
 * badge, with a chevron that opens the filter's option menu and an optional
 * dismiss × for user-added chips.
 *
 * Replaces the createElement-built chip groups in the old sherpa-filter-bar,
 * preserving its "Label: Value" + count-badge label convention.
 *
 * @element sherpa-quick-filter
 * @category control
 * @description An interactive filter chip. data-type sets the treatment
 *   (default | ai | populated); data-label is the field name, data-value the applied value(s).
 *   When a value is set the label reads "Label: Value" (or "Label" + a count badge for multiple).
 *   The chevron opens the option menu (fires quick-filter-menu-open); dismissible chips show an ×.
 *   AI chips (data-type="ai") support a data-thinking pulse and accept/dismiss for AI-suggested filters.
 *
 * @attr {string}  data-label       — Field/label text
 * @attr {string}  data-value       — Applied value display (comma-joined for multiple)
 * @attr {number}  data-count       — Show a count badge instead of inlining many values
 * @attr {enum}    data-type        — default | ai | populated
 * @attr {boolean} data-active      — Chip is active/open
 * @attr {boolean} data-thinking    — (ai) show the thinking pulse
 * @attr {boolean} data-dismissible — Show the × (user-added chip)
 * @attr {boolean} data-no-menu     — Hide the chevron (e.g. boolean toggle chip)
 * @attr {string}  data-field       — The underlying field key (passed through in events)
 *
 * @fires quick-filter-click     — Chip body clicked   · bubbles, composed · detail: { field, value }
 * @fires quick-filter-menu-open — Chevron clicked      · bubbles, composed · detail: { field }
 * @fires quick-filter-dismiss   — × clicked            · bubbles, composed · detail: { field }
 * @fires quick-filter-ai-accept — (ai) suggestion accepted · bubbles, composed · detail: { field }
 *
 * @method setValue(value)       — Set the applied value(s) and refresh the label
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";
import type { EventHandler } from "../utilities/types.js";

export class SherpaQuickFilter extends SherpaElement {
  static override get cssUrl(): string { return new URL("./sherpa-quick-filter.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-quick-filter.html", import.meta.url).href; }

  static override get observedAttributes(): string[] {
    return [...super.observedAttributes, "data-label", "data-value", "data-count"];
  }

  public els = this.cacheElements({
    main: { selector: ".chip-main", type: HTMLButtonElement },
    label: { selector: ".chip-label", type: HTMLElement },
    count: { selector: ".chip-count", type: HTMLElement },
    menu: { selector: ".chip-menu", type: HTMLButtonElement },
    dismiss: { selector: ".chip-dismiss", type: HTMLButtonElement },
  });

  #bound = false;

  override onRender(): void {
    if (!this.#bound) {
      this.els.main?.addEventListener("click", this.#onMain);
      this.els.menu?.addEventListener("click", this.#onMenu);
      this.els.dismiss?.addEventListener("click", this.#onDismiss);
      this.#bound = true;
    }
    this.#syncLabel();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-label" || name === "data-value" || name === "data-count") this.#syncLabel();
  }

  /* ── Public API ────────────────────────────────────────────────── */

  get field(): string { return this.dataset["field"] || this.dataset["label"] || ""; }

  public setValue(value: string | string[]): void {
    if (Array.isArray(value)) {
      if (value.length > 1) { this.dataset["count"] = String(value.length); this.dataset["value"] = value[0] ?? ""; }
      else { delete this.dataset["count"]; this.dataset["value"] = value[0] ?? ""; }
    } else {
      delete this.dataset["count"];
      if (value) this.dataset["value"] = value; else delete this.dataset["value"];
    }
    this.dataset["type"] = this.dataset["value"] ? "populated" : (this.dataset["type"] === "ai" ? "ai" : "default");
    this.#syncLabel();
  }

  /* ── Label sync (filter-bar's "Label: Value" convention) ───────── */

  #syncLabel(): void {
    if (!this.els.label) return;
    const label = this.dataset["label"] || "";
    const value = this.dataset["value"] || "";
    const count = this.dataset["count"];
    if (value && !count) {
      this.els.label.textContent = `${label}: ${value}`;
    } else {
      this.els.label.textContent = label;
    }
    if (this.els.count && count) this.els.count.textContent = count;
  }

  /* ── Interaction ───────────────────────────────────────────────── */

  #onMain: EventHandler<MouseEvent> = () => {
    // AI-suggested chips: clicking the body accepts the suggestion.
    if (this.dataset["type"] === "ai" && !this.dataset["thinking"]) {
      this.emit("quick-filter-ai-accept", { field: this.field });
      return;
    }
    this.emit("quick-filter-click", { field: this.field, value: this.dataset["value"] ?? "" });
  };

  #onMenu: EventHandler<MouseEvent> = (e: MouseEvent) => {
    e.stopPropagation();
    this.emit("quick-filter-menu-open", { field: this.field });
  };

  #onDismiss: EventHandler<MouseEvent> = (e: MouseEvent) => {
    e.stopPropagation();
    this.emit("quick-filter-dismiss", { field: this.field });
  };
}

customElements.define("sherpa-quick-filter", SherpaQuickFilter);
