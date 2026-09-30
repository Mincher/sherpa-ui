/**
 * sherpa-barchart — a vertical bar chart. JS hands CSS a height percent and a
 * colour per bar; CSS grows each bar from the baseline.
 *
 * TRAP T-hiding-a-series-rescales-the-axis — the y-max comes from the bars it is given.
 *
 * Map:
 * - BarDatum — one bar: its label and value
 */
import type { ChartDatum } from '../../core/data/chart-datum.js';
import type { ChartScale } from '../../core/data/format-tick.js';
import { SHARED_PROPS, SUMMARY_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import type { DataAsk } from '../../core/ui/context.js';
import { chartScale } from '../../core/data/format-tick.js';
import { fillTip, pairAnchor, paintSeries, renderValueAxis } from '../../core/ui/chart-parts.js';
import { DEFAULT_TICKS } from '../../core/ui/shared-constants.js';


/** One bar. TRAP T-chart-datum-aliases-are-not-copies — an alias, not a copy. */
export type BarDatum = ChartDatum;

export class SherpaBarchart extends SherpaElement {
  static override css = [
    new URL('../../core/sherpa-chart-axes.css', import.meta.url),
    new URL('./sherpa-barchart.css', import.meta.url),
  ];
  static override html = new URL('./sherpa-barchart.html', import.meta.url);
  static override asks: DataAsk = { shape: 'segments', shows: 'chart' };

  static override props = {
    ...SUMMARY_PROPS,
    'data-legend': SHARED_PROPS['data-legend'],
    'data-axis-label': { type: 'string', kind: 'content', to: '.axis-label-y' },
  } as const;

  static override observed = ['data-max', 'data-ticks'];

  /** The bars, as populated. */
  #data: BarDatum[] = [];

  override onRender(): void {
    this.$('.bars')?.addEventListener('click', this.#onClick);
    if (this.#data.length) this.#render();
  }

  override onChange(): void {
    this.#render();
  }

  /** populate([{ label, value, colorIndex? }]) — the bars. */
  protected override renderData(data: unknown): void {
    this.#data = Array.isArray(data) ? (data as BarDatum[]) : [];
    this.#render();
  }

  /** Draw the bars, the value axis and the category labels. */
  #render(): void {
    const bars = this.$('.bars');
    const tpl = this.$<HTMLTemplateElement>('template.bar-tpl');
    const xAxis = this.$('.x-axis-row');
    const xTpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    if (!bars || !tpl) return;

    const shown = this.#data.map((d, i) => ({ d, i }));

    /* ONE scale rule for every chart. TRAP T-nan-is-the-not-given-sentinel: an
       absent max is derived. TRAP T-one-scale-for-every-chart */
    const explicitMax = this.num('data-max', NaN);
    const scale = chartScale(shown.map(({ d }) => d.value), {
      // `data-ticks` is the PREFERRED band count; the scale may use one either
      // side to land every gridline on a round number.
      bands: this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true }),
      ...(explicitMax > 0 ? { max: explicitMax } : {}),
    });

    /* WHERE ZERO SITS. A chart of positive values has it on the baseline and
       draws exactly as before; one that goes negative lifts the line and lets
       a bar hang beneath it. TRAP T-a-bar-hangs-from-the-zero-line */
    const zero = scale.percent(0);
    this.toggleAttribute('data-below-zero', scale.min < 0);
    this.style.setProperty('--_zero', `${zero}%`);

    this.#renderYAxis(scale, shown.length);

    // The zero line is the bars' own child, so it survives the re-stamp.
    const zeroLine = bars.querySelector('.bars-zero');
    bars.replaceChildren();
    if (zeroLine) bars.appendChild(zeroLine);
    xAxis?.replaceChildren();
    for (const { d, i } of shown) {
      const col = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      // TRAP T-hiding-a-series-rescales-the-axis — the ORIGINAL index.
      col.dataset['index'] = String(i);
      const bar = col.querySelector<HTMLElement>('.bar')!;
      /* A bar is the distance from ZERO to its value, and it grows away from
         the line in whichever direction the value points.
         TRAP T-a-bar-hangs-from-the-zero-line */
      const at = scale.percent(d.value);
      col.dataset['sign'] = d.value < 0 ? '-' : '+';
      bar.style.setProperty('--_h', `${Math.abs(at - zero)}%`);
      bar.style.setProperty('--_base', `${zero}%`);
      paintSeries(bar, i, d.colorIndex);
      pairAnchor(`--bar-mark-${i}`, col);
      fillTip(col, d.label, d.value);
      // The tip is hidden until hover, so it names nothing: the bar says it itself.
      col.setAttribute('aria-label', `${d.label}: ${col.querySelector('.chart-tip-value')!.textContent}`);
      bars.appendChild(col);

      // A SIBLING of the plot, so it lands below the baseline.
      if (xAxis && xTpl) {
        const label = xTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        label.textContent = d.label;
        xAxis.appendChild(label);
      }
    }
  }

  /** The value axis, and the gridline bands the CSS draws from it. */
  #renderYAxis(scale: ChartScale, shownCount: number): void {
    const steps = this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true }) > 0 ? scale.bands : 0;
    this.style.setProperty('--_bands', String(steps));
    this.toggleAttribute('data-has-y-axis', renderValueAxis(
      this.$('.y-axis'), this.$<HTMLTemplateElement>('template.ytick-tpl'), scale, shownCount > 0 ? steps : 0,
    ));
  }

  /** A bar was clicked: report which. */
  #onClick = (event: Event): void => {
    const col = (event.target as HTMLElement).closest<HTMLElement>('.bar-col');
    const raw = col?.dataset['index'];
    if (raw == null) return;
    const i = Number(raw);
    const d = this.#data[i];
    this.emit('bar-click', { index: i, label: d?.label ?? '', value: d?.value ?? 0 });
  };
}

customElements.define('sherpa-barchart', SherpaBarchart);
