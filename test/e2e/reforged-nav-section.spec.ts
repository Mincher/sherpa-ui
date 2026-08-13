import { test, expect } from '@playwright/test';

/**
 * sherpa-nav-section on the reforged base — a settings-style panel of grouped
 * nav items. populate() stamps groups + item rows (cloning prototypes), the
 * heading comes from data-heading, data-active-id marks the active row, and a
 * click fires nav-section-select. Not registered by the harness index, so each
 * test imports its compiled module first.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-nav-section/sherpa-nav-section.js');
    await customElements.whenDefined('sherpa-nav-section');
  });
});

interface SectionEl extends HTMLElement {
  rendered?: Promise<void>;
  populate?: (d: unknown) => void;
}

const SECTIONS = [
  { label: 'Account', items: [{ id: 'profile', label: 'Profile' }, { id: 'billing', label: 'Billing' }] },
  { label: 'Workspace', items: [{ id: 'members', label: 'Members', icon: '★' }] },
];

test('renders groups + items from populate() and the heading from data-*', async ({ page }) => {
  const r = await page.evaluate(async (sections) => {
    const el = document.createElement('sherpa-nav-section') as unknown as SectionEl;
    el.setAttribute('data-heading', 'Settings');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(sections);
    await new Promise((res) => setTimeout(res, 10));
    const s = el.shadowRoot!;
    return {
      heading: s.querySelector('.heading')!.textContent,
      groups: s.querySelectorAll('.group').length,
      items: s.querySelectorAll('.item-row').length,
      groupLabels: Array.from(s.querySelectorAll('.group-label')).map((g) => g.textContent),
      icon: s.querySelector('.item-row[data-id="members"] .item-icon')!.textContent,
    };
  }, SECTIONS);
  expect(r.heading).toBe('Settings');
  expect(r.groups).toBe(2);
  expect(r.items).toBe(3);
  expect(r.groupLabels).toEqual(['Account', 'Workspace']);
  expect(r.icon).toBe('★');
});

test('data-active-id marks the matching row active', async ({ page }) => {
  const r = await page.evaluate(async (sections) => {
    const el = document.createElement('sherpa-nav-section') as unknown as SectionEl;
    el.setAttribute('data-active-id', 'billing');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(sections);
    await new Promise((res) => setTimeout(res, 10));
    const s = el.shadowRoot!;
    const active = s.querySelector('.item-row[data-active] .item-label')?.textContent;
    const aria = s
      .querySelector('.item-row[data-active] .item')
      ?.getAttribute('aria-current');
    return { active, aria };
  }, SECTIONS);
  expect(r.active).toBe('Billing');
  expect(r.aria).toBe('page');
});

test('clicking an item fires nav-section-select and updates the active id', async ({ page }) => {
  const r = await page.evaluate(async (sections) => {
    const el = document.createElement('sherpa-nav-section') as unknown as SectionEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!(sections);
    await new Promise((res) => setTimeout(res, 10));

    let selected: string | null = null;
    el.addEventListener('nav-section-select', (e) => (selected = (e as CustomEvent).detail.id));

    el.shadowRoot!
      .querySelector<HTMLElement>('.item-row[data-id="members"] .item')!
      .click();
    await new Promise((res) => setTimeout(res, 10));

    return { selected, activeId: el.getAttribute('data-active-id') };
  }, SECTIONS);
  expect(r.selected).toBe('members');
  expect(r.activeId).toBe('members');
});

test('a group with no label hides its group-label', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-section') as unknown as SectionEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ items: [{ id: 'a', label: 'Alpha' }] }]);
    await new Promise((res) => setTimeout(res, 10));
    const label = el.shadowRoot!.querySelector('.group-label')!;
    return { display: getComputedStyle(label).display, items: el.shadowRoot!.querySelectorAll('.item-row').length };
  });
  expect(r.display).toBe('none');
  expect(r.items).toBe(1);
});
