import { test, expect } from '@playwright/test';

/**
 * sherpa-section-header on the reforged base — the title-sync pattern (data-title
 * writes .title text), the data-size heading scale, the data-divider rule, and the
 * data-has-{slot} reflection for description / actions / a custom heading.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('data-title writes the heading text', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'Team members');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.title')!.textContent;
  });
  expect(text).toBe('Team members');
});

test('data-title updates reactively after render', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'First');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-title', 'Second');
    return el.shadowRoot!.querySelector('.title')!.textContent;
  });
  expect(text).toBe('Second');
});

test('data-size scales the heading font size (sm < base < lg)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (size?: string) => {
      const el = document.createElement('sherpa-section-header') as HTMLElement & {
        rendered?: Promise<void>;
      };
      el.setAttribute('data-title', 'x');
      if (size) el.setAttribute('data-size', size);
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return parseFloat(getComputedStyle(el.shadowRoot!.querySelector('.title')!).fontSize);
    };
    return { sm: await mk('sm'), base: await mk(), lg: await mk('lg') };
  });
  expect(r.sm).toBeLessThan(r.base);
  expect(r.base).toBeLessThan(r.lg);
});

test('actions slot presence reflects to data-has-actions and shows the region', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    const btn = document.createElement('button');
    btn.setAttribute('slot', 'actions');
    btn.textContent = 'New';
    el.appendChild(btn);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // let the slotchange microtask settle
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasAttr: el.hasAttribute('data-has-actions'),
      display: getComputedStyle(el.shadowRoot!.querySelector('.actions')!).display,
    };
  });
  expect(r.hasAttr).toBe(true);
  expect(r.display).toBe('flex');
});

test('no actions slot leaves the actions region hidden', async ({ page }) => {
  const display = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.actions')!).display;
  });
  expect(display).toBe('none');
});

test('description slot presence shows the description region', async ({ page }) => {
  const display = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'x');
    const p = document.createElement('span');
    p.setAttribute('slot', 'description');
    p.textContent = 'A short blurb.';
    el.appendChild(p);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return getComputedStyle(el.shadowRoot!.querySelector('.description')!).display;
  });
  expect(display).toBe('block');
});

test('a slotted heading collapses the default .title', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-title', 'ignored');
    const h = document.createElement('h3');
    h.setAttribute('slot', 'heading');
    h.textContent = 'Custom heading';
    el.appendChild(h);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasHeading: el.hasAttribute('data-has-heading'),
      titleDisplay: getComputedStyle(el.shadowRoot!.querySelector('.title')!).display,
    };
  });
  expect(r.hasHeading).toBe(true);
  expect(r.titleDisplay).toBe('none');
});

test('data-divider shows the bottom rule', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const without = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    without.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(without);
    await without.rendered;

    const withDiv = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    withDiv.setAttribute('data-title', 'x');
    withDiv.setAttribute('data-divider', '');
    document.getElementById('root')!.appendChild(withDiv);
    await withDiv.rendered;

    return {
      without: getComputedStyle(without.shadowRoot!.querySelector('.divider')!).display,
      withDiv: getComputedStyle(withDiv.shadowRoot!.querySelector('.divider')!).display,
    };
  });
  expect(r.without).toBe('none');
  expect(r.withDiv).toBe('block');
});
