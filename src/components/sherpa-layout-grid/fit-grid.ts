/**
 * fit-grid.ts — the ONE number a `data-rows="fit"` grid cannot work out itself.
 *
 * Lives beside sherpa-layout-grid because that is its only caller; it stays a
 * separate module because it is also EXPORTED, for a `.sherpa-grid` div that is
 * not the element.
 *
 * CSS owns every visual decision. This supplies `--_fit-rows`: how many rows
 * sit above the filler, so the grid can say
 * `repeat(var(--_fit-rows), min-content) 1fr`.
 *
 * TRAP T-a-fit-grid-needs-its-row-count
 */

/** The item that takes the remaining height: `data-grow`, else the last child. */
function filler(grid: HTMLElement): HTMLElement | null {
  return grid.querySelector<HTMLElement>(':scope > [data-grow]')
    ?? (grid.lastElementChild as HTMLElement | null);
}

/**
 * How many grid ROWS sit above `item`.
 *
 * Counted from laid-out POSITIONS, not from spans: which items share a row is
 * decided during layout, and adding up `data-col-span` values re-implements that
 * — wrongly, the moment a span wraps.
 */
function rowsAbove(grid: HTMLElement, item: HTMLElement): number {
  const top = item.getBoundingClientRect().top;
  const tops = new Set<number>();
  for (const child of grid.children) {
    if (child === item) continue;
    const y = child.getBoundingClientRect().top;
    // Half a pixel of rounding is the same row, not a new one.
    if (y < top - 0.5) tops.add(Math.round(y));
  }
  return tops.size;
}

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

/** Write `--_fit-rows`, or clear it when the grid is not in fit mode. */
export function measureFitGrid(grid: HTMLElement): void {
  if (grid.dataset['rows'] !== 'fit') {
    grid.style.removeProperty('--_fit-rows');
    return;
  }
  const item = filler(grid);
  if (!item) {
    grid.style.setProperty('--_fit-rows', '0');
    return;
  }
  /* MEASURED WITH THE TEMPLATE OFF. Leaving it on measures the layout the
     count itself produced: with `--_fit-rows: 0` the template is a lone `1fr`,
     so four quarter-width items wrapped onto TWO rows and the count came back
     one too many. `grid-template-rows: none` restores plain auto placement for
     the one frame this reads. */
  const held = grid.style.gridTemplateRows;
  grid.style.gridTemplateRows = 'none';
  const rows = rowsAbove(grid, item);
  grid.style.gridTemplateRows = held;
  grid.style.setProperty('--_fit-rows', String(rows));
}

/**
 * Keep a fit grid measured: now, on resize, and whenever its children change.
 *
 * Returns a teardown. Pass a `signal` and it runs on abort.
 * TRAP T-signal-not-a-teardown-list
 */
export function bindFitGrid(
  grid: HTMLElement,
  options: { signal?: AbortSignal } = {},
): () => void {
  let frame = 0;
  const schedule = (): void => {
    // COALESCED: a resize and a mutation in one tick are one measurement.
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(() => {
      measureFitGrid(grid);
      measureGroupedGrid(grid);
    });
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
    attributeFilter: ['data-col-span', 'data-row-span', 'data-grow', 'data-grouped'],
  });

  measureFitGrid(grid);
  measureGroupedGrid(grid);

  const destroy = (): void => {
    cancelAnimationFrame(frame);
    resize.disconnect();
    mutations.disconnect();
  };
  options.signal?.addEventListener('abort', destroy, { once: true });
  return destroy;
}
