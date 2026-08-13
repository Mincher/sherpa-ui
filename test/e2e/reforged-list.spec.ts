import { test, expect } from '@playwright/test';

/**
 * sherpa-list on the reforged base — data-driven rows via populate() (stamped
 * sherpa-list-item from the .row-tpl prototype), slotted-child mode, single
 * active row enforcement, and the empty state.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() =>
    Promise.all([
      customElements.whenDefined('sherpa-list'),
      customElements.whenDefined('sherpa-list-item'),
    ]),
  );
});

interface ListEl extends HTMLElement {
  rendered?: Promise<void>;
  populate: (data: unknown) => void;
}

const settle = () => new Promise((res) => setTimeout(res, 20));

test('populate stamps one sherpa-list-item per row from the prototype', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([
      { title: 'Alpha', description: 'first' },
      { title: 'Beta' },
      { title: 'Gamma', description: 'third' },
    ]);
    await new Promise((res) => setTimeout(res, 20));
    const s = el.shadowRoot!;
    const items = Array.from(s.querySelectorAll('.rows > sherpa-list-item'));
    return {
      count: items.length,
      titles: items.map((n) => n.getAttribute('data-title')),
      prototypePresent: !!s.querySelector('template.row-tpl'),
      allInteractive: items.every((n) => n.hasAttribute('data-interactive')),
    };
  });
  expect(r.count).toBe(3);
  expect(r.titles).toEqual(['Alpha', 'Beta', 'Gamma']);
  expect(r.prototypePresent).toBe(true); // proves cloning-prototype render
  expect(r.allInteractive).toBe(true); // data rows are interactive by default
});

test('re-populating replaces the previous rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ title: 'Old 1' }, { title: 'Old 2' }]);
    await new Promise((res) => setTimeout(res, 20));
    el.populate([{ title: 'New' }]);
    await new Promise((res) => setTimeout(res, 20));
    return Array.from(el.shadowRoot!.querySelectorAll('.rows > sherpa-list-item')).map((n) =>
      n.getAttribute('data-title'),
    );
  });
  expect(r).toEqual(['New']);
});

test('clicking a stamped row keeps only that row active (single-active)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ title: 'One' }, { title: 'Two' }, { title: 'Three' }]);
    await new Promise((res) => setTimeout(res, 20));
    const items = Array.from(
      el.shadowRoot!.querySelectorAll<HTMLElement>('.rows > sherpa-list-item'),
    );
    items[0]!.click();
    await new Promise((res) => setTimeout(res, 5));
    items[2]!.click();
    await new Promise((res) => setTimeout(res, 5));
    return items.map((n) => n.hasAttribute('data-active'));
  });
  // Only the last-clicked row (index 2) stays active.
  expect(r).toEqual([false, false, true]);
});

test('slotted sherpa-list-item children are supported (data-has-content)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    el.innerHTML =
      '<sherpa-list-item data-title="Slotted A" data-interactive></sherpa-list-item>' +
      '<sherpa-list-item data-title="Slotted B" data-interactive></sherpa-list-item>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    return {
      hasContent: el.hasAttribute('data-has-content'),
      childCount: el.querySelectorAll(':scope > sherpa-list-item').length,
    };
  });
  expect(r.hasContent).toBe(true);
  expect(r.childCount).toBe(2);
});

test('single-active applies across slotted children too', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    el.innerHTML =
      '<sherpa-list-item data-title="A" data-interactive data-active></sherpa-list-item>' +
      '<sherpa-list-item data-title="B" data-interactive></sherpa-list-item>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    const kids = Array.from(el.querySelectorAll<HTMLElement>(':scope > sherpa-list-item'));
    kids[1]!.click(); // click B → A must deactivate
    await new Promise((res) => setTimeout(res, 5));
    return kids.map((n) => n.hasAttribute('data-active'));
  });
  expect(r).toEqual([false, true]);
});

test('empty-state message shows when there are no rows', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    el.setAttribute('data-empty', 'Nothing here yet');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    const empty = el.shadowRoot!.querySelector('.empty')!;
    return {
      visible: getComputedStyle(empty).display !== 'none',
      text: empty.textContent,
      hostFlag: el.hasAttribute('data-empty-visible'),
    };
  });
  expect(r.visible).toBe(true);
  expect(r.text).toBe('Nothing here yet');
  expect(r.hostFlag).toBe(true);
});

test('empty-state hides once rows are populated', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    el.setAttribute('data-empty', 'Nothing here yet');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 20));
    el.populate([{ title: 'Now populated' }]);
    await new Promise((res) => setTimeout(res, 20));
    const empty = el.shadowRoot!.querySelector('.empty')!;
    return {
      hostFlag: el.hasAttribute('data-empty-visible'),
      emptyDisplay: getComputedStyle(empty).display,
    };
  });
  expect(r.hostFlag).toBe(false);
  expect(r.emptyDisplay).toBe('none');
});

test('bordered variant collapses the inter-row gap', async ({ page }) => {
  const gap = await page.evaluate(async () => {
    const el = document.createElement('sherpa-list') as unknown as ListEl;
    el.setAttribute('data-variant', 'bordered');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ title: 'A' }, { title: 'B' }]);
    await new Promise((res) => setTimeout(res, 20));
    return getComputedStyle(el.shadowRoot!.querySelector('.body')!).rowGap;
  });
  expect(parseFloat(gap)).toBe(0);
});
