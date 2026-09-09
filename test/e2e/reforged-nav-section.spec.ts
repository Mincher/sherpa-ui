import { test, expect } from '@playwright/test';

/**
 * sherpa-nav-section on the reforged base — the Figma "Navigation Section" (32:43134):
 * a tiny section-label DIVIDER (a label + a hairline rule), NOT a settings panel.
 * data-label sets the text; data-collapsed (a collapsed rail) hides the label.
 * (The former settings-panel behaviour + item-select event were removed 2026-09-07.)
 */

const HARNESS = '/test/reforged/harness.html';

type SectionEl = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-nav-section'));
});

test('renders the label text from data-label + a rule line', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-section') as SectionEl;
    el.setAttribute('data-label', 'Workspace');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const label = el.shadowRoot!.querySelector('.label')!;
    const rule = el.shadowRoot!.querySelector('.rule');
    return { label: label.textContent, labelShown: getComputedStyle(label).display !== 'none', hasRule: !!rule };
  });
  expect(r.label).toBe('Workspace');
  expect(r.labelShown).toBe(true);
  expect(r.hasRule).toBe(true);
});

test('data-collapsed hides the label (collapsed rail)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-section') as SectionEl;
    el.setAttribute('data-label', 'Workspace');
    el.setAttribute('data-collapsed', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const label = el.shadowRoot!.querySelector('.label')!;
    return { labelShown: getComputedStyle(label).display !== 'none' };
  });
  expect(r.labelShown).toBe(false);
});

test('updating data-label re-renders the label text', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-section') as SectionEl;
    el.setAttribute('data-label', 'One');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-label', 'Two');
    return { label: el.shadowRoot!.querySelector('.label')!.textContent };
  });
  expect(r.label).toBe('Two');
});
