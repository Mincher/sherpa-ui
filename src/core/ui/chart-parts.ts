/**
 * chart-parts.ts — what every chart draws the same way: its value axis, a
 * mark's hue, and a mark's tip.
 *
 * Map:
 * - renderValueAxis — Stamp the value axis from its scale, min to max; true when it drew any.
 * - paintSeries — Give one mark its category's hue and border.
 * - pairAnchor — Name the anchor a dot and its tip share.
 * - fillTip — Write a tip's label and exact value.
 */
import {
  formatTick, formatValue, seriesBorderVar, seriesVar, tickPercent, type ChartScale,
} from '../data/format-tick.js';

/** Stamp the value axis from its scale, min to max; true when it drew any.
 *  TRAP T-y-axis-width-is-fixed-not-measured — the host writes the flag, never measures. */
export function renderValueAxis(
  axis: HTMLElement | null,
  tpl: HTMLTemplateElement | null,
  scale: ChartScale,
  steps: number,
): boolean {
  const proto = tpl?.content.firstElementChild;
  if (!axis || !proto) return false;
  // Cleared BEFORE the early return, so an empty chart keeps no stale ticks.
  axis.replaceChildren();
  if (steps <= 0) return false;
  for (let i = 0; i <= steps; i++) {
    const tick = document.importNode(proto, true) as HTMLElement;
    tick.style.setProperty('--_at', `${tickPercent(i, steps)}%`);
    /* `min + step * i`, never `max * i / steps` — the SCALE decided where its
       lines fall. TRAP T-the-top-gridline-rounds-to-its-magnitude */
    tick.querySelector('.y-value')!.textContent = formatTick(scale.min + scale.step * i);
    axis.append(tick);
  }
  return true;
}

/** Give one mark its category's hue and border — by its colorIndex, never its
 *  position. TRAP T-a-category-keeps-its-colour */
export function paintSeries(el: HTMLElement | SVGElement, index: number, colorIndex?: number): void {
  el.style.setProperty('--_hue', seriesVar(index, colorIndex));
  el.style.setProperty('--_border', seriesBorderVar(index, colorIndex));
}

/** Name the anchor a dot and its tip share — on BOTH, or the browser parks the
 *  tip wherever it likes. TRAP T-chart-tip-is-a-sibling-of-its-dot */
export function pairAnchor(name: string, ...els: HTMLElement[]): void {
  for (const el of els) el.style.setProperty('--_anchor', name);
}

/** Write a tip's label and value: a number prints EXACTLY, never compacted as
 *  the axis is; text prints as given. TRAP T-a-tooltip-is-not-an-axis */
export function fillTip(tip: ParentNode, label: string, value: number | string): void {
  tip.querySelector('.chart-tip-label')!.textContent = label;
  tip.querySelector('.chart-tip-value')!.textContent = typeof value === 'number' ? formatValue(value) : value;
}
