/**
 * provider-mode.ts — the filter panel or the bars: which answers, the buttons
 * that switch them, and a narrow window. TRAP T-the-provider-owns-the-panel-mode
 *
 * Map:
 * - isColumn — Is it drawn over several scopes — the panel area's occupant?
 * - ModeHost — What the mode asks of its provider.
 * - ProviderMode — The panel or the bars, for one provider.
 * - .mode — What the panel and bars show now.
 * - .want — The app or the reader asks for a mode.
 * - .page — A page is about to be drawn: its filters open the wanted panel, and none shuts it.
 * - .join — A bar or a panel that joins takes the mode.
 * - .closed — Every close reports; a reader's is a choice worth keeping.
 * - .room — The shell lost room for the panel, or has it again.
 */
import { declared } from './provider-declared.js';

/** Is it the panel's content: what asks for a `scope`, over a scope list or declared a column? TODO 425, 436 */
export function isColumn(el: Element): boolean {
  const { asks, column } = declared(el);
  return asks?.shape === 'scope' && (column || scopesOf(el).length > 1);
}

/** The scopes it names. */
function scopesOf(el: Element): string[] {
  return (el.getAttribute('data-scope') ?? '').trim().split(/\s+/).filter(Boolean);
}

/** What the mode asks of its provider. */
export interface ModeHost {
  /** Every filter bar that asked. */
  bars(): Element[];
  /** Every panel that asked. */
  panels(): Array<HTMLElement & { show(): void; hide(reason?: string): void }>;
  /** Every panel in the subtree, asked or not: one asks only once drawn, after the first paint. */
  found(): Array<HTMLElement & { show(): void; hide(reason?: string): void }>;
  /** A fresh mode button from the provider's template — the panel's or the bars' — or null before it has drawn. */
  button(kind: 'panel' | 'bars'): HTMLElement | null;
  /** Settles once the provider has drawn its template. */
  rendered(): Promise<void>;
  /** The reader switched the mode. */
  changed(mode: 'toolbars' | 'panel'): void;
  /** A bar stepped back for the panel, or forward. */
  stepped(bar: Element): void;
}

/** The panel or the bars, for one provider. */
export class ProviderMode {
  /** The provider it serves. */
  readonly #host: ModeHost;
  /** What the panel and bars show now. */
  #mode: 'toolbars' | 'panel' = 'toolbars';
  /** What was ASKED for — a narrow window can refuse the panel for a while. */
  #wanted: 'toolbars' | 'panel' = 'toolbars';
  /** The shell has room for a panel area. TRAP T-the-panel-is-desktop-only */
  #room = true;
  /** The mode buttons, by the bar or panel each sits in. */
  #toggles = new WeakMap<Element, HTMLElement>();

  constructor(host: ModeHost) {
    this.#host = host;
  }

  /** What the panel and bars show now. */
  get mode(): 'toolbars' | 'panel' {
    return this.#mode;
  }

  /** The app or the reader asks for a mode. */
  want(mode: 'toolbars' | 'panel'): void {
    this.#wanted = mode;
    this.#setMode(mode);
    this.#early();
  }

  /** A page is about to be drawn: one with filters opens the panel the reader
   *  wants, one with none shuts it — before it paints. TRAP T-the-filter-mode-is-set-before-the-page-paints */
  page(filters: boolean): void {
    if (!filters) for (const panel of this.#host.found()) panel.hide('page');
    // A shut panel's close is reported a moment later: a page that wants it opens it whatever the mode says yet.
    else if (this.#wanted === 'panel' && (this.#mode !== 'panel' || this.#host.panels().some((p) => !p.hasAttribute('open')))) this.#setMode('panel');
    if (filters) this.#early();
  }

  /** A panel that has not asked yet is opened as it is: the shell's panel area
   *  is then there at the first paint. It takes the mode in full when it asks.
   *  TRAP T-the-filter-mode-is-set-before-the-page-paints */
  #early(): void {
    if (this.#wanted !== 'panel' || !this.#room || this.#host.panels().length) return;
    for (const panel of this.#host.found()) panel.show();
  }

  /** A bar or a panel that joins takes the mode — a page loaded later too. */
  join(el: Element): void {
    if (isColumn(el)) {
      if (this.#wanted === 'panel' && this.#mode !== 'panel') this.#setMode('panel');
      // What it answers for may have changed: each bar steps back, or forward. TODO 436
      else for (const bar of this.#strips()) this.#stepBack(bar);
    } else this.#stepBack(el);
    this.#giveToggles();
  }

  /** EVERY close reports, and a READER's is a choice worth keeping; a window
   *  too narrow is not. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  readonly closed = (event: Event): void => {
    // A close reported late, for a panel that has opened again since, is stale.
    if (this.#host.panels().some((p) => p.hasAttribute('open'))) return;
    this.#mode = 'toolbars';
    for (const bar of this.#strips()) this.#stepBack(bar);
    this.#giveToggles();
    // A narrow window, or a page with no filters, is not a choice.
    const reason = (event as CustomEvent<{ reason?: string }>).detail?.reason;
    if (reason === 'width' || reason === 'page' || this.#wanted === 'toolbars') return;
    this.#wanted = 'toolbars';
    this.#host.changed('toolbars');
  };

  /** The shell lost room for the panel: shut it, which is not a choice. Room
   *  again, and the reader wanted it: give it back. TRAP T-the-panel-is-desktop-only */
  readonly room = (event: Event): void => {
    this.#room = (event as CustomEvent<{ room?: boolean }>).detail?.room !== false;
    if (!this.#room) for (const panel of this.#host.panels()) panel.hide('width');
    else if (this.#wanted === 'panel') this.#setMode('panel');
  };

  /** Open or shut every panel, and step every bar back or forward to match. */
  #setMode(mode: 'toolbars' | 'panel'): void {
    const panels = this.#host.panels();
    for (const panel of panels) {
      if (mode !== 'panel') panel.hide();
      else if (this.#room) panel.show();
    }
    // With no room the panel stays shut, so follow what it actually did.
    this.#mode = mode === 'panel' && panels.some((p) => p.hasAttribute('open')) ? 'panel' : 'toolbars';
    for (const bar of this.#strips()) this.#stepBack(bar);
    this.#giveToggles();
  }

  /**
   * THE MODE'S OWN BUTTONS — the page's, so no bar or panel carries a switch
   * for a mode it knows nothing of (Will, TODO 37). The page's View bar has "View as filter
   * panel" in its `actions` slot while a panel is on the page, inactive while the panel is
   * shown; the panel has "Filter in the toolbars instead".
   * TRAP T-the-mode-switch-is-the-pages-own
   */
  #giveToggles(): void {
    const panels = this.#host.panels();
    for (const bar of this.#strips()) {
      let toggle = this.#toggles.get(bar);
      // ONE home, the page-level (View) bar in the app header: a local scope's bar never has it. Will, TODO 869
      // It switches the whole page's mode, so it stays even where the column leaves the View out ("Include View Context in the panel" off).
      if (!panels.length || (bar as HTMLElement).dataset['type'] !== 'view') {
        toggle?.remove();
        this.#toggles.delete(bar);
        continue;
      }
      // The header's bar keeps the page's switch in either mode. While the panel is shown it is inactive: the panel's own
      // header returns to the toolbars, and the bar may not be in view to do it (the View in the panel).
      toggle ??= this.#toggle(bar, 'panel');
      if (!toggle) continue;
      toggle.toggleAttribute('disabled', this.#mode === 'panel');
      if (!toggle.isConnected) bar.append(toggle);
    }
    for (const panel of panels) {
      if (!this.#toggles.has(panel)) this.#toggle(panel, 'bars');
    }
  }

  /** One mode button, from the template, into its host's `actions` slot — or,
   *  before the provider has drawn its template, once it has. */
  #toggle(host: Element, kind: 'panel' | 'bars'): HTMLElement | undefined {
    const button = this.#host.button(kind);
    if (!button) {
      void this.#host.rendered().then(() => this.#giveToggles());
      return undefined;
    }
    button.addEventListener('button-click', this.#onConfigure);
    // A content's switch goes in its panel's header, after the panel's own buttons.
    const panel = host.closest('sherpa-overlay-panel');
    if (panel) button.setAttribute('slot', 'actions-end');
    (panel ?? host).append(button);
    this.#toggles.set(host, button);
    return button;
  }

  /** The bars the mode switches: not a column's sections, in portrait. TODO 425 */
  #strips(): Element[] {
    return this.#host.bars().filter((bar) => (bar as HTMLElement).dataset['orientation'] !== 'portrait');
  }

  /** A bar steps back while a panel answers for it. A View the column leaves out
   *  stays a toolbar. Will, TODO 436. TRAP T-panel-mode-hides-what-the-panel-answers */
  #stepBack(bar: Element): void {
    bar.toggleAttribute('data-panel-mode', this.#mode === 'panel' && this.#answered(bar) && (bar as HTMLElement).dataset['orientation'] !== 'portrait');
    this.#host.stepped(bar);
  }

  /** Does a column answer this bar — hold its scope? */
  #answered(bar: Element): boolean {
    const scope = scopesOf(bar)[0] ?? '';
    return this.#host.panels().some((panel) => scopesOf(panel).includes(scope));
  }

  /** A mode button: the reader switches the mode. */
  #onConfigure = (): void => {
    this.#wanted = this.#mode === 'panel' ? 'toolbars' : 'panel';
    this.#setMode(this.#wanted);
    this.#host.changed(this.#wanted);
  };
}
