/**
 * node-bands.ts — BANDS along one axis of a canvas: stages across it, lanes down it. Each band holds its members, a pad
 * past them each side; empty, it has a size of its own at its own start. PUSHED, a band that would start before the last
 * one ends, plus a gap, is pushed on, its members with it. FLEX, every band after the first starts the gap after the
 * last one ends, its members moving with it, as a flex row does: a band that shrinks draws the rest back. Pure: no DOM.
 * Will, 2026-11-10
 *
 * Map:
 * - BandGroup — One band to lay out: its id, where it starts when empty, and its members' starts and sizes.
 * - Band — One band as laid out: its start and its end.
 * - BandRules — The sizes a lay-out keeps: an empty band's size, the pad, the gap.
 * - packBands — Each band, in order, and the members a push moved, by their new start.
 */

/** One band to lay out: its id, where it starts when empty, and its members' starts and sizes along the axis. */
export interface BandGroup {
  id: string;
  at: number;
  members: readonly { id: string; start: number; size: number }[];
  /** An empty band takes no room and no gap: a junction with nothing in it. */
  skipEmpty?: boolean;
  /** An empty band's own size, in place of the rules'. */
  min?: number;
}

/** One band as laid out: its start and its end, in plane px. */
export interface Band {
  id: string;
  start: number;
  end: number;
}

/** The sizes a lay-out keeps: an empty band's size, how far a band reaches past its members, and the gap between two. */
export interface BandRules {
  min: number;
  pad: number;
  gap: number;
  /** As a flex row: every band after the first stands the gap after the last, and a member left of its band's start is
   *  held at it. The first grows back past its start, and never moves. Else bands are only pushed on. */
  flex?: boolean;
}

/** Each band, in order, and the members a push moved, by their new start. A skipped empty band is not in the list. */
export function packBands(groups: readonly BandGroup[], rules: BandRules): { bands: Band[]; moves: Record<string, number> } {
  const bands: Band[] = [];
  const moves: Record<string, number> = {};
  let end = -Infinity;
  for (const group of groups) {
    const { members } = group;
    if (!members.length && group.skipEmpty) continue;
    const natural = members.length ? Math.min(...members.map((m) => m.start)) - rules.pad : group.at;
    let start: number;
    let stop: number;
    if (rules.flex) {
      // The first band grows back past its start and never moves; each after it stands the gap on, its members with it.
      const first = !bands.length;
      start = first ? Math.min(group.at, natural) : end + rules.gap;
      const shift = first ? 0 : start - group.at;
      stop = start;
      for (const m of members) {
        const at = Math.max(m.start + shift, start + rules.pad);
        if (at !== m.start) moves[m.id] = at;
        stop = Math.max(stop, at + m.size + rules.pad);
      }
    } else {
      start = natural;
      stop = members.length ? Math.max(...members.map((m) => m.start + m.size)) + rules.pad : start;
      const push = end + rules.gap - start;
      if (push > 0) {
        start += push;
        stop += push;
        for (const m of members) moves[m.id] = m.start + push;
      }
    }
    stop = Math.max(stop, start + (group.min ?? rules.min));
    bands.push({ id: group.id, start: Math.round(start), end: Math.round(stop) });
    end = stop;
  }
  return { bands, moves };
}
