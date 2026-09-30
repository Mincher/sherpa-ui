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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      hasHeadingAttr: el.hasAttribute('data-has-heading'),
      // The default .title is FALLBACK content inside <slot name="heading">; a
      // filled slot leaves it unrendered (computed display is "" not "none"), so
      // assert the real contract — it isn't visible — via checkVisibility().
      textHidden: !el.shadowRoot!.querySelector('.title')!.checkVisibility(),
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const full = document.createElement('sherpa-container-header') as HeaderEl;
    full.setAttribute('data-heading', 'Full');
    full.innerHTML = '<button slot="actions">Act</button>';
    document.getElementById('root')!.appendChild(full);
    await full.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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
    // The close is a composed sherpa-button now, so the click has to land on its
    // own inner <button> — clicking the HOST produces no button-click, which is
    // exactly the point of listening for that event rather than a raw click.
    // `el.rendered` only covers the HEADER; the button is a child component with
    // its own render to wait for.
    const closeHost = el.shadowRoot!.querySelector('.close') as HTMLElement & {
      shadowRoot: ShadowRoot; rendered: Promise<void>;
    };
    await closeHost.rendered;
    const close = closeHost.shadowRoot.querySelector('button') as HTMLElement;
    // Visibility is the HOST's business — CSS reveals it off data-dismissible.
    const closeVisible = getComputedStyle(closeHost).display !== 'none';
    let dismissed = false;
    el.addEventListener('header-dismiss', () => (dismissed = true));
    close.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
    const toggleHost = el.shadowRoot!.querySelector('.toggle') as HTMLElement & {
      shadowRoot: ShadowRoot; rendered: Promise<void>;
    };
    await toggleHost.rendered;
    const toggle = toggleHost.shadowRoot.querySelector('button') as HTMLElement;
    let detail: unknown = null;
    el.addEventListener('header-collapse', (e) => (detail = (e as CustomEvent).detail));
    toggle.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
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
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const withMeta = document.createElement('sherpa-container-header') as HeaderEl;
    withMeta.setAttribute('data-heading', 'Meta');
    withMeta.innerHTML = '<span slot="metadata">Updated 2h ago</span>';
    document.getElementById('root')!.appendChild(withMeta);
    await withMeta.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

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
    panel.setAttribute('data-type', 'panel');
    panel.setAttribute('data-heading', 'Panel title');
    panel.innerHTML = '<span slot="metadata">buildings · Acme Corp</span>';
    document.getElementById('root')!.appendChild(panel);
    await panel.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const s = panel.shadowRoot!;
    const titleColor = getComputedStyle(s.querySelector('.title')!).color;
    const defaultTitleColor = getComputedStyle(dflt.shadowRoot!.querySelector('.title')!).color;
    return {
      variant: panel.getAttribute('data-type'),
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

test('the default variant: its description is the metadata row, and no link-style title', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-container-header') as HeaderEl;
    el.setAttribute('data-heading', 'Default header');
    el.setAttribute('data-description', 'A subtitle');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    return {
      variant: el.getAttribute('data-type'), // unset by default
      metadataVisible: getComputedStyle(s.querySelector('.metadata')!).display !== 'none',
      descriptionVisible: getComputedStyle(s.querySelector('.description')!).display !== 'none',
      title: s.querySelector('.title')!.textContent,
    };
  });
  expect(r.variant).toBeNull();
  // The description IS the metadata row's first line, as Figma's is (TODO 80).
  expect(r.metadataVisible).toBe(true);
  expect(r.descriptionVisible).toBe(true);
  expect(r.title).toBe('Default header');
});

/* Will, TODO 80: the header is Figma's GRID (912:33355) — LEFT · TITLE ·
   ACTIONS, the metadata under the TITLE (not the icon), 4 below; and a
   collapsible header's chevron LEADS, as the accordion variant has it. */
test('the header is Figma\'s grid: metadata under the title, 4 below; the chevron leads', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (attrs: Record<string, string>, inner = ''): Promise<HeaderEl> => {
      const el = document.createElement('sherpa-container-header') as HeaderEl;
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.innerHTML = inner;
      el.style.inlineSize = '576px';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
      return el;
    };
    const box = (el: HeaderEl, sel: string) => el.shadowRoot!.querySelector(sel)!.getBoundingClientRect();
    const full = await make({ 'data-heading': 'Header title', 'data-icon': 'home', 'data-description': 'Optional description' },
      '<sherpa-button slot="actions" data-type="icon" data-size="sm" data-icon-start="cross" aria-label="x"></sherpa-button>');
    const icon = box(full, '.icon');
    const title = box(full, '.labels');
    const meta = box(full, '.metadata');
    const bare = await make({ 'data-heading': 'Bare' });
    const fold = await make({ 'data-heading': 'Folds', 'data-collapsible': '' });
    return {
      metaUnderTitle: Math.round(meta.left) === Math.round(title.left) && meta.left > icon.right,
      metaGap: Math.round(meta.top - title.bottom),
      // The grid's own box: the rule under the host is drawn outside it.
      fullHeight: Math.round(box(full, '.header').height),
      bareHeight: Math.round(box(bare, '.header').height),
      // No leading cell: the title starts at the padding, with no gap spent.
      bareTitleAt: Math.round(box(bare, '.labels').left - bare.getBoundingClientRect().left),
      chevronLeads: box(fold, '.toggle').right <= box(fold, '.labels').left,
    };
  });
  expect(r.metaUnderTitle).toBe(true);
  expect(r.metaGap).toBeGreaterThanOrEqual(4);
  expect(r.fullHeight).toBe(60);
  // A title alone: its 20px line and the 8px padding — no row is spent on metadata.
  expect(r.bareHeight).toBe(36);
  expect(r.bareTitleAt).toBe(8);
  expect(r.chevronLeads).toBe(true);
});

