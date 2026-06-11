/**
 * sherpa-container-header.js
 * SherpaContainerHeader — Header row for sherpa-container.
 *
 * Renders title, description, and optional action buttons (drag handle,
 * open-external, overflow menu). Built to be slotted as a light-DOM child
 * of sherpa-container, but works inside any host element.
 *
 * Events from the embedded sherpa-button (menu-open, menu-close, buttonclick)
 * bubble and compose out of the header's shadow DOM and continue through
 * its host into any ancestor — no re-dispatching required.
 *
 * @element sherpa-container-header
 * @category container
 * @description Standard header row for a sherpa-container card. Provides title, optional
 *   description, and configurable action buttons (overflow menu, external-link, drag handle).
 *   Always slot it as slot="header" inside a container. Add data-menu-button to inject an
 *   overflow menu; the menu-select event bubbles through the header's shadow root into the
 *   container's ancestors without re-dispatching.
 *
 * @attr {string}  data-title          — Heading text
 * @attr {string}  data-description    — Secondary text (hidden when empty)
 * @attr {boolean} data-open-external  — Show the open-external button
 * @attr {boolean} data-menu-button    — Show the overflow menu button
 * @attr {boolean} data-drag-handle    — Show the drag handle
 *
 * @csspart header-row — Outer header element
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaContainerHeader extends SherpaElement {
  static override get htmlUrl(): string {
    return new URL("./sherpa-container-header.html", import.meta.url).href;
  }

  static override get cssUrl(): string {
    return new URL("./sherpa-container-header.css", import.meta.url).href;
  }

  static override get observedAttributes(): string[] {
    return [
      ...super.observedAttributes,
      "data-title",
      "data-description",
    ];
  }

  public els = this.cacheElements({
    title: '.header-title',
    description: '.header-description'
  });

  /* ── Lifecycle ─────────────────────────────────────────────── */

  override onRender(): void {
    this.#syncTitle();
    this.#syncDescription();
  }

  override onAttributeChanged(name: string): void {
    if (name === "data-title") this.#syncTitle();
    if (name === "data-description") this.#syncDescription();
  }

  /* ── Private sync ──────────────────────────────────────────── */

  #syncTitle(): void {
    if (this.els.title) this.els.title.textContent = this.dataset["title"] || "";
  }

  #syncDescription(): void {
    if (this.els.description)
      this.els.description.textContent = this.dataset["description"] || "";
  }
}

customElements.define("sherpa-container-header", SherpaContainerHeader);
