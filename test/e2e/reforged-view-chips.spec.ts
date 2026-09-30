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
 * This runs against the EXAMPLES server (:4200), not the sandbox: the Contexts
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
      // View, Customer and Region: the alerts have no time, so no Date chip.
      return (bar?.shadowRoot?.querySelectorAll('.chips > .chip').length ?? 0) >= 3;
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
      /* The values the DATA carries — a chip's options are a fact about the
         records, so a value naming no row never lands. These were lowercase
         here while both datasets held uppercase names, which is exactly the
         drift T-a-chip-filters-the-values-the-data-has is about. */
      header.values = { region: ['APAC'], customer: ['Contoso', 'Fabrikam'] };
      return header.values;
    });
    expect(got['region']).toEqual(['APAC']);
    expect(got['customer']).toEqual(['Contoso', 'Fabrikam']);

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
test('a record added on one Context changes the summary on another', async ({ page }) => {
  const nav = async (context: string) => {
    // The ROUTER'S path — the row's own link, no reload. Setting window.location
    // is a full reload and would wipe the store by design, proving nothing.
    await page.evaluate((v) => {
      const n = document.querySelector('sherpa-nav')!;
      (n.shadowRoot!.querySelector(`[data-href="?context=${v}"]`)!.shadowRoot!.querySelector('a[href]') as HTMLElement).click();
    }, context);
    await page.waitForTimeout(1200);
  };

  await page.goto('http://localhost:4200/?context=dashboard');
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
    // Every required field, as a reader must: nothing is filled in for them. TODO 61
    const email = root.querySelector('#f-email') as HTMLElement & { value?: string };
    if (email) email.value = `probe.${Date.now()}@example.com`;
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
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() => {
    const g = document.querySelector('sherpa-data-grid');
    return (g?.shadowRoot?.querySelectorAll('tbody tr').length ?? 0) > 0;
  }, undefined, { timeout: 15000 });

  const r = await page.evaluate(async () => {
    /* `/contexts/…`, the url the CONTEXT imports. The server serves this file at two
       urls and a browser keys its module registry on the url, so
       `/examples/contexts/…` is a SECOND instance with its own store — this test
       passed against a store the app never held.
       TRAP T-two-urls-are-two-modules. */
    const { customerStore } = await import('/contexts/records-data.js');
    const before = (await customerStore.load()).total;

    // NO EMAIL — and email is the KEY, so a blank one would collide with the
    // next blank one. The store is what stops it.
    let refused: string | null = null;
    try {
      await customerStore.insert({ name: 'No Email', email: '', seats: 1 });
    } catch (e) { refused = String(e); }
    const afterBad = (await customerStore.load()).total;

    /* A GOOD row still goes in, so the guard is a rule and not a wall.
       `customer` is REQUIRED — every record belongs to an organisation, or the
       Customer chip can never find it.
       TRAP T-a-chip-filters-the-values-the-data-has */
    await customerStore.insert({
      name: 'Fine Person', email: `ok-${Date.now()}@example.com`,
      customer: 'Northwind', seats: 2, health: 50,
    });
    const afterGood = (await customerStore.load()).total;

    // NO CUSTOMER. The Add dialog had no such field until 2026-09-22, so a
    // record saved with none was invisible to the Customer chip for ever.
    let noOrg: string | null = null;
    try {
      await customerStore.insert({ name: 'No Org', email: `org-${Date.now()}@example.com` });
    } catch (e) { noOrg = String(e); }
    const afterNoOrg = (await customerStore.load()).total;

    return { before, afterBad, afterGood, refused, noOrg, afterNoOrg };
  });

  expect(r.afterBad, 'the bad row never landed').toBe(r.before);
  expect(r.refused, 'and it said which field and why').toContain('email');
  expect(r.afterGood).toBe(r.before! + 1);
  expect(r.noOrg, 'a record with no organisation is refused').toContain('customer');
  expect(r.afterNoOrg, 'and it never landed').toBe(r.afterGood);
});

/**
 * DELETE ASKS FIRST, AND SAYS WHEN IT FAILS.
 *
 * Two halves of one flow, and the second is the one that rots quietly: a
 * mutation that throws into a `void` call removes nothing, says nothing, and
 * leaves the row on screen looking like a rendering bug.
 *
 * TRAP T-a-failed-mutation-must-reach-the-reader.
 */
test('delete asks before it deletes, and reports a refusal', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() => {
    const g = document.querySelector('sherpa-data-grid');
    return (g?.shadowRoot?.querySelectorAll('.row').length ?? 0) > 0;
  }, undefined, { timeout: 15000 });

  const settle = () => page.waitForTimeout(600);

  const tickTwo = () => page.evaluate(() => {
    const g = document.querySelector('sherpa-data-grid')!;
    // The CONTROL inside each box — TRAP T-a-test-must-click-what-the-listener-is-on.
    [0, 1].forEach((i) => (g.shadowRoot!.querySelectorAll('.row')[i]!
      .querySelector('.row-multi') as HTMLElement & { shadowRoot: ShadowRoot })
      .shadowRoot.querySelector<HTMLElement>('.control')!.click());
  });

  const clickBulkDelete = () => page.evaluate(() => {
    const btn = [...document.querySelectorAll('#bulk-actions sherpa-button')]
      .find((x) => /delete/i.test(x.textContent ?? '')) as HTMLElement & { shadowRoot: ShadowRoot };
    (btn.shadowRoot.querySelector<HTMLElement>('.trigger') ?? btn).click();
  });

  const clickConfirm = (id: string) => page.evaluate((sel) => {
    const btn = document.querySelector(sel) as HTMLElement & { shadowRoot: ShadowRoot };
    (btn.shadowRoot.querySelector<HTMLElement>('.trigger') ?? btn).click();
  }, id);

  const firstNames = () => page.evaluate(() =>
    [...document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.row')]
      .slice(0, 2).map((r) => r.querySelector('.cell')!.textContent!.trim()));

  /* ── 1. It ASKS, and CANCEL deletes nothing ─────────────────────────── */
  /* READ the names, never assume them. This store is an `IdbStore`, so it
     PERSISTS across page loads and across test runs — a test that hardcoded
     "Aisha Cohen" passed once and then failed forever, because an earlier run
     had really deleted her. TRAP T-the-records-store-persists-between-runs. */
  const before = await firstNames();
  await tickTwo();
  await settle();
  await clickBulkDelete();
  await settle();

  const asked = await page.evaluate(() => {
    const c = document.querySelector('#confirm') as HTMLElement;
    return {
      open: c.hasAttribute('open'),
      status: c.dataset['status'],
      heading: c.dataset['heading'],
      text: document.querySelector('#confirm-text')!.textContent ?? '',
    };
  });
  expect(asked.open, 'the confirm dialog opened').toBe(true);
  // CRITICAL, because this destroys data — the status cascade paints the card.
  expect(asked.status).toBe('critical');
  // COUNTED when there are several, so the reader knows the scale of it.
  expect(asked.heading).toBe('Delete 2 customers?');
  expect(asked.text).toContain('cannot be undone');

  await clickConfirm('#confirm-cancel');
  await settle();
  expect(await firstNames(), 'Cancel deleted nothing').toEqual(before);

  /* ── 2. A REFUSED delete says so, and keeps the rows ────────────────── */
  await page.evaluate(async () => {
    /* `/contexts/…`, NOT `/examples/contexts/…`. The server maps the same file to
       BOTH urls, and a browser keys its module registry on the url — so the
       two are two separate module instances with two separate stores. The Context
       imports `./records-data.js` from `/contexts/records.js`, so this is the copy
       it actually holds; patching the other one refused a delete nothing ever
       called. TRAP T-two-urls-are-two-modules. */
    const mod = await import('/contexts/records-data.js');
    const store = mod.customerStore as { remove: (k: unknown) => Promise<void> };
    store.remove = async () => { throw new Error('Network unreachable'); };
  });

  await clickBulkDelete();
  await settle();
  await clickConfirm('#confirm-delete');
  await page.waitForTimeout(1200);

  const failed = await page.evaluate(() => {
    const toast = [...document.querySelectorAll('sherpa-toast')].pop() as
      (HTMLElement & { shadowRoot: ShadowRoot }) | undefined;
    return {
      names: [...document.querySelector('sherpa-data-grid')!.shadowRoot!.querySelectorAll('.row')]
        .slice(0, 2).map((r) => r.querySelector('.cell')!.textContent!.trim()),
      toastStatus: toast?.dataset['status'] ?? null,
      toastText: (toast?.shadowRoot.textContent ?? '').replace(/\s+/g, ' ').trim(),
      stillSelected: (document.querySelector('sherpa-data-grid') as
        HTMLElement & { selectedKeys: string[] }).selectedKeys.length,
    };
  });

  // NOTHING VANISHED. A row that did not delete stays, which is the honest
  // outcome — the screen is never updated by hand.
  expect(failed.names, 'a refused delete removes nothing').toEqual(before);
  expect(failed.toastStatus, 'and says so, critically').toBe('critical');
  // THE REASON, not just "something went wrong".
  expect(failed.toastText).toContain('Network unreachable');
  // STILL TICKED, so the reader can try again without re-picking.
  expect(failed.stillSelected).toBe(2);
});

/**
 * A VIEW CHANGE RESETS THE HEADER CHIPS the new view does not set. Region
 * stayed LIT on "My accounts" while `setState` had dropped its part — a chip
 * that says it filters and does not. Will, 2026-09-24: header filters do not
 * carry over between views. TRAP T-a-view-change-resets-the-header-chips
 */
test('a view change resets a header chip the new view does not set', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  const steer = (id: string, values: string[]) => page.evaluate(([i, v]) => {
    const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]') as
      HTMLElement & { setChipValues(id: string, v: string[]): void; report(): void };
    bar.setChipValues(i as string, v as string[]);
    bar.report();
  }, [id, values] as const);
  const read = () => page.evaluate(() => ({
    total: (window as unknown as { sherpa: { source: { debugState(): { total: number } } } })
      .sherpa.source.debugState().total,
    region: document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]')!
      .shadowRoot!.querySelector('.chip[data-id="region"]')!.hasAttribute('data-current'),
  }));

  await steer('region', ['EMEA']);
  await expect.poll(read).toEqual({ total: 27, region: true });
  await steer('view', ['mine']);
  // All of Ravi's accounts — the view's own filter, and nothing the chip claims.
  await expect.poll(read).toEqual({ total: 12, region: false });
});

/**
 * A VIEW'S OWN COLUMN CONDITION HOLDS. At risk sets `status ne churned` on the
 * grid; the view's reset emptied Status a moment later and wiped the condition
 * — 20 rows where 13 are at risk. It is Status's own chip that shows it, as a
 * condition (Will, 2026-09-27: a heading filter wears the field's NORMAL chip),
 * and All turns it off. TRAP T-an-empty-selection-never-wipes-a-condition
 */
test('At risk keeps its own column condition on the Status chip, and All clears it', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot
      ?.querySelector('.row, [role="row"]'));
  const pick = (id: string) => page.evaluate((v) => {
    const bar = document.querySelector('sherpa-app-shell > sherpa-app-header sherpa-quick-filter-toolbar[slot="filters"]') as
      HTMLElement & { setChipValues(id: string, v: string[]): void; report(): void };
    bar.setChipValues('view', [v]);
    bar.report();
  }, id);
  const read = () => page.evaluate(() => {
    const grid = document.querySelector('#context-root sherpa-data-grid') as HTMLElement & {
      columnClause(f: string): unknown };
    const chip = document.querySelector('#context-root sherpa-quick-filter-toolbar')!.shadowRoot!
      .querySelector<HTMLElement>('.chip[data-id="status"]')!;
    return {
      total: (window as unknown as { sherpa: { source: { debugState(): { total: number } } } })
        .sherpa.source.debugState().total,
      clause: grid.columnClause('status'),
      chip: `${chip.hasAttribute('data-current') ? 'on' : 'off'}:${chip.dataset['condition'] ?? ''}`,
    };
  });

  await pick('risk');
  await expect.poll(read).toEqual({ total: 13, clause: ['status', 'ne', 'churned'], chip: 'on:advanced' });
  await pick('all');
  await expect.poll(read).toEqual({ total: 100, clause: null, chip: 'off:' });
});

/**
 * A HEADING FILTER WEARS ITS FIELD'S NORMAL CHIP — the one Add offers — so the
 * bar says what the rows are under (Will, 2026-09-27). One reading in the
 * Query, two views of it: it survives a reload in both, and REMOVING the chip
 * clears the heading and the rows. That removal used to move the answer to
 * the View, where it kept filtering with no chip. TRAP T-one-query-one-owner
 */
test('a heading filter adds its normal chip; a reload keeps both; Remove clears both', async ({ page }) => {
  const loaded = () => page.waitForFunction(() =>
    (window as unknown as { sherpa?: { source?: { debugState(): { loaded: boolean } } } })
      .sherpa?.source?.debugState().loaded);
  const read = () => page.evaluate(() => {
    const grid = document.querySelector('#context-root sherpa-data-grid') as HTMLElement & {
      columnClause(f: string): unknown };
    const chip = document.querySelector('#context-root sherpa-quick-filter-toolbar')?.shadowRoot
      ?.querySelector<HTMLElement>('.chip[data-id="email"]');
    return {
      total: (window as unknown as { sherpa?: { source?: { debugState(): { total: number } } } })
        .sherpa?.source?.debugState().total,
      heading: grid?.columnClause('email') ?? null,
      chip: chip ? `${chip.hasAttribute('data-current') ? 'on' : 'off'}:${chip.dataset['condition'] ?? ''}` : 'none',
    };
  });
  await page.goto('http://localhost:4200/?context=records');
  await loaded();
  await page.evaluate(() => {
    const grid = document.querySelector('#context-root sherpa-data-grid') as HTMLElement & {
      setColumnFilter(f: string, c: unknown[]): void };
    grid.setColumnFilter('email', ['email', 'contains', 'an']);
    // The commit the heading's own menu sends.
    grid.shadowRoot!.querySelector('.head-cell[data-field="email"] .head-filter')!
      .dispatchEvent(new CustomEvent('menu-apply', { bubbles: true, composed: true, detail: {} }));
  });
  const on = { total: 18, heading: ['email', 'contains', 'an'], chip: 'on:advanced' };
  await expect.poll(read).toEqual(on);
  await page.reload();
  await loaded();
  await expect.poll(read).toEqual(on);
  await page.evaluate(() => (document.querySelector('#context-root sherpa-quick-filter-toolbar') as
    HTMLElement & { removeFilter(id: string): void }).removeFilter('email'));
  await expect.poll(read).toEqual({ total: 100, heading: null, chip: 'none' });
});
