/**
 * show-as.ts — Show as: the menu a card offers to show its data another way, one
 * markup and one wiring for every host that offers it. Will, TODO 548
 *
 * Map:
 * - SHOW_AS_HTML — The family file a host lists first in its static html.
 * - SHOW_AS — What Show as offers: the definition's way, then each other.
 * - showAs — Show as where the host offers it: put in its `.show-as` once, each pick to `pick`, what it shows ticked.
 */
import { PRESENTATION_KINDS } from '../data/query.js';
import '../../components/sherpa-button/sherpa-button.js';
import '../../components/sherpa-menu/sherpa-menu.js';
import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';

/** The family file a host lists first in its static html. */
export const SHOW_AS_HTML = new URL('../sherpa-show-as.html', import.meta.url);

/** What Show as offers: the definition's way, then each other. */
export const SHOW_AS = ['default', ...PRESENTATION_KINDS.filter((k) => k !== 'grid')] as const;

/** Show as where the host offers it — `on`, its `data-presentation`: put in its
 *  `.show-as` once — `bare`, a header's — each pick to `pick` (a request), what it shows ticked. Not
 *  offered, or `off` (the app's setting, TODO 582), nothing is made: every toolbar would carry a menu. */
export function showAs(root: ParentNode, on: string | undefined, pick: (kind: string) => void, bare = false): void {
  if (on === undefined || on === 'off') return;
  const at = root.querySelector('.show-as');
  const tpl = root.querySelector<HTMLTemplateElement>('template.show-as-tpl');
  if (!at || !tpl) return;
  const made = at.querySelector<SherpaMenu>('.presentation-menu');
  if (made) {
    made.values = [on];
    return;
  }
  at.append(document.importNode(tpl.content, true));
  /* A header's icon actions are small and bare; a toolbar's button wears the
     default look and size, as its neighbours do. Will, TODO 548 */
  const button = at.querySelector('.presentation');
  if (bare) {
    button?.setAttribute('data-look', 'transparent');
    button?.setAttribute('data-size', 'sm');
  }
  const words = root.querySelector<HTMLTemplateElement>('template.show-as-words')?.content;
  const menu = at.querySelector<SherpaMenu>('.presentation-menu');
  menu?.items?.(SHOW_AS.map((kind) => ({
    value: kind, label: words?.querySelector(`[data-word="${kind}"]`)?.textContent?.trim() ?? kind, selected: kind === on,
  })));
  menu?.addEventListener('menu-change', (event) => {
    const [kind] = (event as CustomEvent<{ values?: string[] }>).detail?.values ?? [];
    // Its job is done: asked for, never shown here first.
    menu.hide();
    if (kind) pick(kind);
  });
}
