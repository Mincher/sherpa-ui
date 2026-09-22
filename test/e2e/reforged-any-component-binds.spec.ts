import { test, expect } from './harness';

/**
 * ANY COMPONENT CAN BE BOUND TO A DATA SOURCE.
 *
 * `bind()` never checked a type — a plain button could always steer a query.
 * But only 23 of 58 components overrode `renderData`, so the other 35 took a
 * payload and drew nothing: the ASK half was generic and the SHOW half was not.
 *
 * The base class now has a default data path that writes a payload's keys onto
 * the attributes a component DECLARES. A tag showing one count is as
 * legitimate a reader of app data as a grid showing a thousand rows.
 *
 * TRAP T-any-component-can-be-bound
 */

/** Build an element, wait for its first render, hand it back. */
const MAKE = `async function make(tag) {
  const el = document.createElement(tag);
  document.getElementById('root').append(el);
  await customElements.whenDefined(tag);
  await el.__settled?.();
  return el;
}`;

test.beforeEach(async ({ page }) => {
  await page.addInitScript(`window.make = ${MAKE.slice(MAKE.indexOf('async'))}`);
  await page.goto('/test/reforged/harness.html');
});

test('a component with NO renderData still shows bound data', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { DataSource, ArrayStore } = await import('/dist/index.js');
    const rows = Array.from({ length: 40 }, (_, i) => ({ id: i }));
    const src = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });

    // Neither of these overrides renderData, and neither knows a data layer
    // exists. Both declare the attributes below as `kind: 'content'`.
    const header = await (window as never as { make: (t: string) => Promise<HTMLElement> })
      .make('sherpa-section-header');
    const empty = await (window as never as { make: (t: string) => Promise<HTMLElement> })
      .make('sherpa-empty-state');

    src.bind(header, {
      readonly: true, scope: 'all',
      as: (rs: unknown[]) => ({ heading: `${rs.length} records` }),
    });
    src.bind(empty, {
      readonly: true, scope: 'all',
      as: (rs: unknown[]) => ({ heading: 'Nothing here', description: `searched ${rs.length}` }),
    });

    await src.load({ force: true });
    await new Promise((res) => setTimeout(res, 300));

    const text = (el: HTMLElement) =>
      (el.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();
    return {
      header: text(header),
      empty: text(empty),
      // The payload went through the DECLARED attributes, not around them.
      headerAttr: header.getAttribute('data-heading'),
    };
  });

  expect(r.header).toContain('40 records');
  expect(r.empty).toContain('Nothing here');
  expect(r.empty).toContain('searched 40');
  expect(r.headerAttr).toBe('40 records');
});

test('an UNDECLARED key is ignored, so a payload cannot spray attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { DataSource, ArrayStore } = await import('/dist/index.js');
    const src = new DataSource({ store: new ArrayStore([{ id: 1 }], { key: 'id' }) });
    const header = await (window as never as { make: (t: string) => Promise<HTMLElement> })
      .make('sherpa-section-header');

    /* A payload shaped for a GRID, handed to a header. Only what the header
       declares may land — otherwise one adapter's keys become another
       component's attributes. */
    src.bind(header, {
      readonly: true, scope: 'all',
      as: () => ({ heading: 'kept', totalPages: 999, columns: [], bogus: 'no' }),
    });
    await src.load({ force: true });
    await new Promise((res) => setTimeout(res, 250));

    return {
      kept: header.getAttribute('data-heading'),
      totalPages: header.getAttribute('data-total-pages'),
      bogus: header.getAttribute('data-bogus'),
      columns: header.getAttribute('data-columns'),
    };
  });

  expect(r.kept).toBe('kept');
  expect(r.totalPages).toBeNull();
  expect(r.bogus).toBeNull();
  expect(r.columns).toBeNull();
});

test('a component with its OWN renderData is untouched', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { DataSource, ArrayStore } = await import('/dist/index.js');
    const rows = [{ id: 1, tier: 'Gold' }, { id: 2, tier: 'Silver' }];
    const src = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });

    // sherpa-metric overrides renderData and takes { label, value }. The
    // default path must not run instead of it.
    const metric = await (window as never as { make: (t: string) => Promise<HTMLElement> })
      .make('sherpa-metric');
    src.bind(metric, {
      readonly: true, scope: 'all',
      as: (rs: unknown[]) => ({ label: 'Records', value: rs.length }),
    });
    await src.load({ force: true });
    await new Promise((res) => setTimeout(res, 300));

    return (metric.shadowRoot?.textContent ?? '').replace(/\s+/g, ' ').trim();
  });

  expect(r).toContain('Records');
  expect(r).toContain('2');
});

test('ASKING was always generic: a plain button steers the query', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { DataSource, ArrayStore } = await import('/dist/index.js');
    const rows = Array.from({ length: 10 }, (_, i) => ({ id: i, tier: i % 2 ? 'Gold' : 'Silver' }));
    const src = new DataSource({ store: new ArrayStore(rows, { key: 'id' }) });

    const button = await (window as never as { make: (t: string) => Promise<HTMLElement> })
      .make('sherpa-button');
    src.bind(button);

    // A button is in no allow-list. It sends a steering event like anything else.
    button.dispatchEvent(new CustomEvent('sort-change', {
      bubbles: true, composed: true, detail: { field: 'tier', direction: 'desc' },
    }));
    await new Promise((res) => setTimeout(res, 250));

    return {
      sort: JSON.stringify(src.state.sort),
      // A two-way bind LOCKS, so the button reports and never writes its own.
      locked: button.hasAttribute('data-locked'),
      // …and the state comes back down as attributes.
      field: button.getAttribute('data-sort-field'),
      direction: button.getAttribute('data-sort-direction'),
    };
  });

  expect(r.sort).toBe('[{"field":"tier","direction":"desc"}]');
  expect(r.locked).toBe(true);
  expect(r.field).toBe('tier');
  expect(r.direction).toBe('desc');
});
