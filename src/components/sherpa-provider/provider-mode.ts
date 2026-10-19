/**
 * provider-mode.ts — the filter panel or the bars: which answers, the buttons
 * that switch them, and a narrow window. TRAP T-the-provider-owns-the-panel-mode
 *
 * Map:
 * - ModeHost — What the mode asks of its provider.
 * - ProviderMode — The panel or the bars, for one provider.
 * - .mode — What the panel and bars show now.
 * - .want — The app or the reader asks for a mode.
 * - .join — A bar or a panel that joins takes the mode.
 * - .closed — Every close reports; a reader's is a choice worth keeping.
 * - .room — The shell lost room for the panel, or has it again.
 */

/** What the mode asks of its provider. */
export interface ModeHost {
  /** Every filter bar that asked. */
  bars(): Element[];
  /** Every panel that asked. */
  panels(): Array<HTMLElement & { show?: () => void; hide?: (reason?: string) => void }>;
  /** A fresh mode button from the provider's template — the panel's or the bars' — or null before it has drawn. */
  button(kind: 'panel' | 'bars'): HTMLElement | null;
  /** Settles once the provider has drawn its template. */
  rendered(): Promise<void>;
  /** The reader switched the mode. */
  changed(mode: 'toolbars' | 'panel'): void;
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
  #toggles = new Map<Element, HTMLElement>();

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
  }

  /** A bar or a panel that joins takes the mode — a page loaded later too. */
  join(el: Element): void {
    if ('drawScopes' in el && this.#wanted === 'panel' && this.#mode !== 'panel') this.#setMode('panel');
    else if (!('drawScopes' in el)) this.#stepBack(el);
    this.#giveToggles();
  }

  /** EVERY close reports, and a READER's is a choice worth keeping; a window
   *  too narrow is not. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  readonly closed = (event: Event): void => {
    this.#mode = 'toolbars';
    for (const bar of this.#host.bars()) this.#stepBack(bar);
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
    if (!this.#room) for (const panel of this.#host.panels()) panel.hide?.('width');
    else if (this.#wanted === 'panel') this.#setMode('panel');
  };

  /** Open or shut every panel, and step every bar back or forward to match. */
  #setMode(mode: 'toolbars' | 'panel'): void {
    const panels = this.#host.panels();
    for (const panel of panels) {
      if (mode !== 'panel') panel.hide?.();
      else if (this.#room) panel.show?.();
    }
    // With no room the panel stays shut, so follow what it actually did.
    this.#mode = mode === 'panel' && panels.some((p) => p.hasAttribute('open')) ? 'panel' : 'toolbars';
    for (const bar of this.#host.bars()) this.#stepBack(bar);
    this.#giveToggles();
  }

  /**
   * THE MODE'S OWN BUTTONS — the page's, so no bar or panel carries a switch
   * for a mode it knows nothing of (Will, TODO 37). A bar has "View as filter
   * panel" in its `actions` slot while a panel is on the page — taken out
   * while the panel answers; a panel has "Filter in the toolbars instead".
   * TRAP T-the-mode-switch-is-the-pages-own
   */
  #giveToggles(): void {
    const panels = this.#host.panels();
    for (const bar of this.#host.bars()) {
      let toggle = this.#toggles.get(bar);
      if (!panels.length) {
        toggle?.remove();
        this.#toggles.delete(bar);
        continue;
      }
      toggle ??= this.#toggle(bar, 'panel');
      if (!toggle) continue;
      if (this.#mode === 'panel') toggle.remove();
      else if (!toggle.isConnected) bar.append(toggle);
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
    host.append(button);
    this.#toggles.set(host, button);
    return button;
  }

  /** A bar steps back while a panel answers for it. TRAP T-panel-mode-hides-what-the-panel-answers */
  #stepBack(bar: Element): void {
    bar.toggleAttribute('data-panel-mode', this.#mode === 'panel');
  }

  /** A mode button: the reader switches the mode. */
  #onConfigure = (): void => {
    this.#wanted = this.#mode === 'panel' ? 'toolbars' : 'panel';
    this.#setMode(this.#wanted);
    this.#host.changed(this.#wanted);
  };
}
