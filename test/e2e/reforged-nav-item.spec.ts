import { test, expect } from '@playwright/test';

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
    el.current = true;
    const on = el.hasAttribute('data-current');
    // The row box transitions background-color over 100ms, so reading it in the
    // same task catches the START of the animation (transparent), not the target.
    // Wait for the transition to land rather than asserting a mid-flight value.
    await new Promise<void>((resolve) => {
      const done = (): void => resolve();
      el.addEventListener('transitionend', done, { once: true });
      setTimeout(done, 300);
    });
    // The HOST is the row box now (Figma's Navigation Item contains the tag and
    // the chevron), so the active fill and ink live there, not on the inner control.
    const cs = getComputedStyle(el);
    const styled = { bg: cs.backgroundColor, color: cs.color, weight: cs.fontWeight };
    el.current = false;
    return { on, off: el.hasAttribute('data-current'), ...styled };
  });
  expect(r.on).toBe(true);
  expect(r.off).toBe(false);
  // Figma Style=active: surface/active/base face + content-active ink. The label
  // weight binds Theme weight/light (300) and does NOT change with the mode.
  expect(r.bg).toBe('rgb(242, 223, 255)'); // #f2dfff
  expect(r.color).toBe('rgb(131, 0, 182)'); // #8300b6
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
    el.addEventListener('item-click', (e) => (detail = (e as CustomEvent).detail));
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
    el.addEventListener('item-click', () => (fired = true));
    el.click();
    return { fired };
  });
  expect(r.fired).toBe(false);
});

test('promo variant renders heading + description', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-nav-item') as unknown as NavItemEl;
    el.setAttribute('data-variant', 'promo');
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
  // sits 8px in. With the hasChildren chevron after it, 8 + 16 chevron + 8 gap.
  expect(r.link['trailingInset']).toBe(8);
  expect(r.parent['trailingInset']).toBe(32);

  // Figma Tag/Type=full at Structure xs: 16 tall, rounding/xl 16 (a pill).
  expect(r.link['height']).toBe(16);
  expect(r.link['radius']).toBe('16px');
});
