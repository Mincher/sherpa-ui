/**
 * threshold.ts — a ZONE of a number: its top, its name, its status. A gauge
 * draws a number's zones, made from the status field whose values are ranges of
 * it (`zonesOf`, plan 683). DOM-free. TRAP T-a-status-is-worked-out-by-the-data
 *
 * Map:
 * - Threshold — One zone: its top, its name, its status.
 */

/** One zone: its TOP, its name, its status. The first runs up from the bottom of
 *  the scale; each after it, from the top below. */
export interface Threshold {
  to: number;
  label: string;
  status?: string;
}
