/**
 * @element sherpa-progress-bar
 * @category display
 * @description Horizontal progress bar for communicating the status of a single ongoing task.
 *   Use during file uploads, data imports, or any async operation where percentage completion
 *   can be reported. Set data-variant="indeterminate" when the duration is unknown. Always set
 *   data-label to describe what is in progress for screen reader users.
 *   NOTE: The native `value` and `max` HTML attributes are silently ignored — use
 *   `data-value` (0–100 percentage) instead.
 *
 * @attr {string}  data-label                  — Task label above the bar
 * @attr {number}  data-value                  — 0–100 percentage (determinate)
 * @attr {enum}    data-variant=determinate     — determinate | indeterminate
 * @attr {string}  data-status-text            — Override auto-generated status text
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProgressBar extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-progress-bar.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-progress-bar.html", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-label",
      "data-value",
      "data-variant",
      "data-status-text",
    ];
  }

  public els = this.cacheElements({
    label: { selector: '.label', type: HTMLSpanElement },
    fill: { selector: '.fill', type: HTMLDivElement },
    status: { selector: '.status', type: HTMLSpanElement }
  });

  /* ── lifecycle ───────────────────────────────────────────── */

  override onRender(): void {
    // Defaults
    if (!this.dataset["variant"]) this.dataset["variant"] = "determinate";

    // Accessibility
    if (!this.hasAttribute("role")) this.setAttribute("role", "progressbar");
    this.setAttribute("aria-valuemin", "0");
    this.setAttribute("aria-valuemax", "100");

    this.#syncLabel();
    this.#syncValue();
  }

  override onAttributeChanged(name: string, _old: string | null, _new: string | null): void {
    switch (name) {
      case "data-label":
        this.#syncLabel();
        break;
      case "data-value":
      case "data-variant":
      case "data-status-text":
        this.#syncValue();
        break;
    }
  }

  /* ── sync helpers ────────────────────────────────────────── */

  #syncLabel(): void {
    if (this.els.label) {
      this.els.label.textContent = this.dataset["label"] || "";
    }
  }

  #syncValue(): void {
    const isIndeterminate = this.dataset["variant"] === "indeterminate";
    const raw = parseFloat(this.dataset["value"] || "");
    const value = Number.isFinite(raw) ? Math.min(100, Math.max(0, raw)) : 0;

    // Fill width
    if (this.els.fill) {
      this.els.fill.style.setProperty("--_progress", `${value}%`);
    }

    // ARIA
    if (isIndeterminate) {
      this.removeAttribute("aria-valuenow");
    } else {
      this.setAttribute("aria-valuenow", String(value));
    }

    // Status text
    if (this.els.status) {
      if (isIndeterminate) {
        this.els.status.textContent = "";
      } else {
        this.els.status.textContent =
          this.dataset["statusText"] || `Loading: ${Math.round(value)}%`;
      }
    }
  }
}

customElements.define("sherpa-progress-bar", SherpaProgressBar);
export { SherpaProgressBar };
