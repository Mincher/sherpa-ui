import { test, expect } from '@playwright/test';

/**
 * sherpa-section-header on the reforged base — the title-sync pattern (data-heading
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

test('data-heading writes the heading text', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-heading', 'Team members');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.shadowRoot!.querySelector('.title')!.textContent;
  });
  expect(text).toBe('Team members');
});

test('data-heading updates reactively after render', async ({ page }) => {
  const text = await page.evaluate(async () => {
    const el = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    el.setAttribute('data-heading', 'First');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-heading', 'Second');
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
      el.setAttribute('data-heading', 'x');
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
    el.setAttribute('data-heading', 'x');
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
    el.setAttribute('data-heading', 'x');
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
    el.setAttribute('data-heading', 'x');
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
    el.setAttribute('data-heading', 'ignored');
    const h = document.createElement('h3');
    h.setAttribute('slot', 'heading');
    h.textContent = 'Custom heading';
    el.appendChild(h);
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasHeading: el.hasAttribute('data-has-heading'),
      // Default .title is slot fallback; a filled slot leaves it unrendered
      // (display "" not "none"). Assert the real contract via checkVisibility().
      titleHidden: !el.shadowRoot!.querySelector('.title')!.checkVisibility(),
    };
  });
  expect(r.hasHeading).toBe(true);
  expect(r.titleHidden).toBe(true);
});

test('the bottom rule shows by default; data-divider="none" hides it', async ({ page }) => {
  // Ratified 2026-09-08 (visual-diff): Figma shows the section-header divider
  // ALWAYS — so it is default-on; data-divider="none" is the opt-out.
  const r = await page.evaluate(async () => {
    const byDefault = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    byDefault.setAttribute('data-heading', 'x');
    document.getElementById('root')!.appendChild(byDefault);
    await byDefault.rendered;

    const hidden = document.createElement('sherpa-section-header') as HTMLElement & {
      rendered?: Promise<void>;
    };
    hidden.setAttribute('data-heading', 'x');
    hidden.setAttribute('data-divider', 'none');
    document.getElementById('root')!.appendChild(hidden);
    await hidden.rendered;

    return {
      byDefault: getComputedStyle(byDefault.shadowRoot!.querySelector('.divider')!).display,
      hidden: getComputedStyle(hidden.shadowRoot!.querySelector('.divider')!).display,
    };
  });
  expect(r.byDefault).toBe('block');
  expect(r.hidden).toBe('none');
});
