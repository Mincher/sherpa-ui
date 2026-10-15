/**
 * sherpa-sparkline — a tiny inline trend chart. JS hands CSS the numbers and the
 * range; CSS draws the line, fill, bars and dots.
 *
 * @method populate(values: number[]) — the single data path; serialises to data-values
 */
import { SherpaElement, define } from '../../core/ui/sherpa-element.js';
import { chartScale, formatValue } from '../../core/data/format-tick.js';
import { pairAnchor } from '../../core/ui/chart-parts.js';

/** The last SLOTS values are drawn: a trend, not a history. */
const SLOTS = 8;
/** TRAP T-sparkline-headroom-is-a-share-of-the-box — share of the BOX, not of the data. */
const LINE_SHARE = 0.62;

/** The trend in words: a sparkline has no marks to focus, so it SAYS its shape. TODO 284 */
const trendText = (v: readonly number[]): string =>
  `Trend: ${formatValue(v[0]!)} to ${formatValue(v.at(-1)!)}, low ${formatValue(Math.min(...v))}, high ${formatValue(Math.max(...v))}`;

export class SherpaSparkline extends SherpaElement {
  static override css = new URL('./sherpa-sparkline.css', import.meta.url);
  static override html = new URL('./sherpa-sparkline.html', import.meta.url);
  // A host's aria-label names the chart; the trend is its description. TRAP T-a-host-label-must-reach-its-control
  static override labelTarget = '.chart';

  static override props = {
    'data-type': { type: 'enum', kind: 'style', values: ['bar'] },
    'data-values': { type: 'string', kind: 'behaviour' },
  } as const;

  override onRender(): void {
    this.#apply();
  }

  override onChange(): void {
    this.#apply();
  }

  /** populate(number[]) — the points, kept in data-values, which is the source of truth */
  protected override renderData(source: unknown): void {
    if (!Array.isArray(source)) return;
    this.set('data-values', JSON.stringify(source));
  }

  /* ── Private ─────────────────────────────────────────────────────────── */

  /** data-values is JSON or CSV; non-finite entries are dropped. */
  #parse(): number[] {
    const raw = this.dataset['values'];
    if (!raw) return [];
    let parsed: unknown;
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = raw.split(',').map((v) => parseFloat(v.trim()));
    }
    if (!Array.isArray(parsed)) return [];
    return parsed.map(Number).filter((n) => Number.isFinite(n));
  }

  /** Stamp a shape per value pair and a dot per value, each with its own numbers. */
  #apply(): void {
    const values = this.#parse().slice(-SLOTS);
    const count = values.length;
    // One value is no trend: nothing is drawn.
    const drawn = count > 1 ? values : [];

    this.renderItems('.shapes', 'template.shape-tpl', drawn.slice(1), {
      after: (shape, to, i) => {
        shape.style.setProperty('--_from', String(drawn[i]));
        shape.style.setProperty('--_to', String(to));
      },
    });
    /* Paired by NAME, placed by CSS. TRAP T-chart-tip-is-a-sibling-of-its-dot
       The tip says the exact value. TRAP T-a-tooltip-is-not-an-axis */
    this.renderItems('.hotspots', 'template.hotspot-tpl', drawn.map((v) => ({ text: formatValue(v) })), {
      after: (dot, _item, i) => {
        dot.style.setProperty('--_i', String(i));
        dot.style.setProperty('--_v', String(drawn[i]));
        pairAnchor(`--spark-${i}`, dot, dot.nextElementSibling as HTMLElement);
      },
    });

    const chart = this.$('.chart');
    if (drawn.length) chart?.setAttribute('aria-description', trendText(drawn));
    else chart?.removeAttribute('aria-description');
    if (!drawn.length) return;

    /* FITS ITS OWN RANGE — a sparkline shows a SHAPE, so `zero: false`: a
       floor at zero would flatten a series that never goes near it.
       TRAP T-one-scale-for-every-chart */
    const { min, span: spread } = chartScale(values, { zero: false });

    // The PADDING is this chart's own: the line sits in the middle 62%.
    const extra = spread / LINE_SHARE - spread;
    const below = extra * 0.8;
    const paddedMin = min - below;
    const range = spread + extra;

    this.style.setProperty('--_min', String(paddedMin));
    this.style.setProperty('--_range', String(range));
    this.style.setProperty('--_len', String(count));
  }
}

define('sherpa-sparkline', SherpaSparkline);
