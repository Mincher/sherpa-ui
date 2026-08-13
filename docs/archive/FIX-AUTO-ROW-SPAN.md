# Fix: `data-row-span="auto"` collapses to 1 row when content contains `sherpa-data-grid`

## Root cause

Three independent timing / measurement problems compound:

1. **Measurement reads the constrained height.**  
   `#updateAutoSpan` called `getBoundingClientRect().height` which reflects the *grid
   span* (e.g. 64 px for span-1), not the content.

2. **`height: max-content` doesn't cross scroll-container boundaries.**  
   The fallback tried `height: max-content !important` but `overflow: auto` / `clip`
   on card-content and the data grid host stops the intrinsic-size walk. The result is
   always ~97 px (header chrome only) regardless of how many rows are rendered.

3. **The ResizeObserver and the catch-up timer both fire before the data grid has
   rendered.**  
   `dispatchDataset()` fires `dataset-filtered` before `sherpa-layout-grid` finishes
   bootstrapping. By the time `#initAutoSpan` runs, `_filtered` is already set, but the
   data grid's shadow DOM has not been stamped and its rows not rendered yet.
   `tc.scrollHeight` is 0 at both measurement points, so spans stays at 1.

## The fix (one file — `components/sherpa-layout-grid/sherpa-layout-grid.ts`)

### 1. Replace `#updateAutoSpan`

Use `scrollHeight` of `.table-container` inside `sherpa-data-grid`'s shadow root —
it reflects the full unclipped row height even when the element is visually collapsed.
Fall back to `height: max-content` for containers without a data grid (charts, metrics).

```ts
#updateAutoSpan(el: HTMLElement): void {
  const surface = this.$<HTMLElement>('.grid-surface');
  if (!surface) return;
  const style = getComputedStyle(surface);
  const rowHeight = parseFloat(style.getPropertyValue('--row-height')) || 64;
  const rowGap = parseFloat(style.rowGap) || 16;
  const rowUnit = rowHeight + rowGap;
  const contentH = this.#measureNaturalHeight(el);
  const spans = Math.max(1, Math.ceil((contentH + rowGap) / rowUnit));
  el.style.setProperty('--_auto-row-span', String(spans));
}

#measureNaturalHeight(el: HTMLElement): number {
  // 1. Non-scrollable header chrome.
  const headerSlot = el.querySelector<HTMLElement>('[slot="header"]');
  const headerH = headerSlot?.getBoundingClientRect().height ?? 0;

  // 2. If there's a data grid, use its table-container's scrollHeight.
  //    height:max-content can't cross the scroll-container boundary, but
  //    scrollHeight always reflects the full unclipped content height.
  const dataGrid = el.querySelector<HTMLElement>('sherpa-data-grid');
  if (dataGrid?.shadowRoot) {
    const sr = dataGrid.shadowRoot;
    const tableContainer = sr.querySelector<HTMLElement>('.table-container');
    const pagination = sr.querySelector<HTMLElement>('sherpa-pagination, .grid-pagination');
    const bodyH = tableContainer?.scrollHeight ?? 0;
    const paginationH = pagination?.getBoundingClientRect().height ?? 0;
    return headerH + bodyH + paginationH;
  }

  // 3. Fallback for non-data-grid content (charts, metrics…).
  el.style.setProperty('height', 'max-content', 'important');
  const h = el.getBoundingClientRect().height;
  el.style.removeProperty('height');
  return h;
}
```

### 2. Replace the catch-up trigger in `#initAutoSpan`

Replace the old `setTimeout(() => this.#remeasureAutoSpans(), 0)` block with a call
to a new `#waitAndRemeasure` method, and update the `dataset-filtered` listener to
use the same method.

```ts
// In #initAutoSpan — replace the listener and the _filtered check:

this.addEventListener('dataset-filtered', () => {
  this.#waitAndRemeasure();
});

if ((this as unknown as Record<string, unknown>)['_filtered']) {
  this.#waitAndRemeasure();
}
```

### 3. Add `#waitAndRemeasure`

```ts
async #waitAndRemeasure(): Promise<void> {
  interface WithRendered { rendered?: Promise<void> }
  const slot = this.$<HTMLSlotElement>('slot:not([name])');
  for (const el of slot?.assignedElements() ?? []) {
    if (!(el instanceof HTMLElement) || el.dataset['rowSpan'] !== 'auto') continue;
    // Await the data grid and header so their shadow DOMs are stamped and
    // ContentAttributesMixin.onConnect() has called setData() (rows painted).
    const waits: Promise<void>[] = [];
    for (const child of el.querySelectorAll('sherpa-data-grid, [slot="header"]')) {
      const r = (child as unknown as WithRendered).rendered;
      if (r) waits.push(r);
    }
    if (waits.length) await Promise.all(waits);
    this.#updateAutoSpan(el);
  }
}
```

---

## Build

```bash
npm run build:ts
```

CSS files are not compiled by `build:ts`. If any CSS was modified during earlier fix
attempts, copy them back:

```bash
cp components/sherpa-container/sherpa-container.css   dist/components/sherpa-container/sherpa-container.css
cp components/sherpa-data-grid/sherpa-data-grid.css   dist/components/sherpa-data-grid/sherpa-data-grid.css
```

---

## Verify in dashboard-prototypes

```bash
rm -rf node_modules/sherpa-ui && npm install
```

Open `?view=device-dashboard`.  The Device Inventory container should expand to show
all rows without a scroll bar.  Check in DevTools:

```js
document.querySelector('sherpa-container[data-row-span="auto"]')
  .style.getPropertyValue('--_auto-row-span')  // "10" or similar — not "1"
```
