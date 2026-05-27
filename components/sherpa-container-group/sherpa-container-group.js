/**
 * sherpa-container-group.js
 * SherpaContainerGroup — Subgrid tile cluster for sherpa-layout-grid.
 *
 * Wraps a set of <sherpa-container> tiles inside a <sherpa-layout-grid>, so
 * they render as a single bordered region with seamless internal alignment
 * to the parent grid's column tracks.
 *
 * The host element IS the subgrid container — slotted children participate
 * in the host's grid via slot transparency. Border and corner clipping are
 * owned by the component's CSS.
 *
 * Group title: the FIRST slotted <sherpa-container>'s own
 * <sherpa-container-header> acts as the title for the whole group. The
 * group labels each tile with a managed `data-group-position` attribute
 * (`first` | `follow`). Follower tiles' header content is visually muted
 * (visibility: hidden) while the header band keeps its natural height —
 * so every tile's content baseline aligns across rows. See
 * sherpa-container.css / sherpa-container-header.css for the visual
 * mechanism (cascaded --_cg-header-vis / --_cg-header-sep).
 *
 * Cascading custom properties set on :host (inherit through shadow DOM
 * into slotted light-DOM children):
 *
 *   --_cg-border-width: 0   → child containers render borderless
 *   --_cg-border-radius: 0  → child containers render without corner rounding
 *
 * Usage:
 *   <sherpa-layout-grid>
 *     <sherpa-container-group data-col-span="12">
 *       <sherpa-container data-col-span="3">
 *         <sherpa-container-header slot="header" data-title="KPIs"></sherpa-container-header>
 *         …
 *       </sherpa-container>
 *       <sherpa-container data-col-span="3">…</sherpa-container>
 *       <sherpa-container data-col-span="3">…</sherpa-container>
 *       <sherpa-container data-col-span="3">…</sherpa-container>
 *     </sherpa-container-group>
 *   </sherpa-layout-grid>
 *
 * Only meaningful as a direct child of <sherpa-layout-grid> — subgrid
 * requires the host to be a grid item of a CSS grid container.
 *
 * @element sherpa-container-group
 * @category container
 *
 * @attr {enum} [data-col-span] — 2 | 3 | 4 | 6 | 8 | 9 | 12 — span across
 *   the parent <sherpa-layout-grid>'s columns. Defaults to a full row
 *   (1 / -1) when omitted.
 *
 * @attr {number} [data-row-span] — Number of outer-grid rows this group
 *   should span. Set this just as you would on a plain
 *   <sherpa-container> tile; the CSS `:host([data-row-span="N"])` rules
 *   emit `grid-row: span N` to claim the appropriate tracks.
 *
 * @slot (default) — One or more <sherpa-container> tiles. Each may carry
 *   its own data-col-span (2..12) and data-row-span (2..6). The first
 *   tile's `<sherpa-container-header slot="header">` serves as the group
 *   title; subsequent tiles' headers are visually muted but still reserve
 *   header-band height for cross-tile content alignment.
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

export class SherpaContainerGroup extends SherpaElement {
  static get htmlUrl() {
    return new URL("./sherpa-container-group.html", import.meta.url).href;
  }

  static get cssUrl() {
    return new URL("./sherpa-container-group.css", import.meta.url).href;
  }

  #defaultSlot = null;
  #stamped = new Set();

  onRender() {
    this.#defaultSlot = this.shadowRoot.querySelector("slot");
    this.#defaultSlot?.addEventListener("slotchange", () => this.#syncGroupPositions());
    this.#syncGroupPositions();
    // Compute the correct initial row span from whatever tile spans are current.
    // The router passes a static fallback value — this overrides it so that
    // regrouping after tile resizes (or on any subsequent group cycle) reflects
    // the actual layout rather than the hardcoded default.
    this.#updateRowSpan();

    // When a tile inside is resized, recompute how many outer rows the group
    // needs to claim. The tile's ResizeBehavior updates data-row-span before
    // the event reaches this element, so #computeRequiredRows() sees the
    // new value immediately.
    this.addEventListener("container-increase-rows", () => this.#updateRowSpan());
    this.addEventListener("container-decrease-rows", () => this.#updateRowSpan());
    this.addEventListener("container-increase-cols",  () => this.#updateRowSpan());
    this.addEventListener("container-decrease-cols",  () => this.#updateRowSpan());
  }

  /**
   * Simulate CSS grid auto-placement (row-by-row, no dense) across 12
   * columns to determine how many outer rows the group needs to span.
   * Uses only data-col-span / data-row-span attributes — no pixel measurement.
   */
  #computeRequiredRows() {
    const COLS = 12;
    /** @type {Map<number, number>} row index → 12-bit occupied-column bitmask */
    const rowBits = new Map();

    const canFit = (r, c, rs, cs) => {
      if (c + cs > COLS) return false;
      const mask = ((1 << cs) - 1) << c;
      for (let ri = r; ri < r + rs; ri++) {
        if ((rowBits.get(ri) ?? 0) & mask) return false;
      }
      return true;
    };

    const occupy = (r, c, rs, cs) => {
      const mask = ((1 << cs) - 1) << c;
      for (let ri = r; ri < r + rs; ri++) {
        rowBits.set(ri, (rowBits.get(ri) ?? 0) | mask);
      }
    };

    let cursorRow = 0, cursorCol = 0, maxRow = 0;

    for (const child of this.children) {
      if (child.nodeType !== 1 || child.hasAttribute("slot")) continue;
      const cs = Math.min(parseInt(child.dataset.colSpan) || 1, COLS);
      const rs = Math.max(parseInt(child.dataset.rowSpan) || 1, 1);

      outer: for (let r = cursorRow; ; r++) {
        const startCol = r === cursorRow ? cursorCol : 0;
        for (let c = startCol; c + cs <= COLS; c++) {
          if (canFit(r, c, rs, cs)) {
            occupy(r, c, rs, cs);
            if (r + rs > maxRow) maxRow = r + rs;
            cursorRow = r;
            cursorCol = c + cs;
            if (cursorCol >= COLS) { cursorRow = r + 1; cursorCol = 0; }
            break outer;
          }
        }
      }
    }

    return maxRow;
  }

  #updateRowSpan() {
    const required = this.#computeRequiredRows();
    if (required > 0) this.dataset.rowSpan = String(required);
  }

  onDisconnect() {
    for (const child of this.#stamped) {
      delete child.dataset.groupPosition;
    }
    this.#stamped.clear();
  }

  /**
   * Stamp `data-group-position` on each direct-child <sherpa-container>:
   * `first` on the first one, `follow` on the rest. sherpa-container.css
   * reads this attribute to cascade --_cg-header-vis: hidden and
   * --_cg-header-sep: transparent into follower tiles, muting their
   * header content while preserving header-band height so content
   * baselines align across rows. The first tile's header serves as the
   * group title.
   */
  #syncGroupPositions() {
    const current = new Set();
    let isFirst = true;
    for (const child of this.children) {
      if (child.nodeType !== 1 || child.hasAttribute("slot")) continue;
      if (child.tagName !== "SHERPA-CONTAINER") continue;
      child.dataset.groupPosition = isFirst ? "first" : "follow";
      current.add(child);
      isFirst = false;
    }
    // Clear stale stamps from tiles that left the group (e.g. ungrouped).
    for (const prev of this.#stamped) {
      if (!current.has(prev)) delete prev.dataset.groupPosition;
    }
    this.#stamped = current;
  }

}

customElements.define("sherpa-container-group", SherpaContainerGroup);
