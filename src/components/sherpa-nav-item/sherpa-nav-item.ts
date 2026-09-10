/**
 * sherpa-nav-item — one row in a navigation menu.
 *
 * Use this when you're building a nav by hand (sherpa-nav makes its own rows).
 * Each row has a leading icon (data-icon), a label (data-label), and an optional
 * badge (data-badge) or your own trailing content. Set data-href to make it a link.
 *
 * The "promo" style makes a bigger call-to-action row with an icon, a heading
 * (data-label), and a description (data-description).
 *
 * CSS handles the look; JS writes the text, sets the link, and fires the click.
 *
 * Expandable items (data-expandable) grow a trailing chevron caret. Clicking it
 * fires item-expand and toggles data-expanded, which CSS rotates the caret from.
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
 *   data-variant     "promo" for the CTA row
 *   disabled         disabled state
 *
 * @tier sub-component
 * @fires item-click — detail: { label, href }
 * @fires item-expand — detail: { expanded }
 */
import { SherpaElement } from '../../core/sherpa-element.js';

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

  /** This row's custom-highlight name, assigned on first use. */
  #highlightName: string | null = null;
  /** Whether its ::highlight() rule has been adopted into this root yet. */
  #highlightStyled = false;

  protected override get templateId(): string {
    return this.dataset['variant'] === 'promo' ? 'promo' : 'default';
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
    const promo = this.dataset['variant'] === 'promo';

    // Both the <button> and the <a href> row carry the icon/label — write to both.
    const setAll = (sel: string, text: string): void => {
      for (const el of this.$$(sel)) el.textContent = text;
    };
    // Icons are Font Awesome class lists ("fa-solid fa-house"); anything else is
    // treated as a literal glyph. Writing an FA class list as text would render the
    // class names, which is why this can't go through setAll.
    for (const el of this.$$(promo ? '.promo-icon' : '.icon')) {
      this.#applyIcon(el, this.dataset['icon'] ?? '');
    }
    // Skip the label while a search mark is in place — rewriting textContent would
    // wipe the <mark> highlight() just built. highlight() re-reads data-label itself,
    // so the two never disagree.
    for (const el of this.$$(promo ? '.promo-heading' : '.label')) {
      if (el.querySelector('mark.match')) continue;
      el.textContent = this.dataset['label'] ?? '';
    }

    if (promo) {
      setAll('.promo-description', this.dataset['description'] ?? '');
    } else {
      // BOTH rows carry a badge (the <button> row and the <a href> row; CSS shows
      // one). `this.$('.badge')` returns only the FIRST, which is the hidden
      // <button> row on a link item — so the visible badge stayed empty while a
      // zero-width offscreen one held the text. Same trap as the label above.
      setAll('.badge', this.dataset['badge'] ?? '');
    }

    // The <a href> row is a real link when data-href is set; CSS shows it in
    // place of the <button> row via :host([data-href]).
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

    // The chevron is a real toggle button, so it must announce its own state and
    // say WHAT it expands. CSS handles the rotation; this is the a11y half.
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
   * Two mechanisms, deliberately together:
   *
   *  1. The CSS Custom Highlight API — the right tool, and the one Will asked for.
   *     Each row registers its OWN uniquely-named highlight and styles it in its own
   *     root, because a single shared Highlight holding ranges from many shadow trees
   *     paints nothing.
   *  2. A real <mark> around the matched text — the VISIBLE result today. Chromium
   *     (verified on 153) does not paint custom highlights for text inside a shadow
   *     root, however the highlight is registered: a hard-coded ::highlight() paints
   *     on light-DOM text and is ignored here. <mark> is also the semantic element
   *     for a search hit, so assistive tech announces it.
   *
   * When the engine gains shadow-DOM highlight painting, (1) lights up for free and
   * (2) can be dropped without touching callers.
   *
   * Pass a null/empty query to clear the mark.
   */
  highlight(query: string | null): void {
    const full = this.dataset['label'] ?? '';
    const needle = query?.trim() ?? '';
    const at = needle ? full.toLowerCase().indexOf(needle.toLowerCase()) : -1;

    // BOTH rows carry a label (the <button> row and the <a href> row; CSS shows one).
    // Marking only the first would mark the HIDDEN one — which is exactly why the
    // highlight appeared to do nothing on link rows.
    const labels = this.$$(this.dataset['variant'] === 'promo' ? '.promo-heading' : '.label');
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
      const mark = document.createElement('mark');
      mark.className = 'match';
      mark.textContent = full.slice(at, at + needle.length);
      label.replaceChildren(
        document.createTextNode(full.slice(0, at)),
        mark,
        document.createTextNode(full.slice(at + needle.length)),
      );
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
    // The TRANSPARENT ACTIVE purple — the same tint as the <mark> fallback in the
    // CSS, so whichever one the engine paints, the hit looks identical.
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

  /** Render an icon as FA classes on an <i> when it looks like one, else as text. */
  #applyIcon(host: Element, value: string): void {
    if (/\bfa-/.test(value)) {
      const i = document.createElement('i');
      i.className = value;
      i.setAttribute('aria-hidden', 'true');
      host.replaceChildren(i);
    } else {
      host.textContent = value;
    }
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
    // A click on the trailing expand chevron toggles expansion, not navigation.
    //
    // Read composedPath(), NOT event.target. This listener is on the HOST, so by
    // the time the event arrives the target has been RETARGETED to the host itself
    // — `event.target.closest('.expand')` then searches the host's light DOM, finds
    // nothing, and every chevron click fell through to navigation instead.
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
