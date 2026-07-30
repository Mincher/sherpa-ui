/**
 * sherpa-proposal-op.js
 * SherpaProposalOp — Single change row inside <sherpa-proposal-preview>.
 *
 * @element sherpa-proposal-op
 * @category ai
 * @description A single change entry inside a sherpa-proposal-preview. Represents one discrete
 *   add, remove, update, or edge operation from an AI proposal. Set data-op to the operation
 *   type for the appropriate colour-coded icon; slot the human-readable change description as
 *   the default text content. Not used standalone.
 *
 * @attr {enum}   data-op       add | remove | update | add-edge | remove-edge
 * @attr {string} data-target   Machine-readable target this op applies to (e.g. a node id,
 *                              edge id, or field key) — lets hosts apply/undo the op
 *                              programmatically rather than parsing the slotted text.
 * @attr {string} data-field    Optional field/property key the op changes (for update/filter ops)
 * @attr {string} data-value    Optional new value the op sets (for add/update ops)
 *
 * @slot — Label text describing the change
 */

import { SherpaElement } from "../utilities/sherpa-element/sherpa-element.js";

class SherpaProposalOp extends SherpaElement {
  static override get cssUrl(): string  { return new URL("./sherpa-proposal-op.css",  import.meta.url).href; }
  static override get htmlUrl(): string { return new URL("./sherpa-proposal-op.html", import.meta.url).href; }
}

customElements.define("sherpa-proposal-op", SherpaProposalOp);
export { SherpaProposalOp };
