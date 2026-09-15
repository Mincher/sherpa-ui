/**
 * sherpa-barchart — a vertical bar chart for comparing categories.
 *
 * Give it data with populate([{ label, value, colorIndex? }]). JS draws one bar
 * per item and hands two numbers to CSS: the bar's height (as a percent of the
 * tallest) and its colour. CSS grows each bar up from the baseline. Clicking a
 * bar fires bar-click.
 *
 * `setBarHidden(index, hidden)` drops a bar so a chart legend can toggle it. The
 * y-max then comes from what is left, so the remaining bars use the full height.
 *
 * @fires bar-click — a bar is clicked. bubbles + composed. detail: { index: number, label: string, value: number }
 */
import { SherpaElement } from '../../core/sherpa-element.js';
import { formatTick, seriesBorderVar, seriesVar, tickPercent } from '../../core/format-tick.js';

/** Gridlines when data-ticks is absent — 4 matches the Figma Chart Axis. */
const DEFAULT_TICKS = 4;

export interface BarDatum {
  label: string;
  value: number;
  colorIndex?: number;
}

export class SherpaBarchart extends SherpaElement {
  static override css = new URL('./sherpa-barchart.css', import.meta.url);
  static override html = new URL('./sherpa-barchart.html', import.meta.url);
  static override props = {
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
    // Fresh data means the old indices point at different bars, so a stale hide
    // would silently drop the wrong category.
    this.#hidden.clear();
    this.#render();
  }

  /**
   * Hide or show one bar, so a chart legend can toggle it.
   *
   * Hiding RE-SCALES the chart: the y-max comes from the visible bars, so leaving
   * a hidden category in the maximum would squash everything that is left against
   * a ceiling nobody can see.
   */
  setBarHidden(index: number, hidden = true): void {
    if (hidden) this.#hidden.add(index);
    else this.#hidden.delete(index);
    this.#render();
  }

  /** The indices currently hidden, ascending. */
  get hiddenBars(): number[] {
    return [...this.#hidden].sort((a, b) => a - b);
  }

  #render(): void {
    const bars = this.$('.bars');
    const tpl = this.$<HTMLTemplateElement>('template.bar-tpl');
    const xAxis = this.$('.x-axis-row');
    const xTpl = this.$<HTMLTemplateElement>('template.xlabel-tpl');
    if (!bars || !tpl) return;

    // Bars a legend has switched off are dropped entirely, and the scale comes
    // from what is LEFT — keeping a hidden category in the max would squash
    // everything visible against a ceiling nobody can see.
    const shown = this.#data
      .map((d, i) => ({ d, i }))
      .filter(({ i }) => !this.#hidden.has(i));

    // NaN is the "not given" sentinel — an absent max is DERIVED from the bars.
    const explicitMax = this.num('data-max', NaN);
    const max = Number.isFinite(explicitMax) && explicitMax > 0
      ? explicitMax
      : Math.max(1, ...shown.map(({ d }) => d.value));

    this.#renderYAxis(max, shown.length);

    bars.replaceChildren();
    xAxis?.replaceChildren();
    for (const { d, i } of shown) {
      const col = tpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      // The ORIGINAL index, so bar-click still names the datum the caller gave us
      // even when earlier categories are hidden.
      col.dataset['index'] = String(i);
      const hue = seriesVar(i, d.colorIndex);
      const bar = col.querySelector<HTMLElement>('.bar')!;
      bar.style.setProperty('--_h', `${Math.max(0, Math.min(100, (d.value / max) * 100))}%`);
      bar.style.setProperty('--_hue', hue);
      bar.style.setProperty('--_border', seriesBorderVar(i, d.colorIndex));

      // The hover tooltip. The only thing JS supplies is the anchor NAME — CSS
      // cannot derive a per-mark `anchor-name`, and everything else about the
      // tip's placement is declarative (see .chart-tip in core/sherpa-base.css).
      col.style.setProperty('--_anchor', `--bar-mark-${i}`);
      col.querySelector('.chart-tip-label')!.textContent = d.label;
      col.querySelector('.chart-tip-value')!.textContent = formatTick(d.value);
      bars.appendChild(col);

      // The category label is a SIBLING of the plot now, in the x-axis row, so it
      // renders below the baseline rule instead of on top of the bars.
      if (xAxis && xTpl) {
        const label = xTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
        label.textContent = d.label;
        xAxis.appendChild(label);
      }
    }
  }

  /**
   * Stamp the y-axis values, top (max) to bottom (0).
   *
   * Descending because the axis is inverted relative to the DOM's flow: the
   * highest value is at the TOP of the plot but the FIRST child in the column.
   * CSS spaces them with `justify-content: space-between` on a zero-height cell,
   * so each label's centre lands on its own gridline.
   */
  #renderYAxis(max: number, shownCount: number): void {
    const axis = this.$('.y-axis');
    const tpl = this.$<HTMLTemplateElement>('template.ytick-tpl');
    if (!axis || !tpl) return;

    const steps = this.num('data-ticks', DEFAULT_TICKS, { min: 0, int: true });
    // Clear FIRST, before the early return below: turning the axis off has to take
    // the old ticks with it, or a data-ticks="0" would leave the previous scale
    // on screen labelling nothing.
    axis.replaceChildren();
    // The flag CSS gates on — an absent data-ticks must not mean "no axis", and a
    // data-ticks="0" must, so the state has to be written rather than inferred.
    // Counted from the SHOWN bars: hiding every category via the legend must
    // take the axis with them, not leave a scale labelling nothing.
    this.toggleAttribute('data-has-y-axis', steps > 0 && shownCount > 0);
    // The gridline gradient repeats every 1/bands of the plot, so the lines and
    // the labels are both driven by this ONE number.
    this.style.setProperty('--_bands', String(steps));
    if (steps <= 0 || shownCount <= 0) return;

    // One label per division BOUNDARY — steps+1 of them, positioned at the SAME
    // percentage its gridline is drawn at (tickPercent), so the two cannot drift.
    const boundaries = Array.from({ length: steps + 1 }, (_, i) => i);
    this.renderList('.y-axis', 'template.ytick-tpl', boundaries, (tick, i) => {
      tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
      tick.querySelector('.y-value')!.textContent = formatTick((max * i) / steps);
    });
    // The axis width is FIXED in CSS and long labels truncate — nothing measured
    // here. Sizing it from the data made the plot wiggle whenever a value crossed
    // a digit boundary.
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
