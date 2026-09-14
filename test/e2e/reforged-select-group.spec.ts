import { test, expect } from '@playwright/test';

/**
 * sherpa-select-group on the reforged base — a group of composed
 * sherpa-select-checkbox / sherpa-select-radio children stamped from populate().
 * Exercises option rendering, single (radio) vs multi (checkbox) selection, the
 * value property, and the aggregate change event (dispatched off the child's
 * composed change, found via composedPath()).
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-select-group'));
});

interface GroupEl extends HTMLElement {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
  value?: string[] | string | null;
}

const OPTIONS = [
  { value: 'a', label: 'Alpha' },
  { value: 'b', label: 'Beta', description: 'the second' },
  { value: 'c', label: 'Gamma' },
];

test('renders one child per option with label + description', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const el = document.createElement('sherpa-select-group') as unknown as GroupEl;
    el.setAttribute('data-label', 'Pick one');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(options);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    const children = el.querySelectorAll('sherpa-select-radio'); // options are slotted (light DOM)
    return {
      heading: s.querySelector('.label')!.textContent,
      count: children.length,
      firstLabel: children[0]?.getAttribute('data-label'),
      betaDesc: children[1]?.getAttribute('data-description'),
    };
  }, OPTIONS);
  expect(r.count).toBe(3); // default is radios (single-select)
  expect(r.heading).toBe('Pick one');
  expect(r.firstLabel).toBe('Alpha');
  expect(r.betaDesc).toBe('the second');
});

test('data-multiple renders checkboxes and allows multi-select', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const el = document.createElement('sherpa-select-group') as unknown as GroupEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(options);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const boxes = el.querySelectorAll('sherpa-select-checkbox');
    el.value = ['a', 'c'];
    return {
      tag: boxes.length,
      value: el.value,
    };
  }, OPTIONS);
  expect(r.tag).toBe(3);
  expect(r.value).toEqual(['a', 'c']); // multiple → array
});

test('radio value is a single string (single-select)', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const el = document.createElement('sherpa-select-group') as unknown as GroupEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(options);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    el.value = 'b';
    return { value: el.value };
  }, OPTIONS);
  expect(r.value).toBe('b'); // single-select → the value, not an array
});

test('toggling a child fires change with the aggregate value (composedPath)', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const el = document.createElement('sherpa-select-group') as unknown as GroupEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(options);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    let detail: unknown = null;
    el.addEventListener('change', (e) => (detail = (e as CustomEvent).detail.value));

    // Click the inner native checkbox of the first child (Alpha).
    const child = el.querySelector('sherpa-select-checkbox') as HTMLElement & {
      rendered?: Promise<void>;
    };
    await child.rendered;
    child.shadowRoot!.querySelector<HTMLInputElement>('.control')!.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { detail };
  }, OPTIONS);
  expect(r.detail).toEqual(['a']); // aggregate value carried up from the child
});
