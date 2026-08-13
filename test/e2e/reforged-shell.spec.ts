import { test, expect } from '@playwright/test';

/**
 * sherpa-app-shell + sherpa-nav on the reforged base — the layout composite.
 * app-shell: region grid + header collapse + nav-collapsed width. nav: data-driven
 * item list (cloning prototype), active reflection, nav-select event delegation.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('app-shell lays out nav / header / content regions', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const shell = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    shell.innerHTML =
      '<div slot="nav">rail</div><div slot="header">Header</div><main>Content</main>';
    document.getElementById('root')!.appendChild(shell);
    await shell.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const s = shell.shadowRoot!;
    return {
      hasNav: !!s.querySelector('[slot="nav"]') || !!s.querySelector('.nav slot'),
      headerAttr: shell.hasAttribute('data-has-header'),
      headerVisible: getComputedStyle(s.querySelector('.header')!).display !== 'none',
      cols: getComputedStyle(shell).gridTemplateColumns,
    };
  });
  expect(r.headerAttr).toBe(true); // header slot filled
  expect(r.headerVisible).toBe(true);
  // two columns: a fixed nav width + the flexible main column
  expect(r.cols.split(' ').length).toBe(2);
});

test('data-nav-collapsed narrows the nav column', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const shell = document.createElement('sherpa-app-shell') as HTMLElement & { rendered?: Promise<void> };
    shell.innerHTML = '<div slot="nav">rail</div><main>c</main>';
    document.getElementById('root')!.appendChild(shell);
    await shell.rendered;
    const wide = getComputedStyle(shell).gridTemplateColumns.split(' ')[0];
    shell.setAttribute('data-nav-collapsed', '');
    const narrow = getComputedStyle(shell).gridTemplateColumns.split(' ')[0];
    return { wide: parseFloat(wide!), narrow: parseFloat(narrow!) };
  });
  expect(r.narrow).toBeLessThan(r.wide);
});

test('nav renders items from populate() and marks the active one', async ({ page }) => {
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
    const rows = nav.shadowRoot!.querySelectorAll('.item');
    const active = nav.shadowRoot!.querySelector('.item[data-active] .label')?.textContent;
    return { count: rows.length, active };
  });
  expect(r.count).toBe(3);
  expect(r.active).toBe('Reports'); // data-active-id → the matching row
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
    await new Promise((res) => setTimeout(res, 10));

    let selected: string | null = null;
    nav.addEventListener('nav-select', (e) => (selected = (e as CustomEvent).detail.id));

    const reports = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.item')).find(
      (r) => r.dataset['id'] === 'reports'
    )!;
    reports.querySelector<HTMLElement>('.link')!.click();
    await new Promise((res) => setTimeout(res, 10));

    return { selected, activeId: nav.getAttribute('data-active-id') };
  });
  expect(r.selected).toBe('reports');
  expect(r.activeId).toBe('reports'); // click reflected the active id
});

test('data-collapsed hides labels (icon-only rail)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const nav = document.createElement('sherpa-nav') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    nav.setAttribute('data-collapsed', '');
    document.getElementById('root')!.appendChild(nav);
    await nav.rendered;
    nav.populate!([{ id: 'home', label: 'Home', icon: '⌂' }]);
    await new Promise((res) => setTimeout(res, 10));
    const label = nav.shadowRoot!.querySelector('.label')!;
    return { labelDisplay: getComputedStyle(label).display };
  });
  expect(r.labelDisplay).toBe('none');
});
