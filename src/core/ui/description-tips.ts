/**
 * description-tips.ts — a tip IN LINES, where the page shows them: the Name, the
 * Description, the Value, then the rest. The page says so on `<html
 * data-description-tips>`; a component that draws a tip hears it change.
 * Will, TODO 691 · TRAP T-a-tip-in-lines
 *
 * Map:
 * - TIP_HTML — The tip's lines, the family markup a control lists first in its static html.
 * - TipLines — A tip's one line as before, and its lines.
 * - tipsInLines — Does the page show tips in lines now?
 * - watchTipLines — Hear the page's choice change; the function it returns stops.
 * - writeTip — Write a tip: in lines where the page says, else its one line as before.
 */

/** The tip's lines, the family markup a control lists first in its static html.
 *  TRAP T-a-family-shares-markup */
export const TIP_HTML = new URL('../sherpa-tip.html', import.meta.url);

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
  // Its lines, from the family's prototype in its root, at the first write.
  if (!tip.querySelector(':scope > .tip-line')) {
    const from = (tip.getRootNode() as ParentNode).querySelector?.<HTMLTemplateElement>('template.tip-lines-tpl');
    if (from) tip.append(document.importNode(from.content, true));
  }
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
