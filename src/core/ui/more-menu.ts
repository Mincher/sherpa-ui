/**
 * more-menu.ts — the ⋮ menu a filter bar and its column share: what has
 * FOLDED away at this width, then the host's "Limit to matching filters". TODO 196
 * TRAP T-the-more-menu-holds-what-folded
 *
 * Map:
 * - MoreRow — One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, whether it is off.
 * - folded — Is this element folded away at this width?
 * - resetRows — Reset filters, then Reset to view defaults — off where they would change nothing.
 * - hidesUnmatched — Limit is on, and hides what it rules out.
 * - saveRows — Save filters; none unless the host saves.
 * - extraRows — The page's own buttons in the `actions` slot that have folded away.
 * - offersMore — Would the ⋮ menu hold anything: these rows, or the host's own switches?
 * - openMore — Draw the ⋮ menu from groups of rows, and show it at the trigger.
 * - syncHide — Hide invalid filters is inactive while Limit is off.
 * - pickMore — A row was chosen: the menu hides; a page button's row presses it, any other hands back its value.
 * - askSwitches — The ⋮ menu's two switches: each that MOVED is asked for, Limit first.
 */

import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import { VIEW } from '../data/query.js';
import { report } from '../data/report.js';
import { saves } from './filters-button.js';

/** One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, and whether it is off. */
export type MoreRow = readonly [value: string, disabled?: boolean];

const EXTRA = 'extra:';

/** Is this element folded away at this width? */
export function folded(el: Element | null): boolean {
  return !!el && getComputedStyle(el).display === 'none';
}

/** Is this the PAGE's bar, in the app header? Only it offers the two Limit switches: its value sets every scope on the page.
 *  Will, TODO 870 */
function isPageBar(host: HTMLElement): boolean {
  return host.dataset['type'] === 'view';
}

/** Is this host over the View: its bar, or a column that holds it? */
function atView(host: HTMLElement): boolean {
  return host.dataset['type'] === 'view' || !!(host.constructor as { column?: boolean }).column
    || (host.dataset['scope'] ?? '').split(/\s+/).includes(VIEW);
}

/** Reset filters, then Reset to view defaults — off where they would change nothing (TODO 231),
 *  and the second only over the View. Will, TODO 524 */
export function resetRows(host: HTMLElement): MoreRow[] {
  return [['reset', host.hasAttribute('data-nothing-to-reset')], ...(atView(host) ? [['reset-default', host.hasAttribute('data-at-default')] as MoreRow] : [])];
}

/** Limit is on, and hides what it rules out. Will, TODO 205. */
export function hidesUnmatched(host: HTMLElement): boolean {
  return host.dataset['limitOptions'] === 'on' && host.dataset['hideUnmatched'] === 'on';
}

/** Save filters, none unless the host saves; off while the filters are the View's
 *  own, as Reset all is. TODO 105 · Will, 382 */
export function saveRows(host: HTMLElement): MoreRow[] {
  return saves(host) ? [['filters-save', host.hasAttribute('data-at-default')]] : [];
}

/** The page's own buttons in the `actions` slot that have folded away — the panel switch is one. */
export function extraRows(host: HTMLElement): MoreRow[] {
  return extras(host).flatMap((extra, i): MoreRow[] => (folded(extra) ? [[`${EXTRA}${i}`]] : []));
}

/** Would the ⋮ menu hold anything: these rows, or the host's own switches? Will, TODO 566 */
export function offersMore(host: HTMLElement, groups: readonly MoreRow[][]): boolean {
  return groups.some((rows) => rows.length) || (!!host.dataset['limitOptions'] && isPageBar(host));
}

/** Draw the ⋮ menu from groups of rows — a divider between each — then the
 *  host's own switch, and show it at the trigger. Will, TODO 178. */
export function openMore(host: HTMLElement, root: ParentNode, trigger: HTMLElement, groups: readonly MoreRow[][]): void {
  const menu = root.querySelector<SherpaMenu>('.more-menu');
  const divider = cloneFirst(root, 'template.more-divider-tpl');
  if (!menu || !divider) return;
  const drawn = groups.map((rows) => drawRows(host, root, rows));
  const limit = host.dataset['limitOptions'];
  // The app's setting: offered on the page's View bar only, and it sets every scope. Will, TODOs 553, 870
  if (limit && isPageBar(host)) {
    // …and below it, whether what Limit rules out is shown at all. Will, TODOs 205 and 376
    drawn.push([check(root, 'limit-options', limit === 'on'), check(root, 'hide-unmatched', host.dataset['hideUnmatched'] === 'on')]
      .filter((n): n is HTMLElement => !!n));
  }
  menu.replaceChildren(...drawn.filter((g) => g.length)
    .flatMap((g, i) => (i ? [divider.cloneNode(true) as HTMLElement, ...g] : g)));
  syncHide(host, root);
  // It says what its ⋮ does, under its heading. Will, TODO 691 · TRAP T-an-action-says-what-it-does
  const described = trigger.getAttribute('data-description');
  if (described) menu.setAttribute('data-description', described);
  else menu.removeAttribute('data-description');
  menu.show?.(trigger);
}

/** Each row, cloned from its prototype: off where it says. */
function drawRows(host: HTMLElement, root: ParentNode, rows: readonly MoreRow[]): HTMLElement[] {
  return rows.flatMap(([value, disabled]) => {
    const one = value.startsWith(EXTRA) ? pageRow(host, root, value) : row(root, value);
    one?.toggleAttribute('disabled', !!disabled);
    return one ? [one] : [];
  });
}

/** Hide invalid filters is inactive — not hidden — while Limit is off. Will, TODO 376 */
export function syncHide(host: HTMLElement, root: ParentNode): void {
  const box = root.querySelector<HTMLInputElement>('.more-menu input[value="hide-unmatched"]');
  if (box) box.disabled = host.dataset['limitOptions'] !== 'on';
}

/** A row's prototype, by value, from its host's more-rows-tpl. */
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
 *  host owns both: Limit to matching filters, and Hide invalid filters. */
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
