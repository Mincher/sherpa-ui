/**
 * view-markup.ts — a view's content as MARKUP, parsed through an allow-list.
 *
 * A saved view is the same HTML an author would write into `sherpa-app-shell`,
 * but it comes from storage or a server, so it is parsed, never assigned.
 *
 * Not a general sanitiser: it accepts the small vocabulary a Sherpa view is
 * written in and drops the rest.
 *
 * TRAP T-saved-markup-is-untrusted-input
 *
 * Map:
 * - MarkupReport — What `parseViewMarkup` dropped, for a caller that wants to report it.
 * - ParseResult — the parsed fragment, plus what the allow-list dropped
 * - parseViewMarkup — Parse saved view markup into a fragment, dropping anything outside the vocabulary.
 * - checkViewMarkup — Check saved markup WITHOUT building it — the markup twin of `checkView`.
 */

/* ── The vocabulary ────────────────────────────────────────────────────── */

/**
 * Non-Sherpa tags a view may use — layout and text only.
 *
 * No `<a>`, `<img>`, `<form>`, `<input>`, `<iframe>`, `<svg>`: navigation
 * surfaces, network fetches and script vectors. A component does each job.
 */
const ALLOWED_TAGS = new Set([
  'div', 'span', 'section', 'p', 'br', 'hr', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'small', 'code', 'pre',
]);

/**
 * Non-`data-*` attributes a view may set.
 *
 * `class` is here because the layout grid is a class. `style` is not: it
 * carries `url()` and `behavior`.
 */
const ALLOWED_ATTRS = new Set([
  'class', 'id', 'slot', 'part', 'hidden', 'disabled', 'name', 'value',
  'type', 'role', 'aria-label', 'aria-labelledby', 'aria-describedby',
  'aria-hidden', 'aria-live', 'title', 'lang', 'dir',
]);

/** What `parseViewMarkup` dropped, for a caller that wants to report it. */
export interface MarkupReport {
  /** Tags removed entirely, with their subtree. */
  tags: string[];
  /** `element.attribute` pairs removed. */
  attributes: string[];
}

export interface ParseResult {
  fragment: DocumentFragment;
  report: MarkupReport;
}

/* ── Parsing ───────────────────────────────────────────────────────────── */

/**
 * Whether a tag name is allowed.
 *
 * Any `sherpa-*` passes — an unknown one renders inert, the right outcome for
 * a view saved against a newer component set.
 */
function tagAllowed(tag: string): boolean {
  return tag.startsWith('sherpa-') || ALLOWED_TAGS.has(tag);
}

/**
 * Whether an attribute is allowed on an element.
 *
 * `data-*` is the public API, so the whole namespace passes. `on*` is refused
 * ON PURPOSE, not merely by omission from the list below.
 */
function attrAllowed(name: string): boolean {
  const lower = name.toLowerCase();
  if (lower.startsWith('on')) return false;
  if (lower === 'style') return false;
  if (lower.startsWith('data-')) return true;
  return ALLOWED_ATTRS.has(lower);
}

/**
 * Parse saved view markup into a fragment, dropping anything outside the
 * vocabulary.
 *
 * TRAP T-saved-markup-is-untrusted-input
 */
export function parseViewMarkup(markup: string): ParseResult {
  const report: MarkupReport = { tags: [], attributes: [] };
  const fragment = document.createDocumentFragment();
  if (typeof markup !== 'string' || !markup.trim()) return { fragment, report };

  // INERT by specification — nothing in here executes or fetches.
  const doc = new DOMParser().parseFromString(`<body>${markup}</body>`, 'text/html');

  const clean = (source: Element): Element | null => {
    const tag = source.tagName.toLowerCase();
    if (!tagAllowed(tag)) {
      report.tags.push(tag);
      return null;
    }

    // BUILT FRESH, never adopted — only the allow-list crosses over.
    const el = document.createElement(tag);
    for (const attr of Array.from(source.attributes)) {
      if (attrAllowed(attr.name)) el.setAttribute(attr.name, attr.value);
      else report.attributes.push(`${tag}.${attr.name}`);
    }

    for (const child of Array.from(source.childNodes)) {
      if (child.nodeType === Node.TEXT_NODE) {
        el.appendChild(document.createTextNode(child.nodeValue ?? ''));
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        const cleaned = clean(child as Element);
        if (cleaned) el.appendChild(cleaned);
      }
      // Comments and the rest drop unreported — noting them buries the drops
      // that matter.
    }
    return el;
  };

  for (const node of Array.from(doc.body.childNodes)) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.nodeValue ?? '';
      if (text.trim()) fragment.appendChild(document.createTextNode(text));
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      const cleaned = clean(node as Element);
      if (cleaned) fragment.appendChild(cleaned);
    }
  }

  return { fragment, report };
}

/**
 * Check saved markup WITHOUT building it — the markup twin of `checkView`.
 *
 * Browser only (it needs `DOMParser`); a Node server checks at its own edge.
 */
export function checkViewMarkup(markup: string): { ok: boolean; report: MarkupReport } {
  const { report } = parseViewMarkup(markup);
  return { ok: report.tags.length === 0 && report.attributes.length === 0, report };
}
