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
export const SHOW_AS = ['default', ...PRESENTATION_KINDS] as const;

/** Show as where the host offers it — `on`, its `data-presentation`: put in its
 *  `.show-as` once — `bare`, a header's — each pick to `pick` (a request), what it shows ticked. `own`,
 *  its `data-presentation-default`, is what Default draws: the first row names it, and no other row
 *  repeats it. Will, TODO 620. Not offered, or `off` (the app's setting, TODO 582), nothing is made:
 *  every toolbar would carry a menu. */
export function showAs(root: ParentNode, on: string | undefined, pick: (kind: string) => void, bare = false, own?: string): void {
  if (on === undefined || on === 'off') return;
  const at = root.querySelector('.show-as');
  const tpl = root.querySelector<HTMLTemplateElement>('template.show-as-tpl');
  if (!at || !tpl) return;
  if (!at.querySelector('.presentation-menu')) {
    at.append(document.importNode(tpl.content, true));
    /* A header's icon actions are small and bare; a toolbar's button wears the
       default look and size, as its neighbours do. Will, TODO 548 */
    const button = at.querySelector('.presentation');
    if (bare) {
      button?.setAttribute('data-look', 'transparent');
      button?.setAttribute('data-size', 'sm');
    }
    const made = at.querySelector<SherpaMenu>('.presentation-menu');
    made?.addEventListener('menu-change', (event) => {
      const [kind] = (event as CustomEvent<{ values?: string[] }>).detail?.values ?? [];
      // Its job is done: asked for, never shown here first.
      made.hide();
      if (kind) pick(kind);
    });
  }
  const words = root.querySelector<HTMLTemplateElement>('template.show-as-words')?.content;
  const word = (kind: string): string => words?.querySelector(`[data-word="${kind}"]`)?.textContent?.trim() ?? kind;
  // A gauge splits nothing, so its data shows as a grid and no chart.
  const others = PRESENTATION_KINDS.filter((kind) => kind !== own && (own !== 'gauge' || kind === 'grid'));
  const ticked = on === own ? 'default' : on;
  at.querySelector<SherpaMenu>('.presentation-menu')?.items?.([
    { value: 'default', label: own ? `${word('default')} - ${word(own)}` : word('default'), selected: ticked === 'default' },
    ...others.map((kind) => ({ value: kind, label: word(kind), selected: kind === ticked })),
  ]);
}
