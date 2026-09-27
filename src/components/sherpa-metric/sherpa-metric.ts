/**
 * sherpa-metric — a KPI tile: a headline number with its trend.
 *
 * @method populate(data: MetricData) — the single data path
 */
import { SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { formatValue } from '../../core/data/format-tick.js';
import { report } from '../../core/data/report.js';
import type { DataAsk } from '../../core/ui/context.js';
import '../sherpa-sparkline/sherpa-sparkline.js';

interface MetricData {
  /** TRAP T-populate-label-not-name */
  label?: string;
  /** @deprecated The old spelling of `label`. Still read. */
  name?: string;
  /** Already display-ready. */
  value?: string | number;
  /** Change text, e.g. "+12.5%". */
  delta?: string;
  /** Sets a "+n%"/"-n%" delta and the trend direction. */
  deltaPercent?: number;
  /** Derived from deltaPercent when omitted. */
  trend?: 'up' | 'down' | 'flat';
  /** When present, the embedded sparkline is shown and fed. */
  values?: number[];
  /**
   * Which number the tile SHOWS when `value` is not given.
   *
   * `'last'` (the default) is the latest reading — what a "current state"
   * tile means. `'total'` sums the series, for a tile counting things that
   * accumulate. A total also prefixes the label with "Total", so the two
   * readings can never be confused on screen.
   *
   * Ignored when `value` is given: an explicit value is the caller's own, and
   * deriving over the top of it would silently disagree.
   * TRAP T-a-total-says-so-in-its-label
   */
  show?: 'last' | 'total';
}

type Sparkline = HTMLElement & { populate?: (v: number[]) => void };

/**
 * The number a tile shows when the caller gave none: the LAST reading, or the
 * sum. TRAP T-a-total-says-so-in-its-label
 */
function deriveValue(values?: number[], show?: 'last' | 'total'): number | null {
  const usable = (values ?? []).filter((v) => Number.isFinite(v));
  if (!usable.length) return null;
  return show === 'total' ? usable.reduce((sum, v) => sum + v, 0) : usable[usable.length - 1]!;
}

export class SherpaMetric extends SherpaElement {
  static override css = new URL('./sherpa-metric.css', import.meta.url);
  static override html = new URL('./sherpa-metric.html', import.meta.url);

  /* DECLARED, not hand-synced. Both are written by the component itself from
     the data, and both are read only by CSS — `data-trend` by a `:host()` rule
     and `data-status` by the `--_status-*` cascade, which has no selector to
     grep for. Undeclared, the second looked like a half-finished rename.
     TRAP T-metric-status-follows-the-trend */
  static override asks: DataAsk = { shape: 'aggregate' };

  static override props = {
    ...SUMMARY_PROPS,
    /** The value's `Intl.NumberFormatOptions`, as JSON. TRAP T-a-format-is-the-platforms */
    'data-format': { type: 'string', kind: 'style' },
    'data-label': { type: 'string', kind: 'content', to: '.label' },
    'data-value': { type: 'string', kind: 'content', to: '.value' },
    'data-delta': { type: 'string', kind: 'content', to: '.delta' },
    'data-trend': { type: 'enum', kind: 'style', values: ['up', 'down', 'flat'] },
    'data-status': { type: 'enum', kind: 'style', values: ['success', 'critical'] },
  } as const;

  /** The data path. */
  protected override renderData(source: unknown): void {
    // A provider's aggregate is a bare number when it runs over no field.
    const data = (typeof source === 'number' ? { value: source } : source ?? {}) as MetricData;

    /* A TOTAL names itself. Two tiles reading "Alerts 1,284" and "Alerts 37"
       are indistinguishable without it. TRAP T-a-total-says-so-in-its-label */
    const rawLabel = data.label ?? data.name;
    const total = data.show === 'total';
    const label = rawLabel != null && total && !/^total\b/i.test(String(rawLabel))
      ? `Total ${String(rawLabel).charAt(0).toLowerCase()}${String(rawLabel).slice(1)}`
      : rawLabel;
    if (label != null) this.dataset['label'] = String(label);

    /* An explicit `value` wins: deriving over the caller's own number would
       silently disagree with it. Otherwise the series answers. */
    const derived = data.value ?? deriveValue(data.values, data.show);
    if (derived != null) this.dataset['value'] = typeof derived === 'number' ? this.#format(derived) : derived;

    if (data.delta != null) {
      this.dataset['delta'] = data.delta;
    } else if (data.deltaPercent != null && Number.isFinite(data.deltaPercent)) {
      /* TWO decimals (Will, 2026-09-22). Every caller used to pass a tidy
         literal like 3.1, so the raw interpolation never showed — until a
         DERIVED delta arrived and the tile read "-0.6211180124223602%".
         A percentage is a presentation value, and this is the presentation.
         TRAP T-a-delta-is-derived-not-declared */
      const rounded = Number(data.deltaPercent.toFixed(2));
      const sign = rounded > 0 ? '+' : '';
      this.dataset['delta'] = `${sign}${rounded}%`;
    }

    const trend = data.trend ?? this.#deriveTrend(data.deltaPercent);
    if (trend) this.dataset['trend'] = trend;
    this.#applyStatus(trend);

    if (Array.isArray(data.values) && data.values.length > 0) {
      this.#fillSparkline(data.values);
    }
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** A number, as `data-format` declares — the platform's own
   *  `Intl.NumberFormatOptions`, as JSON. Undeclared, the library's one format.
   *  TRAP T-a-format-is-the-platforms
   *  TRAP T-a-tooltip-is-not-an-axis */
  #format(n: number): string {
    const declared = this.getAttribute('data-format');
    if (!declared) return formatValue(n);
    try {
      return new Intl.NumberFormat(undefined, JSON.parse(declared) as Intl.NumberFormatOptions).format(n);
    } catch {
      report({
        code: 'metric-bad-format',
        message: 'sherpa-metric: data-format is not Intl.NumberFormatOptions as JSON, so the plain format is used.',
        at: { format: declared },
      });
      return formatValue(n);
    }
  }

  /** TRAP T-metric-status-follows-the-trend — "default" means NO attribute. */
  /** A rising trend reads success, a falling one critical. */
  #applyStatus(trend: 'up' | 'down' | 'flat' | null): void {
    const status = trend === 'up' ? 'success' : trend === 'down' ? 'critical' : null;
    if (status) this.dataset['status'] = status;
    else delete this.dataset['status'];
  }

  /** Trend from the percent, when the caller gave none. */
  #deriveTrend(deltaPercent?: number): 'up' | 'down' | 'flat' | null {
    if (deltaPercent == null || !Number.isFinite(deltaPercent)) return null;
    if (deltaPercent > 0) return 'up';
    if (deltaPercent < 0) return 'down';
    return 'flat';
  }

  /** Feed the embedded sparkline and reveal it (data-has-values → CSS shows it). */
  #fillSparkline(values: number[]): void {
    const spark = this.$<Sparkline>('sherpa-sparkline');
    if (!spark) return;
    this.setAttribute('data-has-values', '');
    spark.populate?.(values);
  }
}

customElements.define('sherpa-metric', SherpaMetric);
