/**
 * swap.ts — a value in a component's markup that follows a host attribute: a
 * toggle's name, its icon, aria-pressed. TRAP T-a-swapped-label-is-in-the-markup
 *
 * Map:
 * - Swap — One element's swap, read from its markup.
 * - readSwaps — Every `[data-swap-on]` in a stamped tree, read before anything writes.
 * - applySwaps — Write each swap for the host's state now — only those following `changed`, when given.
 */
const ON = 'data-swap-on';
const PREFIX = 'data-swap-';
/** Only text, `title`, ARIA and `data-*` — never a script, a style or a URL. */
const ALLOWED = /^(aria-|data-|title$|text$)/;

/** One element's swap, read from its markup. */
export interface Swap {
  el: Element;
  /** The host attribute it follows; `is`: the value it needs, null for present. */
  attr: string;
  is: string | null;
  /** name, value while on, the template's own; `text` is the element's text. */
  pairs: [name: string, on: string, own: string | null][];
}

/** Every `[data-swap-on]` in a stamped tree, read before anything writes. */
export function readSwaps(root: ParentNode): Swap[] {
  return [...root.querySelectorAll(`[${ON}]`)].map((el) => {
    const spec = el.getAttribute(ON) ?? '';
    const at = spec.indexOf('=');
    const pairs: Swap['pairs'] = [];
    for (const { name, value } of [...el.attributes]) {
      if (name === ON || !name.startsWith(PREFIX)) continue;
      const target = name.slice(PREFIX.length);
      // Never another directive, and never a script's text.
      if (!ALLOWED.test(target) || target.startsWith(PREFIX) || (target === 'text' && el.localName === 'script')) continue;
      pairs.push([target, value, target === 'text' ? (el.textContent ?? '').trim() : el.getAttribute(target)]);
    }
    return { el, attr: at < 0 ? spec : spec.slice(0, at), is: at < 0 ? null : spec.slice(at + 1), pairs };
  });
}

/** Write each swap for the host's state now — only those following `changed`, when given. */
export function applySwaps(host: Element, swaps: readonly Swap[], changed?: string): void {
  for (const { el, attr, is, pairs } of swaps) {
    if (changed !== undefined && attr !== changed) continue;
    const now = host.getAttribute(attr);
    const on = is === null ? now !== null : now === is;
    for (const [name, alt, own] of pairs) {
      const want = on ? alt : own;
      if (name === 'text') {
        if (el.textContent !== (want ?? '')) el.textContent = want ?? '';
      } else if (want === null) el.removeAttribute(name);
      else if (el.getAttribute(name) !== want) el.setAttribute(name, want);
    }
  }
}
