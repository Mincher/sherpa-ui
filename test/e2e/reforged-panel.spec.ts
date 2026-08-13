import { test, expect } from '@playwright/test';

/**
 * sherpa-panel on the reforged base — a titled, collapsible content panel.
 * Exercises the title sync (data-title → .title-text), the heading-slot override,
 * data-has-{slot} reflection for controls + footer, and the collapse toggle
 * (data-collapsed, aria-expanded, panel-toggle, body/footer folding away).
 *
 * The panel isn't registered by the harness index — the spec imports its module
 * in-page (like reforged-toast) to define the element before use.
 */

const HARNESS = '/test/reforged/harness.html';

type PanelEl = HTMLElement & { rendered?: Promise<void>; collapsed?: boolean };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-panel/sherpa-panel.js');
    await customElements.whenDefined('sherpa-panel');
  });
});

test('renders data-title into the header and defaults expanded', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-title', 'Details');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const toggle = el.shadowRoot!.querySelector('.toggle')!;
    return {
      title: el.shadowRoot!.querySelector('.title-text')!.textContent,
      collapsedAttr: el.hasAttribute('data-collapsed'),
      aria: toggle.getAttribute('aria-expanded'),
      bodyVisible: getComputedStyle(el.shadowRoot!.querySelector('.body')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Details');
  expect(r.collapsedAttr).toBe(false);
  expect(r.aria).toBe('true');
  expect(r.bodyVisible).toBe(true);
});

test('data-title updates reactively after render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-title', 'First');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-title', 'Second');
    return { title: el.shadowRoot!.querySelector('.title-text')!.textContent };
  });
  expect(r.title).toBe('Second');
});

test('the heading slot overrides data-title', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-title', 'fallback');
    el.innerHTML = '<h3 slot="heading">Slotted</h3><p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    return {
      hasHeadingAttr: el.hasAttribute('data-has-heading'),
      textHidden: getComputedStyle(el.shadowRoot!.querySelector('.title-text')!).display === 'none',
    };
  });
  expect(r.hasHeadingAttr).toBe(true);
  expect(r.textHidden).toBe(true);
});

test('controls + footer regions reflect data-has-{slot} and collapse when empty', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-panel') as PanelEl;
    bare.setAttribute('data-title', 'Bare');
    bare.innerHTML = '<p>body only</p>';
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const full = document.createElement('sherpa-panel') as PanelEl;
    full.setAttribute('data-title', 'Full');
    full.innerHTML =
      '<button slot="controls">C</button><p>body</p><div slot="footer">Actions</div>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement, sel: string) =>
      getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';

    return {
      bareControlsAttr: bare.hasAttribute('data-has-controls'),
      bareFooterVisible: vis(bare, '.footer'),
      fullControlsAttr: full.hasAttribute('data-has-controls'),
      fullControlsVisible: vis(full, '.controls'),
      fullFooterAttr: full.hasAttribute('data-has-footer'),
      fullFooterVisible: vis(full, '.footer'),
    };
  });
  expect(r.bareControlsAttr).toBe(false);
  expect(r.bareFooterVisible).toBe(false);
  expect(r.fullControlsAttr).toBe(true);
  expect(r.fullControlsVisible).toBe(true);
  expect(r.fullFooterAttr).toBe(true);
  expect(r.fullFooterVisible).toBe(true);
});

test('the toggle collapses the panel: data-collapsed, aria, folded body, panel-toggle event', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-title', 'Collapse me');
    el.innerHTML = '<p>body</p><div slot="footer">footer</div>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const events: boolean[] = [];
    el.addEventListener('panel-toggle', (e) => events.push((e as CustomEvent).detail.collapsed));

    const toggle = el.shadowRoot!.querySelector<HTMLElement>('.toggle')!;
    toggle.click(); // → collapsed
    const collapsedAttr = el.hasAttribute('data-collapsed');
    const collapsedAria = toggle.getAttribute('aria-expanded');
    const bodyHidden = getComputedStyle(el.shadowRoot!.querySelector('.body')!).display === 'none';
    const footerHidden = getComputedStyle(el.shadowRoot!.querySelector('.footer')!).display === 'none';

    toggle.click(); // → expanded
    const reExpandedAttr = el.hasAttribute('data-collapsed');

    return { events, collapsedAttr, collapsedAria, bodyHidden, footerHidden, reExpandedAttr };
  });
  expect(r.events).toEqual([true, false]);
  expect(r.collapsedAttr).toBe(true);
  expect(r.collapsedAria).toBe('false');
  expect(r.bodyHidden).toBe(true);
  expect(r.footerHidden).toBe(true);
  expect(r.reExpandedAttr).toBe(false);
});

test('the collapsed property toggles the attribute (read/write)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-panel') as PanelEl;
    el.setAttribute('data-title', 'Prop');
    el.innerHTML = '<p>body</p>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.collapsed = true;
    const afterSet = el.hasAttribute('data-collapsed');
    const getter = el.collapsed;
    return { afterSet, getter };
  });
  expect(r.afterSet).toBe(true);
  expect(r.getter).toBe(true);
});
