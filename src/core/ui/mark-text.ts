/**
 * mark-text.ts — point at what matched: `<mark class="match">` around each hit
 * in a cell or a label. One decision, so every caller marks alike.
 * TRAP T-mark-match-is-one-shape
 *
 * Map:
 * - markNeedles — Mark every hit of every needle in `el`, or write plain text when there is nothing to point at.
 * - markMatch — Rebuild `el` as before + `<mark class="match">` + after, around one hit.
 */

/**
 * Which operators leave something to POINT AT in a cell — only the substring
 * family. `eq` would circle the whole value; `ne` matched by NOT being there.
 * TRAP T-a-needle-comes-from-either-direction
 */
const MARKABLE_OPS: ReadonlySet<string> =
  new Set(['contains', 'startswith', 'endswith']);

/**
 * Mark every hit of every needle in `el`, or write plain text when there is
 * nothing to point at. A condition chain holds several strings, so each marks;
 * overlapping hits join into one mark. ONE decision, so every caller alike.
 *
 * The CELL's casing wins: "ana" against "Ana" leaves "Ana".
 * TRAP T-mark-match-is-one-shape · TRAP T-a-condition-marks-every-match
 */
export function markNeedles(el: Element, text: string, needles: readonly { op: string; text: string }[]): void {
  const lower = text.toLowerCase();
  const hits: Array<[number, number]> = [];
  for (const { op, text: raw } of needles) {
    const needle = raw.toLowerCase();
    if (!needle || !MARKABLE_OPS.has(op)) continue;
    if (op === 'startswith') {
      if (lower.startsWith(needle)) hits.push([0, needle.length]);
    } else if (op === 'endswith') {
      if (lower.endsWith(needle)) hits.push([text.length - needle.length, text.length]);
    } else {
      for (let at = lower.indexOf(needle); at >= 0; at = lower.indexOf(needle, at + needle.length)) {
        hits.push([at, at + needle.length]);
      }
    }
  }
  const spans: Array<[number, number]> = [];
  for (const [start, end] of hits.sort((a, b) => a[0] - b[0])) {
    const last = spans.at(-1);
    if (last && start <= last[1]) last[1] = Math.max(last[1], end);
    else spans.push([start, end]);
  }
  const nodes: Node[] = [];
  let from = 0;
  for (const [start, end] of spans) {
    if (start > from) nodes.push(document.createTextNode(text.slice(from, start)));
    nodes.push(matchMark(text.slice(start, end)));
    from = end;
  }
  if (from < text.length) nodes.push(document.createTextNode(text.slice(from)));
  el.replaceChildren(...nodes);
}

/** One `<mark class="match">` — text, never markup. */
function matchMark(text: string): HTMLElement {
  const mark = document.createElement('mark');
  mark.className = 'match';
  mark.textContent = text;
  return mark;
}

/**
 * Rebuild `el` as before + `<mark class="match">` + after, around one hit.
 * TRAP T-mark-match-is-one-shape
 */
export function markMatch(el: Element, text: string, at: number, length: number): HTMLElement {
  const mark = matchMark(text.slice(at, at + length));
  el.replaceChildren(
    document.createTextNode(text.slice(0, at)),
    mark,
    document.createTextNode(text.slice(at + length)),
  );
  return mark;
}
