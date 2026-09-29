import { test, expect } from './harness';

/**
 * sherpa-nav on the reforged base — the primary navigation rail rebuilt to the
 * Figma "Primary Navigation": brand header + search + quick items over grouped
 * sections, composing <sherpa-nav-item> rows. Covers legacy-array and rich-config
 * populate, active reflection, nav-select delegation, nav-search, and collapse.
 * (The view frame is the light-DOM `.sherpa-view` grid — see reforged-view.spec.ts.)
 */


test('legacy array populate() renders items and marks the active one', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    nav.setAttribute('data-current-id', 'reports');
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // Scope to .content — the rail also carries the default quick items
    // (Home · Recent · Favorites) in its header, which are not section rows.
    const rows = nav.shadowRoot!.querySelectorAll('.content .nav-row sherpa-nav-item');
    const activeRow = nav.shadowRoot!.querySelector('.content .nav-row sherpa-nav-item[data-current]') as HTMLElement | null;
    return { count: rows.length, activeLabel: activeRow?.dataset['label'] };
  });
  expect(r.count).toBe(3); // legacy array → one unlabelled section of 3
  expect(r.activeLabel).toBe('Reports'); // data-current-id → the matching item
});

test('rich config renders brand, sections with labels, and quick items', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({
      product: { name: 'Sherpa', icon: '⛰' },
      quickItems: [{ id: 'search', label: 'Search' }],
      sections: [
        { label: 'Main', items: [{ id: 'home', label: 'Home' }, { id: 'reports', label: 'Reports' }] },
        { label: 'Admin', items: [{ id: 'settings', label: 'Settings' }] },
      ],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = nav.shadowRoot!;
    return {
      product: s.querySelector('.product')?.textContent,
      searchable: nav.hasAttribute('data-searchable'),
      sectionLabels: Array.from(s.querySelectorAll('.section-label')).map((el) => el.textContent),
      quickCount: s.querySelectorAll('.quick sherpa-nav-item').length,
      sectionItemCount: s.querySelectorAll('.section-items sherpa-nav-item').length,
    };
  });
  expect(r.product).toBe('Sherpa');
  expect(r.searchable).toBe(true); // a product nav auto-shows search
  expect(r.sectionLabels).toEqual(['Main', 'Admin']);
  expect(r.quickCount).toBe(1);
  expect(r.sectionItemCount).toBe(3); // 2 + 1 across sections
});

test('clicking an item fires nav-select and updates the active id', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let selected: string | null = null;
    nav.addEventListener('nav-select', (e) => (selected = (e as CustomEvent).detail.id));

    const reports = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
      (r) => r.dataset['id'] === 'reports'
    )!;
    // Click the composed nav-item's inner row (event bubbles as item-click).
    const item = reports.querySelector('sherpa-nav-item') as HTMLElement & { rendered?: Promise<void> };
    await item.rendered;
    (item.shadowRoot!.querySelector('.nav-button, .nav-link') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { selected, activeId: nav.getAttribute('data-current-id') };
  });
  expect(r.selected).toBe('reports');
  expect(r.activeId).toBe('reports'); // click reflected the active id
});

test('typing in search fires nav-search with the query', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' }, sections: [{ items: [{ id: 'a', label: 'A' }] }] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let query: string | null = null;
    nav.addEventListener('nav-search', (e) => (query = (e as CustomEvent).detail.query));

    const input = nav.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
    input.value = 'rep';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { query };
  });
  expect(r.query).toBe('rep');
});

test('the rail starts collapsed: 40px, no product name or section labels, search as an icon', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' }, sections: [{ label: 'Main', items: [{ id: 'home', label: 'Home', icon: 'home' }] }] });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = nav.shadowRoot!;
    return {
      state: nav.dataset['navState'],
      width: getComputedStyle(nav).getPropertyValue('--sherpa-navigation-nav-layout-width').trim(),
      product: getComputedStyle(s.querySelector('.product')!).display,
      search: getComputedStyle(s.querySelector('.search')!).display,
      // The FIELD collapses to its glyph, but the row itself stays — see below.
      searchInput: getComputedStyle(s.querySelector('.search-input')!).display,
      searchBox: (() => { const r = s.querySelector('.search')!.getBoundingClientRect();
        return { h: Math.round(r.height), w: Math.round(r.width) }; })(),
      sectionLabel: getComputedStyle(s.querySelector('.section-label')!).display,
      // The NAME goes; the row and its divider stay — see below.
      sectionLabelColor: getComputedStyle(s.querySelector('.section-label')!).color,
      sectionLabelHeight: Math.round(s.querySelector('.section-label')!.getBoundingClientRect().height),
    };
  });
  // Figma Navigation collection: the rail's resting mode is `collapsed` at 40px.
  expect(r.state).toBe('collapsed');
  expect(r.width).toBe('40px');
  expect(r.product).toBe('none');
  // The search SURVIVES as an icon row — Figma's Primary Navigation keeps a search
  // in the quick-nav slot above the content items in every state, and the rail's
  // whole job when collapsed is to be a column of reachable icons. What collapses
  // is the FIELD around the glyph: no border, no padding, no input.
  expect(r.search).toBe('flex');
  expect(r.searchInput).toBe('none');
  // 32 tall — the SAME height the expanded field has, not 24 like a nav row.
  // Hovering the rail swaps collapsed → hover, and a row that changed height
  // between the two shifted everything below it as the panel opened.
  expect(r.searchBox).toEqual({ h: 32, w: 24 });
  // The section ROW stays in every state — the divider is its ::after, so hiding
  // the row took the section rule with it and the collapsed rail lost its
  // grouping entirely. What collapses is the TEXT.
  expect(r.sectionLabel).toBe('flex');
  expect(r.sectionLabelColor).toBe('rgba(0, 0, 0, 0)');
  // A FIXED 24 in every state, so nothing below it jumps as the rail opens.
  expect(r.sectionLabelHeight).toBe(24);
});

test('pointer in opens the rail (hover); pointer out collapses it again', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;

    const states: string[] = [];
    nav.addEventListener('nav-state-change', (e) => states.push((e as CustomEvent).detail.state));
    // The rail ANIMATES its width, so assert the projected token (the design intent)
    // rather than the mid-transition computed width.
    const targetWidth = (): string =>
      getComputedStyle(nav).getPropertyValue('--sherpa-navigation-nav-layout-width').trim();

    nav.dispatchEvent(new PointerEvent('pointerenter'));
    const open = targetWidth();
    nav.dispatchEvent(new PointerEvent('pointerleave'));
    const shut = targetWidth();
    return { states, open, shut };
  });
  expect(r.states).toEqual(['hover', 'collapsed']);
  expect(r.open).toBe('320px'); // nav-layout/width in every open mode
  expect(r.shut).toBe('40px');
});

test('the pin latches the rail open; settings switches mode and relabels the header', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' } });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = nav.shadowRoot!;

    (s.querySelector('.pin') as HTMLElement).click();
    // Latched: leaving with the pointer must NOT collapse it.
    nav.dispatchEvent(new PointerEvent('pointerleave'));
    const pinned = {
      state: nav.dataset['navState'],
      width: getComputedStyle(nav).getPropertyValue('--sherpa-navigation-nav-layout-width').trim(),
      pressed: s.querySelector('.pin')!.getAttribute('aria-pressed'),
    };

    (s.querySelector('.settings') as HTMLElement).click();
    const settings = {
      state: nav.dataset['navState'],
      label: s.querySelector('.product')!.textContent,
      pressed: s.querySelector('.settings')!.getAttribute('aria-pressed'),
    };
    return { pinned, settings };
  });
  expect(r.pinned.state).toBe('pinned');
  expect(r.pinned.width).toBe('320px'); // stays open through a pointer leave
  expect(r.pinned.pressed).toBe('true');
  // Figma nav-container-header-label: only the settings mode changes the label.
  expect(r.settings.state).toBe('settings');
  expect(r.settings.label).toBe('Settings');
  expect(r.settings.pressed).toBe('true');
});

test('leaving settings returns the rail to the mode it came from', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' } });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const settings = nav.shadowRoot!.querySelector('.settings') as HTMLElement;
    const roundTrip = () => { settings.click(); settings.click(); return nav.dataset['navState']; };

    // Unpinned: the pointer is on the rail, so it comes back as hover…
    nav.dispatchEvent(new PointerEvent('pointerenter'));
    const fromHover = roundTrip();
    // …and a pointer leave then shuts it, which a pinned rail would refuse.
    nav.dispatchEvent(new PointerEvent('pointerleave'));
    const afterLeave = nav.dataset['navState'];

    (nav.shadowRoot!.querySelector('.pin') as HTMLElement).click();
    const fromPinned = roundTrip();
    return { fromHover, afterLeave, fromPinned };
  });
  expect(r.fromHover).toBe('hover');
  expect(r.afterLeave).toBe('collapsed');
  expect(r.fromPinned).toBe('pinned');
});

test('typing in search filters the rows and marks the matched text', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({
      product: { name: 'Sherpa' },
      sections: [
        { label: 'Views', items: [{ id: 'settings', label: 'Settings' }, { id: 'reports', label: 'Reports' }] },
        { label: 'Admin', items: [{ id: 'users', label: 'Users' }] },
      ],
    });
    // WAIT FOR THE NAV-ITEMS' OWN SHADOW ROOTS, not for a fixed 20ms.
    // populate() stamps sherpa-nav-items, and the <mark> this test reads lives
    // inside each one's shadow root — so the nav's `rendered` resolving is not
    // enough. Under parallel load they had not rendered within the fixed wait
    // and the marks read empty, about one full run in three.
    const s = nav.shadowRoot!;
    const items = () => [...s.querySelectorAll('sherpa-nav-item')] as (HTMLElement & {
      rendered?: Promise<void>;
    })[];
    for (let i = 0; i < 100 && items().length < 3; i++) {
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    }
    await Promise.all(items().map((n) => n.rendered));
    const input = s.querySelector<HTMLInputElement>('.search-input')!;

    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      // Filtering re-renders the items, so wait out their shadow roots again
      // before reading a <mark> from inside one.
      await Promise.all(items().map((n) => n.rendered));
      const rows = Array.from(s.querySelectorAll('.content .nav-row'));
      const visible = rows
        .filter((row) => !(row as HTMLElement).hasAttribute('data-filtered-out'))
        .map((row) => (row.querySelector('sherpa-nav-item') as HTMLElement).dataset['label']);
      // The mark lands on BOTH row templates (button + link) — CSS shows whichever
      // matches data-href — so de-duplicate by row rather than by geometry (the rail
      // is collapsed here, so every label has zero width).
      const marks = rows.flatMap((row) => {
        const item = row.querySelector('sherpa-nav-item') as HTMLElement;
        const texts = Array.from(item.shadowRoot!.querySelectorAll('mark.match')).map((m) => m.textContent);
        return texts.length ? [texts[0]] : [];
      });
      const emptySections = Array.from(s.querySelectorAll('.section'))
        .filter((sec) => (sec as HTMLElement).hasAttribute('data-filtered-out'))
        .map((sec) => sec.querySelector('.section-label')!.textContent);
      return { visible, marks, emptySections, searching: nav.hasAttribute('data-searching') };
    };

    const matched = await type('set');
    const cleared = await type('');
    return { matched, cleared };
  });

  // Only the matching row survives, and its matched letters are marked.
  expect(r.matched.visible).toEqual(['Settings']);
  expect(r.matched.marks).toEqual(['Set']);
  expect(r.matched.searching).toBe(true);
  // A section that lost every row hides its label + rule too.
  expect(r.matched.emptySections).toEqual(['Admin']);

  // Clearing restores every row and removes the marks.
  expect(r.cleared.visible).toEqual(['Settings', 'Reports', 'Users']);
  expect(r.cleared.marks).toEqual([]);
  expect(r.cleared.searching).toBe(false);
});

test('the search clear button appears with text and resets the filter', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({
      product: { name: 'Sherpa' },
      sections: [{ label: 'Views', items: [{ id: 'a', label: 'Alpha' }, { id: 'b', label: 'Beta' }] }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = nav.shadowRoot!;
    const input = s.querySelector<HTMLInputElement>('.search-input')!;
    const clear = s.querySelector<HTMLElement>('.search-clear')!;
    const shown = () => getComputedStyle(clear).display !== 'none';

    const empty = shown();
    input.value = 'alp';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const typed = shown();
    const filtered = s.querySelectorAll('.content .nav-row:not([data-filtered-out])').length;

    let searchEvents = 0;
    nav.addEventListener('nav-search', () => searchEvents++);
    clear.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // NOTE: the button also calls input.focus() so typing continues in the field.
    // That is not asserted here — a headless page with no user activation never
    // moves focus off <body>, so neither activeElement nor a focus listener sees it.
    return {
      empty,
      typed,
      filtered,
      afterClear: shown(),
      value: input.value,
      rows: s.querySelectorAll('.content .nav-row:not([data-filtered-out])').length,
      searchEvents,
    };
  });
  expect(r.empty).toBe(false); // hidden while the field is empty
  expect(r.typed).toBe(true); // shown once it has text
  expect(r.filtered).toBe(1); // "alp" → Alpha only
  expect(r.afterClear).toBe(false); // hidden again after clearing
  expect(r.value).toBe('');
  expect(r.rows).toBe(2); // every row restored
  expect(r.searchEvents).toBe(1); // clearing announces the empty query
});

test('the settings button swaps the rail to its own section list', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({
      product: { name: 'Sherpa' },
      sections: [{ label: 'Views', items: [{ id: 'home', label: 'Dashboard' }] }],
      settingsSections: [
        { label: 'Account', items: [
          { id: 'profile', label: 'Profile' },
          { id: 'sessions', label: 'Sessions', tier: 2 },
        ] },
      ],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = nav.shadowRoot!;
    const read = () => ({
      sections: Array.from(s.querySelectorAll('.section-label')).map((el) => el.textContent),
      rows: Array.from(s.querySelectorAll<HTMLElement>('.content .nav-row sherpa-nav-item')).map((i) => ({
        label: i.dataset['label'],
        tier: i.dataset['tier'] ?? '1',
      })),
    });

    const main = read();
    (s.querySelector('.settings') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const settings = { ...read(), label: s.querySelector('.product')!.textContent };
    // Leaving settings restores the product tree.
    (s.querySelector('.settings') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { main, settings, back: read() };
  });

  expect(r.main.sections).toEqual(['Views']);
  expect(r.main.rows).toEqual([{ label: 'Dashboard', tier: '1' }]);
  // Settings pages live behind the header button, not as a row in the product tree.
  expect(r.settings.label).toBe('Settings');
  expect(r.settings.sections).toEqual(['Account']);
  expect(r.settings.rows).toEqual([
    { label: 'Profile', tier: '1' },
    { label: 'Sessions', tier: '2' }, // child rows carry the Figma indent tier
  ]);
  expect(r.back.sections).toEqual(['Views']);
  expect(r.back.rows).toEqual([{ label: 'Dashboard', tier: '1' }]);
});

test('the default quick items are Home · Recent · Favorites', async ({ page }) => {
  const labels = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' } });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return Array.from(
      nav.shadowRoot!.querySelectorAll<HTMLElement>('.quick sherpa-nav-item'),
    ).map((el) => el.dataset['label']);
  });
  expect(labels).toEqual(['Home', 'Recent', 'Favorites']);
});

/* ── Nesting: children, chevrons, icons and the collapsed rail ───────────── */

/** A config with a two-deep branch, so tier 1, 2 and 3 are all exercised. */
const NESTED = {
  product: { name: 'Test' },
  quickItems: [],
  sections: [
    {
      label: 'Monitor',
      items: [
        {
          id: 'endpoints',
          label: 'Endpoints',
          icon: 'desktop',
          badge: '1284',
          children: [
            { id: 'servers', label: 'Servers' },
            // A child that is itself a parent — its own child must stay hidden
            // until BOTH it and its parent are open.
            { id: 'desktops', label: 'Desktops', children: [{ id: 'laptops', label: 'Laptops' }] },
          ],
        },
        { id: 'health', label: 'Health', icon: 'gauge' },
      ],
    },
  ],
};

test('children start hidden, indent one tier deeper, and carry no icon', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate(c: unknown): void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate(config);
    nav.setAttribute('data-nav-state', 'pinned');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const row = (label: string): HTMLElement =>
      Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
        (li) => li.querySelector('sherpa-nav-item')?.getAttribute('data-label') === label,
      )!;
    const item = (label: string): HTMLElement =>
      row(label).querySelector('sherpa-nav-item') as HTMLElement;
    const shown = (label: string): boolean => row(label).offsetParent !== null;
    const iconShown = (label: string): boolean =>
      getComputedStyle(item(label).shadowRoot!.querySelector('.icon')!).display !== 'none';
    const chevronShown = (label: string): boolean =>
      getComputedStyle(item(label).shadowRoot!.querySelector('.expand')!).display !== 'none';

    return {
      // Every row is stamped, flat, whether visible or not.
      stamped: nav.shadowRoot!.querySelectorAll('.content .nav-row').length,
      parentShown: shown('Endpoints'),
      childShown: shown('Servers'),
      grandchildShown: shown('Laptops'),
      // Depth → the Figma indent tiers.
      tiers: {
        endpoints: item('Endpoints').getAttribute('data-tier'),
        servers: item('Servers').getAttribute('data-tier'),
        laptops: item('Laptops').getAttribute('data-tier'),
      },
      padding: {
        endpoints: getComputedStyle(item('Endpoints')).paddingLeft,
        servers: getComputedStyle(item('Servers')).paddingLeft,
        laptops: getComputedStyle(item('Laptops')).paddingLeft,
      },
      // Only top-level rows carry an icon.
      icons: { endpoints: iconShown('Endpoints'), servers: iconShown('Servers') },
      // Only parents carry a chevron.
      chevrons: {
        endpoints: chevronShown('Endpoints'),
        desktops: chevronShown('Desktops'),
        health: chevronShown('Health'),
      },
    };
  }, NESTED);

  // Five rows exist: Endpoints, Servers, Desktops, Laptops, Health.
  expect(r.stamped).toBe(5);
  // A parent is closed by default, so nothing below it shows.
  expect(r.parentShown).toBe(true);
  expect(r.childShown).toBe(false);
  expect(r.grandchildShown).toBe(false);
  // Tier 1 needs no attribute; 2 and 3 are written.
  expect(r.tiers.endpoints).toBeNull();
  expect(r.tiers.servers).toBe('2');
  expect(r.tiers.laptops).toBe('3');
  // Figma Navigation indent-tier-1/2/3 = 8 / 32 / 48.
  expect(r.padding.endpoints).toBe('8px');
  expect(r.padding.servers).toBe('32px');
  expect(r.padding.laptops).toBe('48px');
  // "All nav items have an icon unless they are child items."
  expect(r.icons.endpoints).toBe(true);
  expect(r.icons.servers).toBe(false);
  // The Figma hasChildren chevron, on parents only.
  expect(r.chevrons.endpoints).toBe(true);
  expect(r.chevrons.desktops).toBe(true);
  expect(r.chevrons.health).toBe(false);
});

test('the chevron toggles a subtree without navigating, and a shut parent keeps its grandchildren hidden', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate(c: unknown): void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate(config);
    nav.setAttribute('data-nav-state', 'pinned');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const row = (label: string): HTMLElement =>
      Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
        (li) => li.querySelector('sherpa-nav-item')?.getAttribute('data-label') === label,
      )!;
    const shown = (label: string): boolean => row(label).offsetParent !== null;
    const chevron = (label: string): HTMLElement =>
      (row(label).querySelector('sherpa-nav-item') as HTMLElement)
        .shadowRoot!.querySelector('.expand') as HTMLElement;

    const selects: string[] = [];
    nav.addEventListener('nav-select', (e) => selects.push((e as CustomEvent).detail.id));

    chevron('Endpoints').click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const opened = { servers: shown('Servers'), desktops: shown('Desktops'), laptops: shown('Laptops') };

    chevron('Desktops').click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const bothOpen = { laptops: shown('Laptops') };

    // Shutting the GRANDPARENT must hide the grandchild, even though Desktops
    // itself is still marked open. This is why visibility walks the whole
    // ancestor chain rather than looking one level up.
    chevron('Endpoints').click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const grandparentShut = { desktops: shown('Desktops'), laptops: shown('Laptops') };

    return { opened, bothOpen, grandparentShut, selects };
  }, NESTED);

  expect(r.opened.servers).toBe(true);
  expect(r.opened.desktops).toBe(true);
  expect(r.opened.laptops).toBe(false); // Desktops is still shut
  expect(r.bothOpen.laptops).toBe(true);
  expect(r.grandparentShut.desktops).toBe(false);
  expect(r.grandparentShut.laptops).toBe(false);
  // A chevron click is not a navigation.
  expect(r.selects).toEqual([]);
});

test('the collapsed rail hides every child row, tag and chevron', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate(c: unknown): void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate(config);

    const row = (label: string): HTMLElement =>
      Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
        (li) => li.querySelector('sherpa-nav-item')?.getAttribute('data-label') === label,
      )!;
    const item = (label: string): HTMLElement =>
      row(label).querySelector('sherpa-nav-item') as HTMLElement;

    // Open the parent FIRST, so the test proves collapsing hides an already-open
    // subtree rather than relying on it being shut anyway.
    nav.setAttribute('data-nav-state', 'pinned');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    (item('Endpoints').shadowRoot!.querySelector('.expand') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const openFirst = row('Servers').offsetParent !== null;

    nav.setAttribute('data-nav-state', 'collapsed');
    // The rail transitions inline-size over 160ms, so a short wait reads a
    // mid-flight width (232px on the way down from 320). Wait for the transition.
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      nav.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400);
    });

    const sr = item('Endpoints').shadowRoot!;
    const vis = (sel: string): boolean => getComputedStyle(sr.querySelector(sel)!).display !== 'none';
    const rows = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.content .nav-row'));
    return {
      openFirst,
      railWidth: Math.round(nav.getBoundingClientRect().width),
      childrenShowing: rows.filter((li) => li.dataset['parent'] && li.offsetParent !== null).length,
      // The icon survives — in a 40px rail the icon IS the row.
      iconShown: vis('.icon'),
      // The tag and chevron live in / with `content`, which the isVisible flag hides.
      badgeShown: vis('.nav-link .badge') || vis('.nav-button .badge'),
      chevronShown: vis('.expand'),
    };
  }, NESTED);

  expect(r.openFirst).toBe(true);
  expect(r.railWidth).toBe(40);
  expect(r.childrenShowing).toBe(0);
  expect(r.iconShown).toBe(true);
  expect(r.badgeShown).toBe(false);
  expect(r.chevronShown).toBe(false);
});

test('the collapsed rail centres its icons, and the header buttons use the Structure sm mode', async ({ page }) => {
  const r = await page.evaluate(async (config) => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate(c: unknown): void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate(config);
    nav.setAttribute('data-nav-state', 'pinned');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = nav.shadowRoot!;
    // Figma pins the pin/settings Buttons to Structure=sm: height → space/xl 24,
    // icon-size → content/size/small 12.
    const pin = sr.querySelector<HTMLElement>('.pin')!;
    const pinBox = pin.getBoundingClientRect();
    const header = {
      box: `${Math.round(pinBox.width)}x${Math.round(pinBox.height)}`,
      glyph: getComputedStyle(pin).fontSize,
    };

    const item = (label: string): HTMLElement =>
      Array.from(sr.querySelectorAll<HTMLElement>('.nav-row'))
        .find((li) => li.querySelector('sherpa-nav-item')?.getAttribute('data-label') === label)!
        .querySelector('sherpa-nav-item') as HTMLElement;

    const endpoints = item('Endpoints');
    // Figma Icon on the Navigation Item: Theme size/icon/xs. That var now aliases
    // content/size/base → 14, because the icon scale and the text scale were
    // unified: an icon is the SAME size as the text beside it (the label is 14/20).
    const openIconBox = (() => {
      const el = endpoints.shadowRoot!.querySelector<HTMLElement>(
        `${endpoints.getAttribute('data-href') ? '.nav-link' : '.nav-button'} .icon`,
      )!;
      const b = el.getBoundingClientRect();
      return `${Math.round(b.width)}x${Math.round(b.height)}`;
    })();

    nav.setAttribute('data-nav-state', 'collapsed');
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      nav.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 400);
    });

    const iconEl = endpoints.shadowRoot!.querySelector<HTMLElement>(
      `${endpoints.getAttribute('data-href') ? '.nav-link' : '.nav-button'} .icon`,
    )!;
    const navRect = nav.getBoundingClientRect();
    const iconRect = iconEl.getBoundingClientRect();
    return {
      header,
      openIconBox,
      collapsed: {
        railWidth: Math.round(navRect.width),
        iconBox: `${Math.round(iconRect.width)}x${Math.round(iconRect.height)}`,
        // 0 = the icon's centre is the rail's centre.
        centreOffset: Math.round(
          iconRect.left + iconRect.width / 2 - (navRect.left + navRect.width / 2),
        ),
      },
    };
  }, NESTED);

  // Structure=sm, read from that mode's tokens rather than a look-alike constant.
  expect(r.header.box).toBe('24x24');
  expect(r.header.glyph).toBe('12px');

  // Theme size/icon/xs → content/size/base → 14. Same box in both rails, and the
  // same 14px as the row's label — that pairing is the point of the unified scale.
  expect(r.openIconBox).toBe('14x14');
  expect(r.collapsed.iconBox).toBe('14x14');

  // An icon-only row is a square, so the glyph must sit dead centre. The row's
  // asymmetric 4/8 inset used to leave it 4px to the left.
  expect(r.collapsed.railWidth).toBe(40);
  expect(r.collapsed.centreOffset).toBe(0);
});

/* ── The selection carries what the row SHOWS ─────────────────────────────
   An app header that mirrors the current view must not keep its own copy of the
   nav config: two copies of one string is exactly how a renamed row ends up with
   a stale title and nothing to catch it. So the rail reports its label and icon,
   and can be asked for them. */

test('nav-select carries the row label and icon, and entry() reads them back', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate: (d: unknown) => Promise<void>;
      entry: (id: string) => unknown;
      activeEntry: unknown;
    };
    document.getElementById('root')!.appendChild(nav);
    // PINNED so the rows are laid out and clickable — the 40px collapsed rail
    // hides labels and children.
    nav.dataset['navState'] = 'pinned';
    await nav.populate({
      quickItems: [],
      sections: [{ label: 'Views', items: [
        { id: 'records', label: 'Records', icon: 'list' },
      ] }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const detail: unknown[] = [];
    nav.addEventListener('nav-select', (e) => detail.push((e as CustomEvent).detail));
    const row = [...nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')]
      .find((x) => x.dataset['id'] === 'records')!;
    row.querySelector<HTMLElement>('sherpa-nav-item')!
      .dispatchEvent(new CustomEvent('item-select', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { detail: detail[0], entry: nav.entry('records'), active: nav.activeEntry };
  });

  expect(r.detail).toEqual({ id: 'records', label: 'Records', icon: 'list' });
  // entry() reads the STAMPED row, so it agrees with what is on screen.
  expect(r.entry).toEqual({ id: 'records', label: 'Records', icon: 'list' });
  // activeEntry follows data-current-id, which the click just set.
  expect(r.active).toEqual({ id: 'records', label: 'Records', icon: 'list' });
});

test('a row with NO icon reports none, so a mirror can clear its own', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      populate: (d: unknown) => Promise<void>;
      entry: (id: string) => { icon?: string } | null;
    };
    document.getElementById('root')!.appendChild(nav);
    nav.dataset['navState'] = 'pinned';
    // A CHILD row never carries an icon — the design tells it apart by its indent.
    await nav.populate({
      quickItems: [],
      sections: [{ items: [
        { id: 'reports', label: 'Reports', icon: 'chart-pie', expanded: true,
          children: [{ id: 'monthly', label: 'Monthly rollup' }] },
      ] }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const detail: { icon?: string }[] = [];
    nav.addEventListener('nav-select', (e) => detail.push((e as CustomEvent).detail));
    const row = [...nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')]
      .find((x) => x.dataset['id'] === 'monthly')!;
    row.querySelector<HTMLElement>('sherpa-nav-item')!
      .dispatchEvent(new CustomEvent('item-select', { bubbles: true, composed: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { detail: detail[0], entry: nav.entry('monthly') };
  });

  expect(r.detail).toEqual({ id: 'monthly', label: 'Monthly rollup', icon: undefined });
  // UNDEFINED, not an empty string: a mirror must be able to tell "no icon" from
  // "an icon whose value is blank", because only the first means hide it.
  expect(r.entry?.icon).toBeUndefined();
});

test('setting state to settings swaps the section list, and announces it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      populate: (d: unknown) => Promise<void>;
      state: string;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.populate({
      product: { name: 'N-central' },
      quickItems: [{ id: 'home', label: 'Home', icon: 'home' }],
      sections: [{ label: 'Views', items: [{ id: 'records', label: 'Records' }] }],
      settingsSections: [{ label: 'Account', items: [{ id: 'prefs', label: 'Preferences' }] }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const ids = () => [...nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')]
      .map((x) => x.dataset['id']);

    const before = ids();
    const announced: string[] = [];
    nav.addEventListener('nav-state-change', (e) => announced.push((e as CustomEvent).detail.state));

    // The PUBLIC setter — the route a host app takes. It used to write the
    // attribute and nothing else, so neither the swap nor the event happened.
    nav.state = 'settings';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const inSettings = ids();

    nav.state = 'collapsed';
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { before, inSettings, after: ids(), announced };
  });

  expect(r.before).toEqual(['home', 'records']);
  // Settings is a different PLACE: its own pages, and no quick items at all.
  expect(r.inSettings).toEqual(['prefs']);
  // …and leaving it restores the product tree, quick items included.
  expect(r.after).toEqual(['home', 'records']);
  expect(r.announced).toEqual(['settings', 'collapsed']);
});

/**
 * THE BRAND MARK IS A DRAWING, NOT A WORD.
 *
 * `#applyIcon` used to decide by SPELLING — `/\bfa-/` meant "an icon", anything
 * else meant "a raw glyph". When the icon names lost their `fa-` prefix every
 * one of them fell through to the text branch, and the brand tile printed the
 * word "group" where the mark should be. Nothing failed: a name IS a valid
 * string to render as text.
 * TRAP T-an-icon-is-known-by-the-set-not-its-spelling
 */
test('the brand icon draws an SVG for a name, and text for a raw glyph', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const read = async (icon: string): Promise<{ text: string; paints: boolean }> => {
      const nav = document.createElement('sherpa-nav') as HTMLElement & {
        rendered?: Promise<void>; populate?: (d: unknown) => void;
      };
      document.getElementById('root')!.replaceChildren(nav);
      await nav.rendered;
      nav.populate!({ product: { name: 'Acme', icon }, sections: [] });
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      const host = nav.shadowRoot!.querySelector('.brand-icon')!;
      return {
        text: (host.textContent ?? '').trim(),
        paints: !!host.querySelector('svg path, svg circle, svg rect'),
      };
    };
    return { named: await read('group'), glyph: await read('★') };
  });

  // A NAME in the icon set becomes a real drawing and leaves no text behind.
  expect(r.named.paints).toBe(true);
  expect(r.named.text).toBe('');
  // A raw character is still printed — that branch is deliberate, not a fallback.
  expect(r.glyph.paints).toBe(false);
  expect(r.glyph.text).toBe('★');
});
