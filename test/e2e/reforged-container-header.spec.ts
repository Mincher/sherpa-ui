import { test, expect } from '@playwright/test';

/**
 * sherpa-container-header on the reforged base — the header bar for a container's
 * header slot. Exercises the title sync (data-heading → .title), the description
 * sync + its data-description visibility, the heading-slot override, and the
 * data-has-actions reflection for the trailing actions slot.
 *
 * Not registered by the harness index — the spec imports its module in-page.
 */

const HARNESS = '/test/reforged/harness.html';

type HeaderEl = HTMLElement & { rendered?: Promise<void> };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-container-header/sherpa-container-header.js');
    await customElements.whenDefined('sherpa-container-header');
  });
});

test('renders data-heading into the title node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'Overview');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { title: el.shadowRoot!.querySelector('.title')!.textContent };
  });
  expect(r.title).toBe('Overview');
});

test('data-heading and data-description update reactively after render', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'First');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-heading', 'Second');
    el.setAttribute('data-description', 'A subtitle');
    return {
      title: el.shadowRoot!.querySelector('.title')!.textContent,
      description: el.shadowRoot!.querySelector('.description')!.textContent,
      descVisible: getComputedStyle(el.shadowRoot!.querySelector('.description')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Second');
  expect(r.description).toBe('A subtitle');
  expect(r.descVisible).toBe(true);
});

test('description is hidden when data-description is absent', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'No sub');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { descVisible: getComputedStyle(el.shadowRoot!.querySelector('.description')!).display !== 'none' };
  });
  expect(r.descVisible).toBe(false);
});

test('the heading slot overrides data-heading', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'fallback');
    el.innerHTML = '<h2 slot="heading">Slotted</h2>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    return {
      hasHeadingAttr: el.hasAttribute('data-has-heading'),
      textHidden: getComputedStyle(el.shadowRoot!.querySelector('.title')!).display === 'none',
    };
  });
  expect(r.hasHeadingAttr).toBe(true);
  expect(r.textHidden).toBe(true);
});

test('the actions region hides when empty and appears when slotted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-container-header') as HeaderEl;
    bare.setAttribute('data-heading', 'Bare');
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const full = document.createElement('sherpa-container-header') as HeaderEl;
    full.setAttribute('data-heading', 'Full');
    full.innerHTML = '<button slot="actions">Act</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement) =>
      getComputedStyle(el.shadowRoot!.querySelector('.actions')!).display !== 'none';

    return {
      bareActionsVisible: vis(bare),
      fullActionsAttr: full.hasAttribute('data-has-actions'),
      fullActionsVisible: vis(full),
    };
  });
  expect(r.bareActionsVisible).toBe(false); // no actions, no dismiss, no toggle → hidden
  expect(r.fullActionsAttr).toBe(true);
  expect(r.fullActionsVisible).toBe(true);
});

test('data-draggable and data-icon reveal the drag handle and icon', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'Panel');
    el.setAttribute('data-draggable', '');
    el.setAttribute('data-icon', '📁');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      dragVisible: getComputedStyle(s.querySelector('.drag')!).display !== 'none',
      iconVisible: getComputedStyle(s.querySelector('.icon')!).display !== 'none',
      iconText: s.querySelector('.icon')!.textContent,
    };
  });
  expect(r.dragVisible).toBe(true);
  expect(r.iconVisible).toBe(true);
  expect(r.iconText).toBe('📁');
});

test('data-dismissible close button fires dismiss', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'X');
    el.setAttribute('data-dismissible', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const close = el.shadowRoot!.querySelector('.close') as HTMLElement;
    const closeVisible = getComputedStyle(close).display !== 'none';
    let dismissed = false;
    el.addEventListener('dismiss', () => (dismissed = true));
    close.click();
    await new Promise((res) => setTimeout(res, 0));
    return { closeVisible, dismissed };
  });
  expect(r.closeVisible).toBe(true);
  expect(r.dismissed).toBe(true);
});

test('data-collapsible toggle flips data-collapsed and fires toggle', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'Section');
    el.setAttribute('data-collapsible', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const toggle = el.shadowRoot!.querySelector('.toggle') as HTMLElement;
    let detail: unknown = null;
    el.addEventListener('toggle', (e) => (detail = (e as CustomEvent).detail));
    toggle.click();
    await new Promise((res) => setTimeout(res, 0));
    return { collapsedAfter: el.hasAttribute('data-collapsed'), detail };
  });
  expect(r.collapsedAfter).toBe(true);
  expect(r.detail).toEqual({ collapsed: true });
});

/* ── Panel variant + metadata slot ─────────────────────────────────────── */

test('the metadata slot is hidden when empty and appears when slotted', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bare = document.createElement('sherpa-container-header') as HeaderEl;
    bare.setAttribute('data-heading', 'Bare');
    document.getElementById('root')!.appendChild(bare);
    await bare.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const withMeta = document.createElement('sherpa-container-header') as HeaderEl;
    withMeta.setAttribute('data-heading', 'Meta');
    withMeta.innerHTML = '<span slot="metadata">Updated 2h ago</span>';
    document.getElementById('root')!.appendChild(withMeta);
    await withMeta.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const vis = (el: HTMLElement) =>
      getComputedStyle(el.shadowRoot!.querySelector('.metadata')!).display !== 'none';

    return {
      bareMetadataVisible: vis(bare),
      metaAttr: withMeta.hasAttribute('data-has-metadata'),
      metaVisible: vis(withMeta),
    };
  });
  expect(r.bareMetadataVisible).toBe(false); // no metadata slotted → hidden
  expect(r.metaAttr).toBe(true);
  expect(r.metaVisible).toBe(true);
});

test('the panel variant renders a link-style title and the metadata row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // A default header to contrast the title colour against.
    const dflt = document.createElement('sherpa-container-header') as HeaderEl;
    dflt.setAttribute('data-heading', 'Default');
    document.getElementById('root')!.appendChild(dflt);
    await dflt.rendered;

    const panel = document.createElement('sherpa-container-header') as HeaderEl;
    panel.setAttribute('data-variant', 'panel');
    panel.setAttribute('data-heading', 'Panel title');
    panel.innerHTML = '<span slot="metadata">buildings · Acme Corp</span>';
    document.getElementById('root')!.appendChild(panel);
    await panel.rendered;
    await new Promise((res) => setTimeout(res, 0));

    const s = panel.shadowRoot!;
    const titleColor = getComputedStyle(s.querySelector('.title')!).color;
    const defaultTitleColor = getComputedStyle(dflt.shadowRoot!.querySelector('.title')!).color;
    return {
      variant: panel.getAttribute('data-variant'),
      titleText: s.querySelector('.title')!.textContent,
      metadataVisible: getComputedStyle(s.querySelector('.metadata')!).display !== 'none',
      // panel title uses the content-link token → differs from the default title colour
      titleColorDiffers: titleColor !== defaultTitleColor,
    };
  });
  expect(r.variant).toBe('panel');
  expect(r.titleText).toBe('Panel title');
  expect(r.metadataVisible).toBe(true);
  expect(r.titleColorDiffers).toBe(true);
});

test('the default variant is unchanged: metadata hidden, no link-style title', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'Default header');
    el.setAttribute('data-description', 'A subtitle');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => setTimeout(res, 0));
    const s = el.shadowRoot!;
    return {
      variant: el.getAttribute('data-variant'), // unset by default
      metadataVisible: getComputedStyle(s.querySelector('.metadata')!).display !== 'none',
      descriptionVisible: getComputedStyle(s.querySelector('.description')!).display !== 'none',
      title: s.querySelector('.title')!.textContent,
    };
  });
  expect(r.variant).toBeNull();
  expect(r.metadataVisible).toBe(false); // no metadata slotted → hidden (Default)
  expect(r.descriptionVisible).toBe(true); // Default still shows description
  expect(r.title).toBe('Default header');
});
