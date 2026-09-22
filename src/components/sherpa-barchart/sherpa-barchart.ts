/**
 * sherpa-barchart — a vertical bar chart. JS hands CSS a height percent and a
 * colour per bar; CSS grows each bar from the baseline.
 *
 * TRAP T-hiding-a-series-rescales-the-axis — the y-max comes from what is left.
 */
import type { ChartDatum } from '../../core/chart-datum.js';
import { SHARED_PROPS, SherpaElement } from '../../core/sherpa-element.js';
import { formatTick, seriesBorderVar, seriesVar, tickPercent } from '../../core/format-tick.js';

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

    // TRAP T-nan-is-the-not-given-sentinel — an absent max is DERIVED.
    const explicitMax = this.num('data-max', NaN);
    const max = Number.isFinite(explicitMax) && explicitMax > 0
      ? explicitMax
      : Math.max(1, ...shown.map(({ d }) => d.value));

    this.#renderYAxis(max, shown.length);

    bars.replaceChildren();
    xAxis?.replaceChildren();
    for (const { d, i } of shown) {
      const col = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      // TRAP T-hiding-a-series-rescales-the-axis — the ORIGINAL index.
      col.dataset['index'] = String(i);
      const hue = seriesVar(i, d.colorIndex);
      const bar = col.querySelector<HTMLElement>('.bar')!;
      bar.style.setProperty('--_h', `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`);
      bar.style.setProperty('--_hue', hue);
      bar.style.setProperty('--_border', seriesBorderVar(i, d.colorIndex));

      // TRAP T-chart-tip-is-a-sibling-of-its-dot — JS names the anchor; CSS places it.
      col.style.setProperty('--_anchor', `--bar-mark-${i}`);
      col.querySelector('.chart-tip-label')!.textContent = d.label;
      col.querySelector('.chart-tip-value')!.textContent = formatTick(d.value);
      bars.appendChild(col);

      // A SIBLING of the plot, so it lands below the baseline.
      if (xAxis && xTpl) {
        const label = xTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        label.textContent = d.label;
        xAxis.appendChild(label);
      }
    }
  }

  /** Stamp the y-axis values, top (max) to bottom (0). */
  #renderYAxis(max: number, shownCount: number): void {
    const axis = this.$('.y-axis');
    const tpl = this.$<HTMLTemplateElement>('template.ytick-tpl');
    if (!axis || !tpl) return;

    const steps = this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true });
    // TRAP T-y-axis-width-is-fixed-not-measured — clear BEFORE the early return.
    axis.replaceChildren();
    this.toggleAttribute('data-has-y-axis', steps > 0 && shownCount > 0);
    this.style.setProperty('--_bands', String(steps));
    if (steps <= 0 || shownCount <= 0) return;

    const boundaries = Array.from({ length: steps + 1 }, (_, i) => i);
    this.renderList('.y-axis', 'template.ytick-tpl', boundaries, (tick, i) => {
      tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
      tick.querySelector('.y-value')!.textContent = formatTick((max * i) / steps);
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
