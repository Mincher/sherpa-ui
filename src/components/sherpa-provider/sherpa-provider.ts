/**
 * sherpa-provider — the data layer, over a SUBTREE of the page: a component
 * inside it ASKS, and this ANSWERS.
 *
 * A thin DOM door onto the DOM-free data layer. It holds the sources it is
 * given and joins each component that asks to the one its subtree provides —
 * by `bind()`, delivering through the callback the component asked with. A
 * request that arrives before any source waits, and `provide()` answers it.
 * docs/PROVIDER-DESIGN.md. TRAP T-a-component-asks-its-provider
 *
 * Map:
 * - ProvideOptions — What a provider is given: its sources, by name.
 */
import { SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import {
  DATA_CONTEXT, SOURCE_CONTEXT, type ContextRequestEvent, type DataAsk,
} from '../../core/ui/context.js';
import { report } from '../../core/data/report.js';
import { summarise, type SummarySpec } from '../../core/data/aggregate.js';
import { bindSelection, type Selector } from '../../core/data/bind-selection.js';
import { valueKey } from '../../core/data/store.js';
import type { DataSource } from '../../core/data/data-source.js';
import type { Populatable } from '../../core/ui/apply-state.js';

/** What a provider is given: its sources, by name. */
export interface ProvideOptions {
  sources: Record<string, DataSource>;
}

/** The attribute a summary needs before it asks; without it a page populates it.
 *  TRAP T-a-component-declares-its-summary */
const DECLARED_BY: Partial<Record<DataAsk['shape'], string>> = {
  aggregate: 'data-aggregate', segments: 'data-segment-field', series: 'data-over-field',
  scope: 'data-scope',
};

/** The shapes a summary is answered in. */
const SUMMARIES = new Set<DataAsk['shape']>(['aggregate', 'segments', 'series']);

/** Each summary attribute, and the key it fills in a `SummarySpec`. */
const SPEC_KEYS = [
  ['aggregate', 'data-aggregate'], ['field', 'data-field'], ['segment', 'data-segment-field'],
  ['over', 'data-over-field'], ['bucket', 'data-bucket'],
] as const;

/** A component that picks values, through its `picked` door. */
type Picker = Element & { picked: string[] };

/** The element above this one, across a shadow root. */
const up = (el: Element): Element | null =>
  el.parentElement ?? ((el.getRootNode() as ShadowRoot).host ?? null);

/** One component that asked, and how to stop answering it. */
interface Asked {
  request: ContextRequestEvent<unknown>;
  unbind?: () => void;
}

export class SherpaProvider extends SherpaElement {
  static override css = new URL('./sherpa-provider.css', import.meta.url);
  static override html = new URL('./sherpa-provider.html', import.meta.url);

  /** The sources this subtree provides, by name. */
  #sources: Record<string, DataSource> = {};
  /** Every component that asked, by the element that asked. */
  #asked = new Map<Element, Asked>();

  constructor() {
    super();
    // From the START: a child can ask before this has rendered.
    this.addEventListener('context-request', this.#onRequest);
  }

  /** Give this subtree its sources. Every component already asking is answered
   *  again — a Context that swaps its source swaps it for everything in it. */
  provide(options: ProvideOptions): void {
    this.#sources = { ...options.sources };
    for (const asked of this.#asked.values()) this.#answer(asked);
  }

  override onDisconnect(): void {
    for (const asked of this.#asked.values()) asked.unbind?.();
    this.#asked.clear();
  }

  /** A request from inside: the NEAREST provider answers, so it stops here. */
  #onRequest = (event: Event): void => {
    const request = event as ContextRequestEvent<unknown>;
    if (request.context !== DATA_CONTEXT && request.context !== SOURCE_CONTEXT) return;
    event.stopPropagation();
    if (request.context === SOURCE_CONTEXT) {
      const source = this.#resolve(request.contextTarget);
      if (source) request.callback(source);
      return;
    }
    this.#asked.get(request.contextTarget)?.unbind?.();
    const asked: Asked = { request };
    this.#asked.set(request.contextTarget, asked);
    this.#answer(asked);
  };

  /** Join one asking component to its source, in the shape it declared. */
  #answer(asked: Asked): void {
    asked.unbind?.();
    delete asked.unbind;
    const { contextTarget: el, callback } = asked.request;
    // Gone from the page while it waited: forget it, never bind it.
    if (!el.isConnected) {
      this.#asked.delete(el);
      return;
    }
    const source = this.#resolve(el);
    // No source yet: it waits, and `provide()` answers it.
    if (!source) return;
    // Bound by hand already — the page's own bind stands, and is not doubled.
    if (source.boundElements.includes(el as Populatable)) return;
    const asks = (el.constructor as { asks?: DataAsk }).asks ?? { shape: 'rows' };
    // Nothing declared: it is the page's to populate.
    const needs = DECLARED_BY[asks.shape];
    if (needs && !this.#inherited(el, needs)) return;
    const spec = SUMMARIES.has(asks.shape) ? this.#spec(el, asks) : undefined;
    if (SUMMARIES.has(asks.shape) && !spec) return;
    const leave = (): void => {
      asked.unbind?.();
      this.#asked.delete(el);
    };
    const scope = this.#inherited(el, 'data-scope');
    const unbind = source.bind(el as Populatable, {
      rows: spec || asks.shape === 'all' ? 'all' : 'page',
      // A pager and a filter bar steer; the rows are not theirs to draw.
      steerOnly: asks.shape === 'state' || asks.shape === 'scope',
      ...(asks.own ? { ignore: asks.own } : {}),
      ...(scope ? { scope } : {}),
      /* A summary SHOWS the data and never steers it. TRAP T-aggregation-is-data */
      ...(spec ? { readonly: true, as: (rows, src) => summarise(rows, spec, (f) => src.valuesFor(f)) } : {}),
      // A page of rows arrives WITH its groups: a group is the data layer's.
      // TRAP T-a-group-is-a-data-layer-concept
      ...(asks.shape === 'rows'
        ? { as: (rows, src) => ({ rows, groups: src.state.group && src.loaded ? src.groups() : null }) }
        : {}),
      deliver: (payload) => callback(payload, leave),
    });
    const unpick = spec && asks.picks ? this.#picks(el as Picker, source, spec, asks.picks) : undefined;
    asked.unbind = () => {
      unpick?.();
      unbind();
    };
    // No rows ever come, so it is handed its way out now.
    if (asks.shape === 'state' || asks.shape === 'scope') callback(undefined, leave);
  }

  /** An attribute from the asking element, or the nearest one above it — a
   *  legend reads its chart's, a nested pager its grid's. Stops here. */
  #inherited(el: Element, name: string): string | null {
    for (let n: Element | null = el; n && n !== this; n = up(n)) {
      const value = n.getAttribute(name);
      if (value !== null) return value;
    }
    return null;
  }

  /** The summary a component declared, as JSON — or none, and it waits. */
  #spec(el: Element, asks: DataAsk): SummarySpec | undefined {
    const spec: Record<string, unknown> = { shape: asks.shape };
    for (const [key, attr] of SPEC_KEYS) {
      const value = this.#inherited(el, attr);
      if (value) spec[key] = value;
    }
    const kinds: readonly string[] = SUMMARY_PROPS['data-aggregate'].values;
    if (spec['aggregate'] && !kinds.includes(spec['aggregate'] as string)) {
      report({
        code: 'provider-unknown-aggregate',
        message: 'sherpa-provider: data-aggregate names no aggregate, so nothing is summarised.',
        at: { tag: el.localName, aggregate: String(spec['aggregate']), offers: kinds.join(',') },
      });
      return undefined;
    }
    if (asks.keepEmpty) spec['keepEmpty'] = true;
    return spec as unknown as SummarySpec;
  }

  /**
   * A component that PICKS values of its segment field — a legend. Its pick
   * narrows its host (its chart) and nothing else: component reach.
   * TRAP T-a-legend-toggle-is-a-filter
   * TRAP T-a-component-part-narrows-one-component
   */
  #picks(el: Picker, source: DataSource, spec: SummarySpec, picks: NonNullable<DataAsk['picks']>): (() => void) | undefined {
    const field = spec.segment ?? '';
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
    return bindSelection(el, source as unknown as Selector, {
      field,
      values,
      read: (c) => c.picked,
      draw: (c, picked) => { c.picked = [...picked]; },
      event: picks.event,
      reach: 'component',
      ...(only ? { only } : {}),
      // One part per component, or the second would replace the first.
      key: `picks:${el.id || field}`,
    }).destroy;
  }

  /**
   * The source a component's subtree provides. Named only when the subtree
   * offers two; an unnamed ask of two, or a name not offered, is LOUD — never
   * a guess. FILTER-REVIEW §12, decided 2026-09-25.
   */
  #resolve(el: Element): DataSource | null {
    const names = Object.keys(this.#sources);
    const named = this.#inherited(el, 'data-source');
    if (named) {
      const source = this.#sources[named];
      if (!source && names.length) {
        report({
          code: 'provider-unknown-source',
          message: 'sherpa-provider: this subtree provides no source by that name.',
          at: { tag: el.localName, name: named, offers: names.join(',') },
        });
      }
      return source ?? null;
    }
    if (names.length > 1) {
      report({
        code: 'provider-ambiguous',
        message: 'sherpa-provider: this subtree provides several sources, so a component must name one.',
        at: { tag: el.localName, offers: names.join(',') },
      });
      return null;
    }
    return names.length ? this.#sources[names[0]!]! : null;
  }
}

customElements.define('sherpa-provider', SherpaProvider);
