/**
 * sherpa-barchart — a vertical bar chart. JS hands CSS a height percent and a
 * colour per bar; CSS grows each bar from the baseline.
 *
 * TRAP T-hiding-a-series-rescales-the-axis — the y-max comes from what is left.
 */
import type { ChartDatum } from '../../core/data/chart-datum.js';
import type { ChartScale } from '../../core/data/format-tick.js';
import { SHARED_PROPS, SherpaElement } from '../../core/ui/sherpa-element.js';
import { chartScale, formatTick, seriesBorderVar, seriesVar, tickPercent, formatValue } from '../../core/data/format-tick.js';

/** Gridlines when data-ticks is absent — matches the Figma Chart Axis. */
const DEFAULT_TICKS = 4;

/** One bar. TRAP T-chart-datum-aliases-are-not-copies — an alias, not a copy. */
export type BarDatum = ChartDatum;

export class SherpaBarchart extends SherpaElement {
  static override css = new URL('./sherpa-barchart.css', import.meta.url);
  static override html = new URL('./sherpa-barchart.html', import.meta.url);
  static override props = {
    'data-legend': SHARED_PROPS['data-legend'],
    'data-axis-label': { type: 'string', kind: 'content', to: '.axis-label-y' },
  } as const;

  static override observed = ['data-max', 'data-ticks'];

  #data: BarDatum[] = [];
  /** Bars a chart legend has switched off. */
  #hidden = new Set<number>();

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
    // A stale hide would drop the wrong bar.
    this.#hidden.clear();
    this.#render();
  }

  /** Hide or show one bar, so a chart legend can toggle it. */
  setBarHidden(index: number, hidden = true): void {
    if (hidden) this.#hidden.add(index);
    else this.#hidden.delete(index);
    this.#render();
  }

  /** The indices currently hidden, ascending. */
  get hiddenBars(): number[] {
    return [...this.#hidden].sort((a, b) => a - b);
  }

  /** Hide exactly these bars. TRAP T-hidden-set-is-view-state-and-replaces — it REPLACES. */
  set hiddenBars(indices: readonly number[]) {
    this.#hidden = new Set(indices.filter((i) => Number.isInteger(i) && i >= 0));
    this.#render();
  }

  #render(): void {
    const bars = this.$('.bars');
    const tpl = this.$<HTMLTemplateElement>('template.bar-tpl');
    const xAxis = this.$('.x-axis-row');
    const xTpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    if (!bars || !tpl) return;

    const shown = this.#data
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => !this.#hidden.has(i));

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
      const hue = seriesVar(i, d.colorIndex);
      const bar = col.querySelector<HTMLElement>('.bar')!;
      /* A bar is the distance from ZERO to its value, and it grows away from
         the line in whichever direction the value points.
         TRAP T-a-bar-hangs-from-the-zero-line */
      const at = scale.percent(d.value);
      col.dataset['sign'] = d.value < 0 ? '-' : '+';
      bar.style.setProperty('--_h', `${Math.abs(at - zero)}%`);
      bar.style.setProperty('--_base', `${zero}%`);
      bar.style.setProperty('--_hue', hue);
      bar.style.setProperty('--_border', seriesBorderVar(i, d.colorIndex));

      // TRAP T-chart-tip-is-a-sibling-of-its-dot — JS names the anchor; CSS places it.
      col.style.setProperty('--_anchor', `--bar-mark-${i}`);
      col.querySelector('.chart-tip-label')!.textContent = d.label;
      // The exact number, not the axis's compacting — TRAP T-a-tooltip-is-not-an-axis.
      col.querySelector('.chart-tip-value')!.textContent = formatValue(d.value);
      bars.appendChild(col);

      // A SIBLING of the plot, so it lands below the baseline.
      if (xAxis && xTpl) {
        const label = xTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        label.textContent = d.label;
        xAxis.appendChild(label);
      }
    }
  }

  /** Stamp the y-axis values, top (max) to bottom (min). */
  #renderYAxis(scale: ChartScale, shownCount: number): void {
    const axis = this.$('.y-axis');
    const tpl = this.$<HTMLTemplateElement>('template.ytick-tpl');
    if (!axis || !tpl) return;

    const steps = this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true }) > 0
      ? scale.bands
      : 0;
    // TRAP T-y-axis-width-is-fixed-not-measured — clear BEFORE the early return.
    axis.replaceChildren();
    this.toggleAttribute('data-has-y-axis', steps > 0 && shownCount > 0);
    this.style.setProperty('--_bands', String(steps));
    if (steps <= 0 || shownCount <= 0) return;

    const boundaries = Array.from({ length: steps + 1 }, (_, i) => i);
    this.renderList('.y-axis', 'template.ytick-tpl', boundaries, (tick, i) => {
      tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
      /* `min + step * i`, never `max * i / steps` — the SCALE decided where
         its lines fall. TRAP T-the-top-gridline-rounds-to-its-magnitude */
      tick.querySelector('.y-value')!.textContent =
        formatTick(scale.min + scale.step * i);
    });
  }

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
