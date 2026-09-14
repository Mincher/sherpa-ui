import { test, expect } from '@playwright/test';

/**
 * sherpa-tabs on the reforged base — a tabbed content switcher. Proves the tab
 * strip renders from populate([{ id, label }]), the first tab defaults active,
 * clicking a tab switches data-current-id + fires tab-change, only the matching
 * slotted panel shows, and arrow keys move the active tab (roving focus).
 */

const HARNESS = '/test/reforged/harness.html';

type TabsEl = HTMLElement & {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
  currentId?: string;
  select?: (id: string) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-tabs'));
});

test('renders tabs from populate() and defaults the first tab active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tabs') as TabsEl;
    el.innerHTML =
      '<section data-tab="a">Panel A</section>' +
      '<section data-tab="b">Panel B</section>' +
      '<section data-tab="c">Panel C</section>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const tabs = el.shadowRoot!.querySelectorAll('.tab');
    const active = el.shadowRoot!.querySelector('.tab[data-current] .label')?.textContent;
    return { count: tabs.length, active, activeId: el.getAttribute('data-current-id') };
  });
  expect(r.count).toBe(3);
  expect(r.active).toBe('Alpha'); // first tab defaults active
  expect(r.activeId).toBe('a');
});

test('an explicit data-current-id selects that tab and shows only its panel', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tabs') as TabsEl;
    el.setAttribute('data-current-id', 'b');
    el.innerHTML =
      '<section data-tab="a">Panel A</section>' +
      '<section data-tab="b">Panel B</section>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const vis = (sel: string) =>
      getComputedStyle(el.querySelector(sel)!).display !== 'none';
    const activeLabel = el.shadowRoot!.querySelector('.tab[data-current] .label')?.textContent;
    return { activeLabel, panelAVisible: vis('[data-tab="a"]'), panelBVisible: vis('[data-tab="b"]') };
  });
  expect(r.activeLabel).toBe('Beta');
  expect(r.panelBVisible).toBe(true);
  expect(r.panelAVisible).toBe(false); // only the active panel shows
});

test('clicking a tab switches the active id and fires tab-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tabs') as TabsEl;
    el.innerHTML =
      '<section data-tab="a">A</section><section data-tab="b">B</section>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let fired: string | null = null;
    el.addEventListener('tab-change', (e) => (fired = (e as CustomEvent).detail.id));

    const beta = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.tab')).find(
      (t) => t.dataset['id'] === 'b',
    )!;
    beta.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const bVisible = getComputedStyle(el.querySelector('[data-tab="b"]')!).display !== 'none';
    return { fired, activeId: el.getAttribute('data-current-id'), bVisible };
  });
  expect(r.fired).toBe('b');
  expect(r.activeId).toBe('b');
  expect(r.bVisible).toBe(true);
});

test('arrow keys move the active tab (roving focus)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-tabs') as TabsEl;
    el.innerHTML =
      '<section data-tab="a">A</section><section data-tab="b">B</section><section data-tab="c">C</section>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const strip = el.shadowRoot!.querySelector('.tabs')!;
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
    const afterRight = el.getAttribute('data-current-id');
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'End', bubbles: true }));
    const afterEnd = el.getAttribute('data-current-id');
    strip.dispatchEvent(new KeyboardEvent('keydown', { key: 'Home', bubbles: true }));
    const afterHome = el.getAttribute('data-current-id');
    return { afterRight, afterEnd, afterHome };
  });
  expect(r.afterRight).toBe('b'); // a → b
  expect(r.afterEnd).toBe('c'); // → last
  expect(r.afterHome).toBe('a'); // → first
});
