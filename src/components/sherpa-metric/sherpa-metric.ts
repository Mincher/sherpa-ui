/**
 * sherpa-metric — a KPI tile.
 *
 * Behaviour only. Appearance (trend colouring, arrow direction, the sparkline's
 * appearance/disappearance) is pure CSS off data-*. JS writes text into the
 * label/value/delta spans and toggles data-trend / data-has-values — it never
 * sets display, colour, or width. The embedded <sherpa-sparkline> is fed through
 * its own populate(); it's imported here so the child element is defined before
 * the metric stamps its template.
 *
 * @element sherpa-metric
 * @attr {string} data-label — the metric name
 * @attr {string} data-value — the formatted value string
 * @attr {string} data-delta — the change text (e.g. "+12.5%")
 * @attr {enum}   data-trend — up | down | flat (colours the delta, shows the arrow)
 *
 * @method populate(data: MetricData) — the single data path
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import '../sherpa-sparkline/sherpa-sparkline.js';

interface MetricData {
  /** Metric name / label. */
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
    // Reflect any attributes set before the shadow DOM was ready.
    this.#sync();
  }

  override onChange(): void {
    this.#sync();
  }

  /** populate({ name, value, delta, deltaPercent, trend, values }) — the data path. */
  protected override renderData(source: unknown): void {
    const data = (source ?? {}) as MetricData;

    if (data.name != null) this.dataset['label'] = String(data.name);
    if (data.value != null) this.dataset['value'] = String(data.value);

    // Derive delta text + trend from deltaPercent when not given explicitly.
    if (data.delta != null) {
      this.dataset['delta'] = data.delta;
    } else if (data.deltaPercent != null && Number.isFinite(data.deltaPercent)) {
      const sign = data.deltaPercent > 0 ? '+' : '';
      this.dataset['delta'] = `${sign}${data.deltaPercent}%`;
    }

    const trend = data.trend ?? this.#deriveTrend(data.deltaPercent);
    if (trend) this.dataset['trend'] = trend;

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
