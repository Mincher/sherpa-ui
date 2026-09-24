import { test, expect } from '@playwright/test';

/**
 * THE PANEL IS THE TOOLBAR IN A COLUMN.
 *
 * Two accordions, one per SCOPE. Inside each, a field is a sherpa-section-header
 * plus a wrapping run of boolean chips — one per value. ONE search and ONE
 * footer for the whole panel, so a reader answers every field and applies once.
 *
 * Everything is COMPOSED: the panel, the accordions, the headers, the runs and
 * the chips are all real components. TRAP T-the-panel-is-the-toolbar-in-a-column
 */

const APP = 'http://localhost:4200/?context=records';

async function records(page: import('@playwright/test').Page): Promise<void> {
  await page.setViewportSize({ width: 1440, height: 950 });
  await page.goto(APP);
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  await page.waitForTimeout(500);
}

/** Open the panel the way the Configure button does. */
async function openPanel(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(() => {
    document.querySelector('#context-root sherpa-quick-filter-toolbar')!
      .dispatchEvent(new CustomEvent('filter-configure', { bubbles: true, composed: true }));
  });
  await page.waitForTimeout(700);
}

test('a field is a section header and a run of value chips — all composed', async ({ page }) => {
  await records(page);
  await openPanel(page);

  const r = await page.evaluate(() => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const status = panel.querySelector('.panel-field[data-field="status"]') as HTMLElement;
    return {
      fields: [...panel.querySelectorAll('.panel-field')]
        .map((f) => (f as HTMLElement).dataset['field']),
      // NOTHING hand-rolled: every part is a real component.
      header: status.querySelector('sherpa-section-header')?.getAttribute('data-heading'),
      values: [...status.querySelectorAll('.panel-value')]
        .map((c) => (c as HTMLElement).dataset['value']),
      // The chips sit on ONE line where they fit, at their OWN widths.
      lines: new Set([...status.querySelectorAll('.panel-value')]
        .map((c) => Math.round(c.getBoundingClientRect().y))).size,
      widths: new Set([...status.querySelectorAll('.panel-value')]
        .map((c) => Math.round(c.getBoundingClientRect().width))).size,
      // ONE search and ONE footer for the whole panel, not one per field.
      searches: panel.querySelectorAll('.panel-search').length,
      applies: panel.querySelectorAll('.panel-apply').length,
      accordions: panel.querySelectorAll('sherpa-accordion').length,
    };
  });

  expect(r.fields).toEqual(['status', 'plan', 'tier', 'owner']);
  expect(r.header).toBe('Status');
  expect(r.values).toEqual(['active', 'churned', 'suspended', 'trial']);

  /* HUG, not stretch: a chip is its own width. `data-wrap` alone gives every
     item `flex: 1 1 200px`, which put one chip per line. */
  expect(r.widths).toBeGreaterThan(1);
  expect(r.lines).toBeLessThan(4);

  expect(r.searches).toBe(1);
  expect(r.applies).toBe(1);
  // One per SCOPE — and only `data` has fields the panel draws.
  expect(r.accordions).toBe(1);
});

/**
 * THE VIEW, CUSTOMER AND REGION CHIPS STAY ON THE HEADER.
 *
 * `view` is not a filter — it is what the filters apply WITHIN. `customer` and
 * `region` are GLOBAL: a reader sets them once and they follow from page to
 * page, so burying them in a per-Context panel makes a global answer look
 * local. TRAP T-the-view-chip-stays-on-the-header
 */
test('a field the panel draws is hidden on its bar; the global ones are not',
  async ({ page }) => {
    await records(page);
    const shown = () => page.evaluate(() => {
      const read = (bar: Element | null | undefined) =>
        [...(bar?.shadowRoot?.querySelectorAll('.chips > .chip:not([data-panelled])') ?? [])]
          .map((c) => (c as HTMLElement).dataset['id']);
      return {
        header: read(document.querySelector('sherpa-app-shell > sherpa-app-header')
          ?.querySelector('sherpa-quick-filter-toolbar')),
        data: read(document.querySelector('#context-root sherpa-quick-filter-toolbar')),
      };
    });

    const before = await shown();
    await openPanel(page);
    const after = await shown();

    // The header keeps the three exceptions, plus the date the panel cannot draw.
    expect(after.header).toEqual(['view', 'customer', 'region', 'dateRange']);
    /* Its four value fields moved; the three TOGGLES stay — they answer yes or
       no and have no values for the panel to draw. (Group and Sort are in the
       bar's own organise run, not `.chips`.) */
    expect(after.data).toEqual(['has-tickets', 'at-risk', 'unassigned']);
    expect(before.data).toContain('status');

    // Closing gives every chip back.
    await page.evaluate(() => {
      document.querySelector('#filter-panel')!.querySelector('sherpa-container-header')!
        .dispatchEvent(new CustomEvent('header-dismiss', { bubbles: true }));
    });
    await page.waitForTimeout(400);
    expect((await shown()).data).toEqual(before.data);
  });

/**
 * ONE FOOTER, FOR EVERY FIELD AT ONCE.
 *
 * Apply commits the whole panel; Discard reverts to the last Apply — which is
 * why it is not called Cancel.
 */
test('Apply commits every field; Discard reverts to the last Apply', async ({ page }) => {
  await records(page);
  await openPanel(page);

  const r = await page.evaluate(async () => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const wait = (ms = 500) => new Promise((res) => { setTimeout(res, ms); });
    const pages = () => {
      const p = document.querySelector('#context-root sherpa-pagination') as
        (HTMLElement & { shadowRoot: ShadowRoot }) | null;
      return (p?.shadowRoot?.textContent ?? '').match(/of (\d+)/)?.[1] ?? '?';
    };
    const chip = (field: string, value: string) => panel.querySelector(
      `.panel-field[data-field="${field}"] .panel-value[data-value="${value}"]`) as HTMLElement;
    const on = (field: string) => [...panel.querySelectorAll(
      `.panel-field[data-field="${field}"] .panel-value[data-current]`)]
      .map((c) => (c as HTMLElement).dataset['value']).sort();
    const press = (sel: string) => panel.querySelector(sel)!
      .dispatchEvent(new CustomEvent('button-click', { bubbles: true, composed: true }));

    // A DRAFT: two fields ticked, nothing applied.
    chip('status', 'active').setAttribute('data-current', '');
    chip('tier', 'Gold').setAttribute('data-current', '');
    await wait(200);
    const drafted = pages();

    press('.panel-apply');
    await wait(800);
    const applied = { pages: pages(), status: on('status'), tier: on('tier') };

    // Change again, then DISCARD.
    chip('status', 'active').removeAttribute('data-current');
    chip('status', 'churned').setAttribute('data-current', '');
    await wait(200);
    press('.panel-discard');
    await wait(400);

    return { drafted, applied, discarded: { pages: pages(), status: on('status') } };
  });

  // NOTHING applies until Apply, however many fields were touched.
  expect(r.drafted).toBe('4');
  // BOTH fields, in one commit.
  expect(r.applied.status).toEqual(['active']);
  expect(r.applied.tier).toEqual(['Gold']);
  expect(Number(r.applied.pages)).toBeLessThan(4);
  // Back to what Apply left, not to empty.
  expect(r.discarded.status).toEqual(['active']);
  expect(r.discarded.pages).toBe(r.applied.pages);
});

/**
 * ONE SEARCH, ACROSS EVERY VALUE IN THE PANEL.
 *
 * It hides value CHIPS, never field labels: a reader searching "gold" still
 * needs to see that Gold is a Tier.
 */
test('the search matches values across every field, and keeps the labels',
  async ({ page }) => {
    await records(page);
    await openPanel(page);

    const r = await page.evaluate(async () => {
      const panel = document.querySelector('#filter-panel') as HTMLElement;
      const search = panel.querySelector('.panel-search') as HTMLElement & { value: string };
      search.value = 'gold';
      search.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
      await new Promise((res) => { setTimeout(res, 300); });

      return {
        shown: [...panel.querySelectorAll('.panel-value')]
          .filter((c) => !c.hasAttribute('data-filtered-out'))
          .map((c) => (c as HTMLElement).dataset['value']),
        // Every field still names itself.
        labels: panel.querySelectorAll('sherpa-section-header').length,
        // A field the search emptied says so.
        empty: [...panel.querySelectorAll('.panel-field[data-no-matches]')]
          .map((f) => (f as HTMLElement).dataset['field']),
      };
    });

    expect(r.shown).toEqual(['Gold']);
    expect(r.labels).toBe(4);
    expect(r.empty).toEqual(['status', 'plan', 'owner']);
  });

/**
 * BELOW DESKTOP, FILTERING GOES BACK TO THE TOOLBARS.
 * TRAP T-the-panel-is-desktop-only
 */
test('a narrow window refuses the panel, and shuts an open one', async ({ page }) => {
  await records(page);
  await openPanel(page);
  expect(await page.evaluate(() =>
    !document.querySelector('#filter-panel')!.hasAttribute('hidden'))).toBe(true);

  await page.setViewportSize({ width: 1024, height: 900 });
  await page.waitForTimeout(500);

  const narrow = await page.evaluate(async () => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const bar = document.querySelector('#context-root sherpa-quick-filter-toolbar') as
      HTMLElement & { shadowRoot: ShadowRoot };
    const shut = {
      hidden: panel.hasAttribute('hidden'),
      // Every chip is back on its bar, so the toolbars still work.
      panelled: bar.shadowRoot.querySelectorAll('.chips > .chip[data-panelled]').length,
    };
    bar.dispatchEvent(new CustomEvent('filter-configure', { bubbles: true, composed: true }));
    await new Promise((res) => { setTimeout(res, 400); });
    return { shut, afterAsk: panel.hasAttribute('hidden') };
  });

  expect(narrow.shut).toEqual({ hidden: true, panelled: 0 });
  expect(narrow.afterAsk).toBe(true);
});
