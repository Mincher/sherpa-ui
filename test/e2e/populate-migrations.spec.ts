import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Verifies the Batch 2/3 migrations: each newly-migrated component renders when
 * driven through the canonical `populate()` path (what an element JSON node's
 * `data` field reaches). One representative shape per component.
 */

test.beforeEach(async ({ page }) => openHarness(page));

async function mountAndPopulate(
  page: import('@playwright/test').Page,
  tag: string,
  data: unknown,
  countSelector: string,
  attrs: Record<string, string> = {},
): Promise<number> {
  return page.evaluate(
    async ({ tag, data, countSelector, attrs }) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
      };
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate?.(data);
      await new Promise((r) => setTimeout(r, 60));
      return el.shadowRoot!.querySelectorAll(countSelector).length;
    },
    { tag, data, countSelector, attrs },
  );
}

test('sherpa-tree populates from a node array', async ({ page }) => {
  const n = await mountAndPopulate(
    page,
    'sherpa-tree',
    [
      { value: 'a', label: 'Alpha', children: [{ value: 'a1', label: 'A-One' }] },
      { value: 'b', label: 'Beta' },
    ],
    '.tree-node',
  );
  expect(n).toBeGreaterThanOrEqual(2);
});

test('sherpa-nav-section populates from a sections array', async ({ page }) => {
  const n = await mountAndPopulate(
    page,
    'sherpa-nav-section',
    [{ label: 'Group', items: [{ id: 'x', label: 'Item X' }, { id: 'y', label: 'Item Y' }] }],
    '.sections *',
  );
  expect(n).toBeGreaterThan(0);
});

test('sherpa-sparkline populates from a number array', async ({ page }) => {
  const n = await mountAndPopulate(page, 'sherpa-sparkline', [10, 25, 15, 30, 20], '.point');
  expect(n).toBeGreaterThan(0);
});

test('sherpa-input-select populates from an options array', async ({ page }) => {
  const n = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-select') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate?.([
      { value: 'a', label: 'Apple' },
      { value: 'b', label: 'Banana' },
    ]);
    await new Promise((r) => setTimeout(r, 60));
    return el.shadowRoot!.querySelectorAll('option').length;
  });
  // Two options + possible placeholder.
  expect(n).toBeGreaterThanOrEqual(2);
});

test('sherpa-data-grid populates from a { rows, columns } collection', async ({ page }) => {
  const n = await mountAndPopulate(
    page,
    'sherpa-data-grid',
    {
      columns: [
        { field: 'name', name: 'Name', type: 'string' },
        { field: 'role', name: 'Role', type: 'string' },
      ],
      rows: [
        { name: 'Alice', role: 'Admin' },
        { name: 'Bob', role: 'Editor' },
        { name: 'Carol', role: 'Viewer' },
      ],
    },
    'tbody tr, [role="row"], .grid-row',
  );
  expect(n).toBeGreaterThanOrEqual(3);
});

test('sherpa-button menu populate() builds items in the delegated overlay', async ({ page }) => {
  // Item-building now lives in the overlay; the button's populate() delegates to
  // menuElement.populate(). Assert the overlay actually built the items (as
  // light-DOM <sherpa-overlay-item>), for both the bare array and { items,
  // options } wrapper forms.
  const r = await page.evaluate(async () => {
    async function build(data: unknown): Promise<{ count: number; values: string[] }> {
      const el = document.createElement('sherpa-button') as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (d: unknown) => void;
        menuElement?: HTMLElement & { rendered?: Promise<void> };
      };
      el.setAttribute('data-label', 'Menu');
      el.setAttribute('data-menu', 'true');
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      el.populate?.(data);
      // The overlay is created on demand; wait for it to render + build.
      const overlay = el.menuElement!;
      await overlay.rendered;
      await new Promise((res) => setTimeout(res, 40));
      const items = overlay.querySelectorAll('sherpa-overlay-item');
      return {
        count: items.length,
        values: [...items].map((i) => i.getAttribute('value') ?? ''),
      };
    }

    const bare = await build([
      { value: 'edit', text: 'Edit' },
      { value: 'delete', text: 'Delete' },
    ]);
    const wrapped = await build({
      items: [{ value: 'a', text: 'A' }, { value: 'b', text: 'B' }],
      options: { selection: 'multi' },
    });
    return { bare, wrapped };
  });

  expect(r.bare.count).toBe(2);
  expect(r.bare.values).toEqual(['edit', 'delete']);
  expect(r.wrapped.count).toBe(2);
  expect(r.wrapped.values).toEqual(['a', 'b']);
});

test('sherpa-container (floating) populate() builds its own menu items', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.setAttribute('popover', 'auto');
    el.setAttribute('data-layout', 'menu');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate?.([
      { value: 'one', text: 'One' },
      { value: 'two', text: 'Two' },
      { value: 'three', text: 'Three' },
    ]);
    await new Promise((res) => setTimeout(res, 40));
    return el.querySelectorAll('sherpa-overlay-item').length;
  });
  expect(r).toBe(3);
});
