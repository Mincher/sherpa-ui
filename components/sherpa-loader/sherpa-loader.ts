/**
 * sherpa-loader.js
 * SherpaLoader — Animated loading indicator with spinner and optional label.
 *
 * Sets role="status" and aria-live="polite" on the host so assistive
 * technology announces when the loader appears or its label changes.
 *
 * @element sherpa-loader
 * @category feedback
 * @description Animated spinner for indicating that async content is loading. Use inside a
 *   container's loading slot, or overlay any region that is fetching data. Add data-panel to
 *   render a solid background surface for full-area loading states. Sets role="status" and
 *   aria-live="polite" so assistive technology announces when the spinner appears.
 *
 * @attr {enum}    data-orientation  — horizontal | vertical
 * @attr {enum}    data-size         — small | default | large
 * @attr {boolean} data-panel        — Surface background panel mode
 *
 * @slot label — Loading text displayed beside the spinner
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaLoader extends SherpaElement {
  static override get cssUrl(): string {
    return new URL("sherpa-loader.css", import.meta.url).href;
  }

  static override get htmlUrl(): string {
    return new URL("sherpa-loader.html", import.meta.url).href;
  }

  override onRender(): void {
    if (!this.hasAttribute("role")) this.setAttribute("role", "status");
    if (!this.hasAttribute("aria-live")) this.setAttribute("aria-live", "polite");
  }
}

customElements.define("sherpa-loader", SherpaLoader);
export { SherpaLoader };
