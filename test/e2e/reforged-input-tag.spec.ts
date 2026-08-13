import { test, expect } from '@playwright/test';

/**
 * sherpa-input-tag on the reforged base — a token/chip input. Exercises adding a
 * tag via Enter, removing via a chip's ×, the tags property, the tags-change
 * event, populate() for initial tags, and that each chip renders as a
 * <sherpa-tag>. The remove path proves the composed-event / composedPath handling.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(() =>
    Promise.all([
      customElements.whenDefined('sherpa-input-tag'),
      customElements.whenDefined('sherpa-tag'),
    ]),
  );
});

test('populate() renders initial tags as sherpa-tag chips', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-tag') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      tags?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(['alpha', { label: 'beta' }]);
    await new Promise((res) => setTimeout(res, 20));
    const chips = Array.from(el.shadowRoot!.querySelectorAll('.chip'));
    return {
      tagName: chips[0]?.tagName.toLowerCase(),
      count: chips.length,
      labels: chips.map((c) => c.textContent),
      tags: el.tags,
    };
  });
  expect(r.tagName).toBe('sherpa-tag');
  expect(r.count).toBe(2);
  expect(r.labels).toEqual(['alpha', 'beta']);
  expect(r.tags).toEqual(['alpha', 'beta']);
});

test('typing + Enter adds a tag and fires tags-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-tag') as HTMLElement & {
      rendered?: Promise<void>;
      tags?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('tags-change', (e) => (detail = (e as CustomEvent).detail));

    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    input.value = 'hello';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    return { tags: el.tags, detail, cleared: input.value, chips: el.shadowRoot!.querySelectorAll('.chip').length };
  });
  expect(r.tags).toEqual(['hello']);
  expect(r.detail).toEqual({ tags: ['hello'] });
  expect(r.cleared).toBe('');
  expect(r.chips).toBe(1);
});

test('clicking a chip × removes it (composed tag-remove) and fires tags-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-tag') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
      tags?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(['keep', 'drop']);
    await new Promise((res) => setTimeout(res, 20));

    const changes: unknown[] = [];
    el.addEventListener('tags-change', (e) => changes.push((e as CustomEvent).detail));

    // The second chip is a <sherpa-tag> with its own shadow; wait for it, then
    // click its internal close button — tag-remove is composed and retargets.
    const chip = el.shadowRoot!.querySelectorAll<HTMLElement & { rendered?: Promise<void> }>('.chip')[1]!;
    await chip.rendered;
    chip.shadowRoot!.querySelector<HTMLElement>('.close')!.click();

    return { tags: el.tags, changes, chips: el.shadowRoot!.querySelectorAll('.chip').length };
  });
  expect(r.tags).toEqual(['keep']);
  expect(r.changes).toEqual([{ tags: ['keep'] }]);
  expect(r.chips).toBe(1);
});

test('duplicate tags are rejected', async ({ page }) => {
  const tags = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-tag') as HTMLElement & {
      rendered?: Promise<void>;
      tags?: string[];
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const add = (v: string) => {
      input.value = v;
      input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    };
    add('dup');
    add('dup');
    return el.tags;
  });
  expect(tags).toEqual(['dup']);
});

test('disabled disables the inner input', async ({ page }) => {
  const disabled = await page.evaluate(async () => {
    const el = document.createElement('sherpa-input-tag') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector<HTMLInputElement>('.control')!.disabled;
  });
  expect(disabled).toBe(true);
});
