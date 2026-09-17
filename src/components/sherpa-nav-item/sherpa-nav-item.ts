/**
 * sherpa-nav-item — one row in a navigation menu.
 *
 * Use this when building a nav by hand (sherpa-nav makes its own rows). CSS
 * handles the look; JS writes the text, sets the link, and fires the click.
 * The "promo" type is a bigger CTA row with a heading and a description.
 *
 * Public API:
 *   data-icon        leading icon glyph
 *   data-label       label / heading text
 *   data-badge       trailing badge / count text
 *   data-status-dot  render the trailing chip as a small success/online dot
 *   data-expandable  show a trailing expand chevron
 *   data-expanded    expanded state — rotates the chevron (toggled on chevron click)
 *   data-description promo description (promo variant only)
 *   data-current     current item in the nav set
 *   data-href        render the row as a link
 *   data-type     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @tier sub-component
 */
import { SherpaElement, markMatch } from '../../core/sherpa-element.js';

/** Counter for the per-row custom-highlight names (see highlight()). */
let uid = 0;

export class SherpaNavItem extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-nav-item.css', import.meta.url);
  static override html = new URL('./sherpa-nav-item.html', import.meta.url);
  static override observed = [
    'data-icon',
    'data-label',
    'data-badge',
    'data-description',
    'data-href',
    'data-current',
    'data-expandable',
    'data-expanded',
  ];

  /** `data-type` picks the tree, so a change to it has to re-stamp. */
  static override variantAttrs = ['data-type'];

  /** This row's custom-highlight name, assigned on first use. */
  #highlightName: string | null = null;
  /** Whether its ::highlight() rule has been adopted into this root yet. */
  #highlightStyled = false;

  protected override get templateId(): string {
    return this.dataset['type'] === 'promo' ? 'promo' : 'default';
  }

  override onRender(): void {
    this.#sync();
    // The activation target is a native <button>/<a href>, so it is focusable and
    // Enter/Space-activatable on its own — JS only listens for the resulting click.
    this.addEventListener('click', this.#onClick);
  }

  override onChange(): void {
    this.#sync();
  }

  /* ── Public API ───────────────────────────────────────────────── */

  get current(): boolean {
    return this.hasAttribute('data-current');
  }
  set current(v: boolean) {
    this.toggleAttribute('data-current', v);
  }

  get expanded(): boolean {
    return this.hasAttribute('data-expanded');
  }
  set expanded(v: boolean) {
    this.toggleAttribute('data-expanded', v);
  }

  /* ── Sync attribute state into the template ───────────────────── */

  #sync(): void {
    const promo = this.dataset['type'] === 'promo';

    // TRAP T-nav-item-writes-to-both-rows — $$ everywhere, and the icon cannot
    // go through setAll because an FA class list is not text.
    const setAll = (sel: string, text: string): void => {
      for (const el of this.$$(sel)) el.textContent = text;
    };
    for (const el of this.$$(promo ? '.promo-icon' : '.icon')) {
      this.writeIcon(el, this.dataset['icon'] ?? '');
    }
    // Skip a marked label: a textContent write would wipe highlight()'s <mark>,
    // and highlight() re-reads data-label itself so the two never disagree.
    for (const el of this.$$(promo ? '.promo-heading' : '.label')) {
      if (el.querySelector('mark.match')) continue;
      el.textContent = this.dataset['label'] ?? '';
    }

    if (promo) {
      setAll('.promo-description', this.dataset['description'] ?? '');
    } else {
      // TRAP T-nav-item-writes-to-both-rows
      setAll('.badge', this.dataset['badge'] ?? '');
    }

    // The <a href> row is a real link when data-href is set.
    const link = this.$<HTMLAnchorElement>(promo ? '.promo-link' : '.nav-link');
    if (link) {
      const href = this.dataset['href'];
      if (href) link.setAttribute('href', href);
      else link.removeAttribute('href');
    }

    // The current row carries aria-current="page" on its activation target.
    const current = this.hasAttribute('data-current');
    for (const el of this.$$(promo ? '.promo' : '.nav')) {
      if (current) el.setAttribute('aria-current', 'page');
      else el.removeAttribute('aria-current');
    }

    // The chevron is a real toggle button: it announces its state and what it
    // expands. CSS owns the rotation; this is the a11y half.
    const expand = this.$('.expand');
    if (expand) {
      const open = this.hasAttribute('data-expanded');
      expand.setAttribute('aria-expanded', String(open));
      expand.setAttribute('aria-label', `${open ? 'Collapse' : 'Expand'} ${this.dataset['label'] ?? ''}`.trim());
    }
  }

  /**
   * Mark a substring of this row's label as a search match.
   *
   * TRAP T-custom-highlight-not-painted-in-shadow — the <mark> AND the Custom
   * Highlight are both required; neither is redundant.
   *
   * Pass a null/empty query to clear the mark.
   */
  highlight(query: string | null): void {
    const full = this.dataset['label'] ?? '';
    const needle = query?.trim() ?? '';
    const at = needle ? full.toLowerCase().indexOf(needle.toLowerCase()) : -1;

    // TRAP T-nav-item-writes-to-both-rows — marking only the first marks the hidden one.
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
      // Rebuild each label as before + <mark> + after (no innerHTML).
      const mark = markMatch(label, full, at, needle.length);
      const text = mark.firstChild;
      if (text) {
        const range = new Range();
        range.selectNodeContents(text);
        ranges.push(range);
      }
    }

    // …and register the equivalent custom highlight over the marked text.
    const registry = (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights;
    if (!registry || typeof Highlight === 'undefined' || !ranges.length) return;
    const name = (this.#highlightName ??= `sherpa-item-${++uid}`);
    registry.set(name, new Highlight(...ranges));
    this.#ensureHighlightStyle(name);
  }

  /** Drop this row's entry from the document-level highlight registry. */
  #clearHighlight(): void {
    if (!this.#highlightName) return;
    (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights?.delete(this.#highlightName);
  }

  /** Add this row's ::highlight() rule to its own shadow root, once. */
  #ensureHighlightStyle(name: string): void {
    if (this.#highlightStyled || !this.shadowRoot) return;
    this.#highlightStyled = true;
    const sheet = new CSSStyleSheet();
    // TRAP T-custom-highlight-not-painted-in-shadow — the same tint as the <mark>.
    sheet.replaceSync(
      `::highlight(${name}){background-color:var(--sherpa-theme-surface-active-transparent,#c046ff4d);` +
        `color:var(--sherpa-theme-content-body-base,#0c0b11)}`,
    );
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
  }

  override onDisconnect(): void {
    // Leave no orphan entry in the document-level registry.
    this.#clearHighlight();
  }

  /* ── Interaction ──────────────────────────────────────────────── */

  #activate(): void {
    if (this.hasAttribute('disabled')) return;
    this.emit('item-click', {
      label: this.dataset['label'] ?? '',
      href: this.dataset['href'] ?? null,
    });
  }

  #toggleExpand(): void {
    if (this.hasAttribute('disabled')) return;
    const expanded = !this.hasAttribute('data-expanded');
    this.toggleAttribute('data-expanded', expanded);
    this.emit('item-expand', { expanded });
  }

  #onClick = (event: MouseEvent): void => {
    // A chevron click toggles expansion, not navigation.
    // TRAP T-composed-path-not-target — a host listener sees a RETARGETED target,
    // so every chevron click fell through to navigation.
    const path = event.composedPath();
    const onChevron = path.some(
      (n) => n instanceof Element && n.classList.contains('expand'),
    );
    if (this.hasAttribute('data-expandable') && onChevron) {
      event.preventDefault();
      event.stopPropagation();
      this.#toggleExpand();
      return;
    }
    this.#activate();
  };
}

customElements.define('sherpa-nav-item', SherpaNavItem);
