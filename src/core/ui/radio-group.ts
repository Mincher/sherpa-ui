/**
 * radio-group.ts — HTML's radio group, kept by hand: a shadow root around each
 * radio splits the native one. TRAP T-radios-in-shadow-roots-are-not-one-group
 *
 * Map:
 * - radioGroup — The radios grouped with `host`, itself included: same tag, tree, form and `name`.
 */

/** The radios grouped with `host`, itself included — HTML's rule: the same tag,
 *  the same tree (its root; a shadow root is a tree of its own), the same form
 *  owner and the same non-empty `name`. `formOf` reads a member's form owner. */
export function radioGroup<T extends Element>(host: T, formOf: (el: T) => HTMLFormElement | null): T[] {
  const name = host.getAttribute('name');
  if (!name) return [host];
  const form = formOf(host);
  const tree = host.getRootNode() as ParentNode;
  return [...tree.querySelectorAll<T>(`${host.localName}[name="${CSS.escape(name)}"]`)]
    // One not yet upgraded has no form link, and is not a member yet.
    .filter((el) => el instanceof (host.constructor as new () => T) && formOf(el) === form);
}
