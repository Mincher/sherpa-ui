/**
 * page-components.ts — a page as its Query graph reads it while the page is not on screen: its
 * markup, built off screen, and each grid and chart in it. Inert: nothing in it asks.
 * TRAP T-a-graph-is-a-view-of-a-type
 *
 * Map:
 * - pageMarkup — A page's markup off screen: its template, with its View's own cards where it holds them.
 * - pageComponents — Each component in a page's markup that draws a kind: its id, its card's heading, its kind and its scope.
 */
import { parseViewMarkup } from '../browser/view-markup.js';
import type { PageDefinition } from '../data/page-definition.js';
import type { GraphComponent } from '../data/query-graph.js';
import { presentsOf } from './show-as.js';

/** A page's markup off screen: its template, with its View's own cards where it holds them. */
export function pageMarkup(template: string, content?: string): DocumentFragment {
  const holder = document.createElement('template');
  // The app's own file, as the outlet draws it.
  holder.innerHTML = template;
  const into = typeof content === 'string' ? holder.content.querySelector('[data-view-content]') : null;
  if (into) into.replaceChildren(parseViewMarkup(content!).fragment);
  return holder.content;
}

/** Each component in a page's markup that draws a kind: its id, its card's heading — else its scope's
 *  name, else its id — its kind, and the scope it reads. */
export function pageComponents(root: ParentNode, definition: PageDefinition | null): GraphComponent[] {
  return [...root.querySelectorAll<HTMLElement>('[id]')].flatMap((el) => {
    const kind = presentsOf(el)?.kind;
    if (!kind) return [];
    const scope = el.closest<HTMLElement>('[data-scope]')?.dataset['scope'];
    const heading = el.closest('sherpa-container')?.querySelector<HTMLElement>('sherpa-container-header')?.dataset['heading'];
    return [{
      id: el.id, label: heading ?? definition?.source?.scopes?.[scope ?? '']?.label ?? el.id,
      kind: kind as NonNullable<GraphComponent['kind']>, ...(scope ? { scope } : {}),
    }];
  });
}
