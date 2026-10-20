/**
 * tree-rows.ts — which rows of a FLAT tree are hidden: each under a shut
 * parent, at any depth, found up its parent chain. The nav and a menu's tree
 * both ask it. DOM-free. TRAP T-parent-chain-walk-not-a-selector
 *
 * Map:
 * - hiddenRows — The ids under a shut parent, at any depth.
 */

/** The ids under a shut parent, at any depth. `open` holds only parents; one
 *  it does not name is open. A chain longer than the map is a loop, and ends. */
export function hiddenRows(
  ids: Iterable<string>, parentOf: ReadonlyMap<string, string>, open: ReadonlyMap<string, boolean>,
): Set<string> {
  const out = new Set<string>();
  for (const id of ids) {
    let p = parentOf.get(id);
    for (let n = 0; p !== undefined && n <= parentOf.size; p = parentOf.get(p), n++) {
      if (open.get(p) === false) {
        out.add(id);
        break;
      }
    }
  }
  return out;
}
