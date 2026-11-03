/**
 * description-tips.ts — a tip IN LINES, where the page shows them: the Name, the
 * Description, the Value, then the rest. The page says so on `<html
 * data-description-tips>`; a component that draws a tip hears it change.
 * Will, TODO 691 · TRAP T-a-tip-in-lines
 *
 * Map:
 * - TipLines — A tip's one line as before, and its lines.
 * - tipsInLines — Does the page show tips in lines now?
 * - watchTipLines — Hear the page's choice change; the function it returns stops.
 * - writeTip — Write a tip: in lines where the page says, else its one line as before.
 */

/** A tip's one line as before, and its lines. */
export interface TipLines {
  plain: string;
  name?: string | undefined;
  description?: string | undefined;
  value?: string | undefined;
  more?: string | undefined;
}

/** Every component that draws a tip in lines, told when the page's choice changes. */
const heard = new Set<() => void>();
/** ONE watcher on the page, for every tip. */
let watcher: MutationObserver | null = null;

/** Does the page show tips in lines now? */
export function tipsInLines(): boolean {
  return typeof document !== 'undefined' && document.documentElement.hasAttribute('data-description-tips');
}

/** Hear the page's choice change; the function it returns stops. */
export function watchTipLines(listener: () => void): () => void {
  heard.add(listener);
  if (!watcher && typeof MutationObserver !== 'undefined') {
    watcher = new MutationObserver(() => {
      for (const fn of heard) fn();
    });
    watcher.observe(document.documentElement, { attributes: true, attributeFilter: ['data-description-tips'] });
  }
  return () => {
    heard.delete(listener);
    if (heard.size || !watcher) return;
    watcher.disconnect();
    watcher = null;
  };
}

/** Write a tip: in lines where the page says, else its one line as before, in its
 *  first. A line with nothing to say stays empty, and hides. */
export function writeTip(tip: Element, lines: TipLines): void {
  const on = tipsInLines();
  const put = (line: string, text: string | undefined): void => {
    const el = tip.querySelector(`:scope > .tip-${line}`);
    if (el) el.textContent = (text ?? '').trim();
  };
  put('name', on ? lines.name : lines.plain);
  put('description', on ? lines.description : '');
  put('value', on ? lines.value : '');
  put('more', on ? lines.more : '');
}
