/**
 * provider-legends.ts — a legend that PICKS values of its chart's field: its pick
 * narrows its chart alone, its rows may be chips — in its card's filter toolbar
 * where it has one — and a rest on a row previews its matches.
 *
 * Map:
 * - Picker — A component that picks values, through its `picked` door.
 * - LegendHost — What the legends ask of their provider.
 * - ProviderLegends — The legends that pick, in one provider's subtree.
 * - .picks — Bind a legend's picks to its source, narrowing its host; its way out.
 * - .lay — Lay every legend out again: its rows as chips, or key rows.
 * - .hoverable — Every legend's rest on a row previews its matches, or not.
 * - .counted — A legend drawn in its card's bar has drawn: the bar's chips take its numbers.
 */
import { bindSelection } from '../../core/data/bind-selection.js';
import { valueKey } from '../../core/data/store.js';
import { VIEW } from '../../core/data/query.js';
import { report } from '../../core/data/report.js';
import type { DataAsk } from '../../core/ui/context.js';
import { declared, up } from './provider-declared.js';
import { bindId } from '../../core/ui/bind-source.js';
import type { DataSource } from '../../core/data/data-source.js';
import { cardOf } from './provider-cards.js';

/** A component that picks values, through its `picked` door. */
export type Picker = Element & { picked: string[]; present?: readonly string[] | null };

/** A bar that takes `counts`: its value chips' numbers. */
type Counts = Element & { drawCounts(field: string, counts: Record<string, number> | null): void };

/** What a reader calls a component: its own `aria-label`, or the heading of
 *  the card it sits in. TRAP T-a-scope-is-named-for-its-content */
const nameOf = (el: Element): string =>
  el.getAttribute('aria-label')
  ?? cardOf(el)?.querySelector(':scope > [slot="header"]')?.getAttribute('data-heading')
  ?? '';

/** What the legends ask of their provider. */
export interface LegendHost {
  /** An attribute from the element, or the nearest one above it. */
  inherited(el: Element, name: string): string | null;
  /** The filter bars in a slot. */
  bars(slot: string): Element[];
  /** A slot's toolbars and toggles drawn again. */
  drawToolbars(slot: string): void;
  /** Light what a field of a scope matches, or one value of it. */
  hover(scope: string, field: string, on: boolean, value?: string): void;
  /** The app's choice: a legend's rows as chips. */
  chips(): boolean;
  /** The app's choice: Highlight matches on hover. */
  highlightHover(): boolean;
}

/** The legends that pick, in one provider's subtree. */
export class ProviderLegends {
  /** The provider it serves. */
  readonly #host: LegendHost;
  /** Each legend that picks — a field's values, as a chip's — and how it lays out its chips. */
  readonly #pickers = new Map<Element, () => void>();
  /** Each legend drawn in its card's bar, telling the bar its numbers. TODO 670 */
  readonly #counts = new Map<Element, (payload: unknown) => void>();

  constructor(host: LegendHost) {
    this.#host = host;
  }

  /**
   * A component that PICKS values of its segment field — a legend. Its pick
   * narrows its host (its chart) and nothing else: component reach.
   * TRAP T-a-legend-toggle-is-a-filter
   * TRAP T-a-component-part-narrows-one-component
   */
  picks(el: Picker, source: DataSource, field: string, picks: NonNullable<DataAsk['picks']>): (() => void) | undefined {
    const host = this.#host;
    const values = source.valuesFor(field).map(valueKey);
    if (!values.length) {
      report({
        code: 'provider-picks-undeclared',
        message: "sherpa-provider: a component that picks needs its field's values declared, so this one only shows.",
        at: { tag: el.localName, field },
      });
      return undefined;
    }
    const only = picks.narrows === 'host' ? up(el) : el;
    // One part per component, or the second would replace the first.
    const key = `picks:${el.id || field}`;
    /* A chart in a slot that HOLDS its field — a grid's, shown as a chart — picks
       in that scope: its filters are there already, so no part, no new panel
       section. Will, TODO 548 */
    const slot = host.inherited(el, 'data-scope');
    const home = slot && !/\s/.test(slot) && slot !== VIEW && source.query.holds(slot, field) ? slot : undefined;
    const unbind = bindSelection(el, source, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only: bindId(only) } : {}),
      ...(home ? { home } : {}),
      key,
    }).destroy;
    // No host to narrow: bindSelection said so, and bound nothing.
    if (!only) return unbind;
    /* The chart's OWN scope, so a filter panel draws it — named as the chart
       is. TRAP T-a-chart-scope-is-its-legend-field */
    const label = nameOf(only);
    /* Chips, in its card's filter toolbar where it has one: the part is drawn there,
       answered in its own scope still, and the chart keeps no room for its legend.
       Will, TODO 670 */
    const inSlot = !home && slot && !/\s/.test(slot) && slot !== VIEW ? slot : null;
    const bar = !!inSlot && host.bars(inSlot).length > 0;
    const bars = (): Counts[] => (slot ? host.bars(slot) : []).filter((b): b is Counts => declared(b).takes.includes('counts'));
    const lay = (): void => {
      const inBar = host.chips() && bar;
      if (!home) source.query.declarePart(key, { field, only: bindId(only), ...(label ? { label } : {}), ...(inBar ? { shownIn: slot! } : {}) });
      el.toggleAttribute('data-chips', host.chips() && !inBar);
      only.toggleAttribute('data-no-legend', inBar);
      // Its value chips count what its chart counts, each its legend row's number. Will, TODO 670
      if (inBar) {
        this.#counts.set(el, (payload) => {
          const items = Array.isArray(payload) ? (payload as { label: string; value: number }[]) : [];
          for (const b of bars()) b.drawCounts(field, Object.fromEntries(items.map((i) => [i.label, i.value])));
        });
      } else if (this.#counts.delete(el)) for (const b of bars()) b.drawCounts(field, null);
      // In its bar or out of it, the bar may have nothing left to draw. Will, TODO 696
      if (slot) host.drawToolbars(slot);
    };
    lay();
    // What the filters before it leave, so the legend greys the rest. TRAP T-a-ruled-out-value-is-greyed
    const hear = (event: Event): void => {
      const left = (event as CustomEvent<{ byScope: Record<string, Record<string, string[]>> }>).detail.byScope[home ?? key];
      el.present = left?.[field] ?? null;
    };
    source.addEventListener('present', hear);
    /* A rest on a row previews its value's matches, as a chip's value does — in
       the View where the View holds the field. Will, TODO 495
       TRAP T-a-hovered-chip-previews-the-highlight */
    const scope = (): string => (source.query.scope(VIEW).includes(field) ? VIEW : home ?? key);
    const rest = (event: Event): void => {
      const { label: value, on } = (event as CustomEvent<{ label: string; on: boolean }>).detail;
      host.hover(scope(), field, on, value);
    };
    el.addEventListener('legend-hover', rest);
    this.#pickers.set(el, lay);
    el.toggleAttribute('data-highlight-hover', host.highlightHover());
    return () => {
      el.removeEventListener('legend-hover', rest);
      this.#pickers.delete(el);
      el.removeAttribute('data-highlight-hover');
      el.removeAttribute('data-chips');
      only.removeAttribute('data-no-legend');
      if (this.#counts.delete(el)) for (const b of bars()) b.drawCounts(field, null);
      source.removeEventListener('present', hear);
      if (!home) source.query.declarePart(key, undefined);
      unbind();
    };
  }

  /** Lay every legend out again: its rows as chips, in its bar or in it, or key rows. */
  lay(): void {
    for (const lay of this.#pickers.values()) lay();
  }

  /** Every legend's rest on a row previews its matches — or, off, does not. Will, TODO 495 */
  hoverable(on: boolean): void {
    for (const el of this.#pickers.keys()) el.toggleAttribute('data-highlight-hover', on);
  }

  /** A legend drawn in its card's bar has drawn: the bar's value chips take its numbers. TODO 670 */
  counted(el: Element, payload: unknown): void {
    this.#counts.get(el)?.(payload);
  }
}
