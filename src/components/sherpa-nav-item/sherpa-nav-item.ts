/**
 * sherpa-nav-item — one row in a navigation menu. For navs built by hand;
 * sherpa-nav makes its own rows.
 *
 * Public API:
 *   data-icon        leading icon glyph
 *   data-label       label / heading text
 *   data-badge       trailing badge / count text
 *   data-status-dot  render the trailing chip as a small success/online dot
 *   data-expandable  a PARENT row: the whole row toggles, and it opens nothing
 *   data-expanded    expanded state — rotates the chevron
 *   data-description promo description (promo variant only)
 *   data-current     current item in the nav set
 *   data-href        render the row as a link — IGNORED while data-expandable
 *   data-type     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @tier sub-component
 */
import { SherpaElement, markMatch, define } from '../../core/ui/sherpa-element.js';

let uid = 0;

export class SherpaNavItem extends SherpaElement {
  static override css = new URL('./sherpa-nav-item.css', import.meta.url);
  static override html = new URL('./sherpa-nav-item.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-status-dot': { type: 'boolean', kind: 'style' },
    'data-tier': { type: 'enum', kind: 'style', values: ['2', '3'] },
    'data-icon': { type: 'string', kind: 'content' },
    'data-label': { type: 'string', kind: 'content' },
    'data-badge': { type: 'string', kind: 'content' },
    'data-description': { type: 'string', kind: 'content' },
    'data-href': { type: 'string', kind: 'style' },
    'data-current': { type: 'boolean', kind: 'style', accessor: 'current' },
    'data-expandable': { type: 'boolean', kind: 'style' },
    'data-expanded': { type: 'boolean', kind: 'style', accessor: 'expanded' },
  } as const;

  /** Installed by `define()` from the props' `accessor`. */
  declare current: boolean;
  declare expanded: boolean;

  /** `data-type` picks the tree, so a change to it must re-stamp. */
  static override variantAttrs = ['data-type'];

  /** The name of the search highlight this row registered. */
  #highlightName: string | null = null;
  /** Has the highlight style been added to the shadow root. */
  #highlightStyled = false;

  protected override get templateId(): string {
    return this.dataset['type'] === 'promo' ? 'promo' : 'default';
  }

  override onRender(): void {
    this.#sync();
    // The target is a native <button>/<a href>, so keyboard activation is free.
    this.addEventListener('click', this.#onClick);
  }

  override onChange(): void {
    this.#sync();
  }

  /** Write attribute state into the template. */
  #sync(): void {
    const promo = this.dataset['type'] === 'promo';

    // TRAP T-nav-item-writes-to-both-rows — $$ everywhere. The icon is out of
    // setAll because an icon name is not text.
    const setAll = (sel: string, text: string): void => {
      for (const el of this.$$(sel)) el.textContent = text;
    };
    for (const el of this.$$(promo ? '.promo-icon' : '.icon')) {
      this.writeIcon(el, this.dataset['icon'] ?? '');
    }
    // A textContent write would wipe highlight()'s <mark>; highlight() re-reads
    // data-label itself, so skipping never leaves the two disagreeing.
    for (const el of this.$$(promo ? '.promo-heading' : '.label')) {
      if (el.querySelector('mark.match')) continue;
      el.textContent = this.dataset['label'] ?? '';
    }

    if (promo) {
      setAll('.promo-description', this.dataset['description'] ?? '');
    } else {
      setAll('.badge', this.dataset['badge'] ?? '');
      // NAMED, because a collapsed rail hides the label and leaves the icon alone.
      const name = [this.dataset['label'], this.dataset['badge']].filter(Boolean).join(', ');
      for (const row of this.$$('.nav')) {
        if (name) row.setAttribute('aria-label', name);
        else row.removeAttribute('aria-label');
      }
    }

    const link = this.$<HTMLAnchorElement>(promo ? '.promo-link' : '.nav-link');
    if (link) {
      /* An EXPANDABLE row keeps no href even when one is configured: it opens
         nothing, so a middle-click or a screen reader must not be told it is a
         link. TRAP T-an-expandable-row-is-not-a-destination */
      const href = this.hasAttribute('data-expandable') ? undefined : this.dataset['href'];
      if (href) link.setAttribute('href', href);
      else link.removeAttribute('href');
    }

    const current = this.hasAttribute('data-current');
    for (const el of this.$$(promo ? '.promo' : '.nav')) {
      if (current) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }

    // CSS owns the chevron rotation; this is the a11y half.
    const expand = this.$('.expand');
    if (expand) {
      const open = this.hasAttribute('data-expanded');
      expand.setAttribute('aria-expanded', String(open));
      expand.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${this.dataset['label'] ?? ''}`.trim());
    }
  }

  /**
   * Mark a substring of this row's label as a search match. Null/empty clears it.
   *
   * TRAP T-custom-highlight-not-painted-in-shadow — the <mark> AND the Custom
   * Highlight are both needed; neither is redundant.
   */
  highlight(query: string | null): void {
    const full = this.dataset['label'] ?? '';
    const needle = query?.trim() ?? '';
    const at = needle ? full.toLowerCase().indexOf(needle.toLowerCase()) : -1;

    // TRAP T-nav-item-writes-to-both-rows — mark the first only and you may mark
    // the hidden row.
    const labels = this.$$(this.dataset['type'] === 'promo' ? '.promo-heading' : '.label');
    if (!labels.length) return;

    if (at < 0) {
      for (const label of labels) {
        if (label.childNodes.length !== 1 || label.firstChild?.nodeType !== Node.TEXT_NODE) {
          label.textContent = full;
        }
      }
      this.#clearHighlight();
      return;
    }

    const ranges: Range[] = [];
    for (const label of labels) {
      const mark = markMatch(label, full, at, needle.length);
      const text = mark.firstChild;
      if (text) {
        const range = new Range();
        range.selectNodeContents(text);
        ranges.push(range);
      }
    }

    const registry = (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights;
    if (!registry || typeof Highlight === 'undefined' || !ranges.length) return;
    const name = (this.#highlightName ??= `sherpa-item-${++uid}`);
    registry.set(name, new Highlight(...ranges));
    this.#ensureHighlightStyle(name);
  }

  /** Remove this row's search highlight. */
  #clearHighlight(): void {
    if (!this.#highlightName) return;
    (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights?.delete(this.#highlightName);
  }

  /** Add this row's ::highlight() rule to its own shadow root, once. */
  #ensureHighlightStyle(name: string): void {
    if (this.#highlightStyled || !this.shadowRoot) return;
    this.#highlightStyled = true;
    const sheet = new CSSStyleSheet();
    // The <mark>'s tint, declared in the CSS where the lint reads it.
    sheet.replaceSync(`::highlight(${name}){background-color:var(--_match-surface);color:var(--_match-ink)}`);
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
  }

  override onDisconnect(): void {
    // The registry is document-level — leave no orphan entry.
    this.#clearHighlight();
  }

  /** Report a click on a destination row. */
  #activate(): void {
    if (this.hasAttribute('disabled')) return;
    this.emit('item-select', {
      label: this.dataset['label'] ?? '',
      href: this.dataset['href'] ?? null,
    });
  }

  /** Open or close an Area, and report it. */
  #toggleExpand(): void {
    if (this.hasAttribute('disabled')) return;
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  }

  /** An Area toggles; any other row navigates. */
  #onClick = (event: MouseEvent): void => {
    /* AN EXPANDABLE ROW IS NOT A DESTINATION. The whole row toggles, not just
       the chevron: an Area groups its children, and the Contexts are the children.
       TRAP T-an-expandable-row-is-not-a-destination */
    if (this.hasAttribute('data-expandable')) {
      event.preventDefault();
      event.stopPropagation();
      this.#toggleExpand();
      return;
    }
    this.#activate();
  };
}

define('sherpa-nav-item', SherpaNavItem);
