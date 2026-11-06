/**
 * sherpa-filter-panel — the CONTENT of a `sherpa-overlay-panel`: a section for every filter scope the page
 * offers, the View a heading and the rest accordions. The panel gives it its header, float, Pop, minimise
 * and tab; its own controls are cloned into that header and leave with it.
 * TRAP T-a-content-adopts-its-panels-header
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import type { DataAsk, Take } from '../../core/ui/context.js';
import type { ScopeDescription } from '../../core/data/data-source.js';
import type { FieldReading } from '../../core/data/filter-state.js';
import { FILTER_MENU_HTML } from '../../core/ui/filter-menu.js';
import type { Settings } from '../../core/data/settings.js';
import type { SavedSet } from '../../core/ui/filters-button.js';
import { drawCount } from '../../core/ui/filter-host.js';
import { ToolbarColumn } from './panel-column.js';
import '../sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js';
import '../sherpa-badge/sherpa-badge.js';
import '../sherpa-group/sherpa-group.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-section-header/sherpa-section-header.js';

/** The panel it sits in. */
type PanelLike = HTMLElement & { show(): void; hide(reason?: 'reader' | 'width' | 'page'): void };

export class SherpaFilterPanel extends SherpaElement {
  static override css = new URL('./sherpa-filter-panel.css', import.meta.url);
  static override html = [
    FILTER_MENU_HTML, new URL('../sherpa-quick-filter-toolbar/toolbar-rows.html', import.meta.url),
    new URL('./sherpa-filter-panel.html', import.meta.url),
  ];

  /* It ASKS for its `data-scope`: the source draws it and hears its reports.
     TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = { shape: 'scope' };
  static takes: readonly Take[] = [];
  // A panel's column, even over one scope: the provider's mode shows and shuts its panel. TRAP T-the-provider-owns-the-panel-mode
  static column = true;
  // The app's filter settings it reads, each onto its attribute.
  static override settings = {
    'data-limit-options': 'limitOptions', 'data-hide-unmatched': 'hideUnmatched', 'data-count-applied': 'countApplied',
  };

  static override props = {
    'data-scope': { type: 'string', kind: 'behaviour' },
    'data-saveable': { type: 'boolean', kind: 'behaviour' },
    'data-no-saves': { type: 'boolean', kind: 'behaviour' },
    'data-suggest': { type: 'boolean', kind: 'behaviour' },
    'data-applied': { type: 'number', kind: 'behaviour' },
    'data-count-applied': { type: 'boolean', kind: 'behaviour' },
    'data-at-default': { type: 'boolean', kind: 'behaviour' },
    'data-nothing-to-reset': { type: 'boolean', kind: 'behaviour' },
    'data-limit-options': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
    'data-hide-unmatched': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
    // Its panel is showing: the panel says, and this reports it. TRAP T-a-shut-column-draws-nothing
    open: { type: 'boolean', kind: 'behaviour' },
  } as const;
  static override observed = ['data-applied'];

  /** Its sections and its header's acts. */
  readonly #column = new ToolbarColumn({
    el: this,
    root: () => this.root,
    header: () => this.parentElement ?? this.root,
    clone: (selector) => this.clone(selector),
    emit: (name, detail, options) => { this.emit(name, detail, options); },
    toggleState: (name, on) => this.toggleState(name, on),
  });

  /** The panel it sits in. */
  get #panel(): PanelLike | null {
    return this.closest<PanelLike>('sherpa-overlay-panel');
  }

  override onConnect(): void {
    this.adoptHeader('template.header-tpl');
    this.#column.wire();
    this.#syncOpen();
    this.#syncHeader();
    const panel = this.#panel;
    if (panel) {
      this.on(panel, 'panel-search', (event) => this.#column.find((event as CustomEvent<{ value: string }>).detail.value));
      const watch = new MutationObserver(() => this.#syncOpen());
      watch.observe(panel, { attributes: true, attributeFilter: ['open'] });
      this.signal.addEventListener('abort', () => watch.disconnect(), { once: true });
    }
  }

  /** Off, the panel saves nothing. TODO 485 · TRAP T-saved-filters-are-every-scope */
  protected override onSettings(settings: Settings): void {
    this.toggleAttribute('data-no-saves', settings.get('saveAnyScope') !== true);
  }

  override onChange(name?: string): void {
    if (name === 'open' && this.hasAttribute('open')) this.#column.opened();
    // The saves are off while the filters are the View's own. Will, TODO 382
    if (name === 'data-at-default' || name === 'data-saveable' || name === 'data-no-saves') this.#column.saved(this.#column.sets);
    if (!name || ['data-saveable', 'data-no-saves', 'data-suggest', 'data-applied', 'data-count-applied'].includes(name)) this.#syncHeader();
  }

  /** The panel's own `open`, reported on this element. */
  #syncOpen(): void {
    this.toggleAttribute('open', !!this.#panel?.hasAttribute('open'));
  }

  /** The adopted controls say what the page offers: Suggest, the Save group, the count. */
  #syncHeader(): void {
    const at = (selector: string): HTMLElement | null => this.parentElement?.querySelector<HTMLElement>(`:scope > ${selector}`) ?? null;
    const saves = this.hasAttribute('data-saveable') && !this.hasAttribute('data-no-saves');
    const sets = this.hasState('has-sets');
    at('.column-suggest')?.toggleAttribute('hidden', !this.hasAttribute('data-suggest'));
    at('.saved-group')?.toggleAttribute('hidden', !(saves || sets));
    const save = at('.saved-group > .column-save-as');
    save?.toggleAttribute('hidden', !saves);
    const saved = at('.saved-group > .column-saved');
    saved?.setAttribute('data-group', saves ? 'end' : 'solo');
    saved?.setAttribute('data-icon-start', saves ? 'triangle-down' : 'filter');
    const n = Number(this.dataset['applied']) || 0;
    const shown = this.hasAttribute('data-count-applied') && n ? n : null;
    const badge = at('.applied-count');
    badge?.toggleAttribute('hidden', shown == null);
    drawCount(badge, shown, ['filter applied', 'filters applied']);
  }

  /** drawScopes(scopes) — a column's scopes, from its source: a portrait toolbar per scope. */
  drawScopes(scopes: ScopeDescription[]): void {
    this.#column.draw(scopes);
  }

  /** A chart's own answer, told the column as a panel: its section draws it. */
  drawReading(field: string, reading: FieldReading, scope?: string): void {
    if (scope) this.#column.drawReading(field, reading, scope);
  }

  /** The reader's saved sets: the Saved menu's. Drawn, never reported. TRAP T-saved-filters-are-every-scope */
  set savedSets(sets: readonly SavedSet[]) {
    this.#column.saved(sets);
    this.#syncHeader();
  }
  get savedSets(): SavedSet[] {
    return this.#column.sets;
  }

  /** Its panel is showing. */
  get open(): boolean {
    return this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  show(): void {
    const panel = this.#panel;
    panel?.show();
    // Asked to open before its panel has drawn: it is open as it is asked.
    if (panel) this.setAttribute('open', '');
  }

  /** EVERY close reports, and says why: the panel's `panel-close`. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  hide(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.#panel?.hide(reason);
    this.#syncOpen();
  }

  close(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.hide(reason);
  }

  toggle(): void {
    if (this.open) this.hide();
    else this.show();
  }
}

define('sherpa-filter-panel', SherpaFilterPanel);
