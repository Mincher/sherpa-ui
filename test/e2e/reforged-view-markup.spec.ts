import { test, expect } from './harness';

/**
 * A saved view's content is MARKUP — parsed, never assigned.
 *
 * Every authored screen in examples/templates is HTML dropped into the app
 * shell, so a saved view (the same thing a USER made instead of an author) is
 * the same format. One way to describe a view, not two.
 *
 * The string arrives from localStorage, from IndexedDB, or from a server. None
 * of them was written by this code, and any of them a person can edit. So it is
 * parsed through an allow-list rather than assigned to innerHTML.
 *
 * TRAP T-saved-markup-is-untrusted-input
 */

test('a view built from markup is the same DOM an authored template gives', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { parseViewMarkup } = await import('/dist/index.js');
    const { fragment, report } = parseViewMarkup(`
      <div class="sherpa-grid">
        <sherpa-container data-col-span="full" data-row-span="8">
          <sherpa-container-header slot="header"
            data-heading="Fullest devices"></sherpa-container-header>
          <sherpa-data-grid id="fullest"></sherpa-data-grid>
        </sherpa-container>
      </div>
    `);
    const host = document.getElementById('root')!;
    host.replaceChildren(fragment);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const grid = host.querySelector('sherpa-data-grid');
    return {
      grid: !!grid,
      // The component UPGRADED — a parsed element is a real custom element,
      // not inert markup.
      upgraded: grid instanceof (customElements.get('sherpa-data-grid') as CustomElementConstructor),
      shadow: !!grid?.shadowRoot,
      span: host.querySelector('sherpa-container')?.getAttribute('data-col-span'),
      slot: host.querySelector('sherpa-container-header')?.getAttribute('slot'),
      // The layout class survives — the grid IS a class.
      cls: host.querySelector('div')?.className,
      dropped: report,
    };
  });

  expect(r.grid).toBe(true);
  expect(r.upgraded).toBe(true);
  expect(r.shadow).toBe(true);
  expect(r.span).toBe('full');
  expect(r.slot).toBe('header');
  expect(r.cls).toBe('sherpa-grid');
  // Nothing in ordinary view markup is refused.
  expect(r.dropped).toEqual({ tags: [], attributes: [] });
});

test('the allow-list drops what a saved view has no business carrying', async ({ page }) => {
  /* THE REASON THIS IS A PARSE AND NOT AN ASSIGNMENT. Each of these is a real
     thing that reaches a page through storage someone has edited. */
  const r = await page.evaluate(async () => {
    const { parseViewMarkup, checkViewMarkup } = await import('/dist/index.js');
    const host = document.getElementById('root')!;

    // A flag the page sets if anything in the markup ever executes.
    (window as unknown as { __ran?: boolean }).__ran = false;

    const hostile = `
      <div class="sherpa-grid">
        <script>window.__ran = true;<\/script>
        <img src="x" onerror="window.__ran = true">
        <sherpa-container data-col-span="large" onclick="window.__ran = true" style="position:fixed">
          <sherpa-data-grid id="ok"></sherpa-data-grid>
        </sherpa-container>
        <iframe src="https://example.com"></iframe>
        <a href="javascript:void 0">click</a>
        <form action="/steal"><input name="password"></form>
      </div>
    `;

    const { fragment, report } = parseViewMarkup(hostile);
    host.replaceChildren(fragment);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    await new Promise((r2) => setTimeout(r2, 300));

    return {
      ran: (window as unknown as { __ran?: boolean }).__ran,
      // What SURVIVED: the component and its data-* attribute.
      kept: !!host.querySelector('sherpa-data-grid#ok'),
      span: host.querySelector('sherpa-container')?.getAttribute('data-col-span'),
      // What did NOT.
      script: host.querySelectorAll('script').length,
      img: host.querySelectorAll('img').length,
      iframe: host.querySelectorAll('iframe').length,
      anchor: host.querySelectorAll('a').length,
      form: host.querySelectorAll('form').length,
      onclick: host.querySelector('sherpa-container')?.getAttribute('onclick'),
      style: host.querySelector('sherpa-container')?.getAttribute('style'),
      tags: report.tags.sort(),
      attrs: report.attributes.sort(),
      // checkViewMarkup answers the same question WITHOUT building.
      check: checkViewMarkup(hostile).ok,
      checkClean: checkViewMarkup('<sherpa-container data-col-span="large"></sherpa-container>').ok,
    };
  });

  // NOTHING EXECUTED. This is the assertion the whole file exists for.
  expect(r.ran).toBe(false);

  // The legitimate half came through untouched.
  expect(r.kept).toBe(true);
  expect(r.span).toBe('large');

  // Every vector is gone from the DOM.
  expect(r.script).toBe(0);
  expect(r.img).toBe(0);
  expect(r.iframe).toBe(0);
  expect(r.anchor).toBe(0);
  expect(r.form).toBe(0);
  // An inline handler is a script; `style` carries url() and is not a Sherpa API.
  expect(r.onclick).toBeNull();
  expect(r.style).toBeNull();

  // …and the drops are REPORTED, not silent.
  // `input` is absent because `form` was refused FIRST and took its subtree
  // with it — a refused element is never walked into. Both are gone from the
  // DOM, which is what the assertions above check.
  expect(r.tags).toEqual(['a', 'form', 'iframe', 'img', 'script']);
  expect(r.attrs).toEqual(['sherpa-container.onclick', 'sherpa-container.style']);

  // checkViewMarkup refuses the hostile string and passes the clean one.
  expect(r.check).toBe(false);
  expect(r.checkClean).toBe(true);
});

test('a saved view applies its markup, then configures it by id', async ({ page }) => {
  /* The whole round trip: markup describes the SHAPE, the snapshot configures
     it through each component's own API, addressing the ids in the markup. */
  const r = await page.evaluate(async () => {
    const { onViewPicked } = await import('/dist/index.js');
    const host = document.getElementById('root')!;
    host.replaceChildren();

    const region = document.createElement('div');
    const chip = document.createElement('div');
    host.append(chip, region);

    onViewPicked(
      chip,
      {
        capacity: {
          label: 'Capacity',
          content: `
            <sherpa-container data-col-span="full">
              <sherpa-data-grid id="fullest"></sherpa-data-grid>
            </sherpa-container>
          `,
          snapshot: {
            v: 1,
            elements: {
              /* Addressed BY ID, into an element that did not exist when this
                 listener was wired — and through the component's OWN API, not
                 an attribute: `applyState` walks the prototype chain for a
                 method or accessor. That is the parity rule
                 (T-state-is-the-saved-view-half), and it is what makes a saved
                 view and an agent's MCP call the same path. */
              fullest: { setColumnFilter: ['storage', ['storage', 'gt', 70]] },
            },
          },
        },
      },
      {},
      { into: region },
    );

    chip.dispatchEvent(new CustomEvent('quick-filter-change', {
      bubbles: true,
      detail: { scope: 'bar', values: { view: ['capacity'] } },
    }));
    await new Promise((r2) => setTimeout(r2, 400));

    const grid = region.querySelector('sherpa-data-grid') as HTMLElement & {
      columnClause?: (f: string) => unknown;
    };
    return {
      built: !!grid,
      // READ BACK through the grid's own getter — the other half of parity.
      clause: grid?.columnClause?.('storage') ?? null,
    };
  });

  expect(r.built).toBe(true);
  /* The snapshot reached an element the MARKUP created, through its own API.
     The value reads back as a STRING because a column filter is typed input —
     the grid holds what a person would have typed, not the JSON literal. */
  expect(r.clause).toEqual(['storage', 'gt', '70']);
});
