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
 * @description Deprecated header row for sherpa-node. Use sherpa-node-row with
 *   data-variant="header" for all new nodes. This component is retained for backwards
 *   compatibility only and will be removed in v3.0.0.
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

import { SherpaNodeRow } from "../sherpa-node-row/sherpa-node-row.js";

export class SherpaNodeHeader extends SherpaNodeRow {
  static override get cssUrl(): string { return new URL("./sherpa-node-header.css", import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-node-header.html", import.meta.url).href; }
}

if (!customElements.get("sherpa-node-header")) {
  customElements.define("sherpa-node-header", SherpaNodeHeader);
}
