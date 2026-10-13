/**
 * threshold.ts — a number field's BANDS, declared once as a fact of the field
 * and read by a gauge's zones, a bar chart's bands and a saved filter's `band`.
 * DOM-free. Will, TODO 150. TRAP T-a-threshold-is-a-fact-of-the-field
 *
 * Map:
 * - Threshold — One band, as a field declares it: its top, its name, its status.
 * - bandEdges — The edges a histogram cuts at: the field's lowest, then each band's top.
 * - bandCondition — A band as a condition: from the top below it, up to its own.
 */
import type { Condition } from './where.js';

/** One band, as a field declares it: its TOP, its name, its status. The first
 *  runs up from the bottom of the scale; each after it, from the top below. */
export interface Threshold {
  to: number;
  label: string;
  status?: string;
}

/** The edges a histogram cuts at: the field's lowest, then each band's top. */
export function bandEdges(thresholds: readonly Threshold[], min: number): number[] {
  return [min, ...thresholds.map((t) => t.to)];
}

/** A band as a condition — half-open, as a histogram's are: the first has no
 *  floor and the last no top. `undefined` for a name no band has. */
export function bandCondition(thresholds: readonly Threshold[], name: string): Condition | undefined {
  const at = thresholds.findIndex((t) => t.label === name);
  if (at < 0) return undefined;
  const below = thresholds[at - 1];
  const last = at === thresholds.length - 1;
  return { ...(below ? { gte: below.to } : {}), ...(last ? {} : { lt: thresholds[at]!.to }) };
}
