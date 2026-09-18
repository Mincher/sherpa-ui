/**
 * view-markup.ts — a view's content as MARKUP, parsed through an allow-list.
 *
 *   const frag = parseViewMarkup('<sherpa-container data-span="6">…</sherpa-container>');
 *
 * WHY MARKUP AT ALL. Every authored screen in this repo is already an HTML
 * template dropped into `sherpa-app-shell` — `examples/templates/*.html`, four
 * of them, and none calls `renderView`. A saved view is the same thing a user
 * made instead of an author, so it is the same format. One way to describe a
 * view, not two.
 *
 * WHY IT IS PARSED AND NOT ASSIGNED. A saved view arrives from
 * `localStorage`, from IndexedDB, or from a server — none of which this code
 * wrote, and any of which a person can edit. `innerHTML` on that string runs
 * whatever it contains.
 *
 * TRAP T-saved-markup-is-untrusted-input — the allow-list, what it drops, and
 * why `setHTML` is not enough on its own.
 *
 * NOT A GENERAL SANITISER. It does not try to make arbitrary HTML safe; it
 * accepts the small vocabulary a Sherpa view is written in and drops the rest.
 * That is a far easier promise to keep, and the only one worth making.
 */

/* ── The vocabulary ────────────────────────────────────────────────────── */

/**
 * Non-Sherpa tags a view may use.
 *
 * Layout and text only. **No `<a>`, `<img>`, `<form>`, `<input>`, `<iframe>`,
 * `<svg>`** — each is either a navigation surface, a network fetch or a script
 * vector, and a Sherpa view has a component for the job.
 */
const ALLOWED_TAGS = new Set([
  'div', 'span', 'section', 'p', 'br', 'hr', 'ul', 'ol', 'li',
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'strong', 'em', 'b', 'i', 'small', 'code', 'pre',
]);

/**
 * Non-`data-*` attributes a view may set.
 *
 * `class` is here because the layout grid is a class (`.sherpa-grid`). `style`
 * is NOT: it carries `url()` and `behavior`, and every visual in this system
 * belongs to a token or a `data-*` attribute anyway.
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
 * Any `sherpa-*` element passes: they are the vocabulary. An unknown one
 * renders as an inert unknown element rather than anything dangerous, which is
 * the correct outcome for a view saved against a newer component set.
 */
function tagAllowed(tag: string): boolean {
  return tag.startsWith('sherpa-') || ALLOWED_TAGS.has(tag);
}

/**
 * Whether an attribute is allowed on an element.
 *
 * `data-*` is the public API of every component here, so the whole namespace
 * passes. **`on*` never does** — an inline handler is a script, and the
 * allow-list below would not stop `onclick` without this check, because
 * `onclick` is not in it and therefore only fails by omission. Failing by
 * omission is fine until someone adds a broad rule; this fails on purpose.
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
 * Parsed with `DOMParser`, which builds an INERT document: no script runs, no
 * image loads, no stylesheet fetches, even for the nodes about to be dropped.
 * `innerHTML` on a live element does not make that promise about every case,
 * which is why this is a parse and not an assignment.
 *
 * TRAP T-saved-markup-is-untrusted-input.
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

    // BUILT FRESH, never adopted. Importing the parsed node would carry along
    // whatever the parser attached to it; creating a new element and copying
    // the attributes that pass means only the allow-list ever crosses over.
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
      // Comments and everything else are dropped without a note: a comment is
      // not a threat, and reporting one would bury the drops that matter.
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
 * Check saved markup WITHOUT building it — the half a server can run.
 *
 * The markup twin of `checkView`, and it exists for the same reason: an
 * endpoint deciding whether to ACCEPT a saved view needs an answer before
 * anything is rendered. It runs in a browser only (it needs `DOMParser`); a
 * Node server with no DOM should check markup at its own edge, which is why
 * this lives here rather than in the DOM-free half.
 */
export function checkViewMarkup(markup: string): { ok: boolean; report: MarkupReport } {
  const { report } = parseViewMarkup(markup);
  return { ok: report.tags.length === 0 && report.attributes.length === 0, report };
}
