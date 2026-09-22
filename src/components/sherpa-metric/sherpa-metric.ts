/**
 * sherpa-metric — a KPI tile: a headline number with its trend.
 *
 * @method populate(data: MetricData) — the single data path
 */
import { SherpaElement } from '../../core/sherpa-element.js';
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
}

type Sparkline = HTMLElement & { populate?: (v: number[]) => void };

export class SherpaMetric extends SherpaElement {
  static override css = new URL('./sherpa-metric.css', import.meta.url);
  static override html = new URL('./sherpa-metric.html', import.meta.url);
  static override observed = ['data-label', 'data-value', 'data-delta'];

  /* DECLARED, not hand-synced. Both are written by the component itself from
     the data, and both are read only by CSS — `data-trend` by a `:host()` rule
     and `data-status` by the `--_status-*` cascade, which has no selector to
     grep for. Undeclared, the second looked like a half-finished rename.
     TRAP T-metric-status-follows-the-trend */
  static override props = {
    'data-trend': { type: 'enum', kind: 'style', values: ['up', 'down', 'flat'] },
    'data-status': { type: 'enum', kind: 'style', values: ['success', 'critical'] },
  } as const;

  override onRender(): void {
    this.#sync(); // attributes may have been set before the shadow DOM existed
  }

  override onChange(): void {
    this.#sync();
  }

  /** The data path. */
  protected override renderData(source: unknown): void {
    const data = (source ?? {}) as MetricData;

    const label = data.label ?? data.name;
    if (label != null) this.dataset['label'] = String(label);
    if (data.value != null) this.dataset['value'] = String(data.value);

    if (data.delta != null) {
      this.dataset['delta'] = data.delta;
    } else if (data.deltaPercent != null && Number.isFinite(data.deltaPercent)) {
      /* ONE decimal. Every caller used to pass a tidy literal like 3.1, so the
         raw interpolation never showed — until a DERIVED delta arrived and the
         tile read "-0.6211180124223602%". A percentage is a presentation
         value, and this is the presentation.
         TRAP T-a-delta-is-derived-not-declared */
      const rounded = Number(data.deltaPercent.toFixed(1));
      const sign = rounded > 0 ? '+' : '';
      this.dataset['delta'] = `${sign}${rounded}%`;
    }

    const trend = data.trend ?? this.#deriveTrend(data.deltaPercent);
    if (trend) this.dataset['trend'] = trend;
    this.#applyStatus(trend);

    if (Array.isArray(data.values) && data.values.length > 0) {
      this.#fillSparkline(data.values);
    }

    this.#sync();
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** Mirror the data-* text into the shadow spans. */
  #sync(): void {
    const set = (sel: string, text: string): void => {
      const el = this.$(sel);
      if (el) el.textContent = text;
    };
    set('.label', this.dataset['label'] ?? '');
    set('.value', this.dataset['value'] ?? '');
    set('.delta', this.dataset['delta'] ?? '');
  }

  /** TRAP T-metric-status-follows-the-trend — "default" means NO attribute. */
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
