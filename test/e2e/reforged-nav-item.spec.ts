import { test, expect } from './fixture';

/**
 * sherpa-nav-item on the reforged base — a standalone nav row. Label / icon /
 * badge text from data-*, the current state, an optional promo variant, and the
 * item-click event (gated on disabled). The component isn't registered by
 * the harness index, so each test imports its compiled module first.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-nav-item/sherpa-nav-item.js');
    await customElements.whenDefined('sherpa-nav-item');
  });
});

interface NavItemEl extends HTMLElement {
  rendered?: Promise<void>;
  current?: boolean;
}

test('label, icon and badge render from data-* attributes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-icon', '⌂');
    el.setAttribute('data-label', 'Home');
    el.setAttribute('data-badge', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      icon: s.querySelector('.icon')!.textContent,
      label: s.querySelector('.label')!.textContent,
      badge: s.querySelector('.badge')!.textContent,
      badgeVisible: getComputedStyle(s.querySelector('.badge')!).display !== 'none',
    };
  });
  expect(r.icon).toBe('⌂');
  expect(r.label).toBe('Home');
  expect(r.badge).toBe('3');
  expect(r.badgeVisible).toBe(true);
});

test('badge stays hidden with no data-badge', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Plain');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return { display: getComputedStyle(el.shadowRoot!.querySelector('.badge')!).display };
  });
  expect(r.display).toBe('none');
});

test('data-href renders the row as a link', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Docs');
    el.setAttribute('data-href', '/docs');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    const link = s.querySelector('.nav-link') as HTMLAnchorElement;
    const button = s.querySelector('.nav-button') as HTMLElement;
    return {
      href: link.getAttribute('href'),
      linkVisible: getComputedStyle(link).display !== 'none',
      buttonVisible: getComputedStyle(button).display !== 'none',
    };
  });
  expect(r.href).toBe('/docs'); // the <a class="row-link"> carries the href
  expect(r.linkVisible).toBe(true); // data-href → the link is the active row
  expect(r.buttonVisible).toBe(false); // the plain <button> row is hidden
});

test('current setter reflects to data-current and styles the row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Reports');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // The pin is under test, not the fade: a timed wait read mid-flight under load.
    el.style.transition = 'none';
    el.current = true;
    const on = el.hasAttribute('data-current');
    // The HOST is the row box now (Figma's Navigation Item contains the tag and
    // the chevron), so the active fill and ink live there, not on the inner control.
    const cs = getComputedStyle(el);
    const styled = { bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight };
    el.current = false;
    // The mode's own tokens, resolved the same way, so the check follows Figma.
    const probe = document.createElement('div');
    probe.style.background = 'var(--sherpa-style-transparent-active-surface-base)';
    probe.style.color = 'var(--sherpa-style-transparent-active-content-base)';
    document.body.appendChild(probe);
    const mode = { bg: getComputedStyle(probe).backgroundColor, color: getComputedStyle(probe).color };
    probe.remove();
    return { on, off: el.hasAttribute('data-current'), ...styled, mode };
  });
  expect(r.on).toBe(true);
  expect(r.off).toBe(false);
  // Figma pins Transparent=active on the current row: that look's face and ink.
  // The label weight binds Theme weight/light (300) and does NOT change with the
  // mode. TRAP T-a-state-colour-binds-the-style-mode
  expect(r.bg).toBe(r.mode.bg);
  expect(r.color).toBe(r.mode.color);
  expect(r.weight).toBe('300');
});

test('click fires item-click with the label and href', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Reports');
    el.setAttribute('data-href', '/reports');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let detail: unknown = null;
    el.addEventListener('item-select', (e) => (detail = (e as CustomEvent).detail));
    el.click();
    return { detail };
  });
  expect(r.detail).toEqual({ label: 'Reports', href: '/reports' });
});

test('disabled item does not fire on click', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-label', 'Off');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let fired = false;
    el.addEventListener('item-select', () => (fired = true));
    el.click();
    return { fired };
  });
  expect(r.fired).toBe(false);
});

test('promo variant renders heading + description', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-type', 'promo');
    el.setAttribute('data-label', 'Upgrade');
    el.setAttribute('data-description', 'Unlock more');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      heading: s.querySelector('.promo-heading')?.textContent,
      description: s.querySelector('.promo-description')?.textContent,
      hasDefaultRow: !!s.querySelector('.nav'),
    };
  });
  expect(r.heading).toBe('Upgrade');
  expect(r.description).toBe('Unlock more');
  expect(r.hasDefaultRow).toBe(false); // promo template, not the default row
});

test('the tag renders INSIDE the row box, inset by the row padding', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const build = async (href: boolean, expandable: boolean): Promise<Record<string, unknown>> => {
      const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
      el.setAttribute('data-label', 'Endpoints');
      el.setAttribute('data-icon', 'fa-solid fa-desktop');
      el.setAttribute('data-badge', '1284');
      if (href) el.setAttribute('data-href', '#e');
      if (expandable) el.setAttribute('data-expandable', '');
      // The row is a flex child of the rail in real use; give it a width here so
      // the trailing inset is measurable.
      el.style.inlineSize = '304px';
      document.getElementById('root')!.appendChild(el);
      await el.rendered;

      const sr = el.shadowRoot!;
      // The VISIBLE row's badge — both templates carry one and CSS shows one.
      const badge = sr.querySelector<HTMLElement>(`${href ? '.nav-link' : '.nav-button'} .badge`)!;
      const hostRect = el.getBoundingClientRect();
      const badgeRect = badge.getBoundingClientRect();
      return {
        text: badge.textContent,
        // Figma puts the Tag inside the row box, so it must be within its bounds.
        inside: badgeRect.left >= hostRect.left && badgeRect.right <= hostRect.right,
        trailingInset: Math.round(hostRect.right - badgeRect.right),
        height: Math.round(badgeRect.height),
        radius: getComputedStyle(badge).borderTopLeftRadius,
      };
    };
    return { plain: await build(false, false), link: await build(true, false), parent: await build(true, true) };
  });

  // BOTH row templates must get the text. Writing only the first put it on the
  // hidden <button> row, leaving a link row's visible badge empty.
  expect(r.plain['text']).toBe('1284');
  expect(r.link['text']).toBe('1284');

  // Inside the box, not hanging off the end of it.
  expect(r.plain['inside']).toBe(true);
  expect(r.link['inside']).toBe(true);
  expect(r.parent['inside']).toBe(true);

  // Figma: the row's padding-right is space/xs 8, so a tag with nothing after it
  // sits 8px in. With the hasChildren chevron after it, 8 + 14 chevron + 8 gap = 30
  // — the chevron is 14 (size/icon/xs → content/size/base), matching the label.
  expect(r.link['trailingInset']).toBe(8);
  expect(r.parent['trailingInset']).toBe(30);

  // Figma Tag/Type=full at Structure xs: 16 tall, rounding/xl 16 (a pill).
  expect(r.link['height']).toBe(16);
  expect(r.link['radius']).toBe('16px');
});

test('a search match paints ONE tint: the mark and the row\'s ::highlight() read it from the CSS', async ({ page }) => {
  // TRAP T-custom-highlight-not-painted-in-shadow
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as HTMLElement & { rendered: Promise<void>; highlight(q: string): void };
    el.dataset['label'] = 'Home';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.highlight('Ho');
    const sr = el.shadowRoot!;
    const mark = sr.querySelector<HTMLElement>('.label mark.match')!;
    const own = sr.adoptedStyleSheets.flatMap((s) => [...s.cssRules].map((c) => c.cssText)).find((t) => t.includes('::highlight('));
    return {
      painted: getComputedStyle(mark).backgroundColor !== 'rgba(0, 0, 0, 0)',
      // No colour of its own: an engine without the API leaves no rule, and that is fine.
      highlightReadsTheTint: own === undefined || (own.includes('var(--_match-surface)') && !own.includes('#')),
    };
  });
  expect(r).toEqual({ painted: true, highlightReadsTheTint: true });
});

/** ONE shared highlight, its rule static CSS (TODO 344). TRAP T-custom-highlight-not-painted-in-shadow */
test('rows share one search highlight, and the last row out deletes it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (label: string) => {
      const el = document.createElement('sherpa-nav-item') as HTMLElement & { rendered: Promise<void>; highlight(q: string | null): void };
      el.dataset['label'] = label;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      return el;
    };
    document.getElementById('root')!.replaceChildren();
    const a = await make('Home');
    const b = await make('Homework');
    const reg = (CSS as unknown as { highlights: Map<string, Set<Range>> }).highlights;
    a.highlight('Ho');
    b.highlight('Ho');
    const both = { entries: [...reg.keys()].filter((k) => k.startsWith('sherpa')), size: reg.get('sherpa-nav-match')?.size };
    a.highlight(null);
    const one = reg.get('sherpa-nav-match')?.size;
    b.remove();
    const gone = reg.has('sherpa-nav-match');
    const rule = [...a.shadowRoot!.adoptedStyleSheets].some((s) => [...s.cssRules].some((c) => c.cssText.includes('::highlight(sherpa-nav-match)')));
    return { both, one, gone, rule };
  });
  // A row marks BOTH its labels (TRAP T-nav-item-writes-to-both-rows): two ranges a row.
  expect(r).toEqual({ both: { entries: ['sherpa-nav-match'], size: 4 }, one: 2, gone: false, rule: true });
});
