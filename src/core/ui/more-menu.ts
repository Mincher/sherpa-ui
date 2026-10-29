/**
 * more-menu.ts — the ⋮ menu a filter bar and its column share: what has
 * FOLDED away at this width, then the host's "Limit to matching filters". TODO 196
 * TRAP T-the-more-menu-holds-what-folded
 *
 * Map:
 * - MoreRow — One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, whether it is off, and a name it says.
 * - folded — Is this element folded away at this width?
 * - resetRows — Reset filters, then Reset all on view — off where they would change nothing.
 * - hidesUnmatched — Limit is on, and hides what it rules out.
 * - saveRows — Save filters, or "Save <name>" with Save as and Delete; none unless the host saves.
 * - extraRows — The page's own buttons in the `actions` slot that have folded away.
 * - openMore — Draw the ⋮ menu from groups of rows, and show it at the trigger.
 * - FILTER_ACTIONS — The rows the Filters menu ends with: its filter actions.
 * - drawFilterActions — Lead a Filters menu with Reset and Reset all on view.
 * - drawSaveActions — End a Saved menu with its save rows, then Manage Saved Filters.
 * - syncHide — Hide invalid filters is inactive while Limit is off.
 * - pickMore — A row was chosen: the menu hides; a page button's row presses it, any other hands back its value.
 * - askSwitches — The ⋮ menu's two switches: each that MOVED is asked for, Limit first.
 */

import type { SherpaMenu } from '../../components/sherpa-menu/sherpa-menu.js';
import { VIEW } from '../data/query.js';
import { report } from '../data/report.js';
import { saves } from './filters-button.js';

/** One ⋮ row: the value of its prototype in a `template.more-rows-tpl`, and whether it is off. */
export type MoreRow = readonly [value: string, disabled?: boolean, name?: string];

const EXTRA = 'extra:';

/** Is this element folded away at this width? */
export function folded(el: Element | null): boolean {
  return !!el && getComputedStyle(el).display === 'none';
}

/** Is this host over the View: its bar, or a column that holds it? */
function atView(host: HTMLElement): boolean {
  return host.dataset['type'] === 'view' || host.hasAttribute('data-column')
    || (host.dataset['scope'] ?? '').split(/\s+/).includes(VIEW);
}

/** Reset filters, then Reset all on view — off where they would change nothing (TODO 231),
 *  and the second only over the View. Will, TODO 524 */
export function resetRows(host: HTMLElement): MoreRow[] {
  return [['reset', host.hasAttribute('data-nothing-to-reset')], ...(atView(host) ? [['reset-default', host.hasAttribute('data-at-default')] as MoreRow] : [])];
}

/** Limit is on, and hides what it rules out. Will, TODO 205. */
export function hidesUnmatched(host: HTMLElement): boolean {
  return host.dataset['limitOptions'] === 'on' && host.dataset['hideUnmatched'] === 'on';
}

/** Save filters — or "Save <name>", over the set last taken, then Save filters
 *  as and Delete filters — none unless the host saves; the two saves off while
 *  the filters are the View's own, as Reset all is. TODO 105 · Will, 366, 382 */
export function saveRows(host: HTMLElement, applied?: { label: string }): MoreRow[] {
  if (!saves(host)) return [];
  const same = host.hasAttribute('data-at-default');
  return applied ? [['filters-save', same, applied.label], ['filters-save-as', same], ['filters-delete']] : [['filters-save', same]];
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
  const drawn = groups.map((rows) => drawRows(host, root, rows));
  const limit = host.dataset['limitOptions'];
  // The app's setting: offered over the View only. Will, TODO 553
  if (limit && atView(host)) {
    // …and below it, whether what Limit rules out is shown at all. Will, TODOs 205 and 376
    drawn.push([check(root, 'limit-options', limit === 'on'), check(root, 'hide-unmatched', host.dataset['hideUnmatched'] === 'on')]
      .filter((n): n is HTMLElement => !!n));
  }
  menu.replaceChildren(...drawn.filter((g) => g.length)
    .flatMap((g, i) => (i ? [divider.cloneNode(true) as HTMLElement, ...g] : g)));
  syncHide(host, root);
  menu.show?.(trigger);
}

/** Each row, cloned from its prototype: off where it says, and naming what it acts on. */
function drawRows(host: HTMLElement, root: ParentNode, rows: readonly MoreRow[]): HTMLElement[] {
  return rows.flatMap(([value, disabled, name]) => {
    const one = value.startsWith(EXTRA) ? pageRow(host, root, value) : row(root, value);
    one?.toggleAttribute('disabled', !!disabled);
    // A row that names what it acts on: "Save At risk". Its own word stays otherwise.
    const said = name ? one?.querySelector('.more-name') : null;
    if (said) said.textContent = name!;
    return one ? [one] : [];
  });
}

/** The rows the Filters menu ends with: its filter actions. Will, TODO 383 */
export const FILTER_ACTIONS = new Set(['reset', 'reset-default', 'filters-save', 'filters-save-as', 'filters-delete']);

/** Lead a Filters menu with Reset and Reset all on view, in place of the ones it
 *  had; its save rows are the ⋮'s, or the Saved menu's. Will, TODOs 383, 454 */
export function drawFilterActions(host: HTMLElement, root: ParentNode, menu: Element | null | undefined): void {
  if (!menu) return;
  for (const old of menu.querySelectorAll(':scope > .filter-action')) old.remove();
  const rows = drawRows(host, root, resetRows(host));
  // `data-lead`: above the values, whenever the menu stamps them.
  for (const one of rows) { one.classList.add('filter-action'); one.setAttribute('data-lead', ''); }
  menu.prepend(...rows);
}

/** End a Saved menu — split from Filters — with its save rows, then Manage
 *  Saved Filters, each after a divider: below its sets. Will, TODO 436 */
export function drawSaveActions(host: HTMLElement, root: ParentNode, menu: Element | null | undefined,
  applied?: { label: string }, manage = false): void {
  if (!menu) return;
  for (const old of menu.querySelectorAll(':scope > .save-action')) old.remove();
  const groups = [drawRows(host, root, saveRows(host, applied)), manage ? drawRows(host, root, [['filters-manage']]) : []];
  const rows = groups.filter((g) => g.length).flatMap((g) => [cloneFirst(root, 'template.more-divider-tpl'), ...g])
    .filter((n): n is HTMLElement => !!n);
  for (const one of rows) one.classList.add('save-action');
  menu.append(...rows);
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
