import { test, expect } from '@playwright/test';

/**
 * A saved VIEW DEFINITION must set the filter BAR, not only the data.
 *
 * The bug this guards: picking "EMEA operations" narrowed every chart to EMEA
 * while the header's Region chip stayed off and blank. The bar then claims
 * nothing is filtered while the charts disagree — and a filter nobody can see
 * is a filter nobody can undo.
 *
 * It is really a PARITY test. The chips were unreachable from code: the chip
 * had no `values` at all, the toolbar had a getter and no setter, and the app
 * header had neither. A definition could not say what it meant.
 *
 * This runs against the EXAMPLES server (:4200), not the sandbox: the views
 * are express templates, and the dashboard's saved views are the thing on
 * trial. `npm run serve:examples` must be up.
 */
const APP = 'http://localhost:4200/#/dashboard';

/** Every header chip, as a reader sees it. The chips live in a shadow root. */
async function readChips(page: import('@playwright/test').Page) {
  return page.evaluate(() => {
    const bar = document.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    return [...(bar?.shadowRoot?.querySelectorAll('.chips > .chip') ?? [])].map((c) => ({
      id: (c as HTMLElement).dataset['id'] ?? '',
      on: c.hasAttribute('data-current'),
      text: (c.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim(),
    }));
  });
}

test.describe('view definitions set the filter bar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(APP);
    await page.waitForFunction(() => {
      const bar = document.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
      return (bar?.shadowRoot?.querySelectorAll('.chips > .chip').length ?? 0) >= 4;
    });
  });

  test('picking a view lights the chips it filters by', async ({ page }) => {
    const before = await readChips(page);
    expect(before.find((c) => c.id === 'region')?.on, 'Region starts off').toBe(false);

    await page.evaluate(() => {
      document.querySelector('sherpa-app-shell sherpa-app-header')!
        .dispatchEvent(new CustomEvent('quick-filter-change', {
          bubbles: true, composed: true, detail: { values: { view: ['emea'] } },
        }));
    });
    await page.waitForTimeout(200);

    const after = await readChips(page);
    const region = after.find((c) => c.id === 'region');
    expect(region?.on, 'Region lights up').toBe(true);
    // ON IS NOT ENOUGH. A lit chip reading only its field name says a filter
    // exists without saying what it is. The first fix passed an on/off check
    // and still left the chip blank.
    expect(region?.text, 'and NAMES the value').toContain('EMEA');
    // The view chip renames itself to the view it is in.
    expect(after.find((c) => c.id === 'view')?.text).toContain('EMEA operations');
  });

  test('switching away clears the chips the old view set', async ({ page }) => {
    const pick = (v: string) => page.evaluate((view) => {
      document.querySelector('sherpa-app-shell sherpa-app-header')!
        .dispatchEvent(new CustomEvent('quick-filter-change', {
          bubbles: true, composed: true, detail: { values: { view: [view] } },
        }));
    }, v);

    await pick('emea');
    await page.waitForTimeout(200);
    expect((await readChips(page)).find((c) => c.id === 'region')?.on).toBe(true);

    // A view is a WHOLE statement about the bar, not a patch on the one before
    // it. Leaving Region lit here would carry EMEA into a view that never asked
    // for it — the bar would then describe two views at once.
    await pick('fleet');
    await page.waitForTimeout(200);
    const after = await readChips(page);
    expect(after.find((c) => c.id === 'region')?.on, 'Region goes off again').toBe(false);
    expect(after.find((c) => c.id === 'view')?.text).toContain('Fleet overview');
  });

  test('the header exposes the bar, so a caller never reaches past it', async ({ page }) => {
    // PARITY, directly: set the chips through the header's own API.
    const got = await page.evaluate(() => {
      const header = document.querySelector('sherpa-app-shell sherpa-app-header') as
        HTMLElement & { values: Record<string, readonly string[]> };
      header.values = { region: ['apac'], customer: ['contoso', 'fabrikam'] };
      return header.values;
    });
    expect(got['region']).toEqual(['apac']);
    expect(got['customer']).toEqual(['contoso', 'fabrikam']);

    const chips = await readChips(page);
    expect(chips.find((c) => c.id === 'region')?.text).toContain('APAC');
    // TWO picks show a count, not a name — so assert the chip is on and
    // carries its field, not a value it was never going to print.
    expect(chips.find((c) => c.id === 'customer')?.on).toBe(true);
  });
});
