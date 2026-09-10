import { test, expect } from '@playwright/test';

/**
 * sherpa-nav on the reforged base — the primary navigation rail rebuilt to the
 * Figma "Primary Navigation": brand header + search + quick items over grouped
 * sections, composing <sherpa-nav-item> rows. Covers legacy-array and rich-config
 * populate, active reflection, nav-select delegation, nav-search, and collapse.
 * (The view frame is the light-DOM `.sherpa-view` grid — see reforged-view.spec.ts.)
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('legacy array populate() renders items and marks the active one', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    nav.setAttribute('data-active-id', 'reports');
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([
      { id: 'home', label: 'Home' },
      { id: 'reports', label: 'Reports' },
      { id: 'settings', label: 'Settings' },
    ]);
    await new Promise((res) => setTimeout(res, 10));
    // Scope to .content — the rail also carries the default quick items
    // (Home · Recent · Favorites) in its header, which are not section rows.
    const rows = nav.shadowRoot!.querySelectorAll('.content .nav-row sherpa-nav-item');
    const activeRow = nav.shadowRoot!.querySelector('.content .nav-row sherpa-nav-item[data-current]') as HTMLElement | null;
    return { count: rows.length, activeLabel: activeRow?.dataset['label'] };
  });
  expect(r.count).toBe(3); // legacy array → one unlabelled section of 3
  expect(r.activeLabel).toBe('Reports'); // data-active-id → the matching item
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
    await new Promise((res) => setTimeout(res, 10));
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
    await new Promise((res) => setTimeout(res, 20));

    let selected: string | null = null;
    nav.addEventListener('nav-select', (e) => (selected = (e as CustomEvent).detail.id));

    const reports = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
      (r) => r.dataset['id'] === 'reports'
    )!;
    // Click the composed nav-item's inner row (event bubbles as item-click).
    const item = reports.querySelector('sherpa-nav-item') as HTMLElement & { rendered?: Promise<void> };
    await item.rendered;
    (item.shadowRoot!.querySelector('.row') as HTMLElement).click();
    await new Promise((res) => setTimeout(res, 10));

    return { selected, activeId: nav.getAttribute('data-active-id') };
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
    await new Promise((res) => setTimeout(res, 10));

    let query: string | null = null;
    nav.addEventListener('nav-search', (e) => (query = (e as CustomEvent).detail.query));

    const input = nav.shadowRoot!.querySelector('.search-input') as HTMLInputElement;
    input.value = 'rep';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 10));
    return { query };
  });
  expect(r.query).toBe('rep');
});

test('the rail starts collapsed: 40px, no product name, search or section labels', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' }, sections: [{ label: 'Main', items: [{ id: 'home', label: 'Home', icon: 'fa-regular fa-house' }] }] });
    await new Promise((res) => setTimeout(res, 10));
    const s = nav.shadowRoot!;
    return {
      state: nav.dataset['navState'],
      width: getComputedStyle(nav).getPropertyValue('--sherpa-navigation-nav-layout-width').trim(),
      product: getComputedStyle(s.querySelector('.product')!).display,
      search: getComputedStyle(s.querySelector('.search')!).display,
      sectionLabel: getComputedStyle(s.querySelector('.section-label')!).display,
    };
  });
  // Figma Navigation collection: the rail's resting mode is `collapsed` at 40px.
  expect(r.state).toBe('collapsed');
  expect(r.width).toBe('40px');
  expect(r.product).toBe('none');
  expect(r.search).toBe('none');
  expect(r.sectionLabel).toBe('none');
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
    await new Promise((res) => setTimeout(res, 10));
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
    await new Promise((res) => setTimeout(res, 20));
    const s = nav.shadowRoot!;
    const input = s.querySelector<HTMLInputElement>('.search-input')!;

    const type = async (value: string) => {
      input.value = value;
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await new Promise((res) => setTimeout(res, 20));
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
    await new Promise((res) => setTimeout(res, 20));
    const s = nav.shadowRoot!;
    const input = s.querySelector<HTMLInputElement>('.search-input')!;
    const clear = s.querySelector<HTMLElement>('.search-clear')!;
    const shown = () => getComputedStyle(clear).display !== 'none';

    const empty = shown();
    input.value = 'alp';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    await new Promise((res) => setTimeout(res, 20));
    const typed = shown();
    const filtered = s.querySelectorAll('.content .nav-row:not([data-filtered-out])').length;

    let searchEvents = 0;
    nav.addEventListener('nav-search', () => searchEvents++);
    clear.click();
    await new Promise((res) => setTimeout(res, 20));
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

test('the default quick items are Home · Recent · Favorites', async ({ page }) => {
  const labels = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!({ product: { name: 'Sherpa' } });
    await new Promise((res) => setTimeout(res, 10));
    return Array.from(
      nav.shadowRoot!.querySelectorAll<HTMLElement>('.quick sherpa-nav-item'),
    ).map((el) => el.dataset['label']);
  });
  expect(labels).toEqual(['Home', 'Recent', 'Favorites']);
});
