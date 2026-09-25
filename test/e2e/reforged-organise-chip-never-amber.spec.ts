import { test, expect } from './harness';

/**
 * AN ORGANISE CHIP HAS NO VALUES, SO IT CANNOT BE "ON BUT FILTERING NOTHING".
 *
 * `[data-current][data-empty]` is the AMBER warning pin. `data-empty` has one
 * writer — the chip's own `#syncEmpty` — but `data-current` has 26 outside it,
 * and a Sort chip's menu picks a COLUMN, which reads as zero values until one
 * is chosen. Will saw the yellow border three times and never on a filter.
 *
 * TRAP T-an-organise-chip-has-no-values
 * TRAP T-a-chip-knows-what-kind-it-is
 */

type Bar = HTMLElement & {
  rendered?: Promise<void>;
  populate(d: unknown): void;
  organise(d: unknown): void;
};

const settled = () => (window as unknown as { __settled: () => Promise<void> }).__settled();

const BUILD = `
  const el = document.createElement('sherpa-quick-filter-toolbar');
  document.getElementById('root').replaceChildren(el);
  await el.rendered;
  el.populate([{ id: 'plan', label: 'Plan', select: 'multiple',
    options: [{ value: 'pro', label: 'Pro' }] }]);
  el.organise({
    group: [{ field: 'team', label: 'Team' }],
    sort: [{ field: 'name', label: 'Name' }],
  });
  await window.__settled();
  const sr = el.shadowRoot;
  const sortChip = sr.querySelector('.organise-chip[data-id="sort"]');
  const groupChip = sr.querySelector('.organise-chip[data-id="group"]');
`;

test('both organise chips are MARKED as arrangements, not filters', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${BUILD}
    // WHAT IT IS — not which section happened to draw it.
    const marks = (el) => el.dataset.kind ?? '';
    return {
      sort: marks(sortChip),
      group: marks(groupChip),
      // A real filter chip has NO kind — its menu IS its values, and the empty
      // warning is its job.
      filter: marks(sr.querySelector('.chip[data-id="plan"]')),
    };
  })()`) as { sort: string; group: string; filter: string };

  expect(r).toEqual({ sort: 'sort', group: 'group', filter: '' });
});

test('a sort chip set current from OUTSIDE, with no column, never goes amber', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${BUILD}
    // WITHOUT the marks first, so this test proves the marks are what work.
    delete sortChip.dataset.kind;
    sortChip.setAttribute('data-current', '');
    await window.__settled();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const unmarked = sortChip.hasAttribute('data-empty');

    sortChip.removeAttribute('data-current');
    sortChip.dataset.kind = 'sort';
    // This is what 26 call sites do: write the attribute directly. Nothing has
    // picked a column, so the menu reports zero values.
    sortChip.setAttribute('data-current', '');
    await window.__settled();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return {
      unmarked,
      values: (sortChip.menu?.values ?? []).length,
      current: sortChip.hasAttribute('data-current'),
      empty: sortChip.hasAttribute('data-empty'),
    };
  })()`) as { unmarked: boolean; values: number; current: boolean; empty: boolean };

  // The bug, reproduced: unmarked, this is the amber Will kept seeing.
  expect(r.unmarked).toBe(true);
  // The precondition that used to raise the warning is still there...
  expect(r.values).toBe(0);
  expect(r.current).toBe(true);
  // ...and the warning is not.
  expect(r.empty).toBe(false);
});

test('clicking the sort body with no column picked leaves the chip OFF', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${BUILD}
    // The chip's OWN body button — a click on the host does not reach into its
    // shadow root, and the chip flipping its own data-current first is exactly
    // what #cycleSort reads back.
    const body = () => sortChip.shadowRoot.querySelector('.body');
    // Before the guard, nextSort('', '', 'asc') answered 'desc' and the chip
    // lit up sorting by nothing.
    body().click();
    await window.__settled();
    const afterBare = {
      current: sortChip.hasAttribute('data-current'),
      empty: sortChip.hasAttribute('data-empty'),
    };

    // Pick a column from the menu, and the body cycles as it always did.
    const radio = sortChip.querySelector('input[value="name"]');
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
    await window.__settled();
    const picked = { current: sortChip.hasAttribute('data-current'),
      direction: sortChip.dataset.direction };

    body().click();
    await window.__settled();
    return { afterBare, picked,
      cycled: { current: sortChip.hasAttribute('data-current'),
        direction: sortChip.dataset.direction } };
  })()`) as Record<string, { current: boolean; empty?: boolean; direction?: string }>;

  expect(r.afterBare).toEqual({ current: false, empty: false });
  // A column picked from the menu turns it on, ascending.
  expect(r.picked).toEqual({ current: true, direction: 'asc' });
  // And the body still steps asc → desc.
  expect(r.cycled).toEqual({ current: true, direction: 'desc' });
});

test('a real filter chip STILL warns when it is on with nothing ticked', async ({ page }) => {
  const empty = await page.evaluate(`(async () => {
    ${BUILD}
    const chip = sr.querySelector('.chip[data-id="plan"]');
    chip.setAttribute('data-current', '');
    await window.__settled();
    // The fix must not silence the warning where it is TRUE.
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return chip.hasAttribute('data-empty');
  })()`) as boolean;

  expect(empty).toBe(true);
});
