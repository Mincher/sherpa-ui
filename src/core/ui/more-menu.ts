/**
 * more-menu.ts — the ⋮ menu a filter bar and the filter panel share: what has
 * FOLDED away at this width, then the host's "Limit to matching filters". TODO 196
 * TRAP T-the-more-menu-holds-what-folded
 *
 * Map:
 * - MoreRow — One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, whether it is off, and a name it says.
 * - MORE_MENU — The ⋮ menu's own markup and sheet: a host lists each FIRST.
 * - folded — Is this element folded away at this width?
 * - resetRows — Reset filters, then Reset all to default — off where they would change nothing.
 * - syncResets — Reset, and Reset all to default, as buttons: off where they would change nothing.
 * - hidesUnmatched — Limit is on, and hides what it rules out.
 * - saveRows — Save filters, or "Save <name>" with Save as and Delete; none unless the host saves.
 * - extraRows — The page's own buttons in the `actions` slot that have folded away.
 * - openMore — Draw the ⋮ menu from groups of rows, and show it at the trigger.
 * - pickMore — A row was chosen: the menu hides; a page button's row presses it, any other hands back its value.
 * - askSwitches — The ⋮ menu's two switches: each that MOVED is asked for, Limit first.
 */

import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import { report } from '../data/report.js';

/** One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, and whether it is off. */
export type MoreRow = readonly [value: string, disabled?: boolean, name?: string];

/** The ⋮ menu's own markup and sheet: a host lists each FIRST. TRAP T-a-family-shares-markup */
export const MORE_MENU = {
  html: new URL('../sherpa-filter-more.html', import.meta.url),
  css: new URL('../sherpa-filter-more.css', import.meta.url),
} as const;

const EXTRA = 'extra:';

/** Is this element folded away at this width? */
export function folded(el: Element | null): boolean {
  return !!el && getComputedStyle(el).display === 'none';
}

/** Reset filters, then Reset all to default — off where they would change nothing. TODO 231 */
export function resetRows(host: HTMLElement): MoreRow[] {
  return [['reset', host.hasAttribute('data-nothing-to-reset')], ['reset-default', host.hasAttribute('data-at-default')]];
}

/** Reset, and Reset all to default, as buttons: off where they would change
 *  nothing — the host says. `reset` is the host's own Reset button. TODO 231 */
export function syncResets(host: HTMLElement, root: ParentNode, reset: string): void {
  root.querySelector(reset)?.toggleAttribute('disabled', host.hasAttribute('data-nothing-to-reset'));
  root.querySelector('.reset-more')?.toggleAttribute('disabled', host.hasAttribute('data-at-default'));
}

/** Limit is on, and hides what it rules out. Will, TODO 205. */
export function hidesUnmatched(host: HTMLElement): boolean {
  return host.dataset['limitOptions'] === 'on' && host.dataset['hideUnmatched'] === 'on';
}

/** Save filters — or "Save <name>", over the set last taken, then Save filters
 *  as and Delete filters — none unless the host saves. TODO 105 · Will, 366 */
export function saveRows(host: HTMLElement, applied?: { label: string }): MoreRow[] {
  if (!host.hasAttribute('data-saveable')) return [];
  return applied ? [['filters-save', false, applied.label], ['filters-save-as'], ['filters-delete']] : [['filters-save']];
}

/** The page's own buttons in the `actions` slot that have folded away — the panel switch is one. */
export function extraRows(host: HTMLElement): MoreRow[] {
  return extras(host).flatMap((extra, i): MoreRow[] => (folded(extra) ? [[`${EXTRA}${i}`]] : []));
}

/** Draw the ⋮ menu from groups of rows — a divider between each — then the
 *  host's own switch, and show it at the trigger. Will, TODO 178. */
export function openMore(host: HTMLElement, root: ParentNode, trigger: HTMLElement, groups: readonly MoreRow[][]): void {
  const menu = root.querySelector<SherpaMenu>('.more-menu');
  const divider = cloneFirst(root, 'template.more-divider-tpl');
  if (!menu || !divider) return;
  const drawn = groups.map((rows) => rows.flatMap(([value, disabled, name]) => {
    const one = value.startsWith(EXTRA) ? pageRow(host, root, value) : row(root, value);
    one?.toggleAttribute('disabled', !!disabled);
    // A row that names what it acts on: "Save At risk". Its own word stays otherwise.
    const said = name ? one?.querySelector('.more-name') : null;
    if (said) said.textContent = name!;
    return one ? [one] : [];
  }));
  const limit = host.dataset['limitOptions'];
  if (limit) {
    // …and while Limit is on, whether what it rules out is shown at all. Will, TODO 205.
    drawn.push([check(root, 'limit-options', limit === 'on'),
      ...(limit === 'on' ? [check(root, 'hide-unmatched', host.dataset['hideUnmatched'] === 'on')] : [])]
      .filter((n): n is HTMLElement => !!n));
  }
  menu.replaceChildren(...drawn.filter((g) => g.length)
    .flatMap((g, i) => (i ? [divider.cloneNode(true) as HTMLElement, ...g] : g)));
  menu.show?.(trigger);
}

/** A row's prototype, by value, from any more-rows-tpl: the family's or its host's own. */
function row(root: ParentNode, value: string): HTMLElement | null {
  for (const tpl of root.querySelectorAll<HTMLTemplateElement>('template.more-rows-tpl')) {
    const hit = tpl.content.querySelector(`[value="${value}"]`)?.closest('.more-item, .more-check');
    if (hit) return hit.cloneNode(true) as HTMLElement;
  }
  report({ code: 'more-row-missing', message: `No ⋮ row "${value}" in the markup.`, at: { value } });
  return null;
}

/** A switch row, ticked or not. */
function check(root: ParentNode, value: string, on: boolean): HTMLElement | null {
  const one = row(root, value);
  const box = one?.querySelector('input');
  if (box) box.checked = on;
  return one;
}

/** A page button's row: its words are the page's. */
function pageRow(host: HTMLElement, root: ParentNode, value: string): HTMLElement | null {
  const extra = extras(host)[Number(value.slice(EXTRA.length))];
  const one = cloneFirst(root, 'template.more-item-tpl');
  if (!extra || !one) return null;
  one.setAttribute('value', value);
  one.querySelector('.more-label')!.textContent = extra.getAttribute('aria-label') ?? extra.textContent?.trim() ?? '';
  return one;
}

/** A prototype's first element, cloned. */
function cloneFirst(root: ParentNode, sel: string): HTMLElement | null {
  return (root.querySelector<HTMLTemplateElement>(sel)?.content.firstElementChild?.cloneNode(true) as HTMLElement | undefined) ?? null;
}

/** A row was chosen: the menu hides. A page button's row presses that button,
 *  if it is still there, and hands back ''; any other row hands back its value. */
export function pickMore(host: HTMLElement, root: ParentNode, event: Event): string {
  const value = String((event as CustomEvent).detail?.value ?? '');
  root.querySelector<SherpaMenu>('.more-menu')?.hide?.();
  if (!value.startsWith(EXTRA)) return value;
  extras(host)[Number(value.slice(EXTRA.length))]?.dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));
  return '';
}

/** The ⋮ menu's two switches: each that MOVED is asked for, Limit first — the
 *  host owns both: Limit to matching filters, and Hide unmatching filters. */
export function askSwitches(
  host: HTMLElement, event: Event,
  ask: (name: 'limit-options-change' | 'hide-unmatched-change', on: boolean) => void,
): void {
  event.stopPropagation();
  const on = ((event as CustomEvent).detail?.values ?? []) as string[];
  const limit = on.includes('limit-options');
  const hide = on.includes('hide-unmatched');
  if (limit !== (host.dataset['limitOptions'] === 'on')) ask('limit-options-change', limit);
  // Read AFTER the Limit ask: its host answers by rewriting both attributes.
  if (hide !== (host.dataset['hideUnmatched'] === 'on')) ask('hide-unmatched-change', hide);
}

function extras(host: HTMLElement): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(':scope > [slot="actions"]')];
}
