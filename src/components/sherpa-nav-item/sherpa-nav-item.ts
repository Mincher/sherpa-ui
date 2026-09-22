/**
 * sherpa-nav-item — one row in a navigation menu. For navs built by hand;
 * sherpa-nav makes its own rows.
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

let uid = 0;

export class SherpaNavItem extends SherpaElement {
  static override tier = 'sub-component' as const;
  static override css = new URL('./sherpa-nav-item.css', import.meta.url);
  static override html = new URL('./sherpa-nav-item.html', import.meta.url);

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  static override props = {
    'data-status-dot': { type: 'boolean', kind: 'style' },
    'data-tier': { type: 'enum', kind: 'style', values: ['2', '3'] },
  } as const;
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

  /** `data-type` picks the tree, so a change to it must re-stamp. */
  static override variantAttrs = ['data-type'];

  #highlightName: string | null = null;
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

  /** Write attribute state into the template. */
  #sync(): void {
    const promo = this.dataset['type'] === 'promo';

    // TRAP T-nav-item-writes-to-both-rows — $$ everywhere. The icon is out of
    // setAll because an FA class list is not text.
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
    }

    const link = this.$<HTMLAnchorElement>(promo ? '.promo-link' : '.nav-link');
    if (link) {
      const href = this.dataset['href'];
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

  #clearHighlight(): void {
    if (!this.#highlightName) return;
    (CSS as unknown as { highlights?: Map<string, Highlight> }).highlights?.delete(this.#highlightName);
  }

  /** Add this row's ::highlight() rule to its own shadow root, once. */
  #ensureHighlightStyle(name: string): void {
    if (this.#highlightStyled || !this.shadowRoot) return;
    this.#highlightStyled = true;
    const sheet = new CSSStyleSheet();
    // Same tint as the <mark>.
    sheet.replaceSync(
      `::highlight(${name}){background-color:var(--sherpa-theme-surface-active-transparent,#c046ff4d);` +
        `color:var(--sherpa-theme-content-body-base,#0c0b11)}`,
    );
    this.shadowRoot.adoptedStyleSheets = [...this.shadowRoot.adoptedStyleSheets, sheet];
  }

  override onDisconnect(): void {
    // The registry is document-level — leave no orphan entry.
    this.#clearHighlight();
  }

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
    // TRAP T-composed-path-not-target — a host listener sees a RETARGETED target,
    // so the chevron must be found in the composed path.
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
