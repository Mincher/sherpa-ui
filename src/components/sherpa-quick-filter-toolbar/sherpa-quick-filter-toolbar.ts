/**
 * sherpa-quick-filter-toolbar — the filter toolbar: a chip row that folds what does not fit, or,
 * in portrait, the panel's column. Reports what the reader did. TODO 425
 *
 * TRAP T-actions-were-a-slot
 *
 * Map:
 * - OrganiseDef — The columns the leading Group / Sort chips offer.
 */
import { DATA_PROPS, SHARED_PROPS, SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { NON_VALUE_ROWS, ORGANISE_ICONS, VIEW_CHIP } from '../../core/ui/shared-constants.js';
import { allow, type AllowList } from '../../core/data/allow.js';
import { advancedOf, arranges, kindOf, oneChipList } from '../../core/ui/filter-kind.js';
import { FILTER_MENU_HTML, menuFor } from '../../core/ui/filter-menu.js';
import type { FilterDef, FilterOption } from '../../core/ui/filter-def.js';
import {
  MANAGE_SETS, MenuDrill, OneRows, SavedSets, drawFiltersButton, type AddedFilter, type SavedSet,
} from '../../core/ui/filters-button.js';
import {
  FILTER_ACTIONS, MORE_MENU, askSwitches, drawFilterActions, extraRows, folded, hidesUnmatched, openMore, pickMore,
  saveRows, syncHide,
  type MoreRow,
} from '../../core/ui/more-menu.js';
import { answerWhenDrawn, arrangeFrom, drawCount, limitField, markField, NextFrame, organiseOptions, pendingFields } from '../../core/ui/filter-host.js';
import { report } from '../../core/data/report.js';
import { countSaid } from '../../core/data/filter-face.js';
import { DEFAULT_OP, valueKey, type SortDirection } from '../../core/data/store.js';
import { ruleOut } from '../../core/data/filter-state.js';
import { VIEW, readingAnswered, type QueryRequest } from '../../core/data/query.js';
import {
  modeOf, readingRows,
  type FieldReading,
} from '../../core/data/filter-state.js';
import type { FilterSet, OrganiseColumn, ScopeDescription, ScopeShows } from '../../core/data/data-source.js';
import type { DataAsk } from '../../core/ui/context.js';
import { toolbarKeys } from '../../core/ui/roving-focus.js';
import { dragToOrder } from '../../core/ui/drag-order.js';
import { ToolbarHeader } from './toolbar-header.js';
import { ToolbarColumn } from './toolbar-column.js';
import '../sherpa-quick-filter/sherpa-quick-filter.js';
import '../sherpa-menu/sherpa-menu.js';
import '../sherpa-button/sherpa-button.js';
import '../sherpa-switch/sherpa-switch.js';
import '../sherpa-input-text/sherpa-input-text.js';
import '../sherpa-badge/sherpa-badge.js';
import type { SherpaMenu } from '../sherpa-menu/sherpa-menu.js';
import type { SherpaQuickFilter } from '../sherpa-quick-filter/sherpa-quick-filter.js';
import type { SherpaSwitch } from '../sherpa-switch/sherpa-switch.js';

/** A filter chip, in the run or in a set. TRAP T-a-filter-set-groups-or-chains */
const CHIP = '.chips > .chip';
/** How long a pointer rests on a chip before it previews the highlight. TODO 449 */
const HOVER_WAIT = 150;

/** The columns the leading Group / Sort chips offer. */
export interface OrganiseDef {
  group?: OrganiseColumn[];
  sort?: OrganiseColumn[];
}

export type { OrganiseColumn } from '../../core/data/data-source.js';
export type { SortDirection } from '../../core/data/store.js';

export class SherpaQuickFilterToolbar extends SherpaElement {
  static override css = [MORE_MENU.css, new URL('./sherpa-quick-filter-toolbar.css', import.meta.url)];
  static override html = [
    FILTER_MENU_HTML, MORE_MENU.html, new URL('./toolbar-rows.html', import.meta.url),
    new URL('./sherpa-quick-filter-toolbar.html', import.meta.url),
  ];

  /* DECLARED: CSS-only, so the base class writes nothing. A `:host([data-x])`
     rule is a public API and belongs in one place. */
  /* It ASKS for its `data-scope`: the source draws it and hears its reports.
     TRAP T-a-component-asks-its-provider */
  static override asks: DataAsk = { shape: 'scope' };

  static override props = {
    'data-scroll-shadow': SHARED_PROPS['data-scroll-shadow'],
    'data-bounds': SHARED_PROPS['data-bounds'],
    /* LANDSCAPE, a strip; PORTRAIT, the panel's column: the scope an accordion,
       each list field a SECTION of value chips. Nothing folds. TODO 425 */
    'data-orientation': { type: 'enum', kind: 'template', values: ['landscape', 'portrait'] },
    // Portrait: its scope a HEADING, not an accordion — the column's View Context. Will, TODO 435
    'data-flat': { type: 'boolean', kind: 'template' },
    // Portrait: a COLUMN, header and all, even over ONE scope and its parts. Will, TODO 436
    'data-column': { type: 'boolean', kind: 'template' },
    // Its chips say no match counts: the app's choice, its provider's to write. Will, TODO 436
    'data-no-results': { type: 'boolean', kind: 'behaviour' },
    // How many filters are APPLIED in what it answers, as its provider counts them. TODO 436
    'data-applied': { type: 'number', kind: 'behaviour' },
    // A column's title counts them. TODO 436
    'data-count-applied': { type: 'boolean', kind: 'behaviour' },
    // The saved sets, the save rows and Manage: a Saved menu of their own. Will, TODO 436
    'data-saved-menu': { type: 'boolean', kind: 'behaviour' },
    // No "View Context" over the View's first filter, in toolbar mode. Will, TODO 436
    'data-no-context-label': { type: 'boolean', kind: 'visibility' },
    // No section names over its filters, in portrait. Will, TODO 436
    'data-no-sections': { type: 'boolean', kind: 'visibility' },
    // Each chip's menu offers "Highlight matches": the app's choice. Will, TODO 441
    'data-highlight-matches': { type: 'boolean', kind: 'behaviour' },
    // The chip that drives the highlight, as its source says. TODO 441
    'data-highlight-field': { type: 'string', kind: 'behaviour' },
    // A chip hovered previews what it matches: the app's choice. Will, TODO 449
    'data-highlight-hover': { type: 'boolean', kind: 'behaviour' },
    // A chip, or a section, is dragged into its place in the query: the app's choice. Will, TODO 452
    'data-reorder': { type: 'boolean', kind: 'style' },
    // In portrait, each field's heading in a column at its start: the app's choice. Will, TODO 460
    'data-label-column': { type: 'boolean', kind: 'behaviour' },
    // Every value's count, in a chip's menu too, picked or not: the app's choice. Will, TODO 466
    'data-every-count': { type: 'boolean', kind: 'behaviour' },
    // ASKED of its provider; in portrait, several make it the COLUMN. TODO 425
    'data-scope': { type: 'string', kind: 'template' },
    // The scope's name, as its source says it: a portrait bar's heading.
    'data-heading': { type: 'string', kind: 'content', to: '.scope', as: 'attr' },
    /* The host offers "Limit to matching filters", on or off. Will, TODO 178.
       TRAP T-the-more-menu-holds-what-folded */
    'data-limit-options': { type: 'enum', kind: 'style', values: ['on', 'off'] },
    // …and, while it is on, hides what it rules out. Will, TODO 205.
    'data-hide-unmatched': { type: 'enum', kind: 'behaviour', values: ['on', 'off'] },
    /* The host says a Reset to default would change nothing, so it is not
       offered. TODO 231 · TRAP T-reset-to-default-is-the-views-own */
    'data-at-default': { type: 'boolean', kind: 'style' },
    'data-nothing-to-reset': { type: 'boolean', kind: 'style' },
    'data-no-actions': { type: 'boolean', kind: 'style' },
    // Shows Figma's filter Switch, on a data bar. TRAP T-the-filter-switch-keeps-what-it-turned-off
    'data-switchable': { type: 'boolean', kind: 'visibility' },
    /* A filter PANEL is answering for this bar, so it hides what the panel
       also carries. TRAP T-panel-mode-hides-what-the-panel-answers */
    'data-panel-mode': { type: 'boolean', kind: 'style' },
    /* WHICH SCOPE this bar is. `view` narrows every component on the screen;
       `data` narrows the one component it belongs to. The bar reads it to
       refuse Group and Sort at view scope.
       TRAP T-group-and-sort-are-component-scope */
    'data-type': { type: 'enum', kind: 'style', values: ['view', 'data'] },
    /* The HOST owns this component's state; report, never write. */
    'data-locked': DATA_PROPS['data-locked'],
    /* Clear the chips when a new field set arrives, rather than keeping them. */
    'data-reset-on-populate': { type: 'boolean', kind: 'style' },
    'data-sort-field': DATA_PROPS['data-sort-field'],
    'data-sort-direction': DATA_PROPS['data-sort-direction'],
    'data-group-field': DATA_PROPS['data-group-field'],
    // The host saves filters: its ⋮ offers Save filters. TRAP T-saved-filters-are-every-scope
    'data-saveable': { type: 'boolean', kind: 'style' },
    // Its source fetches from outside: menus wait for Apply. TRAP T-commit-follows-select-mode
    'data-remote': { type: 'boolean', kind: 'behaviour' },
    'data-apply-on': DATA_PROPS['data-apply-on'],
    // The FIELDS its source says are changed and not applied. TRAP T-a-pending-chip-reads-as-a-warning
    'data-pending': { type: 'string', kind: 'behaviour' },
    // Its scope waits for ONE Apply, this bar's; something in it is not applied yet. TODO 406
    'data-waits': { type: 'boolean', kind: 'style' },
    // …or each field applies on its own: its menu's, or its section's, Apply. Will, TODO 451
    'data-field-apply': { type: 'boolean', kind: 'style' },
    // A list with nothing ticked is every row, not none. Will, TODO 489 · TRAP T-none-is-an-answer
    'data-none-shows-all': { type: 'boolean', kind: 'behaviour' },
    'data-dirty': { type: 'boolean', kind: 'behaviour' },
    // The FIELDS whose own read failed: a system error, not 0 matches. TODO 411
    'data-failed': { type: 'string', kind: 'behaviour' },
    // The fields the STORE answers, space-separated; read by its provider. 345 phase 6
    'data-fetch-fields': { type: 'string', kind: 'behaviour' },
  } as const;

  static override variantAttrs = ['data-orientation', 'data-scope', 'data-flat', 'data-column'];

  static override observed = ['open'];

  /** Portrait over one scope, an accordion — or flat; over several, the column. TODO 425, 435 */
  protected override get templateId(): string {
    if (this.dataset['orientation'] !== 'portrait') return 'default';
    if (this.hasAttribute('data-column') || (this.dataset['scope'] ?? '').trim().split(/\s+/).length > 1) return 'column';
    return this.hasAttribute('data-flat') ? 'flat' : 'portrait';
  }

  /** The column it is, over several scopes. */
  readonly #column = new ToolbarColumn({
    el: this,
    root: () => this.root,
    clone: (selector) => this.clone(selector),
    emit: (name, detail, options) => { this.emit(name, detail, options); },
    toggleState: (name, on) => this.toggleState(name, on),
  });
  /** Stamped as a column. */
  #columned = false;

  /** drawScopes(scopes) — a column's scopes, from its source: a portrait
   *  toolbar per scope, under the one header. TODO 425 */
  drawScopes(scopes: ScopeDescription[]): void {
    this.#column.draw(scopes);
  }

  /** A column is showing. */
  get open(): boolean {
    return this.hasAttribute('open');
  }
  set open(value: boolean) {
    if (value) this.show();
    else this.hide();
  }

  show(): void {
    this.toggleAttribute('open', true);
  }

  /** EVERY close reports, and says why. TRAP T-every-close-reports-or-the-toolbars-stay-hidden */
  hide(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    if (!this.hasAttribute('open')) return;
    this.removeAttribute('open');
    this.emit('filter-panel-close', { reason });
  }

  close(reason: 'reader' | 'width' | 'page' = 'reader'): void {
    this.hide(reason);
  }

  toggle(): void {
    if (this.hasAttribute('open')) this.hide();
    else this.show();
  }

  /** The filter defs this bar holds, in order. */
  #filters: FilterDef[] = [];
  /** A source has drawn this bar's scope. */
  #scoped = false;
  /** A source owns this bar's chips — bound, or drawn by one — so the Switch's
   *  list is the source's, from the first act. */
  get #sourced(): boolean {
    return this.#scoped || this.hasAttribute('data-locked');
  }
  /** With no source: the chips its Switch turned off. TRAP T-the-filter-switch-keeps-what-it-turned-off */
  #switchedOff: string[] | null = null;
  /** The columns the Group and Sort chips offer. */
  #organise: OrganiseDef = {};
  /** Filters the user MAY add but has not — the Add chip's menu. */
  #available: FilterDef[] = [];

  /* ── Fitting the bar ─────────────────────────────────────────────── */

  /** Watches the bar, so the chips fold as it narrows. */
  #observer: ResizeObserver | null = null;
  /** The pending reflow frame — a burst of resizes measures once. */
  #frame: number | null = null;

  /** How far the action cluster can fold. */
  static readonly COLLAPSE_STEPS = 3;

  /**
   * Fit the bar — collapse the actions, then fold chips from the end.
   *
   * TRAP T-reflow-resets-before-measuring — reset first, re-measure after each.
   */
  #reflow(): void {
    const bar = this.$('.bar');
    const chips = this.$('.chips');
    if (!bar || !chips) return;
    const was = { collapse: this.#collapse, folded: this.#folded };

    // Cumulative: step 2 sets collapse-1 and collapse-2. TRAP T-private-state-is-a-custom-state
    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) this.toggleState(`collapse-${step}`, false);
    this.#collapse = 0;
    this.set('data-folded', null);
    this.#showAllChips();

    for (let step = 1; step <= SherpaQuickFilterToolbar.COLLAPSE_STEPS; step++) {
      if (!this.#overflowing()) break;
      this.toggleState(`collapse-${step}`, true);
      this.#collapse = step;
    }

    const folded: HTMLElement[] = [];
    if (this.#overflowing()) {
      const run = this.#chips();
      for (let i = run.length - 1; i >= 0; i--) {
        const chip = run[i]!;
        chip.toggleAttribute('data-folded-away', true);
        folded.unshift(chip);
        this.set('data-folded', String(folded.length));
        if (!this.#overflowing()) break;
      }
    }
    // Nothing moved: the open menus stay. TRAP T-a-reflow-that-moves-nothing-keeps-its-menus
    if (this.#collapse === was.collapse
      && folded.length === was.folded.length && folded.every((c, i) => c === was.folded[i])) return;
    this.#closeOverflow();
    // What has folded changed.
    this.$<SherpaMenu>('.more-menu')?.hide?.();
    // The ONE Filters menu lists them. TRAP T-one-filters-button
    this.#folded = folded;
    this.#renderAvailable();
  }

  /** The chips the last fold took off the run, in bar order. */
  #folded: HTMLElement[] = [];
  /** The step the last fold collapsed the actions to. */
  #collapse = 0;

  /** Re-read every folded chip's pick count on its row. Separate from stamping, which rebuilds the open list. */
  #syncFoldedBadges(): void {
    const menu = this.$<HTMLElement>('.add-btn')
      ?.querySelector<SherpaMenu>('sherpa-menu');
    for (const chip of this.#folded) {
      if (chip.isConnected) menu?.setCount?.(chip.dataset['id'] ?? '', this.#chipPicks(chip).length);
    }
    this.#syncOverflowActive();
  }

  /**
   * The Filters button is ACTIVE only when a chip folded into it is — a DOOR to
   * filters, not a filter. A visible chip speaks for itself.
   * TRAP T-the-filters-button-is-a-door-not-a-filter
   */
  #syncOverflowActive(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    const any = this.#chips().some(
      (c) => c.hasAttribute('data-folded-away') && c.hasAttribute('data-current'),
    );
    if (any) add.dataset['status'] = 'active';
    else add.removeAttribute('data-status');
  }

  /** A folded chip's rows, moved into the Filters menu. TRAP T-drill-moves-not-clones */
  #drill = new MenuDrill();


  /** A folded chip's row asked for its child menu: drill into it. TRAP T-a-row-opens-its-child-menu */
  #onMenuDrill = (event: Event): void => {
    // While the Switch is off, a folded chip is as still as a shown one.
    if (this.#filtersSuspended) return;
    const id = String((event as CustomEvent).detail?.value ?? '');
    const add = this.pathFind(event, '.add-btn');
    const into = add?.querySelector<SherpaMenu>('sherpa-menu');
    const chip = id ? this.#chips().find((c) => c.dataset['id'] === id) ?? null : null;
    if (!add || !into || !chip) return;
    event.stopPropagation();
    // Back stays one level deep, never a chain.
    if (this.#drill.home) this.#drillOut();
    const label = this.#defById(id)?.label ?? chip.dataset['label'] ?? id;

    // An on/off chip has no menu: its row's tick answers it. TODO 54
    const from = chip.querySelector<SherpaMenu>('sherpa-menu');
    if (!from) return;

    /* NOTHING TO DRILL. An advanced-only menu answers with its condition
       ROWS, which live in its own shadow DOM — moving its empty light DOM put
       a blank card on screen, so the filter could never be answered, never
       went active, and never filtered. Show the menu ITSELF, anchored to the
       Filters button. TRAP T-a-conditions-only-menu-cannot-be-drilled
       A TREE too: a parent opens its children from its own list. TODO 391 */
    if (!from.children.length || from.matches(':state(tree)')) {
      this.#closeOverflow();
      from.show?.(add);
      return;
    }
    this.#drill.into(into, from, label);
  };

  /** A calendar picked a day or range. The chip relabels itself. */
  #onDatePicked = (event: Event): void => {
    const chip = this.#chipOf(event);
    // A committing menu's pick is a draft: its Apply asks. TRAP T-commit-follows-select-mode
    if (!chip || chip.querySelector('sherpa-menu')?.hasAttribute('data-commit')) return;
    // A date chip turns itself ON by picking — it has no body toggle. Locked, it is drawn.
    if (!chip.hasAttribute('data-locked')) chip.toggleAttribute('data-current', this.#chipPicks(chip).length > 0 || (chip as SherpaQuickFilter).answered);
    this.#emitChange(this.#answerRequest(chip));
  };

  /** A folded chip changed: redraw its badge in the Filters menu. */
  #onFoldedCountsChanged = (): void => {
    this.#syncFoldedBadges();
  };

  /** The drill-in menu's back arrow. */
  #drillOutHandler = (): void => {
    this.#drillOut();
  };

  /** Shut the Filters menu. ORDER MATTERS: drilled rows go back first. */
  #closeOverflow(): void {
    this.#drillOut();
    const menu = this.$<HTMLElement>('.add-btn')
      ?.querySelector<SherpaMenu>('sherpa-menu');
    menu?.hide();
  }

  /** Put a drilled-in filter's rows back and restore the Filters list. */
  #drillOut(): void {
    // Deferred: the badges are read once the rows are back in place.
    if (this.#drill.out()) queueMicrotask(() => this.#syncFoldedBadges());
  }

  /** Does the chip run want more room than it has? TRAP T-overflowing-needs-1px-slack */
  #overflowing(): boolean {
    // A portrait column never folds. TODO 425
    if (this.dataset['orientation'] === 'portrait') return false;
    const chips = this.$('.chips');
    return !!chips && chips.scrollWidth > chips.clientWidth + 1;
  }

  /** PORTRAIT: each LIST field's chip is a SECTION — its heading, then its
   *  values as value chips. A date, a number, a long list, Group, Sort and the
   *  View chip stay chips. TODO 425 */
  #syncLayout(): void {
    const portrait = this.dataset['orientation'] === 'portrait';
    for (const chip of this.#chips()) {
      const def = this.#defOf(chip);
      const menu = chip.querySelector<SherpaMenu>(':scope > sherpa-menu');
      // A field answered by conditions alone has no values to lay out: it stays a chip. TODO 426
      const list = !!def && menu?.getAttribute('data-type') === 'filter' && !menu.dataset['body']
        && !menu.hasAttribute('data-advanced-only')
        && !chip.hasAttribute('data-persistent') && !arranges(kindOf(def)) && !oneChipList(def);
      if (portrait && list) {
        chip.setAttribute('data-layout', 'section');
        chip.toggleAttribute('data-label-start', this.hasAttribute('data-label-column'));
        this.#syncFieldMore(chip);
      } else {
        chip.removeAttribute('data-layout');
        chip.removeAttribute('data-label-start');
        chip.querySelector(':scope > .field-more')?.remove();
      }
    }
    this.#markSections();
    this.#markHighlight();
  }

  /** Each chip's menu offers "Highlight matches", and the chip that drives
   *  wears it. Never a picker's. Will, TODO 441 */
  #markHighlight(): void {
    const offer = this.hasAttribute('data-highlight-matches');
    const driver = this.dataset['highlightField'];
    for (const chip of this.#chips()) {
      const drives = !!driver && chip.dataset['id'] === driver;
      chip.toggleAttribute('data-highlight', drives);
      const menu = chip.querySelector(':scope > sherpa-menu');
      menu?.toggleAttribute('data-highlightable', offer && !chip.hasAttribute('data-persistent'));
      menu?.toggleAttribute('data-highlight', drives);
      // A section's ⋮ says it too: its values are chips, and its menu stays shut.
      const more = chip.querySelector(':scope > .field-more');
      more?.toggleAttribute('data-highlightable', offer);
      const label = more?.querySelector('.more-item[value="highlight"] .more-label');
      if (label) label.textContent = this.word(drives ? 'unhighlight' : 'highlight');
    }
  }

  /** A chip's "Highlight matches": a REQUEST, which waits for no Apply. TODO 441 */
  #onHighlight = (event: Event): void => {
    const id = this.#chipOf(event)?.dataset['id'];
    if (id) this.#askHighlight(id, (event as CustomEvent<{ on: boolean }>).detail.on);
  };

  /** Ask that a field drive the highlight, or let it go. */
  #askHighlight(field: string, on: boolean): void {
    this.#ask({ field, highlight: on }, 'free');
  }

  /** The chip hovered. TODO 449 */
  #hovered: HTMLElement | null = null;
  /** …and what of it: the chip alone, or one value of it. TODO 459 */
  #hoverKey = '';
  /** The beat before it previews. */
  #hoverWait: ReturnType<typeof setTimeout> | undefined;
  /** It previews now. */
  #previewing = false;
  /** The page's pointermove, watched while something here is hovered. */
  #leaving: AbortController | null = null;

  /** Over an applied chip whose matches are counted, it previews them after a
   *  beat, so a pointer passing by previews nothing. Will, TODO 449.
   *  TRAP T-a-hovered-chip-previews-the-highlight */
  #onHoverChip = (event: Event): void => {
    const at = this.hasAttribute('data-highlight-hover') ? this.#hoverTarget(event) : null;
    const key = at ? `${at.chip.dataset['id'] ?? ''}\u0000${at.value ?? ''}` : '';
    if (key === this.#hoverKey) return;
    this.#leaveChip();
    if (!at) return;
    this.#hovered = at.chip;
    this.#hoverKey = key;
    /* LEFT is the page's pointermove off this bar: a bar in the panel's column
       heard no pointerout either. TRAP T-a-hovered-chip-previews-the-highlight */
    this.#leaving = new AbortController();
    document.addEventListener('pointermove', (e) => {
      if (!e.composedPath().includes(this)) this.#leaveChip();
    }, { signal: this.#leaving.signal });
    this.#hoverWait = setTimeout(() => {
      this.#previewing = true;
      this.#askPreview(at.chip, true, at.value);
    }, HOVER_WAIT);
  };

  /** What a pointer rests on: ONE value — a section's value chip, or a value row
   *  of a chip's open menu, picked or not — or an applied chip whose matches are
   *  counted, for its whole answer. Will, TODO 459 */
  #hoverTarget(event: Event): { chip: HTMLElement; value?: string } | null {
    const chip = this.#chipOf(event);
    if (!chip || chip.hasAttribute('data-persistent')) return null;
    const one = this.pathFind(event, '.value');
    if (one?.parentElement === chip && one.dataset['value']) return { chip, value: one.dataset['value'] };
    const row = this.pathFind(event, '.menu-row');
    if (row) {
      const box = row.querySelector<HTMLInputElement>(':scope > input');
      return box?.value && !row.matches('.qf-all, .qf-none') ? { chip, value: box.value } : null;
    }
    return chip.hasAttribute('data-current') && (chip as SherpaQuickFilter).results != null ? { chip } : null;
  }

  /** Out of the bar: the preview goes. Within it, the next pointermove decides. */
  #onLeaveBar = (event: Event): void => {
    const to = (event as PointerEvent).relatedTarget as Node | null;
    if (!to || (to !== this && !this.contains(to))) this.#leaveChip();
  };

  /** The chip is left: its preview, or its wait, goes. */
  #leaveChip(): void {
    this.#leaving?.abort();
    this.#leaving = null;
    clearTimeout(this.#hoverWait);
    if (this.#previewing && this.#hovered) this.#askPreview(this.#hovered, false);
    this.#previewing = false;
    this.#hovered = null;
    this.#hoverKey = '';
  }

  /** Ask that a field — or one value of it — PREVIEW the highlight, or stop: never kept. */
  #askPreview(chip: HTMLElement, on: boolean, value?: string): void {
    const field = this.#fieldFor(chip.dataset['id'] ?? '');
    if (field == null) return;
    this.#ask({ field, preview: on, ...(value != null ? { value } : {}) }, 'free');
  }

  /** Each SECTION's name over the first chip of its run, in portrait: a named
   *  section's, or a lone chip's own field's — a list field heads itself, and
   *  a persistent chip is a picker. Will, TODO 438 · TRAP T-a-section-is-headed-once */
  #markSections(): void {
    const portrait = this.dataset['orientation'] === 'portrait';
    let run = '';
    for (const chip of this.#chips()) {
      const def = this.#defOf(chip);
      const own = chip.hasAttribute('data-layout') || chip.hasAttribute('data-persistent') ? '' : def?.label ?? '';
      const name = def?.section ?? own;
      const key = def?.section ? `section:${def.section}` : `chip:${chip.dataset['id']}`;
      if (portrait && name && key !== run) chip.setAttribute('data-section-start', name);
      else chip.removeAttribute('data-section-start');
      run = key;
    }
  }

  /** Put every chip back, before a fresh measurement. */
  #showAllChips(): void {
    for (const chip of this.#chips()) {
      chip.removeAttribute('data-folded-away');
    }
  }

  /** The bar resized: fold again on the next frame. */
  #onResize = (): void => {
    /* TRAP T-resize-reschedule-never-drop — cancel and re-queue, never return
       when a frame is already pending. */
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = requestAnimationFrame(() => {
      this.#frame = null;
      this.#reflow();
    });
  };

  override onRender(): void {
    /* A COLUMN hears only its header: its sections are toolbars of their own,
       whose events stop at this host. TODO 425 */
    this.#columned = this.templateId === 'column';
    this.toggleState('column', this.#columned);
    if (this.#columned) return this.#column.wire();
    // Left and Right move between the bar's controls. TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs
    const bar = this.$('.bar');
    if (bar) toolbarKeys(bar);
    // PORTRAIT: the accordion says which component its scope narrows. TODO 457
    this.#drawDescription();
    this.addEventListener('quick-filter-click', this.#onChipClick);
    // Delegated: every control fires the same button-click; data-act says which.
    this.$('.actions-zone')?.addEventListener('button-click', this.#onAction);
    this.$('.more-menu')?.addEventListener('menu-select', this.#onMore);
    this.$('.more-menu')?.addEventListener('menu-change', this.#onMoreSwitch);
    this.$('.filters-switch')?.addEventListener('change', this.#onSwitch);
    // CAPTURE — see #onChipChange.
    this.addEventListener('quick-filter-change', this.#onChipChange, true);
    this.addEventListener('quick-filter-change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-change', this.#onFoldedCountsChanged);
    // A committing menu fires nothing while rows are ticked; their native
    // `change` reaches here, being in the CHIP's light DOM.
    this.addEventListener('change', this.#onFoldedCountsChanged);
    this.addEventListener('menu-select', this.#onMenuSelect);
    this.addEventListener('menu-change', this.#onSavedPick);
    this.addEventListener('menu-open', this.#onFieldMoreOpen);
    // A calendar commits through its own events — it has no Apply button.
    this.addEventListener('datetime-change', this.#onDatePicked);
    this.addEventListener('range-select', this.#onDatePicked);
    /* A menu's CONDITION is part of what a chip filters by, so the bar reports
       it like any other change. TRAP T-an-operator-decides-pick-or-type */
    this.addEventListener('condition-change', this.#onConditionChanged);
    // The Add menu hangs off a sherpa-BUTTON, which never relays quick-filter-change.
    this.addEventListener('menu-change', this.#onAddCommit as EventListener);
    this.addEventListener('menu-highlight-change', this.#onHighlight);
    // MOVE, not over: inside a bar the browser sends one pointerover, then none. TODO 463
    this.addEventListener('pointermove', this.#onHoverChip);
    this.addEventListener('pointerout', this.#onLeaveBar);
    this.addEventListener('menu-discard', this.#onMenuDiscard);
    this.addEventListener('menu-apply', this.#onMenuApply);
    this.addEventListener('button-click', this.#onFieldApply);
    if (this.#filters.length) this.#render();
    if (this.#organise.group?.length || this.#organise.sort?.length) this.#renderOrganise();
    if (this.#available.length) this.#renderAvailable();

    // CLICK, not hover: a passing pointer would drill the list out from under it.
    this.addEventListener('menu-drill', this.#onMenuDrill as EventListener);
    // The back arrow is two shadow boundaries away; the menu re-emits it composed.
    this.addEventListener('menu-back', this.#drillOutHandler);

    this.#observer = new ResizeObserver(this.#onResize);
    if (bar) this.#observer.observe(bar);
    this.#watchChips();
  }

  /** A chip on anywhere in it, kept as `:state(chips-on)`: a shut scope's header
   *  wears the on fill. Will, TODO 494 · TRAP T-a-shut-scope-wears-its-chips-fill */
  #watchChips(): void {
    this.#chipsOn?.disconnect();
    const chips = this.$('.chips');
    if (!chips) return;
    this.#chipsOn = new MutationObserver(this.#syncChipsOn);
    this.#chipsOn.observe(chips, { subtree: true, childList: true, attributeFilter: ['data-current'] });
    this.#syncChipsOn();
  }
  /** Watches its chips' on-state. */
  #chipsOn: MutationObserver | null = null;
  /** Say whether a chip is on. */
  #syncChipsOn = (): void => {
    this.toggleState('chips-on', this.#chips().some((c) => c.hasAttribute('data-current') && !c.hasAttribute('data-persistent')));
  };

  override onConnect(): void {
    if (!this.#chipsOn) this.#watchChips();
    // Along the bar, or down a column. TRAP T-a-filter-is-dragged-into-its-place
    dragToOrder(this, {
      axis: this.dataset['orientation'] === 'portrait' ? 'y' : 'x',
      enabled: () => this.hasAttribute('data-reorder'),
      // A preset — the page's own field — keeps its place. Will, TODO 452
      items: () => this.#chips().filter((c) => !c.hasAttribute('data-persistent')
        && !c.hasAttribute('data-folded-away') && !c.hasAttribute('data-superseded')
        && !this.#defOf(c)?.preset),
      moved: (order) => this.#askOrder(order),
      signal: this.signal,
    });
  }

  /** Ask for the bar's fields in this order: the query's order, each count's. */
  #askOrder(order: readonly HTMLElement[]): void {
    this.#ask({ order: order.map((c) => this.#fieldFor(c.dataset['id'] ?? '')).filter((f): f is string => f != null) }, 'free');
  }

  override onDisconnect(): void {
    this.#leaveChip();
    this.#conditioned.cancel();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#chipsOn?.disconnect();
    this.#chipsOn = null;
    if (this.#frame != null) cancelAnimationFrame(this.#frame);
    this.#frame = null;
  }

  /** populate([{ id, label, type?, active?, icon?, options? }]). TRAP T-toggle-chip-has-no-count */
  protected override renderData(data: unknown): void {
    this.#filters = Array.isArray(data) ? (data as FilterDef[]) : [];
    this.#render();
    // Drawn from its filters: a column shows what is under it now. TODO 439
    this.toggleState('populated', true);
  }

  /** The active TOGGLE chips. TRAP T-toggle-chips-have-no-field — menu chips are in `values`. */
  get active(): string[] {
    return this.#chips()
      .filter((c) => c.current && !c.hasAttribute('data-menu'))
      .map((c) => c.dataset['id'] ?? '');
  }

  /** ON chips' constraints by id. TRAP T-values-reports-on-chips-in-one-shape — always an array. */
  get values(): Record<string, string[]> {
    if (!this.#chips().length) return this.#heldValues();
    const out: Record<string, string[]> = {};
    for (const chip of this.#chips()) {
      if (!chip.hasAttribute('data-menu')) continue;
      /* The VIEW owns this field now, so the chip must not narrow anything on
         top of it. Its picks SURVIVE in `pickedValues`, which is the whole
         point of suspending rather than removing.
         TRAP T-a-superseded-chip-suspends-it-is-never-removed */
      if (chip.hasAttribute('data-superseded')) continue;
      // OFF = not filtered. The picks survive — see `pickedValues`.
      if (!chip.hasAttribute('data-current')) continue;
      const id = chip.dataset['id'];
      if (!id) continue;
      const picked = this.#chipPicks(chip);
      if (picked.length) out[id] = picked;
    }
    return out;
  }

  /** Set every chip from a view definition. REPLACES the whole set. Unbound,
   *  SILENT; bound, each chip's answer is then asked for. 366 step 21 */
  set values(next: Record<string, readonly string[]>) {
    const ids = this.#chips().map((chip) => chip.dataset['id'] ?? '');
    this.#paintValues(next);
    this.#askDoor(ids, ids.length ? undefined
      : Object.fromEntries(Object.entries(next).map(([id, picks]) => [id, { picked: [...picks] }])));
  }

  /** Bound, a door's change is asked for: what each chip now answers — on,
   *  off or empty, a date's range among it; with no chips yet, what the door
   *  was given. 366 step 21 */
  #askDoor(ids: readonly string[], given?: Record<string, FieldReading>): void {
    if (!this.hasAttribute('data-locked')) return;
    const theirs = new Set(this.superseded);
    const asks: QueryRequest[] = given
      ? Object.entries(given).flatMap(([id, reading]) => {
        const field = this.#fieldFor(id);
        return field == null ? [] : [{ field, reading }];
      })
      : this.#chips().filter((chip) => ids.includes(chip.dataset['id'] ?? '') && !theirs.has(chip.dataset['id'] ?? ''))
        .flatMap((chip) => {
          const ask = this.#answerRequest(chip);
          if (!ask || chip.current || !readingAnswered(ask.reading)) return ask ? [ask] : [];
          return [{ ...ask, reading: { ...ask.reading, suspended: true } }];
        });
    if (asks.length) this.#emitChange(asks.length === 1 ? asks[0] : asks);
  }

  /** Paint every chip from a whole map; with no chips yet, held. */
  #paintValues(next: Record<string, readonly string[]>): void {
    this.#painted.clear();
    // The WHOLE set, so it replaces every steer held before it.
    if (!this.#chips().length) {
      this.#held = { values: { ...next }, chips: new Map(), ...(this.#held.supersede ? { supersede: this.#held.supersede } : {}) };
      return;
    }
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id || !chip.hasAttribute('data-menu')) continue;
      const wanted = next[id];
      // Never switched off, but it still follows a pick.
      if (chip.hasAttribute('data-persistent')) {
        if (wanted?.length) chip.values = wanted;
        continue;
      }

      if (wanted?.length) {
        // The CHIP owns its own face — label, badge, tooltip, on/off.
        chip.values = wanted;
      } else {
        // Not named by the view: off, but its picks survive. Off is not gone.
        chip.current = false;
      }
    }
    this.#keepOffChips();
  }

  /**
   * Set ONE chip's picks, leaving every other chip alone.
   *
   * `values` is a WHOLE-MAP setter: a chip the map does not name is switched
   * off. That is right for a view restoring its entire filter state, and wrong
   * for anything that owns one field — a legend bound to `plan` wrote
   * `{ plan: [...] }` and silently switched off the Status chip beside it.
   *
   * An empty list CLEARS this chip — unticked and off, because "every value
   * selected" and "no filter" are the same state and only one of them should
   * look like a filter. `undefined` leaves it untouched.
   * TRAP T-one-field-does-not-own-the-whole-map
   * TRAP T-everything-on-is-no-filter
   */
  setChipValues(id: string, picks: readonly string[] | undefined): void {
    if (picks === undefined) return;
    const painted = this.#chips().length > 0;
    this.#paintPicks(id, picks);
    // The View chip answers no field, so it stays the bar's own. 366 step 21
    this.#askDoor([id], painted ? undefined : { [id]: { picked: [...picks] } });
  }

  /** Paint ONE chip's picks; with no chips yet, held. */
  #paintPicks(id: string, picks: readonly string[]): void {
    this.#painted.delete(id);
    if (!this.#chips().length) {
      this.#held.chips.set(id, { picks: [...picks] });
      return;
    }
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id || !chip.hasAttribute('data-menu')) continue;
      /* `values = []` unticks every row and re-derives the face — the badge
         and the value label go with it. `current = false` alone would leave a
         chip reading "3 Plan Enterprise…" while claiming to be off. */
      chip.values = picks;
      if (!picks.length) chip.current = false;
      this.#keepOffChips();
      return;
    }
  }

  /**
   * setChipActive(id, on) — steer one ON/OFF chip: a toggle, or a chip the Switch turned off.
   * SILENT, like every steer, so `report()` when it should be heard. A chip
   * answered by its menu takes `setChipValues` or `setChipReading` instead.
   * TRAP T-a-silent-write-still-needs-a-way-to-report
   */
  #setChipActive(id: string, on: boolean): void {
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    if (chip) chip.current = on;
    this.#syncOneRows();
  }

  /**
   * setChipReading(id, reading) — steer ONE chip with a whole reading.
   *
   * The write path for `readings`, and the only one that can carry a CONDITION.
   * `setChipValues` speaks picks alone, so a field answered by rows — an
   * or-chain, a "starts with" — could not be shown anywhere but where it was
   * typed. Unbound, SILENT, like every other steer; bound, the chip's answer
   * is then asked for, and the source draws it back.
   * TRAP T-a-conditioned-chip-answers-with-its-clause
   */
  setChipReading(id: string, reading: FieldReading): void {
    const painted = this.#chips().length > 0;
    this.#paintReading(id, reading);
    this.#askDoor([id], painted ? undefined : { [id]: reading });
  }

  /** Paint ONE chip's reading — a door's, or a source's draw; with no chips yet, held.
   *  A draw never goes through a door, so it never becomes a request. 366 step 21 */
  #paintReading(id: string, reading: FieldReading): void {
    this.#painted.delete(id);
    if (!this.#chips().length) {
      this.#held.chips.set(id, { reading: { ...reading } });
      return;
    }
    // The FIELD draws it, as a panel's does; its chip knows what answers it. TRAP T-a-chip-says-its-own-answer
    const chip = this.#chips().find((c) => c.dataset['id'] === id && c.hasAttribute('data-menu'));
    // A Group or Sort chip is drawn by its arrangement, never a reading.
    if (chip && !arranges(kindOf(this.#defOf(chip) ?? { id, label: id }))) chip.reading = reading;
    this.#keepOffChips();
  }

  /**
   * PENDING: a field its source says waits (`data-pending`) — this bar is the
   * one writer of the chip's flag. A draft in its own open menu is the chip's
   * own to show (TODO 415). Locally a menu never waits, so nothing is ever
   * pending there. Will, 2026-09-26 (TODO 46). TRAP T-a-pending-chip-reads-as-a-warning
   */
  #syncPending(): void {
    const waiting = pendingFields(this);
    const failed = pendingFields(this, 'failed');
    for (const chip of this.#chips()) {
      const field = this.#fieldOf(chip.dataset['id'] ?? '');
      // A SECTION is marked by its values, never its heading: they know what changed. TODO 425
      const section = chip.dataset['layout'] === 'section' ? { changed: new Set<Element>() } : {};
      markField([chip], [chip.menu], { pending: waiting.has(field), failed: failed.has(field), ...section });
    }
  }

  /**
   * drawApplied(applied) — a bound source says what each field that waits for
   * Apply holds APPLIED: a section marks only the values its draft changed.
   * SILENT. TODO 425 · TRAP T-a-pending-chip-reads-as-a-warning
   */
  drawApplied(applied: Readonly<Record<string, FieldReading>>): void {
    for (const chip of this.#chips()) {
      const field = this.#fieldOf(chip.dataset['id'] ?? '');
      if (chip.dataset['layout'] === 'section') chip.applied = applied[field] ?? null;
    }
  }

  /**
   * drawValueResults(results, scope) — each picked value's own count, by field
   * then value: a section's value chips wear them. SILENT. TODO 425
   */
  drawValueResults(results: Readonly<Record<string, Readonly<Record<string, number>>>>): void {
    this.#valueResults = results;
    this.#drawValueResults();
  }
  /** Each field's value counts, as the source last said. */
  #valueResults: Readonly<Record<string, Readonly<Record<string, number>>>> = {};

  /** Give each section chip its field's value counts; a chip that is no section, none. */
  #drawValueResults(): void {
    const results = this.hasAttribute('data-no-results') ? {} : this.#valueResults;
    for (const chip of this.#chips()) {
      const field = this.#fieldOf(chip.dataset['id'] ?? '');
      const shown = chip.dataset['layout'] === 'section' || this.hasAttribute('data-every-count');
      chip.valueResults = shown ? results[field] ?? null : null;
    }
  }

  /**
   * drawResults(results) — each answered chip's results, from its source: the
   * rows that reach it — the filters before it — and match its answer, by field.
   * SILENT. A chip with none shows no number. Will, TODO 60. TRAP T-a-chip-counts-within-the-filters-before-it
   */
  drawResults(results: Readonly<Record<string, number>>): void {
    this.#results = results;
    const shown = this.#shownResults;
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'] ?? '';
      const field = this.#fieldOf(id);
      chip.results = shown[field] ?? shown[id] ?? null;
    }
    this.#syncScopeBadge();
  }

  /** The counts it shows: none while `data-no-results`. TODO 436 */
  get #shownResults(): Readonly<Record<string, number>> {
    return this.hasAttribute('data-no-results') ? {} : this.#results;
  }

  /** A SHUT portrait section's badge: the rows its filters leave — the last
   *  answered one's results — and each one's in its tip, as a panel's shut
   *  scope says them. TODO 425 */
  #syncScopeBadge(): void {
    const tip = this.$<HTMLElement>('.scope-tip');
    const badge = this.$<HTMLElement>('.scope-results');
    if (!tip || !badge) return;
    const answered = this.#chips().flatMap((chip) => {
      const def = this.#defOf(chip);
      const n = def ? this.#shownResults[def.field ?? def.id] ?? this.#shownResults[def.id] : undefined;
      return def && n != null && !chip.hasAttribute('data-persistent') ? [{ label: def.label, n }] : [];
    });
    const said = drawCount(badge, answered.at(-1)?.n, ['match', 'matches']);
    if (said == null) delete badge.dataset['count'];
    else badge.dataset['count'] = said;
    tip.dataset['text'] = answered.map((one) => `${one.label} - ${countSaid(one.n, ['match', 'matches']).label}`).join('\n');
  }

  /** nameScope(scope) — its source names its scope: a portrait bar's heading,
   *  and the component it narrows. TODO 425 */
  nameScope(scope: { scope?: string; label: string; shows?: ScopeShows | undefined; component?: string | undefined }): void {
    if (scope.scope) this.#scope = scope.scope;
    if (scope.label) this.set('data-heading', scope.label);
    this.#component = scope.component;
    this.#drawDescription();
  }

  /** The scope its source drew. */
  #scope = '';
  /** Which component its scope narrows, by its tag. TODO 457 */
  #component: string | undefined;
  /** …as the portrait accordion's description, under the scope's name: "Bar
   *  Chart", "Data Grid". No icon: Will, TODO 472. A flat scope's heading has none. */
  #drawDescription(): void {
    const portrait = this.templateId === 'portrait';
    const box = this.$('.scope');
    const named = portrait && this.#component ? this.#componentName(this.#component) : '';
    if (named) box?.setAttribute('data-description', named);
    else box?.removeAttribute('data-description');
  }

  /** A component's name, as the markup's words say it — else from its tag. */
  #componentName(tag: string): string {
    for (const tpl of this.$$<HTMLTemplateElement>('template.words')) {
      const hit = tpl.content.querySelector(`[data-word="${CSS.escape(tag)}"]`);
      if (hit) return hit.textContent?.trim() ?? '';
    }
    return tag.replace(/^sherpa-/, '').split('-').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ');
  }

  /**
   * search(text) — a portrait bar shows only the fields whose name, or one of
   * whose values, holds the text; empty shows all. The lead bar's search asks
   * it of every portrait bar beside it. TODO 425
   */
  search(text: string): void {
    const q = text.trim().toLowerCase();
    for (const chip of this.#chips()) {
      const name = (this.#defOf(chip)?.label ?? chip.dataset['label'] ?? '').toLowerCase();
      const named = !q || name.includes(q);
      let any = named;
      for (const one of chip.querySelectorAll<HTMLElement>(':scope > .value')) {
        const hit = named || (one.dataset['label'] ?? '').toLowerCase().includes(q);
        one.toggleAttribute('data-filtered-out', !hit);
        any ||= hit;
      }
      chip.toggleAttribute('data-no-matches', !any);
    }
  }

  /**
   * drawPresent(present) — a bound source says what the filters before each
   * field leave; a chip's menu greys the rest. SILENT. A field not named is
   * not limited. TRAP T-a-ruled-out-value-is-greyed
   */
  drawPresent(present: Readonly<Record<string, readonly string[]>>, scope?: string): void {
    if (this.#columned) return scope ? this.#column.present(present, scope) : undefined;
    this.#present = present;
    for (const chip of this.#chips()) this.#markPresent(chip);
    // The Add list is drawn again only when a field's being spent moved.
    if (this.#spentKey() !== this.#spentFor) this.#renderAvailable();
  }

  /** drawOffered(offered) — what each serial-set field OFFERS: its menu
   *  removes the rest, but keeps a pick. TRAP T-a-filter-set-groups-or-chains */
  drawOffered(offered: Readonly<Record<string, readonly string[]>>): void {
    this.#offered = offered;
    for (const chip of this.#chips()) this.#markPresent(chip);
  }
  /** What each chained field offers, as last drawn. */
  #offered: Readonly<Record<string, readonly string[]>> = {};
  /** What the filters before each field leave, as the source last said. */
  #present: Readonly<Record<string, readonly string[]>> = {};
  /** Each chip's results, as the source last said — a rebuilt chip is given them. */
  #results: Readonly<Record<string, number>> = {};

  /**
   * savedSets — the reader's saved sets of filters. The Filters menu's Saved
   * section lists them, each on screen ticked; the ⋮ says "Save <name>" over
   * the one last taken. Drawn, never reported. Will, TODO 105, 366.
   * TRAP T-saved-filters-are-every-scope
   */
  set savedSets(sets: readonly SavedSet[]) {
    this.#column.saved(sets);
    this.#saved.set(sets);
    this.#renderAvailable();
  }
  get savedSets(): SavedSet[] {
    return this.#saved.all;
  }
  /** The reader's saved sets. */
  #saved = new SavedSets(this);
  /** Its header's Saved menu, Save <name> and filter acts — its column's too. TODO 415 */
  readonly #header = new ToolbarHeader({
    el: this,
    root: () => this.root,
    emit: (name, detail, options) => { this.emit(name, detail, options); },
    toggleState: (name, on) => this.toggleState(name, on),
  }, this.#saved, { saved: '.saved-btn', save: '.save-set', saveAs: '.save-as-btn' });

  /** Steers given before `populate()` drew a chip, for `#render()` to replay in
   *  order. TRAP T-a-value-before-the-first-render-is-held */
  #held: {
    values?: Record<string, readonly string[]>;
    chips: Map<string, { picks: readonly string[] } | { reading: FieldReading }>;
    supersede?: { ids: readonly string[]; at?: string };
  } = { chips: new Map() };

  /** What `values` will report once the held steers land. */
  #heldValues(): Record<string, string[]> {
    const out = new Map(Object.entries(this.#held.values ?? {}).map(([id, picks]) => [id, picks.map(String)]));
    for (const [id, steer] of this.#held.chips) {
      const picks = 'picks' in steer ? steer.picks : steer.reading.suspended ? [] : steer.reading.picked ?? [];
      out.set(id, picks.map(String));
    }
    for (const id of this.#held.supersede?.ids ?? []) out.delete(id);
    return Object.fromEntries([...out].filter(([, picks]) => picks.length));
  }

  /** One chip's menu, told what the filters before its field leave. The chip
   *  itself is never greyed for it: a filter whose every pick is ruled out stays
   *  in force and wears 0 (Will, 2026-10-20). TRAP T-a-ruled-out-value-is-greyed */
  #markPresent(chip: HTMLElement): void {
    const id = chip.dataset['id'] ?? '';
    const field = this.#fieldOf(id);
    if (!chip.querySelector('sherpa-menu') || chip.hasAttribute('data-superseded')) return;
    // A section's value chips are greyed too. TODO 425
    limitField(chip.querySelectorAll<HTMLElement>(':scope > .value'), [(chip as SherpaQuickFilter).menu],
      { present: this.#present[field] ?? null, offered: this.#offered[field] ?? null, hide: hidesUnmatched(this) });
  }

  /**
   * drawReading(field, reading) — a bound source tells this bar one field's
   * answer, whoever set it. SILENT, as every steer is. A SUPERSEDED chip keeps
   * the reader's own picks for when the view lets go.
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   */
  drawReading(field: string, reading: FieldReading, scope?: string): void {
    // A column's sections are told their own; a chart's, through it. TODO 425, 426
    if (this.#columned) return void (scope && this.#column.drawReading(field, reading, scope));
    const id = this.#idOf(field);
    if (this.#supersededId(id)) return;
    /* A chip just ADDED — a raised field's — stamps its menu a moment later,
       and an answer drawn before that is lost. It waits for the SAME settle
       the add's own report waits for, and is queued first — so that report
       carries the answer instead of clearing it.
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    const chip = this.#chips().find((c) => c.dataset['id'] === id);
    const menu = chip?.querySelector('sherpa-menu');
    if (chip && (!chip.shadowRoot?.childElementCount || (menu && !menu.shadowRoot?.childElementCount))) {
      /* Only the LATEST held draw of a field lands, and a draw made meanwhile
         drops it: a stale one put a section's Advanced back to Simple. TODO 426 */
      const held = { reading };
      this.#heldDraws.set(id, held);
      void this.#settled().then(() => {
        if (this.#heldDraws.get(id) !== held) return;
        this.#heldDraws.delete(id);
        if (!this.#supersededId(id) && !this.#drafting(id)) this.#drawChip(id, reading);
      });
      return;
    }
    this.#heldDraws.delete(id);
    this.#drawChip(id, reading);
  }
  /** Each field's draw held until its chip's menu has stamped. */
  #heldDraws = new Map<string, { reading: FieldReading }>();

  /** A field's held draw, drawn NOW — before the reader acts on its menu. */
  #drawHeld(id: string): void {
    const held = this.#heldDraws.get(id);
    if (!held) return;
    this.#heldDraws.delete(id);
    if (!this.#supersededId(id)) this.#drawChip(id, held.reading);
  }

  /** One chip's answer, and whether it is ON. OFF keeps the answer and applies
   *  none of it. The answer it last painted is not painted again, so an open
   *  menu keeps its draft. 366 step 22 · TRAP T-grid-suspend-is-not-clear */
  #drawChip(id: string, reading: FieldReading): void {
    const said = readingAnswered(reading) ? JSON.stringify(reading) : '';
    const was = this.#painted.get(id);
    if (was === said || (was === undefined && this.#drafting(id))) return;
    this.#paintReading(id, reading);
    if (reading.suspended) this.#setChipActive(id, false);
    this.#painted.set(id, said);
  }

  /** What each chip was last drawn, by id — `''` for empty. A door's own paint
   *  drops it; a new chip has none. */
  #painted = new Map<string, string>();

  /** Is the reader working in this chip's menu — open, with a draft not applied? */
  #drafting(id: string): boolean {
    const chip = this.#chips().find((c) => c.dataset['id'] === id) as SherpaQuickFilter | undefined;
    return !!chip?.hasAttribute('data-open') && !!chip.drafting;
  }

  /** The chip that answers a field: its def's `field`, else its id. */
  #idOf(field: string): string {
    return [...this.#filters, ...this.#available].find((f) => (f.field ?? f.id) === field)?.id ?? field;
  }

  /** The field a chip answers; none for a selector — the View chip — or a toggle.
   *  TRAP T-toggle-chips-have-no-field · TRAP T-persistent-chip-is-a-selector */
  #fieldFor(id: string): string | null {
    const def = [...this.#filters, ...this.#available].find((f) => f.id === id);
    if (id === VIEW_CHIP || def?.persistent || def?.field === null) return null;
    if (def && kindOf(def) === 'boolean' && !advancedOf(def)) return null;
    return def?.field ?? id;
  }

  /** A chip's answer, as the request for its field. */
  #answerRequest(chip: HTMLElement): { field: string; reading: FieldReading } | undefined {
    const field = this.#fieldFor(chip.dataset['id'] ?? '');
    const answer = field == null ? undefined : this.#answerOf(chip as SherpaQuickFilter);
    if (field == null || !answer) return undefined;
    const { label: _label, values: _values, suspended: _suspended, ...reading } = answer;
    return { field, reading };
  }

  /**
   * supersede([...ids]) — the VIEW now owns these fields.
   *
   * The chips are SUSPENDED, never removed: each keeps its value and its place,
   * and comes back the moment the view lets the field go. Removing them would
   * throw away what the reader picked, which is the bug this avoids.
   *
   * This is the WHOLE set each time — a chip not named here is restored. That
   * makes the call idempotent, so a host can send the view's field list after
   * every change without tracking what it sent last.
   *
   * TRAP T-a-superseded-chip-suspends-it-is-never-removed
   */
  supersede(ids: readonly string[], appliedAt?: string): void {
    // KEPT, so a chip a rebuild remakes is held above again. Will, TODO 479
    this.#above = { ids: [...ids], ...(appliedAt ? { at: appliedAt } : {}) };
    if (!this.#chips().length) {
      this.#held.supersede = this.#above;
      return;
    }
    // By field or by id: a chip named for its question answers its def's field.
    const taken = new Set(ids.map((f) => this.#idOf(f)));
    for (const chip of this.#chips()) {
      const id = chip.dataset['id'];
      if (!id) continue;
      const held = taken.has(id);
      chip.toggleAttribute('data-superseded', held);
      /* WHERE it is filtered instead. Only the host knows — this bar cannot
         see the one that took the field. An off chip with no explanation reads
         as "your filter vanished".
         TRAP T-an-inactive-chip-says-where-its-filter-went */
      if (held && appliedAt) chip.setAttribute('data-applied-at', appliedAt);
      else chip.removeAttribute('data-applied-at');
    }
  }

  /** The fields the View holds, as last told: every rebuild draws them again. */
  #above: { ids: string[]; at?: string } | null = null;

  /** The ids this bar currently has suspended. */
  get superseded(): string[] {
    if (!this.#chips().length) return [...this.#held.supersede?.ids ?? []];
    return this.#chips()
      .filter((c) => c.hasAttribute('data-superseded'))
      .map((c) => c.dataset['id'] ?? '')
      .filter(Boolean);
  }

  /** What one chip's menu holds — values ticked, or a date as one or two entries. */
  #chipPicks(chip: HTMLElement): string[] {
    // A chip drilled into the Filters menu reports from there — its own menu is
    // empty while the rows are away.
    if (this.#drill.home && this.#drill.home === chip.querySelector('sherpa-menu')) {
      const menu = this.$('.add-btn')?.querySelector<SherpaMenu>('sherpa-menu');
      if (menu) return menu.values;
    }
    /* A NUMBER or DATE menu reports its OWN value — it knows its body and its
       Range shape. TRAP T-a-menu-owns-its-own-bodies */
    const own = chip.querySelector<SherpaMenu>('sherpa-menu[data-body]');
    if (own) return own.values;

    /* THE MENU answers, through the chip's own getter: its rows, or its items
       before they stamp. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    const menu = (chip as SherpaQuickFilter).menu;
    return [...menu?.values ?? []];
  }

  /** The filter chips in the run — not Group, Sort or More — a set's among them. */
  #chips(): SherpaQuickFilter[] {
    return this.$$<SherpaQuickFilter>(CHIP);
  }

  /** A def, by its chip id. */
  #defById(id: string | undefined): FilterDef | undefined {
    return id ? this.#filters.find((f) => f.id === id) : undefined;
  }

  /** A chip's def. */
  #defOf(chip: HTMLElement): FilterDef | undefined {
    return this.#defById(chip.dataset['id']);
  }

  /** Does a chip answer here: no selector, and not held by a scope above? */
  #answering(chip: HTMLElement): boolean {
    return !chip.hasAttribute('data-persistent') && !chip.hasAttribute('data-superseded');
  }

  /** Is this chip id held by a scope above — as the bar drew it, or was told before it drew? */
  #supersededId(id: string): boolean {
    if (!this.#chips().length) return this.#held.supersede?.ids.includes(id) ?? false;
    return !!this.$(`${CHIP}[data-id="${CSS.escape(id)}"][data-superseded]`);
  }

  /** The field a chip id answers: its def's, else the id itself. */
  #fieldOf(id: string): string {
    return this.#defById(id)?.field ?? id;
  }

  /** The FIELD chip an event came from: by CHIP, so never the chip's own inner
   *  `div.chip`, which comes first on the path, nor a section's value chip.
   *  TRAP T-path-not-target-finds-chip-host */
  #chipOf(event: Event): SherpaQuickFilter | null {
    return this.pathFind<SherpaQuickFilter>(event, CHIP);
  }

  /** The scope's name, on a chip, for CSS to put over the first: "View Context". Will, TODO 440 */
  #nameContext(chip: HTMLElement): void {
    const name = this.dataset['heading'];
    if (name) chip.setAttribute('data-context', name);
    else chip.removeAttribute('data-context');
  }

  /** Rebuild the chip run from `#filters`, keeping what the reader did. */
  #render(): void {
    const list = this.$('.chips');
    const tpl = this.$<HTMLTemplateElement>('template.qf-tpl');
    if (!list || !tpl) return;

    // TRAP T-render-captures-live-state — the live DOM is the only record of what
    // the user did since. `data-reset-on-populate` opts out.
    const live = new Map<string, { on: boolean; picked: Set<string> }>();
    /* AND THE REST OF EACH ANSWER — op, typing, rows. A new menu starts from
       its def. TRAP T-a-rebuild-keeps-every-answer */
    const kept = this.hasAttribute('data-reset-on-populate') ? {} : this.#answers();
    if (!this.hasAttribute('data-reset-on-populate')) {
      for (const chip of this.#chips()) {
        const id = chip.dataset['id'];
        if (!id) continue;
        live.set(id, {
          on: chip.hasAttribute('data-current'),
          picked: new Set(this.#chipPicks(chip)),
        });
      }
    }

    /* A chip built from the same def, under the same flags, is MOVED, not
       remade: its menu, its answer and its draft go with it. Only a new or
       changed one is built, and only it takes back a kept answer. TODO 415 */
    const fresh = !this.hasAttribute('data-reset-on-populate');
    const was = new Map(fresh ? this.#chips().map((c) => [c.dataset['id'] ?? '', c] as const) : []);
    const moved = new Set<string>();
    list.replaceChildren();
    // A chip that stays shows what it was drawn; a new one has been drawn nothing.
    for (const id of this.#painted.keys()) if (!live.has(id)) this.#painted.delete(id);
    /* The allow-list applies to the chips already ON the bar, not only to what
       Add offers: a field a reader may not filter by must not appear at all.
       No list → every filter, which is the default. */
    for (const f of this.#inSets(allow(this.#filters, this.#allowedFields))) {
      const key = this.#chipKey(f);
      const old = was.get(f.id);
      if (old && this.#built.get(old) === key) {
        list.appendChild(old);
        this.#nameContext(old);
        moved.add(f.id);
        continue;
      }
      // Not upgraded until it is appended. TRAP T-custom-element-upgrade
      const chip = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      this.#built.set(chip, key);
      const prior = live.get(f.id);
      chip.dataset['id'] = f.id;
      chip.setAttribute('data-label', f.label);
      this.#nameContext(chip);
      if (f.type) chip.setAttribute('data-type', f.type);
      // Live state wins; an untouched chip falls back to `active`.
      if (prior ? prior.on : f.active) chip.setAttribute('data-current', '');
      // The toolbar's glyph to decide, not the app's.
      const glyph = f.id === VIEW_CHIP ? SherpaQuickFilterToolbar.#icons.view : f.icon;
      if (glyph) chip.setAttribute('data-icon-start', glyph);
      /* A selector: always on, and its body does not flip it. LOCKED for that
         reason — `data-locked` is how a chip is told the host owns its state,
         and without it the chip flipped itself off and the toolbar wrote it
         back, two writes for one click. TRAP T-locked-chip-relays-and-nothing-else */
      if (f.persistent) {
        chip.setAttribute('data-persistent', '');
        chip.setAttribute('data-current', '');
      }
      // The page's own, apart from what the reader added. Will, TODO 482
      chip.toggleAttribute('data-preset', !!f.preset);
      this.#lock(chip);
      /* THE KIND DECIDES. A boolean has nothing to open; everything else does
         — a date or number carries its own body, and so does an Advanced one,
         which can only be asked "contains" and never ticked from a list of 240.
         TRAP T-a-condition-only-field-still-has-a-menu
         TRAP T-a-chip-knows-what-kind-it-is */
      const kind = kindOf(f);
      // The App Context's, on a page with no such field: inactive, and it says why. TODO 453
      if (f.unused) {
        chip.setAttribute('disabled', '');
        chip.setAttribute('data-unused', '');
      } else if (kind !== 'boolean' || advancedOf(f)) this.#addMenu(chip, f, prior?.picked);
      list.appendChild(chip);
      if (kind === 'date') {
        chip.setAttribute('data-full-value', '');
        /* The chip says its own days. TRAP T-a-chip-says-its-own-answer — not
           upgraded in a bar drawn after it left the page (a section a column
           dropped), so asked only if it can. TRAP T-custom-element-upgrade */
        (chip as Partial<SherpaQuickFilter>).refresh?.();
      }
    }

    for (const [id, reading] of Object.entries(kept)) if (!moved.has(id)) this.#keepAnswer(id, reading);
    // Then what was steered before there were chips, and the results last drawn.
    const held = this.#held;
    this.#held = { chips: new Map() };
    if (held.values) this.#paintValues(held.values);
    for (const [id, steer] of held.chips) {
      if ('picks' in steer) this.#paintPicks(id, steer.picks);
      else this.#paintReading(id, steer.reading);
    }
    const above = held.supersede ?? this.#above;
    if (above) this.supersede(above.ids, above.at);
    this.drawResults(this.#results);

    /* THE ADD MENU LISTS WHAT IS HELD, so it follows the run. `populate()` is
       deferred, so a host calling `available()` first had nothing to tick.
       TRAP T-the-add-menu-is-the-whole-list */
    this.#renderAvailable();
    this.#syncPending();
    this.#syncLayout();
    this.#drawValueResults();

    // A ResizeObserver fires only on a SIZE change; populating is not one, and
    // what fits just changed.
    this.#keepOffChips();
    this.#onResize();

    /* AND AGAIN once every chip has drawn ITSELF. A cloned `sherpa-quick-filter`
       stamps its own label and icon on its first render, so a run measured now
       is narrower than the run a reader sees — and the bar came to rest one
       chip short of folded, two pixels over its edge. Measured in Firefox: the
       remaining chip is 50px in a 48px track.

       TWO FRAMES after `rendered`, not one: the upgrade and the first stamp
       land in different turns, and the LAYOUT of that stamp in a third.
       TRAP T-the-fold-measures-a-chip-that-has-not-drawn-itself
       TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp */
    void Promise.all(this.#chips().map(
      (chip) => chip.rendered,
    )).then(() => new Promise<void>((done) => {
      requestAnimationFrame(() => requestAnimationFrame(() => done()));
    })).then(() => { if (this.isConnected) this.#reflow(); });
  }

  /** What a chip is BUILT from: its def, less the answer it is told and where it
   *  is held, and the flags its menu is made under. The same key, the same chip. */
  #chipKey(f: FilterDef): string {
    const { state: _state, appliedAt: _at, sendTo: _to, active: _active, ...made } = f as FilterDef & Record<string, unknown>;
    return JSON.stringify([made, this.dataset['bounds'] ?? '', this.hasAttribute('data-remote'), this.dataset['applyOn'] ?? '',
      this.hasAttribute('data-waits'), this.hasAttribute('data-field-apply'), this.hasAttribute('data-none-shows-all')]);
  }
  /** Each chip's key, as it was built. */
  #built = new WeakMap<Element, string>();

  /** Give a chip its value menu — real checkbox/radio rows in the chip's light DOM. */
  #addMenu(chip: HTMLElement, def: FilterDef, picked?: Set<string>): void {
    /* ONE DEF, ONE MENU. The panel and a column heading build theirs the same
       way, so a field cannot open with a different control in each.
       TRAP T-one-field-one-filter-menu */
    const { menu, items } = menuFor(this.root, def, {
      bounds: this.dataset['bounds'], remote: this.hasAttribute('data-remote'),
      live: this.dataset['applyOn'] === 'input', waits: this.hasAttribute('data-waits'),
      // Each field applies on its own: its menu has Apply. TODO 451
      applies: this.hasAttribute('data-field-apply'),
      empties: !this.hasAttribute('data-none-shows-all'),
    });

    // TRAP T-persistent-chip-is-a-selector — no pick at all falls back to the
    // FIRST option, or the chip paints as an empty warning.
    const options = def.options ?? [];
    const hasPick = picked ? picked.size > 0 : options.some((o) => o.selected);
    const fallback = def.persistent && !hasPick ? options[0]?.value : undefined;

    /* THE MENU draws its own items, from the DATA handed to it: it picks the
       control from `data-select`.
       `menuFor` MADE it, so it has upgraded and takes them now; it stamps
       them when it renders. TRAP T-custom-element-upgrade */
    if (items.length) {
      menu.items?.(items.map((item) => ({
        // A Filters row's own flags — a child menu, no box, a count — go too.
        ...item,
        selected: picked
          ? picked.has(item.value) || item.value === fallback
          : !!item.selected || item.value === fallback,
      })));
    }

    this.#addRemove(chip, menu, def);
    this.#addMove(chip, menu, def);

    chip.setAttribute('data-menu', '');
    chip.appendChild(menu);
    this.#markPresent(chip);
  }

  /** A chip's condition or typed value changed — its field's answer did too. */
  #onConditionChanged = (event: Event): void => {
    // A drilled chip's rows are in the Filters menu.
    const chip = this.#chipOf(event) ?? this.#drill.home?.closest<HTMLElement>(CHIP);
    if (!chip) return;
    /* ONE request, next frame: a rebuilt condition row's value select fills
       ASYNCHRONOUSLY, and read now it says no clause. TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
    this.#conditioned.add(chip);
  };

  /** The chips whose rows changed this frame: ONE request for them, the next. */
  #conditioned = new NextFrame<HTMLElement>((chips) => this.#emitChange(chips.flatMap((one) => this.#answerRequest(one) ?? [])));


  /**
   * Carry one chip's op, typing and rows into its REBUILT menu. Until that menu
   * has drawn — a menu that has not drops rows — `readings` reports them from
   * here, so an event sent straight after a rebuild still has them.
   * TRAP T-a-rebuild-keeps-every-answer
   */
  #keepAnswer(id: string, reading: FieldReading): void {
    const menu = this.#filterMenu(id);
    if (!menu) return;
    const rows = readingRows(reading);
    /* The READER'S answer wins over the def's opening one — a def's typed
       condition must not come back on every rebuild. Picks go in as the menu
       is made, so only the rows, the mode and the mirror are compared.
       TRAP T-a-rebuild-keeps-every-answer */
    const gist = (r: FieldReading): string => {
      const own = readingRows(r);
      return JSON.stringify([own, modeOf(r, own) ?? 'simple', !!r.mirror]);
    };
    if (gist(menu.reading) === gist(reading)) return;
    const held: FieldReading = { ...reading };
    this.#pendingAnswers.set(id, held);
    // The menu refuses Advanced mode unless the field opted in.
    if (rows.length) menu.setAttribute('data-advanced', '');
    // A later rebuild may have taken over.
    void answerWhenDrawn(menu, held, () => this.#pendingAnswers.get(id) === held && menu.isConnected, (chip) => {
      /* HELD two frames MORE: a rebuilt row fills a frame late, and a report in
         that gap read Owner as unanswered — the source dropped it, and the
         mirror switched the chip off. Adding Email reset Owner.
         TRAP T-a-rebuilt-row-reads-empty-for-a-tick */
      requestAnimationFrame(() => requestAnimationFrame(() => {
        if (this.#pendingAnswers.get(id) === held) this.#pendingAnswers.delete(id);
      }));
      // The chip draws its face from the menu it holds now; on or off as it was.
      if (chip) chip.current = !reading.suspended;
    });
  }

  /** Answers a rebuilt menu has not drawn yet, by chip id. TRAP T-a-rebuild-keeps-every-answer */
  #pendingAnswers = new Map<string, FieldReading>();

  /**
   * Settle after a REBUILD: every menu has stamped its rows.
   *
   * `items()` on a freshly cloned menu stamps NOTHING — the element has no
   * shadow template until it upgrades, so it keeps the list and stamps at
   * `onRender`. Reading the bar before that gives `values: {}` on a bar full
   * of ticked rows, and a host that answers such an event clears every filter
   * the reader had. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
   */
  async #settled(): Promise<void> {
    /* The chips and menus as they are NOW, read again each frame: one a rebuild
       replaced before it rendered never resolves, and waiting on it hung the
       draw for good — a part's section never heard it was held above. TODO 479 */
    const pending = (): Array<{ rendered: Promise<void> }> => this.#chips()
      .flatMap((chip) => [chip, ...chip.querySelectorAll('sherpa-menu')])
      .filter((el) => el.isConnected && (el as { hasRendered?: boolean }).hasRendered === false) as never;
    for (let left = pending(); left.length; left = pending()) {
      await Promise.race([Promise.all(left.map((el) => el.rendered)), new Promise((r) => requestAnimationFrame(r))]);
    }
  }

  /** Give a chip's menu its "Remove" action. TRAP T-remove-is-opt-in-and-a-footer-button */
  #addRemove(chip: HTMLElement, menu: HTMLElement, def: FilterDef): void {
    if (!chip.classList.contains('chip')) return;
    if (!def.removable || def.persistent) return;
    menu.setAttribute('data-removable', '');
  }

  /** What the scope says of each field it holds: where it may be sent — a
   *  field sent up learns its way back, one added from the offers had none.
   *  Its Move, in its menu and its section's ⋮, follows. TODO 426 */
  #takeWays(fields: readonly { id: string; sendTo?: FilterDef['sendTo'] }[]): void {
    const told = new Map(fields.map((f) => [this.#idOf(f.id), f.sendTo] as const));
    let moved = false;
    this.#filters = this.#filters.map((d) => {
      if (!told.has(d.id)) return d;
      const to = told.get(d.id);
      if (JSON.stringify(to) === JSON.stringify(d.sendTo)) return d;
      moved = true;
      const { sendTo: _was, ...rest } = d;
      return to ? { ...rest, sendTo: to } : rest;
    });
    if (!moved) return;
    for (const chip of this.#chips()) {
      const def = this.#defOf(chip);
      const menu = chip.querySelector<HTMLElement>(':scope > sherpa-menu');
      if (!def || !menu) continue;
      menu.querySelector(':scope > .move')?.remove();
      this.#addMove(chip, menu, def);
    }
    this.#syncLayout();
  }

  /** A chip's menu MOVES its field — up to the View, or a View field back down
   *  to the one scope its source names: a row above its footer, in toolbar mode;
   *  in portrait a section's ⋮ has it. Will, TODOs 425 G4, 450 · TRAP T-send-to-view-filters */
  #addMove(chip: HTMLElement, menu: HTMLElement, def: FilterDef): void {
    const label = this.#moveLabel(def);
    const move = label && chip.classList.contains('chip') && this.dataset['orientation'] !== 'portrait'
      ? this.clone('template.move-tpl') : null;
    if (!move) return;
    move.textContent = label;
    menu.append(move);
  }

  /** What Move says for a field, or nothing where it cannot move: Group and
   *  Sort, a selector. */
  #moveLabel(def: FilterDef): string {
    // A chart's own field moves up too: elevated, it narrows every component. Will, TODO 52
    if (!this.#scope || def.persistent || arranges(kindOf(def))) return '';
    if (this.#scope !== VIEW) return this.word('raise');
    const to = def.sendTo;
    return to ? `${this.word(to.origin ? 'return' : 'lower')} ${to.label}` : '';
  }

  /** Ask for a field to move: up to the View, or down where its source sends it. */
  #move(chip: HTMLElement): void {
    const def = this.#defOf(chip);
    const to = this.#scope === VIEW ? def?.sendTo?.scope : VIEW;
    if (!def || !to) return;
    chip.querySelector<SherpaMenu>(':scope > sherpa-menu')?.hide?.();
    this.emit('filter-add', { scope: to, ids: [def.field ?? def.id], from: this.#scope });
  }

  /** A SECTION's ⋮ — the field's own actions, each only where it applies — in
   *  its chip's `more` slot, in the caret's place; said again on each layout,
   *  as what applies moves (a field sent up learns its way back). Will, TODO 425 G1 */
  #syncFieldMore(chip: SherpaQuickFilter): void {
    const def = this.#defOf(chip);
    if (!def) return;
    let more = chip.querySelector<HTMLElement>(':scope > .field-more');
    if (!more) {
      more = this.clone('template.field-more-tpl');
      if (!more) return;
      chip.append(more);
    }
    // Its own Apply and Discard, before the ⋮; CSS shows them. TODO 451
    if (!chip.querySelector(':scope > .field-apply')) {
      const own = this.clone('template.field-apply-tpl');
      if (own) chip.insertBefore(own, more);
    }
    const move = this.#moveLabel(def);
    const way = this.#scope === VIEW ? 'lower' : 'raise';
    if (move) more.dataset['move'] = way;
    else delete more.dataset['move'];
    const label = more.querySelector(`.more-item[value="${way}"] .more-label`);
    if (label && move) label.textContent = move;
    more.toggleAttribute('data-removable', !!def.removable);
    // Advanced only where the field offers it. Will, TODO 425 G14
    more.toggleAttribute('data-advanced-ok', !!chip.querySelector(':scope > sherpa-menu')?.hasAttribute('data-advanced'));
    more.setAttribute('aria-label', `${def.label} options`);
    this.#labelMode(chip);
  }

  /** A section's ⋮ offers the OTHER mode: Advanced, or back to Simple. */
  #labelMode(chip: Element): void {
    const label = chip.querySelector(':scope > .field-more .more-item[value="advanced"] .more-label');
    const mode = chip.querySelector<SherpaMenu>(':scope > sherpa-menu')?.mode;
    if (label) label.textContent = this.word(mode === 'advanced' ? 'simple' : 'advanced');
  }

  /** A section's ⋮ opened: its mode row says the other mode, as it is now. The
   *  Edit menu opened: its Reset rows say whether there is anything to reset. */
  #onFieldMoreOpen = (event: Event): void => {
    const edit = this.pathFind(event, '.add-btn');
    if (edit) drawFilterActions(this, this.root, edit.querySelector('sherpa-menu'));
    const more = this.pathFind(event, '.field-more');
    const chip = more?.closest('sherpa-quick-filter');
    if (chip) this.#labelMode(chip);
  };

  /** A "Remove" row. `menu-select` is for ACTION rows; value rows commit via `menu-change`. */
  #onMenuSelect = (event: Event): void => {
    const value = (event as CustomEvent).detail?.value;
    // A section's ⋮: Move, or Reset. Will, TODO 425 G1
    const more = this.pathFind(event, '.field-more');
    const owner = more?.closest<SherpaQuickFilter>('sherpa-quick-filter');
    if (owner && (value === 'raise' || value === 'lower' || value === 'clear' || value === 'advanced' || value === 'highlight')) {
      event.stopImmediatePropagation();
      more?.querySelector<SherpaMenu>('sherpa-menu')?.hide?.();
      if (value === 'highlight') {
        this.#askHighlight(owner.dataset['id'] ?? '', !owner.hasAttribute('data-highlight'));
        return;
      }
      /* ADVANCED: the field goes to its rows, drawn in its section (455); Simple
         brings its values back. Will, TODO 425 G14 */
      if (value === 'advanced') {
        const menu = owner.querySelector<SherpaMenu>(':scope > sherpa-menu');
        /* A draw held for this menu's first stamp is drawn FIRST — it holds the
           answer the rows carry — then the switch, which it would undo. TODO 426 */
        void Promise.resolve(menu?.rendered).then(() => {
          this.#drawHeld(owner.dataset['id'] ?? '');
          menu?.switchMode?.();
          // Reported NOW, not next frame: a draw in between would put it back.
          this.#emitChange(this.#answerRequest(owner));
        });
      } else if (value === 'clear') {
        this.#emptyChip(owner);
        this.#emitChange(this.#answerRequest(owner));
      } else this.#move(owner);
      return;
    }
    // A chip menu's Move row: the menu says it, so its path holds no `.move`. TODO 450
    const mover = value === 'move' ? this.#chipOf(event) : null;
    if (mover) {
      event.stopImmediatePropagation();
      this.#move(mover);
      return;
    }
    // Manage Saved Filters and Reset, the Edit menu's actions — or, split, the Saved menu's rows. TODO 427, 436, 454
    if (((value === MANAGE_SETS || FILTER_ACTIONS.has(value)) && this.pathFind(event, '.add-btn'))
      || (String(value).startsWith('filters-') && this.pathFind(event, '.saved-btn'))) {
      event.stopImmediatePropagation();
      this.$<SherpaMenu>('.add-btn sherpa-menu')?.hide?.();
      this.#act(value);
      return;
    }
    if (value !== 'remove') return;
    // TRAP T-remove-matches-the-tag-not-the-class — the PATH, and the field chip.
    const chip = this.#chipOf(event);
    const id = chip?.dataset['id'];
    if (!id) return;
    event.stopImmediatePropagation();
    // Shut it first: a popover destroyed while open leaves the top layer confused.
    chip.querySelector<SherpaMenu>('sherpa-menu')?.hide?.();
    this.#removeFilter(id);
  };

  /** A chip was toggled: report the whole bar. */
  #onChipClick = (event: Event): void => {
    // Composed → find the originating chip on the path. Group and Sort report their own (TODO 424).
    const chip = this.#chipOf(event);
    if (!chip) return;

    // A selector is locked, and no filter: its body asks for nothing.
    if (chip.hasAttribute('data-persistent')) return;
    /* On or off keeps the answer; a toggle answers no field. A locked chip did
       not flip, so it asks for the other state. TRAP T-grid-suspend-is-not-clear */
    // A date that took its default day asks for that day, not a flip. Will, TODO 394
    if ((event as CustomEvent).detail?.picked) return this.#emitChange(this.#answerRequest(chip));
    const field = this.#fieldFor(chip.dataset['id'] ?? '');
    const on = chip.hasAttribute('data-locked') ? !chip.current : chip.current;
    const reading = chip.reading;
    if (field == null || !reading) return this.#emitChange(undefined);
    /* OFF, a pick the filters before it rule out GOES, not kept: it could never
       come back on (TODO 462). None left, the field clears. Will, TODO 465 */
    const picked = reading.picked ?? [];
    const out = ruleOut(this.#present[field] ?? null, this.#offered[field] ?? null);
    const kept = on || reading.mode === 'advanced' ? picked : picked.filter((v) => out(valueKey(v)) === null);
    if (kept.length < picked.length) {
      return this.#emitChange({ field, reading: kept.length ? { ...reading, picked: kept, suspended: true } : null });
    }
    this.#emitChange({ field, suspended: !on });
  };

  /** The Switch flipped: its own act, so the bar's `change` listeners never hear it. */
  #onSwitch = (event: Event): void => {
    event.stopPropagation();
    const off = !(event.target as SherpaSwitch).checked;
    this.#setSwitch(off);
    // Only while it shows one, so a hidden Switch never turns a scope off.
    this.#emitChange(this.#switchable ? { suspended: off } : undefined);
  };

  /** Does this bar show its filter Switch? A data bar only, as Figma draws it. */
  get #switchable(): boolean {
    return this.hasAttribute('data-switchable') && this.dataset['type'] !== 'view';
  }

  /**
   * Is every filter in the bar OFF, each keeping its value? Its Switch says.
   * TRAP T-the-filter-switch-keeps-what-it-turned-off
   */
  get #filtersSuspended(): boolean {
    return !(this.$<SherpaSwitch>('.filters-switch')?.checked ?? true);
  }

  /** Turn the chips — with no source — and draw it. */
  #setSwitch(off: boolean): void {
    if (!this.#sourced) this.#switchChips(off);
    this.#drawSwitch(off);
  }

  /** With no source: turn the filter chips that are on off, listing them, or the listed ones back on. */
  #switchChips(off: boolean): void {
    if (off && !this.#switchedOff) {
      const on = this.#chips().filter((c) => c.current && this.#answering(c));
      this.#switchedOff = on.map((c) => c.dataset['id'] ?? '');
      for (const chip of on) chip.current = false;
    } else if (!off && this.#switchedOff) {
      // Only a chip that still answers: an emptied one would come on as a warning.
      for (const chip of this.#chips()) {
        const answers = chip.reading == null || readingAnswered(chip.reading);
        if (answers && this.#switchedOff.includes(chip.dataset['id'] ?? '')) chip.current = true;
      }
      this.#switchedOff = null;
    }
  }

  /** With no source and the Switch off, a filter that came on goes off and is
   *  listed — the source's keepOff, for a bar that has none. */
  #keepOffChips(): void {
    if (this.#sourced || !this.#switchedOff) return;
    for (const chip of this.#chips()) {
      if (!chip.current || !this.#answering(chip)) continue;
      chip.current = false;
      const id = chip.dataset['id'] ?? '';
      if (!this.#switchedOff.includes(id)) this.#switchedOff.push(id);
    }
  }

  /** Draw the Switch; while it is off, the chips are greyed and still. */
  #drawSwitch(off: boolean): void {
    const sw = this.$<SherpaSwitch>('.filters-switch');
    if (sw) sw.checked = !off;
    this.toggleState('filters-off', off);
    this.$('.chips')?.toggleAttribute('inert', off);
  }

  override onChange(name?: string): void {
    if (name === 'data-heading') for (const chip of this.#chips()) this.#nameContext(chip);
    if (name === 'data-highlight-matches' || name === 'data-highlight-field') this.#markHighlight();
    if (name === 'data-saved-menu') {
      if (this.#columned) this.#column.saved(this.#saved.all);
      else this.#renderAvailable();
    }
    // The saves are off while the filters are the View's own. Will, TODO 382
    if (name === 'data-at-default') {
      if (this.#columned) this.#column.saved(this.#saved.all);
      this.#header.drawSave();
      this.#header.drawSaved();
    }
    if (name === 'data-applied' || name === 'data-count-applied') this.#drawApplied();
    if (name === 'data-no-results') {
      this.drawResults(this.#results);
      this.#drawValueResults();
    }
    // A column draws once it opens. TRAP T-a-shut-column-draws-nothing
    if (name === 'open' && this.#columned && this.hasAttribute('open')) this.#column.opened();
    if (name === 'data-label-column') this.#syncLayout();
    if (name === 'data-every-count') this.#drawValueResults();
    if (name === 'data-orientation') {
      this.#syncLayout();
      this.#drawValueResults();
      this.#reflow();
    }
    // A Switch it no longer shows — hidden, or the panel answering — gives the filters back.
    if ((name === 'data-panel-mode' || name === 'data-switchable' || name === 'data-type') && this.#filtersSuspended
      && (!this.#switchable || this.hasAttribute('data-panel-mode'))) {
      this.#setSwitch(false);
      this.#emitChange({ suspended: false });
    }
    // Local or remote decides which menus wait for Apply, so they are rebuilt.
    if ((name === 'data-remote' || name === 'data-apply-on' || name === 'data-waits' || name === 'data-field-apply' || name === 'data-none-shows-all')
      && this.#filters.length) this.#render();
    if (name === 'data-pending' || name === 'data-failed') this.#syncPending();
    // Apply is on while something in the scope waits for it. TODO 406
    if (name === 'data-dirty' || name === 'data-waits') {
      for (const btn of this.$$('.apply-all, .discard-all')) btn.toggleAttribute('disabled', !this.hasAttribute('data-dirty'));
    }
    if (name === 'data-locked') for (const chip of [...this.#chips(), ...this.$$<HTMLElement>('.organise-chip')]) this.#lock(chip);
    if (name === 'data-hide-unmatched' || name === 'data-limit-options') {
      for (const chip of this.#chips()) this.#markPresent(chip);
      this.$('.add-btn sherpa-menu')?.toggleAttribute('data-hide-unavailable', hidesUnmatched(this));
      syncHide(this, this.root);
    }
    this.#syncArrangement();
    if (name === 'data-saveable') this.#header.drawSave();
  }

  /** ONE reader act, as a request — none for an act no field hears. `values`
   *  and `active` ride along for a host that wants the ticks, the View chip's
   *  among them. TRAP T-a-control-sends-one-request */
  #emitChange(request?: QueryRequest): void {
    this.#keepOffChips();
    this.#ask(request);
    this.#syncOneRows();
  }

  /** SEND one request, every way this bar sends one: `auto`, held for this bar's
   *  Apply where its scope waits (TODO 406); `commit`, applied now (a field's own
   *  Apply, 451); `free`, as it is — a highlight, a preview, an order. */
  #ask(request: QueryRequest | undefined, how: 'auto' | 'commit' | 'free' = 'auto'): void {
    const held = how === 'free' || (how === 'auto' && this.hasAttribute('data-waits'));
    this.emit('quick-filter-change', {
      // TRAP T-values-carries-two-shapes — `scope` says WHICH shape this is.
      scope: 'bar',
      request: request && (held ? request : applied(request)),
      active: this.active,
      // APPLIED: only ON chips.
      values: this.values,
    });
  }

  /**
   * EMPTY one chip, whatever answers it, and switch it off: a list's ticks and
   * rows, a number's two shapes, a date's days. Reset and a redraw both come
   * here — a number chip used to be switched off and left holding its value.
   * TRAP T-empty-is-every-kind-of-answer
   */
  #emptyChip(chip: SherpaQuickFilter): void {
    const id = chip.dataset['id'] ?? '';
    this.#pendingAnswers.delete(id);
    this.#painted.set(id, '');
    // Back to the condition its def opens on. TRAP T-empty-is-every-kind-of-answer
    chip.clear(this.#defOf(chip)?.op ?? DEFAULT_OP);
  }

  /**
   * What a reader DID to each field — the parameters, not an answer. A bar
   * that builds a clause has to know a field's TYPE, and that is how one
   * filtering rule became three.
   *
   * By FIELD — a chip named for its question (the header's Date chip) answers
   * the field its def names. A PERSISTENT chip is a selector, never a filter.
   * TRAP T-the-field-type-decides-the-clause · TRAP T-persistent-chip-is-a-selector
   * TRAP T-the-header-chips-must-reach-the-query
   */
  get readings(): Record<string, FieldReading & { label: string; values: string[] }> {
    const out: Record<string, FieldReading & { label: string; values: string[] }> = {};
    for (const [id, reading] of Object.entries(this.#answers())) {
      const def = this.#defById(id);
      if (!def?.persistent && def?.field !== null) out[def?.field ?? id] = reading;
    }
    return out;
  }

  /** Each chip's answer, by CHIP id — what this bar keeps across a rebuild. */
  #answers(): Record<string, FieldReading & { label: string; values: string[] }> {
    const out: Record<string, FieldReading & { label: string; values: string[] }> = {};
    for (const chip of this.#chips()) {
      const answer = this.#answerOf(chip);
      if (answer) out[chip.dataset['id']!] = answer;
    }
    return out;
  }

  /** ONE chip's answer: none for a superseded chip, a toggle or a selector. */
  #answerOf(chip: SherpaQuickFilter): (FieldReading & { label: string; values: string[] }) | undefined {
    const field = chip.dataset['id'];
    // A SUPERSEDED chip is the view's now; it narrows nothing here.
    if (!field || chip.hasAttribute('data-superseded')) return undefined;
    /* The CHIP says its own answer, and whether it is OFF: off keeps the
       answer and applies none of it. Null: a toggle or a selector.
       TRAP T-a-chip-says-its-own-answer · TRAP T-grid-suspend-is-not-clear */
    const reading = chip.reading;
    if (!reading) return undefined;
    const listed = !chip.menu?.dataset['body'];
    /* A LIST: a menu a rebuild has not drawn yet answers from what the
       rebuild kept, and a drilled chip's rows are in the Filters menu.
       TRAP T-a-rebuild-keeps-every-answer */
    const all = listed
      ? [...chip.menu!.querySelectorAll<HTMLInputElement>('input')]
        .filter((i) => !i.closest(NON_VALUE_ROWS)).map((i) => i.value)
      : [];
    return {
      label: chip.dataset['label'] ?? field,
      values: all,
      ...((listed ? this.#pendingAnswers.get(field) : undefined) ?? reading),
      // ALL is said as all, never as a list of what is ticked now. TRAP T-all-is-an-answer
      ...(listed && !reading.all ? { picked: this.#chipPicks(chip) } : {}),
      suspended: !!reading.suspended,
    };
  }

  /**
   * report() — announce the bar with no request: its `values` and `active`,
   * for a host that follows the View chip. Bound, each door already asked.
   * TRAP T-a-silent-write-still-needs-a-way-to-report
   */
  report(): void {
    this.#emitChange();
  }

  /** One chip's FILTER menu, or null when it has none. */
  #filterMenu(id: string): SherpaMenu | null {
    for (const chip of this.#chips()) {
      if (chip.dataset['id'] !== id) continue;
      const menu = chip.querySelector<SherpaMenu>('sherpa-menu');
      return menu?.getAttribute('data-type') === 'filter' ? menu : null;
    }
    return null;
  }


  /** available([...]) — the filters the Add chip offers, over the populate() set. */
  available(defs: FilterDef[]): void {
    this.#available = Array.isArray(defs) ? defs : [];
    this.#renderAvailable();
  }

  /**
   * addFilters([...ids]) — put offered filters on this bar, as the Add button
   * does. The one door, so a panel's Add and the bar's own Add cannot drift.
   * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  addFilters(ids: readonly string[]): void {
    this.#addFilters([...ids]);
  }

  /**
   * removeFilter(id) — take one filter off this bar, as its menu's Remove
   * does. The other half of `addFilters`, for the same reason: a filter panel
   * draws its own Remove and cannot reach this shadow root.
   * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
   */
  removeFilter(id: string): void {
    this.#removeFilter(id);
  }

  /**
   * groupSets([...]) — the scope's filter SETS: each set's chips are drawn
   * together, in its order — plain chips, never grouped (Will, TODO 241).
   * TODO 99 · TRAP T-a-filter-set-groups-or-chains
   */
  groupSets(sets: readonly FilterSet[]): void {
    if (JSON.stringify(sets) === JSON.stringify(this.#sets)) return;
    this.#sets = [...sets];
    if (this.#chips().length) this.#render();
  }
  /** The scope's filter sets, as last given. */
  #sets: FilterSet[] = [];

  /** The chips in bar order — but each set's together, where its first stands, in the set's order. */
  #inSets(shown: readonly FilterDef[]): FilterDef[] {
    const setOf = new Map(this.#sets.flatMap((set) => set.fields.map((field) => [this.#idOf(field), set] as const)));
    const out: FilterDef[] = [];
    const placed = new Set<string>();
    for (const def of shown) {
      const set = setOf.get(def.id);
      const run = set ? set.fields.map((field) => shown.find((d) => d.id === this.#idOf(field))) : [def];
      for (const one of run) {
        if (!one || placed.has(one.id)) continue;
        placed.add(one.id);
        out.push(one);
      }
    }
    return out;
  }

  /** The ids this bar is holding — the read-back `populate()` never had. */
  get #heldIds(): string[] {
    return this.#filters.map((f) => f.id);
  }

  /** The FIELDS its chips hold — not a selector, or a chip that answers no
   *  field here. What its scope holds. TRAP T-a-bar-reports-its-holds */
  get heldFields(): string[] {
    return this.#filters.filter((f) => !f.persistent && f.field !== null)
      .map((f) => f.field ?? f.id);
  }

  /**
   * drawScope(scope, live) — draw what a scope holds, SILENTLY, from the
   * description the panel is drawn each of: its chips and each field's answer.
   * Nothing is reported — the source already holds all of it. A PERSISTENT
   * chip (the View) is the host's to set, so it is left alone.
   * TRAP T-one-query-one-owner · TRAP T-a-reload-replays-the-readers-answers
   */
  async drawScope(scope: ScopeDescription, live?: () => ScopeDescription): Promise<void> {
    this.#scoped = true;
    this.nameScope(scope);
    // A list this bar kept before a source drew it goes to the source, below.
    const handover = this.#switchedOff;
    this.#switchedOff = null;
    /* The Switch FIRST, before the waits, so a report meanwhile says it. An off
       it cannot show — hidden, or the panel answering — goes back on.
       TRAP T-the-filter-switch-keeps-what-it-turned-off */
    const resume = !!scope.suspended && (!this.#switchable || this.hasAttribute('data-panel-mode'));
    if (resume && !this.#switchable) {
      report({
        code: 'filter-switch-hidden',
        message: `Scope "${scope.scope}" is switched off, and its bar shows no Switch, so it is switched back on. Add data-switchable to offer it.`,
        at: { scope: scope.scope },
      });
    }
    this.#drawSwitch(!!scope.suspended && !resume);
    this.groupSets(scope.sets ?? []);
    // Its Group and Sort, where the scope arranges — drawn again only when they change.
    // TRAP T-group-and-sort-are-component-scope
    const organise = { group: scope.group ?? [], sort: scope.sort ?? [] };
    if (scope.group && JSON.stringify(organise) !== JSON.stringify(this.#organise)) this.organise(organise);
    const fields = scope.filters;
    // A field whose values have just come draws its chip again, with them. TRAP T-a-field-reads-its-values-when-needed
    const ready = new Map(fields.filter((f) => !f.loading).map((f) => [this.#idOf(f.id), f] as const));
    if (this.#filters.some((d) => d.loading && ready.has(d.id))) {
      this.#filters = this.#filters.map((d) => {
        const f = d.loading ? ready.get(d.id) : undefined;
        if (!f) return d;
        const { state: _state, loading: _loading, ...fresh } = f;
        return { ...d, ...fresh, id: d.id, loading: false };
      });
      this.#render();
    }
    // The scope speaks FIELDS; a chip may be named for its question.
    const want = new Set(fields.map((f) => this.#idOf(f.id)));
    // A chip that answers no field here is no scope's to hold, so none takes it off.
    for (const def of [...this.#filters]) {
      if (!want.has(def.id) && def.removable && def.field !== null) this.#removeFilter(def.id, { silent: true });
    }
    /* A field the scope holds that this bar does not offer — a chart's own,
       sent up to the View — is drawn from the scope's own description. TODO 426 */
    for (const id of want) {
      if (this.#heldIds.includes(id) || this.#available.some((f) => f.id === id)) continue;
      const told = fields.find((f) => this.#idOf(f.id) === id);
      if (!told) continue;
      const { state: _state, ...def } = told;
      this.#available.push({ ...(def as FilterDef), id });
    }
    const add = [...want].filter((id) => !this.#heldIds.includes(id)
      && this.#available.some((f) => f.id === id));
    /* An add rebuilds every chip: not while the reader drafts in an open menu —
       the draw after their Apply adds it. TRAP T-a-stale-draw-keeps-the-bars-own-change */
    const drafting = this.#chips().some((c) => this.#drafting(c.dataset['id'] ?? ''));
    if (add.length && !drafting) this.#addFilters(add, { silent: true });
    this.#orderAs(fields.map((f) => this.#idOf(f.id)));
    this.#takeWays(fields);
    // A rebuilt bar reads empty until its menus stamp. TRAP T-a-rebuilt-bar-reads-empty-until-its-menus-stamp
    await this.#settled();
    await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
    const persistent = new Set(this.#chips()
      .filter((c) => c.hasAttribute('data-persistent')).map((c) => c.dataset['id']));
    const answered = new Set<string>();
    /* THE ANSWERS AS THEY ARE NOW, read after the waits: a change made while
       this draw waited is in them. TRAP T-a-stale-draw-keeps-the-bars-own-change */
    for (const { id: field, state } of (live?.() ?? scope).filters) {
      if (!state) continue;
      const id = this.#idOf(field);
      answered.add(id);
      if (!persistent.has(id)) this.#drawChip(id, state);
    }
    /* THE WHOLE SCOPE: a chip it does not answer is EMPTY — a View is a clean
       slate. A superseded chip keeps the reader's own picks. TRAP T-a-view-is-json */
    for (const def of this.#filters) {
      const chip = this.#chips().find((c) => c.dataset['id'] === def.id);
      if (!chip || answered.has(def.id) || persistent.has(def.id)) continue;
      if (this.#painted.get(def.id) === '' || this.#drafting(def.id)) continue;
      if (chip.hasAttribute('data-superseded')) continue;
      this.#emptyChip(chip);
    }
    if (resume) this.#emitChange({ suspended: false });
    else if (handover?.length && scope.suspended) {
      // On in the request, so the source's keepOff lists them as its own.
      const mine = this.#chips().filter((chip) => handover.includes(chip.dataset['id'] ?? ''));
      for (const chip of mine) if (!chip.hasAttribute('data-locked')) chip.current = true;
      this.#emitChange(mine.flatMap((chip) => this.#answerRequest(chip) ?? []));
    }
  }

  /**
   * allowFields([...]) — the ONLY fields this bar may offer, or `null` for all.
   *
   * A context, a role or a fetch decides what a reader may filter by; this bar
   * does not need a branch for who is looking. No list is the default, so a
   * caller that never sets one sees no change.
   * TRAP T-an-allow-list-is-a-filter-not-an-order
   */
  allowFields(list: AllowList): void {
    this.#allowedFields = list ?? null;
    // RENDER FIRST: it replaces the chip run, and the Add button's menu is
    // stamped into that same DOM. The other two callers order it this way too.
    this.#render();
    this.#renderAvailable();
  }

  /** The fields this bar may offer, or null for all. */
  #allowedFields: AllowList = null;

  /** Stamp the Add button's menu from whatever is left to add. */
  #renderAvailable(): void {
    const add = this.$<HTMLElement>('.add-btn');
    if (!add) return;
    // A field the filters before it leave no value for is greyed (349). TRAP T-the-add-menu-is-the-whole-list
    const offer = allow(this.#available, this.#allowedFields)
      .map((f) => (this.#spent(f) ? { ...f, spent: true } : f));
    this.#spentFor = this.#spentKey();
    /* THE WHOLE LIST, not what is LEFT. Ticked is held: a tick adds a chip and
       an untick removes it, so a reader never hunts for where a filter goes.
       Only a REMOVABLE chip is listed — a tick that cannot be cleared is a lie.
       TRAP T-the-add-menu-is-the-whole-list */
    const held = allow(this.#filters.filter((f) => f.removable), this.#allowedFields);
    // A rebuilt run is folded again before it is shown, so a stale fold lists nothing.
    const folded = this.#folded.filter((c) => c.isConnected);
    /* IN BAR ORDER: every chip a reader can take off, and every chip folded
       away — a folded one's row opens its child menu. ONE section, not a
       second one for the folded. Will, 2026-09-25. TRAP T-one-filters-button */
    const heldIds = new Set(held.map((f) => f.id));
    const hidden = new Set(folded);
    const run = this.#chips();
    const inRun = new Set(run.map((c) => c.dataset['id'] ?? ''));
    const added: AddedFilter[] = [
      ...run.filter((c) => heldIds.has(c.dataset['id'] ?? '') || hidden.has(c)).map((c) => {
        const id = c.dataset['id'] ?? '';
        return {
          id, label: this.#defById(id)?.label ?? c.dataset['label'] ?? id,
          removable: heldIds.has(id), hidden: hidden.has(c),
          // ONE value: the tick is the chip's on/off. TODO 54
          ...(c.hasAttribute('data-menu') ? {} : { on: c.current }),
          ...(hidden.has(c) ? { count: this.#chipPicks(c).length } : {}),
        };
      }),
      ...held.filter((f) => !inRun.has(f.id))
        .map((f) => ({ id: f.id, label: f.label, removable: true, hidden: false })),
    ];
    this.#oneRows.tell(added);
    // Split, the sets are the Saved menu's. TODO 436
    const split = this.hasAttribute('data-saved-menu');
    const def = drawFiltersButton(add, added, offer, split ? [] : this.#saved.listed, !split && this.hasAttribute('data-saveable'));
    if (!def) return;
    this.#drawApplied();
    this.#header.drawSaved();
    this.#addMenu(add, def);
    // The Edit menu leads with Reset. Will, TODO 454
    drawFilterActions(this, this.root, add.querySelector('sherpa-menu'));
    add.querySelector('sherpa-menu')?.toggleAttribute('data-hide-unavailable', hidesUnmatched(this));
    this.#header.drawSave();
    this.#syncOverflowActive();
  }

  /** The filters APPLIED, where the app counts them: a column's badge, beside
   *  its title. None, a badge of nothing. Will, TODO 436; the Edit button has
   *  none (TODO 447) */
  #drawApplied(): void {
    const n = Number(this.dataset['applied']) || 0;
    const counting = this.hasAttribute('data-count-applied');
    const badge = this.$<HTMLElement>('.applied-count');
    const said = counting ? drawCount(badge, n || null, ['filter applied', 'filters applied']) : null;
    if (badge) {
      if (said == null) delete badge.dataset['count'];
      else badge.dataset['count'] = said;
    }
  }

  /** A saved set ticked in the Saved menu takes it; unticked, takes it off. TODO 436 */
  #onSavedPick = (event: Event): void => {
    if (this.pathFind(event, '.saved-btn')) this.#header.pick((event as CustomEvent).detail?.values ?? []);
  };

  /** Is an offered field spent — the source tallied it, and found no value left? */
  #spent(def: FilterDef): boolean {
    return this.#present[def.field ?? def.id]?.length === 0;
  }

  /** The offered fields spent now, as one string. */
  #spentKey(): string {
    return this.#available.filter((f) => this.#spent(f)).map((f) => f.id).join();
  }
  /** What the Add list was last drawn spent for. */
  #spentFor = '';

  /** The chips in the source's ONE order (D2 A): the View and any chip that
   *  answers no field first, as they stand, then the scope's own. Drawn again
   *  only when it moved. TRAP T-one-walk-counts-and-limits-in-order */
  #orderAs(ids: readonly string[]): void {
    const rank = new Map(ids.map((id, i) => [id, i]));
    const lead = this.#filters.filter((f) => f.persistent || f.field === null);
    const ranked = this.#filters.filter((f) => !lead.includes(f) && rank.has(f.id))
      .sort((a, b) => rank.get(a.id)! - rank.get(b.id)!);
    const rest = this.#filters.filter((f) => !lead.includes(f) && !rank.has(f.id));
    const next = [...lead, ...ranked, ...rest];
    if (next.every((f, i) => f === this.#filters[i])) return;
    this.#filters = next;
    this.#render();
  }

  /** Move the chosen available filters onto the bar. SILENT for a restore. */
  #addFilters(ids: string[], { silent = false } = {}): void {
    /* BOUND, it ASKS for them: the Query owns its scope's list, and its source
       draws the bar back. Will, TODO 415 (D2 A) */
    const scope = this.#askingScope(silent);
    if (scope) {
      const known = ids.filter((id) => this.#available.some((f) => f.id === id));
      for (const id of ids) {
        if (!known.includes(id)) report({ code: 'unknown-filter', message: 'addFilters: this bar offers no such filter, so nothing was added.', at: { id } });
      }
      if (known.length) this.emit('filter-add', { scope, ids: known, filters: known.map((id) => this.#available.find((f) => f.id === id)!) });
      return;
    }
    const added: FilterDef[] = [];
    for (const id of ids) {
      const i = this.#available.findIndex((f) => f.id === id);
      if (i < 0) {
        // TRAP T-a-broken-assumption-reports — the caller named something the
        // Add list does not hold, so nothing appears and nothing says why.
        report({
          code: 'unknown-filter',
          message: 'addFilters: this bar offers no such filter, so nothing was added.',
          at: { id, offering: this.#available.map((f) => f.id).join(',') },
        });
        continue;
      }
      const [def] = this.#available.splice(i, 1);
      /* OFF, and REMOVABLE. A chip added ON holds no values yet, and "on but
         filtering by nothing" is the amber warning — shown to a reader who has
         done nothing wrong. They add the chip, then answer it.
         TRAP T-a-new-chip-opens-in-default-not-warning */
      added.push({ ...def!, active: false, removable: true });
    }
    if (!added.length) return;
    // A field lands at the end.
    this.#filters = [...this.#filters, ...added];
    this.#render();
    this.#renderAvailable();
    if (silent) return;
    // ONE event for the batch — a host re-queries once. TRAP T-add-menu-batches
    this.emit('filter-add', { ids: added.map((f) => f.id), filters: added, holds: this.heldFields });
  }

  /** Take one filter back OFF the bar. It returns to the Add menu, clean. */
  #removeFilter(id: string, { silent = false } = {}): void {
    const i = this.#filters.findIndex((f) => f.id === id);
    // BOUND, it ASKS to let it go; its source draws the bar back. TODO 415 (D2 A)
    const scope = this.#askingScope(silent);
    if (scope && i >= 0) {
      const { active: _active, ...filter } = this.#filters[i]!;
      this.emit('filter-remove', { scope, id, filter });
      return;
    }
    if (i < 0) {
      // TRAP T-a-broken-assumption-reports
      report({
        code: 'unknown-filter',
        message: 'removeFilter: this bar is not holding that filter.',
        at: { id, held: this.#filters.map((f) => f.id).join(',') },
      });
      return;
    }
    const [def] = this.#filters.splice(i, 1);
    if (this.#switchedOff) this.#switchedOff = this.#switchedOff.filter((x) => x !== id);
    const { active: _active, ...clean } = def!;
    this.#available = [...this.#available, clean as FilterDef];
    this.#render();
    this.#renderAvailable();
    if (silent) return;
    this.emit('filter-remove', { id, filter: clean, holds: this.heldFields });
  }

  /** The scope a bound bar asks a change of — none unbound, or for a silent
   *  change its source itself made. TODO 415 */
  #askingScope(silent: boolean): string | undefined {
    if (silent || !this.#sourced) return undefined;
    return this.#scope || this.dataset['scope']?.trim() || undefined;
  }

  /* ── Action cluster ────────────────────────────────────────────────── */

  /** One listener for the whole cluster — the action is read off `data-act`. */
  #onAction = (event: Event): void => {
    const path = event.composedPath();
    const btn = path.find(
      (n): n is HTMLElement => n instanceof HTMLElement && !!n.dataset['act'],
    );
    if (!btn) return;
    if (btn.dataset['act'] === 'overflow') this.#openMore(btn);
    else this.#act(btn.dataset['act'] ?? '');
  };

  /** One action, whichever button or row asked for it. */
  #act(act: string): void {
    switch (act) {
      case 'reset':
        // RESETS, not announces: a host cannot reach chips it did not stamp.
        this.clearAll();
        break;
      case 'refresh':
        this.emit('data-refresh');
        break;
      case 'apply':
        // Every change its scope holds — or, Discard, none of them. TODO 406
        this.emit('filter-apply', {});
        break;
      case 'discard':
        this.emit('filter-discard', {});
        break;
      case 'add':
        // sherpa-button opens its own slotted menu; nothing to do here.
        break;
      default:
        // Reset all on view, and the save rows: the header's, as its column's. TODO 415
        this.#header.act(act);
    }
  }

  /** A chip menu's Apply, where each field applies on its own: that field goes,
   *  alone. Only an OPEN menu's: a section's value press applies its shut menu,
   *  and that pick waits for the section's own Apply. TRAP T-each-field-can-apply-on-its-own */
  #onMenuApply = (event: Event): void => {
    if (!this.hasAttribute('data-waits') || !this.hasAttribute('data-field-apply')) return;
    if (!this.pathFind<SherpaMenu>(event, 'sherpa-menu')?.open) return;
    const chip = this.#chipOf(event);
    if (chip) this.#commitField(chip);
  };

  /** A section's own Apply or Discard, where each field applies on its own. TODO 451 */
  #onFieldApply = (event: Event): void => {
    const commit = this.pathFind(event, '.field-commit');
    const discard = commit ? null : this.pathFind(event, '.field-discard');
    const chip = commit || discard ? this.#chipOf(event) : null;
    if (!chip) return;
    event.stopPropagation();
    if (commit) this.#commitField(chip);
    else this.#onMenuDiscard(event);
  };

  /** Send ONE field's answer, applied: the rest of the scope still waits. TODO 451 */
  #commitField(chip: HTMLElement): void {
    const request = this.#answerRequest(chip);
    if (request) this.#ask(request, 'commit');
  }

  /** A menu's Discard, where the scope waits: its field's applied answer comes back. TODO 406 */
  #onMenuDiscard = (event: Event): void => {
    if (!this.hasAttribute('data-waits')) return;
    const chip = this.#chipOf(event);
    const field = chip ? this.#fieldFor(chip.dataset['id'] ?? '') : null;
    if (field != null) this.emit('filter-discard', { field });
  };

  /**
   * THE ⋮ MENU: Save filters (Will, TODO 430; Reset is the Edit menu's, 454), then what has FOLDED
   * away at this width — the page's own buttons, then Refresh. A row does what
   * its button does. Suggest filters and the View's ★ and Save are the App
   * Header's (TODO 425). TRAP T-the-more-menu-holds-what-folded
   */
  #openMore(trigger: HTMLElement): void {
    const refresh: MoreRow[] = folded(this.$('.act[data-act="refresh"]')) ? [['refresh']] : [];
    const saves = this.hasAttribute('data-saved-menu') ? [] : saveRows(this, this.#saved.applied);
    // Reset is the Edit menu's. Will, TODO 454
    openMore(this, this.root, trigger, [saves, extraRows(this), refresh]);
  }

  /** The ⋮ menu's switch: a REQUEST — the host owns whether filters limit each other. */
  #onMoreSwitch = (event: Event): void => askSwitches(this, event, (name, on) => this.emit(name, { on }));

  /** A ⋮ row was chosen: do what its folded button does. */
  #onMore = (event: Event): void => this.#act(pickMore(this, this.root, event));

  /** The Add menu committed. `menu-change`: only a CHIP re-emits as quick-filter-change. */
  #onAddCommit = (event: Event): void => {
    const add = this.pathFind(event, '.add-btn');
    if (!add) return;
    event.stopImmediatePropagation();
    // A DRILLED chip's pick is that chip's — never an Add or a Remove.
    const drilled = this.#drill.home?.closest<HTMLElement>('sherpa-quick-filter');
    if (this.#drill.home) {
      this.#emitChange(drilled ? this.#answerRequest(drilled) : undefined);
      return;
    }
    /* WHAT CHANGED is the difference between what the menu now says and what
       the bar is holding — an unticked row is a REMOVE. A ONE-value row's tick
       is its chip's on/off instead, and its × removes it.
       TRAP T-the-add-menu-is-the-whole-list */
    const want = new Set(((event as CustomEvent).detail?.values ?? []) as string[]);
    // A saved set's row takes it, or — unticked — takes it off. TODO 105, 366
    this.#header.pick([...want]);
    // Only a row the reader CHANGED: a stale tick never undoes a chip. TODO 54
    const flips: QueryRequest[] = [];
    let flipped = false;
    // While the Switch is off, a one-value row turns no chip on: its tick goes back.
    const still = this.#filtersSuspended;
    for (const id of this.#oneRows.ids) {
      const on = want.has(id);
      const chip = this.#chips().find((c) => c.dataset['id'] === id);
      // `flip` LAST: it records.
      if (!chip || chip.hasAttribute('data-persistent') || still || !this.#oneRows.flip(id, on)) continue;
      if (!chip.hasAttribute('data-locked')) chip.current = on;
      flipped = true;
      const field = this.#fieldFor(id);
      if (field != null && chip.reading) flips.push({ field, suspended: !on });
    }
    if (still) this.#syncOneRows();
    const ones = this.#oneRows;
    const held = new Set(this.#filters.filter((f) => f.removable && !ones.has(f.id)).map((f) => f.id));
    const added = [...want].filter((id) => !held.has(id) && !ones.has(id));
    const gone = [...held].filter((id) => !want.has(id));
    for (const id of gone) this.#removeFilter(id);
    if (added.length) this.#addFilters(added);
    if (!flipped) return;
    this.#syncOverflowActive();
    this.#emitChange(flips);
  };

  /** What each ONE-value row was told. TODO 54 */
  #oneRows = new OneRows();

  /** A chip turned on or off elsewhere: its row is ticked as it is, while the menu is shut. */
  #syncOneRows(): void {
    const menu = this.$('.add-btn')?.querySelector<SherpaMenu>('sherpa-menu');
    this.#oneRows.follow(menu, (id) => !!this.#chips().find((c) => c.dataset['id'] === id)?.current);
  }

  /**
   * TRAP T-clear-all-resets-organise-too — organise chips included; three events
   * afterwards. `{ organise: false }` keeps Group and Sort, which a VIEW sets
   * itself; `{ carry: true }` keeps a carry-over chip, as a View change does.
   * A field chip is EMPTIED — ticks, op, typing and rows — and redrawn,
   * so an off chip never still names what it held.
   */
  clearAll(options: { organise?: boolean; carry?: boolean } = {}): void {
    const organise = options.organise ?? true;
    // A clean slate: the Switch is on, and what it turned off is forgotten.
    this.#switchedOff = null;
    this.#drawSwitch(false);
    for (const chip of this.#chips()) {
      // TRAP T-persistent-chip-is-a-selector — survives a reset, PICK included.
      if (chip.hasAttribute('data-persistent')) continue;
      const id = chip.dataset['id'] ?? '';
      // A View change leaves a carry-over chip; Reset does not. TRAP T-a-field-can-carry-over-views
      if (options.carry && this.#defById(id)?.carryOver) continue;
      /* A chip the VIEW holds is not this bar's to reset: it keeps what it
         shows, and its own picks for when the View lets go.
         TRAP T-a-superseded-chip-suspends-it-is-never-removed */
      if (chip.hasAttribute('data-superseded')) continue;
      this.#emptyChip(chip);
    }
    if (organise) this.#clearOrganise();
    this.#emitChange({ reset: { ...(organise ? { organise } : {}), ...(options.carry ? { carry: true } : {}) } });
    // Bound, the reset says it; with no source, the host arranges its own rows.
    if (!organise || this.hasAttribute('data-locked')) return;
    // Typed as its Group and Sort chips' own, which this bar carries too. TODO 424
    this.emit('group-change', { field: null as string | null });
    this.emit('sort-change', { field: null as string | null, direction: 'asc' as SortDirection });
  }

  /** Group and Sort off, and the Sort's way forgotten. */
  #clearOrganise(): void {
    // The chip clears its own column and way. TODO 424
    for (const chip of this.$$<SherpaQuickFilter>('.organise-chip')) chip.clear();
  }

  /* ── Organise: the leading Group / Sort chips ───────────────────────── */

  /** TRAP T-organise-glyphs-are-named-not-inline — `view` stays here, the shared four in core/icons. */
  /** The View chip glyph, plus the shared Group and Sort glyphs. */
  static readonly #icons = {
    view: 'desktop',
    ...ORGANISE_ICONS,
  } as const;

  /**
   * organise({ group, sort }) — how ONE component arranges the rows it draws.
   *
   * REFUSED on a `data-type="view"` bar. Group and Sort are not filters and
   * have no view-level meaning: a view holds a population, and "sorted by
   * name" is a property of a table, not of a population. Two components in one
   * view sort differently and are both right.
   *
   * A filter chip answers "which rows"; an organise chip answers "in what
   * order" — which is why this is a separate call from `populate()`.
   * TRAP T-organise-chips-lead-the-bar
   * TRAP T-group-and-sort-are-component-scope
   */
  organise(def: OrganiseDef): void {
    if (this.dataset['type'] === 'view') {
      this.#organise = {};
      return;
    }
    this.#organise = def ?? {};
    this.#renderOrganise();
  }

  /** The column the grid is grouped by — null when the chip is OFF, radio or no radio. */
  get groupField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="group"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('group') ?? null;
  }

  /** The column the grid is sorted by — null while SUSPENDED, though the chip remembers it. */
  get sortField(): string | null {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    if (!chip || !chip.hasAttribute('data-current')) return null;
    return this.#menuValue('sort') ?? null;
  }

  /** Which way that sort runs. Defaults to ascending. */
  get sortDirection(): SortDirection {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return chip?.dataset['direction'] === 'desc' ? 'desc' : 'asc';
  }

  /** Whether the sort is suspended — a column is picked but not being applied. */
  get sortSuspended(): boolean {
    const chip = this.$<HTMLElement>('.organise-chip[data-id="sort"]');
    return !!chip && !chip.hasAttribute('data-current') && !!this.#menuValue('sort');
  }

  /** Stamp the Group and Sort chips into the organise zone. Both single-select. */
  #renderOrganise(): void {
    const zone = this.$('.organise-zone');
    if (!zone) return;

    const group = this.#organise.group ?? [];
    const sort = this.#organise.sort ?? [];
    zone.replaceChildren();
    // CSS cannot see whether the zone has children, and an empty one would leave
    // its divider rule floating.
    this.toggleState('has-organise', group.length > 0 || sort.length > 0);

    /* BORN NAMING ITS COLUMN. The bar may already be grouped or sorted — a
       reload restores both — so the chip is built on that column rather than
       waiting for a second pass to tick it. */
    const on = { group: this.dataset['groupField'] ?? '', sort: this.dataset['sortField'] ?? '' };
    if (group.length) {
      zone.appendChild(this.#organiseChip('group',
        SherpaQuickFilterToolbar.#icons.group, organiseOptions(group, on.group), on.group));
    }
    if (sort.length) {
      // The MENU picks the column, the BODY cycles direction. Built OFF, with
      // the sort-none glyph, until the host's arrangement turns it on below.
      /* NO `data-direction` here. `chip.direction` answers `asc` for a chip that
         is ON with none set, so writing it is a third place that has to agree.
         TRAP T-one-cycle-for-one-value */
      zone.appendChild(this.#organiseChip('sort',
        SherpaQuickFilterToolbar.#icons.sortNone, organiseOptions(sort, on.sort), on.sort));
    }
    // Then ON, if the host is: a rebuild changes no attribute, so onChange will not.
    this.#syncArrangement();
  }

  /** Follow the host's arrangement onto the Group and Sort chips. The chip knows how. */
  #syncArrangement(): void {
    for (const kind of ['group', 'sort'] as const) {
      arrangeFrom(this, this.$<SherpaQuickFilter>(`.organise-chip[data-id="${kind}"]`), kind);
    }
  }

  /** One organise chip, from its own prototype: a menu chip with single-select rows. */
  #organiseChip(
    id: 'group' | 'sort',
    icon: string,
    options: FilterOption[],
    column = '',
  ): HTMLElement {
    const chip = this.clone(`template.organise-${id}-tpl`);
    if (!chip) throw new Error(`sherpa-quick-filter-toolbar: template.organise-${id}-tpl is missing or empty`);
    /* THE CHIP KNOWS WHAT IT IS, and owns its own gesture: group toggles,
       sort cycles. This bar only places it and hears what it reports.
       "Organise" is the zone it sits in, not a kind.
       TRAP T-a-chip-knows-what-kind-it-is */
    if (column) chip.dataset['column'] = column;
    chip.setAttribute('data-icon-start', icon);
    this.#addMenu(chip, { id, label: chip.dataset['label'] ?? '', select: 'single', options });
    this.#lock(chip);
    return chip;
  }

  /** LOCKED, a chip reports and is drawn: a selector always, and in a bound
   *  bar each chip whose state the source keeps — a toggle answers no field,
   *  so it stays its own. 366 step 22 · TRAP T-locked-chip-relays-and-nothing-else */
  #lock(chip: HTMLElement): void {
    const id = chip.dataset['id'] ?? '';
    const kept = chip.classList.contains('organise-chip') || this.#fieldFor(id) != null;
    chip.toggleAttribute('data-locked', chip.hasAttribute('data-persistent') || (this.hasAttribute('data-locked') && kept));
  }

  /** The committed value of one organise chip's menu. */
  #menuValue(id: string): string | undefined {
    const chip = this.$(`.organise-chip[data-id="${id}"]`);
    const checked = chip?.querySelector<HTMLInputElement>('input:checked');
    return checked?.value;
  }

  /** A filter chip committed: its event reports one chip; it is swapped for the
   *  bar's own. Group and Sort report their own, and never send it (TODO 424). */
  #onChipChange = (event: Event): void => {
    /* This hears the chips' quick-filter-change AND the toolbar's own, emit()
       being composed. Registered in CAPTURE so it stops a chip's before a host
       reads it. TRAP T-capture-beats-registration-order */
    const chip = this.#chipOf(event);
    if (!chip) return;
    event.stopImmediatePropagation();
    /* The chip's OWN answer: `values` reports only chips already ON, so an off
       chip could never commit itself on — every date chip's first pick. A TYPED
       condition is an answer too: "Contains Ravi" filtered 100 rows down to 22
       while its chip read OFF. Locked, it is drawn. TRAP T-an-operator-decides-pick-or-type */
    if (!chip.hasAttribute('data-locked') || chip.hasAttribute('data-persistent')) {
      chip.toggleAttribute('data-current', chip.hasAttribute('data-persistent') || this.#chipPicks(chip).length > 0 || chip.answered);
      chip.refresh();
    }
    this.#emitChange(this.#answerRequest(chip));
  };
}

/** A bar's request is its Apply too: its menus waited for theirs. 366 step 21 */
function applied(request: QueryRequest): QueryRequest {
  if (Array.isArray(request)) return (request as readonly QueryRequest[]).map(applied);
  return { ...(request as Exclude<QueryRequest, readonly QueryRequest[]>), commit: true };
}

define('sherpa-quick-filter-toolbar', SherpaQuickFilterToolbar);
