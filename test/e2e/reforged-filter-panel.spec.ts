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

  // PRESETS lead the scope: the toggles, which have no field behind them.
  expect(r.fields).toEqual(['presets:data', 'status', 'plan', 'tier', 'owner']);
  expect(r.header).toBe('Status');
  expect(r.values).toEqual(['active', 'churned', 'suspended', 'trial']);

  /* HUG, not stretch: a chip is its own width. `data-wrap` alone gives every
     item `flex: 1 1 200px`, which put one chip per line. */
  expect(r.widths).toBeGreaterThan(1);
  expect(r.lines).toBeLessThan(4);

  expect(r.searches).toBe(1);
  expect(r.applies).toBe(1);
  /* One per SCOPE. `view` is drawn even with nothing in it — its three chips
     are the ones that stay on the header, and an absent scope reads as a bug
     rather than as an answer. TRAP T-the-view-chip-stays-on-the-header */
  expect(r.accordions).toBe(2);
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
        labels: panel.querySelectorAll('.panel-field sherpa-section-header').length,
        // A field the search emptied says so.
        empty: [...panel.querySelectorAll('.panel-field[data-no-matches]')]
          .map((f) => (f as HTMLElement).dataset['field']),
      };
    });

    expect(r.shown).toEqual(['Gold']);
    // Every field still names itself: Presets, and the four value fields.
    expect(r.labels).toBe(5);
    /* A PRESET is searchable by its own label too, so the Presets section
       empties like any other. TRAP T-a-chip-with-no-field-is-a-preset */
    expect(r.empty).toEqual(['presets:data', 'status', 'plan', 'owner']);
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

/**
 * A SCOPE IS NAMED FOR ITS CONTENT.
 *
 * "Customer records", not "This context" — a reader with two grids on one page
 * has to know which one a section answers for, and "this context" answers for
 * neither. TRAP T-a-scope-is-named-for-its-content
 *
 * And a chip with NO MENU is a PRESET: one question the data answers yes or
 * no, with no field behind it. They lead the scope, in one section.
 * TRAP T-a-chip-with-no-field-is-a-preset
 */
test('scopes are named, and field-less chips lead as Presets', async ({ page }) => {
  await records(page);
  await openPanel(page);

  const r = await page.evaluate(() => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const presets = panel.querySelector('.panel-presets') as HTMLElement;
    return {
      headings: [...panel.querySelectorAll('sherpa-accordion')]
        .map((a) => a.getAttribute('data-heading')),
      // The Add button is the SCOPE's action, in the accordion's own header.
      adds: panel.querySelectorAll('sherpa-accordion > .panel-add[slot="actions"]').length,
      presetLabel: presets?.querySelector('sherpa-section-header')?.getAttribute('data-heading'),
      presetValues: [...(presets?.querySelectorAll('.panel-preset') ?? [])]
        .map((c) => (c as HTMLElement).dataset['value']),
      // PRESETS come FIRST in their scope.
      firstField: (panel.querySelector('.panel-field') as HTMLElement)?.dataset['field'],
      // A preset has no Clear or Remove: there is no field to act on.
      presetActions: presets?.querySelectorAll('.panel-clear, .panel-remove').length,
    };
  });

  expect(r.headings).toEqual(['View filters', 'Customer records']);
  expect(r.adds).toBe(2);
  expect(r.presetLabel).toBe('Presets');
  expect(r.presetValues).toEqual(['has-tickets', 'at-risk', 'unassigned']);
  expect(r.firstField).toBe('presets:data');
  expect(r.presetActions).toBe(0);
});

/**
 * CONDITION MODE REPLACES THE VALUE CHIPS.
 *
 * The button sits in the field's own header, beside Clear and Remove, and the
 * rows it shows are the MENU's — the panel borrows them rather than building a
 * second set. TRAP T-conditions-are-opt-in-per-field
 */
test('the condition button swaps a field between chips and rows', async ({ page }) => {
  await records(page);
  await openPanel(page);

  const r = await page.evaluate(async () => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const wait = (ms = 500) => new Promise((res) => { setTimeout(res, ms); });
    const field = (id: string) => panel.querySelector(
      `.panel-field[data-field="${id}"]`) as HTMLElement;
    const read = (id: string) => ({
      open: field(id).hasAttribute('data-conditional-open'),
      chips: getComputedStyle(field(id).querySelector('.panel-values')!).display,
      rows: field(id).querySelectorAll('.condition-row').length,
    });
    const press = (id: string) => field(id).querySelector('.panel-conditional')!
      .dispatchEvent(new CustomEvent('click', { bubbles: true, composed: true }));

    /* OPT-IN: only a field that asked for conditions offers the button. Status
       is a closed set of four, so it never does. */
    const offered = ['status', 'plan', 'tier', 'owner']
      .filter((id) => !!field(id).querySelector('.panel-conditional'));

    const before = read('owner');
    press('owner');
    await wait();
    const on = read('owner');
    press('owner');
    await wait();

    return { offered, before, on, off: read('owner') };
  });

  expect(r.offered).toEqual(['owner']);
  // Chips at rest, no rows drawn.
  expect(r.before).toEqual({ open: false, chips: 'flex', rows: 0 });
  // The rows REPLACE them — two answers side by side is what this avoids.
  expect(r.on).toEqual({ open: true, chips: 'none', rows: 1 });
  // And back. Neither half is lost.
  expect(r.off).toEqual({ open: false, chips: 'flex', rows: 0 });
});

/**
 * THE ADD BUTTON GOES THROUGH THE BAR THAT OWNS THE LIST.
 * TRAP T-a-panel-adds-through-the-bar-that-owns-the-list
 */
test('adding from the panel consumes the bar\'s own offering', async ({ page }) => {
  await records(page);
  await openPanel(page);

  const r = await page.evaluate(async () => {
    const panel = document.querySelector('#filter-panel') as HTMLElement;
    const bar = document.querySelector('#context-root sherpa-quick-filter-toolbar') as
      HTMLElement & { offering?: { id: string }[] };
    const before = (bar.offering ?? []).map((f) => f.id);

    const add = [...panel.querySelectorAll('.panel-add')]
      .find((a) => (a as HTMLElement).dataset['scope'] === 'data')!;
    add.querySelector('sherpa-menu')!.dispatchEvent(new CustomEvent('menu-change', {
      bubbles: true, composed: true, detail: { values: [before[0]] },
    }));
    await new Promise((res) => { setTimeout(res, 900); });

    return {
      before,
      after: (bar.offering ?? []).map((f) => f.id),
      onBar: [...(bar as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot
        .querySelectorAll('.chips > .chip')].map((c) => (c as HTMLElement).dataset['id']),
    };
  });

  // The field LEFT the offering and joined the bar — one list, one owner.
  expect(r.after).toEqual(r.before.slice(1));
  expect(r.onBar).toContain(r.before[0]);
});
