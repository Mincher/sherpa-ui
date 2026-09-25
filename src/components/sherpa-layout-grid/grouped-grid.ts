/**
 * grouped-grid.ts — each child's grid POSITION, for `data-grouped`.
 *
 * Lives beside sherpa-layout-grid because that is its only caller; it stays a
 * separate module because it is also EXPORTED, for a `.sherpa-grid` div that is
 * not the element.
 *
 * A fit grid needs no JS: its row count is authored. TRAP T-a-fit-grid-needs-its-row-count
 *
 * Map:
 * - measureGroupedGrid — Write each child's POSITION in the grid, for `data-grouped`.
 * - bindGroupedGrid — Keep a grid's positions measured: now, on resize, and whenever its children change.
 */

/**
 * Write each child's POSITION in the grid, for `data-grouped`.
 *
 * Measured from laid-out geometry, never from spans. `grid-column-start`
 * reports `span 4`, not the track auto-placement chose — verified in all three
 * engines — so CSS alone cannot find the first or last item in a row once a
 * span wraps. TRAP T-a-wrapping-span-hides-its-own-row
 */
export function measureGroupedGrid(grid: HTMLElement): void {
  const kids = [...grid.children].filter((c): c is HTMLElement => c instanceof HTMLElement);
  if (!grid.hasAttribute('data-grouped')) {
    for (const kid of kids) kid.removeAttribute('data-group');
    return;
  }
  // Group by row: same top edge, within half a pixel of rounding.
  const rows = new Map<number, HTMLElement[]>();
  for (const kid of kids) {
    const top = Math.round(kid.getBoundingClientRect().top);
    const row = rows.get(top) ?? [];
    row.push(kid);
    rows.set(top, row);
  }
  const tops = [...rows.keys()].sort((a, b) => a - b);
  for (const [index, top] of tops.entries()) {
    const row = rows.get(top)!;
    const band = tops.length === 1 ? 'grid-top'
      : index === 0 ? 'grid-top'
      : index === tops.length - 1 ? 'grid-bottom'
      : 'grid-mid';
    for (const [place, kid] of row.entries()) {
      const across = row.length === 1 ? 'solo'
        : place === 0 ? 'start'
        : place === row.length - 1 ? 'end'
        : 'mid';
      kid.setAttribute('data-group', `${band}-${across}`);
    }
  }
}

/**
 * Keep a grid's positions measured: now, on resize, and whenever its children change.
 *
 * Returns a teardown. Pass a `signal` and it runs on abort.
 * TRAP T-signal-not-a-teardown-list
 */
export function bindGroupedGrid(
  grid: HTMLElement,
  options: { signal?: AbortSignal } = {},
): () => void {
  let frame = 0;
  const schedule = (): void => {
    // COALESCED: a resize and a mutation in one tick are one measurement.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => measureGroupedGrid(grid));
  };

  const resize = new ResizeObserver(schedule);
  resize.observe(grid);
  for (const child of grid.children) resize.observe(child);

  const mutations = new MutationObserver(() => {
    resize.disconnect();
    resize.observe(grid);
    for (const child of grid.children) resize.observe(child);
    schedule();
  });
  mutations.observe(grid, {
    childList: true,
    attributeFilter: ['data-col-span', 'data-row-span', 'data-grouped'],
  });

  measureGroupedGrid(grid);

  const destroy = (): void => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
  };
  options.signal?.addEventListener('abort', destroy, { once: true });
  return destroy;
}
