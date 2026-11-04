/**
 * directives.ts — the one binding language: a template's markup says what fills
 * what. In the stamped tree a source is a HOST attribute, written again as it
 * changes; in an item prototype it is the ITEM's field, written once.
 * TRAP T-a-template-binds-by-markup
 *
 * Map:
 * - Directive — One write a node's markup asks for.
 * - readDirectives — Every directive in a stamped tree, read before anything writes.
 * - applyDirectives — Write each directive for its source now — only those following `changed`, when given.
 * - fillItem — Fill a cloned item from its fields once, and drop its directives.
 */
const TEXT = 'data-text';
const ATTR = 'data-attr-';
const WHEN = 'data-when-';
const INDEX = 'data-index';
/** Only text, ARIA, `data-*`, `title` and `value` — never a script, a style or a URL, nor another directive. */
const WRITABLE = /^(?:aria-|data-(?!text$|attr-|when-)|text$|title$|value$)/;

/** One write a node's markup asks for. */
export interface Directive {
  el: Element;
  /** `text`, `glyph` — a plain element's `data-icon` — or the attribute written. */
  name: string;
  /** What it follows: a host attribute, or an item's field (`a??b`). */
  from: string;
  /** A condition: the value `from` must have (null: present, not false), and what is written while it holds. */
  when?: { is: string | null; value: string };
  /** The template's own, written while the source is absent or the condition fails. */
  own: string | null;
  /** The glyph drawn last. */
  drawn?: string | null;
}

/** A source's value: a host attribute, or an item's field. */
type Read = (from: string) => unknown;
/** Draws a glyph: the element's `writeIcon`. */
type Glyph = (el: Element, value: string) => void;

/** One directive attribute, or null for any other. */
function parse(el: Element, attr: string, value: string): Directive | null {
  let name: string;
  let from = value.trim();
  let when: Directive['when'];
  if (attr === TEXT) name = 'text';
  else if (attr.startsWith(ATTR)) name = attr.slice(ATTR.length);
  else if (attr.startsWith(WHEN)) {
    name = attr.slice(WHEN.length);
    // `cond: value`, or a bare `cond` for a bare attribute; `cond` is `src` or `src=value`.
    const colon = value.indexOf(':');
    const cond = (colon < 0 ? value : value.slice(0, colon)).trim();
    const eq = cond.indexOf('=');
    from = eq < 0 ? cond : cond.slice(0, eq);
    when = { is: eq < 0 ? null : cond.slice(eq + 1), value: colon < 0 ? '' : value.slice(colon + 1).trim() };
  } else return null;
  if (!WRITABLE.test(name) || (name === 'text' && el.localName === 'script')) return null;
  // A plain element's `data-icon` is its glyph; a component's is its own attribute.
  if (name === 'data-icon' && !el.localName.includes('-')) name = 'glyph';
  // Trimmed, and blank is none, so `:empty` still collapses. TRAP T-the-templates-text-is-the-default
  const own = name === 'text' ? el.textContent?.trim() || null : el.getAttribute(name === 'glyph' ? 'data-icon' : name);
  return { el, name, from, ...(when ? { when } : {}), own };
}

/** What a directive writes for its source's value now. */
function wanted(d: Directive, value: unknown): string | null {
  if (!d.when) return value == null ? d.own : String(value);
  const holds = d.when.is === null ? value != null && value !== false : value != null && String(value) === d.when.is;
  return holds ? d.when.value : d.own;
}

/** Write one directive's value; nothing when it is there already. TRAP T-empty-write-lets-css-collapse */
function write(d: Directive, value: string | null, glyph: Glyph): void {
  const { el, name } = d;
  if (name === 'text') {
    if (el.textContent !== (value ?? '')) el.textContent = value ?? '';
  } else if (name === 'glyph') {
    if (d.drawn === value) return;
    d.drawn = value;
    glyph(el, value ?? '');
  } else if (value === null) el.removeAttribute(name);
  else if (el.getAttribute(name) !== value) el.setAttribute(name, value);
}

/** Every directive in a stamped tree, read before anything writes. Never inside a prototype. */
export function readDirectives(root: ParentNode): Directive[] {
  const out: Directive[] = [];
  for (const el of root.querySelectorAll('*')) {
    for (const { name, value } of el.attributes) {
      const d = parse(el, name, value);
      if (d) out.push(d);
    }
  }
  return out;
}

/** Write each directive for its source now — only those following `changed`, when given. */
export function applyDirectives(directives: readonly Directive[], read: Read, glyph: Glyph, changed?: string): void {
  for (const d of directives) {
    if (changed === undefined || d.from === changed) write(d, wanted(d, read(d.from)), glyph);
  }
}

/** An item's field: the first of `a??b` that is not null. */
function field(item: unknown, expr: string): unknown {
  if (item == null || typeof item !== 'object') return undefined;
  const record = item as Record<string, unknown>;
  for (const name of expr.split('??')) {
    const value = record[name.trim()];
    if (value != null) return value;
  }
  return undefined;
}

/** Fill a cloned item from its fields once, and drop its directives. `data-index`
 *  names the attribute that takes its position. TRAP T-item-template-cannot-compute */
export function fillItem(node: Element, item: unknown, index: number, glyph: Glyph): void {
  for (const el of [node, ...node.querySelectorAll('*')]) {
    // A snapshot: each directive is removed as it is read. TRAP T-row-fragment-cloned-whole
    for (const { name, value } of [...el.attributes]) {
      if (name === INDEX) {
        el.removeAttribute(name);
        if (WRITABLE.test(value)) el.setAttribute(value, String(index));
        continue;
      }
      const d = parse(el, name, value);
      if (!d) continue;
      el.removeAttribute(name);
      write(d, wanted(d, field(item, d.from)), glyph);
    }
  }
}
