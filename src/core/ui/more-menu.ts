/**
 * more-menu.ts — the ⋮ menu a filter bar and the filter panel share: what has
 * FOLDED away at this width, then the host's "Limit matching filters". TODO 196
 * TRAP T-the-more-menu-holds-what-folded
 *
 * Map:
 * - MoreRow — One ⋮ row: what it does, what it says, and whether it is off.
 * - folded — Is this element folded away at this width?
 * - resetRows — Reset filters, then Reset all to default — off where they would change nothing.
 * - extraRows — The page's own buttons in the `actions` slot that have folded away.
 * - openMore — Draw the ⋮ menu from groups of rows, and show it at the trigger.
 * - pickMore — A row was chosen: the menu hides; a page button's row hands back that button.
 * - limitOn — The ⋮ menu's switch, as its request: is "Limit matching filters" now on?
 */

type Menu = HTMLElement & { show?: (trigger?: HTMLElement) => void; hide?: () => void };

/** One ⋮ row: what it does, what it says, and whether it is off. */
export type MoreRow = readonly [value: string, label: string, disabled?: boolean];

const EXTRA = 'extra:';

/** Is this element folded away at this width? */
export function folded(el: Element | null): boolean {
  return !!el && getComputedStyle(el).display === 'none';
}

/** Reset filters, then Reset all to default — off where they would change nothing. TODO 231 */
export function resetRows(host: HTMLElement, reset: string): MoreRow[] {
  return [
    [reset, 'Reset filters', host.hasAttribute('data-nothing-to-reset')],
    ['reset-default', 'Reset all to default', host.hasAttribute('data-at-default')],
  ];
}

/** The page's own buttons in the `actions` slot that have folded away — the panel switch is one. */
export function extraRows(host: HTMLElement): MoreRow[] {
  return extras(host).flatMap((extra, i): MoreRow[] => (folded(extra)
    ? [[`${EXTRA}${i}`, extra.getAttribute('aria-label') ?? extra.textContent?.trim() ?? '']]
    : []));
}

/** Draw the ⋮ menu from groups of rows — a divider between each — then the
 *  host's own switch, and show it at the trigger. Will, TODO 178. */
export function openMore(host: HTMLElement, root: ParentNode, trigger: HTMLElement, groups: readonly MoreRow[][]): void {
  const menu = root.querySelector<Menu>('.more-menu');
  const item = root.querySelector<HTMLTemplateElement>('template.more-item-tpl')?.content.firstElementChild;
  const divider = root.querySelector<HTMLTemplateElement>('template.more-divider-tpl')?.content.firstElementChild;
  if (!menu || !item || !divider) return;
  const drawn = groups.map((rows) => rows.map(([value, label, disabled]) => {
    const one = item.cloneNode(true) as HTMLElement;
    one.setAttribute('value', value);
    one.querySelector('.more-label')!.textContent = label;
    one.toggleAttribute('disabled', !!disabled);
    return one;
  }));
  const check = root.querySelector<HTMLTemplateElement>('template.more-check-tpl')?.content.firstElementChild;
  const limit = host.dataset['limitOptions'];
  if (limit && check) {
    const one = check.cloneNode(true) as HTMLElement;
    one.querySelector('input')!.checked = limit === 'on';
    drawn.push([one]);
  }
  menu.replaceChildren(...drawn.filter((g) => g.length)
    .flatMap((g, i) => (i ? [divider.cloneNode(true) as HTMLElement, ...g] : g)));
  menu.show?.(trigger);
}

/** A row was chosen: the menu hides. A page button's row hands back that
 *  button, to press — or nothing, if it has gone; any other row, its value. */
export function pickMore(host: HTMLElement, root: ParentNode, event: Event): string | HTMLElement | undefined {
  const value = String((event as CustomEvent).detail?.value ?? '');
  root.querySelector<Menu>('.more-menu')?.hide?.();
  return value.startsWith(EXTRA) ? extras(host)[Number(value.slice(EXTRA.length))] : value;
}

/** The ⋮ menu's switch, as its REQUEST — the host owns whether filters limit
 *  each other: is "Limit matching filters" now on? */
export function limitOn(event: Event): boolean {
  event.stopPropagation();
  return (((event as CustomEvent).detail?.values ?? []) as string[]).includes('limit-options');
}

function extras(host: HTMLElement): HTMLElement[] {
  return [...host.querySelectorAll<HTMLElement>(':scope > [slot="actions"]')];
}
