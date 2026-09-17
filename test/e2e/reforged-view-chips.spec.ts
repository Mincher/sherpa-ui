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

/**
 * TWO VIEWS, ONE STORE — plan step S3.
 *
 * The dashboard's customer summary and the Records grid read the SAME
 * `customerStore`. Adding a customer on Records changes the numbers on the
 * dashboard, because there is only one set of records and both views are
 * looking at it.
 *
 * This is the thing a per-view store cannot do at all. Before S1 the store was
 * built inside `records.js`'s `init()`, so the dashboard could not have shared
 * it even in principle — and the summary was six hardcoded strings that no
 * change could touch.
 *
 * Runs against the EXAMPLES server (:4200); `npm run serve:examples` must be up.
 */
test('a record added on one view changes the summary on another', async ({ page }) => {
  const nav = async (view: string) => {
    // The ROUTER'S path — pushState, no reload. Setting window.location is a
    // full reload and would wipe the store by design, proving nothing.
    await page.evaluate((v) => {
      const n = document.querySelector('sherpa-nav')!;
      (n.shadowRoot!.querySelector(`[data-href="?view=${v}"]`) as HTMLElement)?.click();
    }, view);
    await page.waitForTimeout(1200);
  };

  await page.goto('http://localhost:4200/?view=dashboard');
  await page.waitForFunction(() => {
    const el = document.querySelector('#kv');
    return (el?.shadowRoot?.textContent ?? '').includes('Customers');
  }, undefined, { timeout: 15000 });

  const summary = () => page.evaluate(() => {
    const text = (document.querySelector('#kv')?.shadowRoot?.textContent ?? '')
      .replace(/\s+/g, ' ').trim();
    const read = (label: string) => {
      const m = new RegExp(`${label} ([\\d,]+)`).exec(text);
      return m ? Number(m[1]!.replace(/,/g, '')) : null;
    };
    return { customers: read('Customers'), trials: read('Trials'), seats: read('Seats sold') };
  });

  const before = await summary();

  // Add one on RECORDS, through the view's own dialog.
  await nav('records');
  await page.waitForFunction(() => {
    const g = document.querySelector('sherpa-data-grid');
    return (g?.shadowRoot?.querySelectorAll('tbody tr').length ?? 0) > 0;
  }, undefined, { timeout: 15000 });
  await page.evaluate(async () => {
    const root = document.querySelector('sherpa-app-shell')!;
    (root.querySelector('#add-btn') as HTMLElement)?.dispatchEvent(
      new CustomEvent('button-click', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 200));
    const name = root.querySelector('#f-name') as HTMLElement & { value?: string };
    if (name) name.value = 'Probe Person';
    (root.querySelector('#save-btn') as HTMLElement)?.dispatchEvent(
      new CustomEvent('button-click', { bubbles: true, composed: true }));
    await new Promise((r) => setTimeout(r, 400));
  });

  await nav('dashboard');
  const after = await summary();

  expect(before.customers, 'the summary reads the store, not a constant').toBeGreaterThan(0);
  expect(after.customers).toBe(before.customers! + 1);
  // The new customer is a TRIAL on the Free plan, so two figures move — which
  // shows the summary is DERIVED from the rows rather than a count nudged by one.
  expect(after.trials).toBe(before.trials! + 1);
  expect(after.seats).toBe(before.seats! + 1);
});

/**
 * THE SCHEMA IS ON THE STORE, so every way in is guarded.
 *
 * A form is not the only way a record arrives: the Add dialog, a paste, a REST
 * response and a script all reach the same records. A rule enforced in one
 * screen is not a rule — so it sits on the store, where nothing gets past it.
 *
 * The example carried no schema at all until 2026-09-17, which meant the whole
 * validation half of the data layer (steps V1-V8) was built, tested and
 * demonstrated nowhere.
 */
test('the records store refuses a record its schema rejects', async ({ page }) => {
  await page.goto('http://localhost:4200/?view=records');
  await page.waitForFunction(() => {
    const g = document.querySelector('sherpa-data-grid');
    return (g?.shadowRoot?.querySelectorAll('tbody tr').length ?? 0) > 0;
  }, undefined, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    const { customerStore } = await import('/examples/views/records-data.js');
    const before = (await customerStore.load()).total;

    // NO EMAIL — and email is the KEY, so a blank one would collide with the
    // next blank one. The store is what stops it.
    let refused: string | null = null;
    try {
      await customerStore.insert({ name: 'No Email', email: '', seats: 1 });
    } catch (e) { refused = String(e); }
    const afterBad = (await customerStore.load()).total;

    // A GOOD row still goes in, so the guard is a rule and not a wall.
    await customerStore.insert({
      name: 'Fine Person', email: `ok-${Date.now()}@example.com`, seats: 2, health: 50,
    });
    const afterGood = (await customerStore.load()).total;

    return { before, afterBad, afterGood, refused };
  });

  expect(r.afterBad, 'the bad row never landed').toBe(r.before);
  expect(r.refused, 'and it said which field and why').toContain('email');
  expect(r.afterGood).toBe(r.before! + 1);
});
