import { test, expect } from '@playwright/test';

/**
 * sherpa-key-value-list on the reforged base — populate() renders dt/dd pairs
 * from the .pair-tpl cloning prototype; data-orientation switches horizontal vs.
 * vertical (pure CSS).
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-key-value-list'));
});

interface KvEl extends HTMLElement {
  rendered?: Promise<void>;
  populate: (data: unknown) => void;
}

test('populate renders one dt/dd pair per item, in order', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-key-value-list') as unknown as KvEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([
      { key: 'Name', value: 'John Doe' },
      { key: 'Email', value: 'john@example.com' },
      { key: 'Role', value: 'Admin' },
    ]);
    await new Promise((res) => requestAnimationFrame(res));
    const s = el.shadowRoot!;
    return {
      keys: Array.from(s.querySelectorAll('.key')).map((n) => n.textContent),
      values: Array.from(s.querySelectorAll('.value')).map((n) => n.textContent),
      prototypePresent: !!s.querySelector('template.pair-tpl'),
    };
  });
  expect(r.keys).toEqual(['Name', 'Email', 'Role']);
  expect(r.values).toEqual(['John Doe', 'john@example.com', 'Admin']);
  expect(r.prototypePresent).toBe(true); // proves cloning-prototype render
});

test('missing / null values render as empty strings', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-key-value-list') as unknown as KvEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ key: 'A', value: null }, { key: 'B' }]);
    await new Promise((res) => requestAnimationFrame(res));
    const s = el.shadowRoot!;
    return Array.from(s.querySelectorAll('.value')).map((n) => n.textContent);
  });
  expect(r).toEqual(['', '']);
});

test('re-populating replaces the previous pairs', async ({ page }) => {
  const keys = await page.evaluate(async () => {
    const el = document.createElement('sherpa-key-value-list') as unknown as KvEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ key: 'Old A', value: '1' }, { key: 'Old B', value: '2' }]);
    await new Promise((res) => requestAnimationFrame(res));
    el.populate([{ key: 'New', value: '3' }]);
    await new Promise((res) => requestAnimationFrame(res));
    return Array.from(el.shadowRoot!.querySelectorAll('.key')).map((n) => n.textContent);
  });
  expect(keys).toEqual(['New']);
});

test('vertical orientation stacks each pair into a single column', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-key-value-list') as unknown as KvEl;
    el.setAttribute('data-orientation', 'vertical');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ key: 'Name', value: 'John' }]);
    await new Promise((res) => requestAnimationFrame(res));
    const dl = el.shadowRoot!.querySelector('.list')!;
    return { cols: getComputedStyle(dl).gridTemplateColumns };
  });
  // Vertical = one column; horizontal (default) would report two tracks.
  expect(r.cols.split(' ').length).toBe(1);
});

test('horizontal orientation lays key and value in two columns', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-key-value-list') as unknown as KvEl;
    el.setAttribute('data-orientation', 'horizontal');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ key: 'Name', value: 'John' }]);
    await new Promise((res) => requestAnimationFrame(res));
    const dl = el.shadowRoot!.querySelector('.list')!;
    return { cols: getComputedStyle(dl).gridTemplateColumns };
  });
  expect(r.cols.split(' ').length).toBe(2);
});
