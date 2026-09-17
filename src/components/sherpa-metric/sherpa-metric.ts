/**
 * sherpa-metric — a KPI tile (a headline number with its trend).
 *
 * CSS handles the look — the trend colour, the up/down arrow, and whether the
 * mini trend chart shows. JS writes the label, value, and change text, and sets
 * the trend direction. The little trend chart is a sherpa-sparkline inside; it's
 * imported here so it's ready before this tile draws.
 *
 * @method populate(data: MetricData) — the single data path
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-sparkline/sherpa-sparkline.js';

interface MetricData {
  /**
   * The metric's name.
   *
   * TRAP T-populate-label-not-name
   */
  label?: string;
  /** @deprecated The old spelling of `label`. Still read, so nothing breaks. */
  name?: string;
  /** Formatted value (already display-ready). */
  value?: string | number;
  /** Change text, e.g. "+12.5%". */
  delta?: string;
  /** Optional percent — sets a "+n%"/"-n%" delta and the trend direction. */
  deltaPercent?: number;
  /** Optional trend direction; derived from deltaPercent when omitted. */
  trend?: 'up' | 'down' | 'flat';
  /** Optional series — when present, the embedded sparkline is shown and fed. */
  values?: number[];
}

type Sparkline = HTMLElement & { populate?: (v: number[]) => void };

export class SherpaMetric extends SherpaElement {
  static override css = new URL('./sherpa-metric.css', import.meta.url);
  static override html = new URL('./sherpa-metric.html', import.meta.url);
  static override observed = ['data-label', 'data-value', 'data-delta'];

  override onRender(): void {
    this.#sync(); // reflect attributes set before the shadow DOM was ready
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ name, value, delta, deltaPercent, trend, values }) — the data path. */
  protected override renderData(source: unknown): void {
    const data = (source ?? {}) as MetricData;

    // TRAP T-populate-label-not-name — `label` wins; `name` is still honoured.
    const label = data.label ?? data.name;
    if (label != null) this.dataset['label'] = String(label);
    if (data.value != null) this.dataset['value'] = String(data.value);

    // TRAP T-metric-status-follows-the-trend — derived when not given.
    if (data.delta != null) {
      this.dataset['delta'] = data.delta;
    } else if (data.deltaPercent != null && Number.isFinite(data.deltaPercent)) {
      const sign = data.deltaPercent > 0 ? '+' : '';
      this.dataset['delta'] = `${sign}${data.deltaPercent}%`;
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

  /**
   * Set data-status from the trend, or remove it.
   *
   * TRAP T-metric-status-follows-the-trend — the component owns this, and
   * "default" means NO attribute at all.
   */
  #applyStatus(trend: 'up' | 'down' | 'flat' | null): void {
    const status = trend === 'up' ? 'success' : trend === 'down' ? 'critical' : null;
    if (status) this.dataset['status'] = status;
    else delete this.dataset['status'];
  }

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
