import { test, expect } from '@playwright/test';

/**
 * sherpa-app-header on the reforged base — rebuilt to the Figma "App Header":
 * two rows (history+actions, then view details with an embedded quick-filter
 * toolbar) over a loading bar. Covers title/icon mirror, the notification count
 * badge, the back / favourite / export events, breadcrumb re-dispatch, the
 * loading bar, and populate() composing breadcrumbs + filters.
 *
 * The component isn't registered by the harness index, so the spec imports the
 * compiled module (and the composed children) to trigger customElements.define().
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist/components/sherpa-app-header/sherpa-app-header.js');
    await customElements.whenDefined('sherpa-app-header');
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void>; populate?: (d: unknown) => void };

test('data-heading / data-icon mirror into the view row', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    el.setAttribute('data-heading', 'Dashboards');
    el.setAttribute('data-icon', '📊');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    return {
      title: s.querySelector('.title')!.textContent,
      icon: s.querySelector('.view-icon')!.textContent,
      iconVisible: getComputedStyle(s.querySelector('.view-icon')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Dashboards');
  expect(r.icon).toBe('📊');
  expect(r.iconVisible).toBe(true);
});

test('data-notifications shows a count badge; 0/unset hides it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const badge = el.shadowRoot!.querySelector('.notif-badge')!;
    const hidden = getComputedStyle(badge).display === 'none';

    el.setAttribute('data-notifications', '5');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const shownText = badge.textContent;
    const shown = getComputedStyle(badge).display !== 'none';

    el.setAttribute('data-notifications', '0');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const clearedAttr = el.hasAttribute('data-notifications');

    return { hidden, shownText, shown, clearedAttr };
  });
  expect(r.hidden).toBe(true); // unset → no badge
  expect(r.shown).toBe(true);
  expect(r.shownText).toBe('5');
  expect(r.clearedAttr).toBe(false); // 0 removes the attribute → hidden again
});

test('every header action fires its event', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    // Each action is opt-in, so turn them all on for this test.
    // No `chat` and no `favorite-action`: read from the Figma node (App Header
    // 150:3690), neither exists — the code had invented a chat button, and the
    // view-level Filter Toolbar below the header carries the ★.
    for (const flag of ['back', 'ai', 'labs', 'theme-toggle', 'account', 'help', 'menu']) {
      el.setAttribute(`data-${flag}`, '');
    }
    el.setAttribute('data-notifications', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    // The header's own `rendered` resolves when ITS shadow root exists; the
    // composed sherpa-buttons inside still have none, so their inner <button> is
    // not reachable yet.
    await Promise.all(
      [...s.querySelectorAll('sherpa-button')].map(
        (b) => (b as HTMLElement & { rendered?: Promise<void> }).rendered,
      ),
    );

    // One event per Figma action button, in header order.
    const actions: ReadonlyArray<readonly [string, string]> = [
      ['.back', 'back-click'],
      ['.ai', 'ai-click'],
      ['.labs', 'labs-click'],
      ['.theme-toggle', 'theme-toggle'],
      ['.notif-btn', 'notifications-open'],
      ['.account', 'account-click'],
      ['.help', 'help-click'],
      ['.menu', 'menu-click'],
    ];
    const seen: Record<string, unknown> = {};
    for (const [, event] of actions) el.addEventListener(event, () => (seen[event] = true));

    // Each action is a composed <sherpa-button>, so the real control is the
    // <button> inside ITS shadow root — clicking the host does not press it.
    for (const [sel] of actions) {
      const host = s.querySelector(sel) as HTMLElement & { shadowRoot: ShadowRoot };
      (host.shadowRoot.querySelector('button') as HTMLElement).click();
    }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      seen,
      fired: actions.map(([, e]) => e),
      // Neither exists any more — asserted so a re-added one is noticed.
      hasChat: !!s.querySelector('.chat'),
      hasStar: !!s.querySelector('.favorite'),
    };
  });
  for (const event of r.fired) expect(r.seen[event]).toBe(true);
  expect(r.hasChat).toBe(false);
  expect(r.hasStar).toBe(false);
});

test('data-loading reveals the loading bar', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const bar = el.shadowRoot!.querySelector('.loading-bar') as HTMLElement;
    const read = () => ({
      display: getComputedStyle(bar).display,
      position: getComputedStyle(bar).position,
      // It must never add height to the header, loading or not.
      headerHeight: Math.round(el.getBoundingClientRect().height),
    });
    const before = read();
    el.setAttribute('data-loading', '');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const after = read();
    return { before, after };
  });

  // ABSENT, not merely invisible. `visibility: hidden` (what this used to assert)
  // still reserved the bar's 2px at the header's bottom edge — and a 2px strip of
  // empty space against the content below reads exactly like a grey bottom rule.
  expect(r.before.display).toBe('none');
  expect(r.after.display).toBe('block');

  // …and when it IS showing it is an OVERLAY on the header's bottom edge, so it
  // costs no height either way. The header must be the same size both times.
  expect(r.after.position).toBe('absolute');
  expect(r.after.headerHeight).toBe(r.before.headerHeight);
});

test('populate() composes breadcrumbs + a quick-filter toolbar, and breadcrumb-select surfaces', async ({ page }) => {
  const r = await page.evaluate(async () => {
    await import('/dist/components/sherpa-breadcrumbs/sherpa-breadcrumbs.js');
    await import('/dist/components/sherpa-quick-filter-toolbar/sherpa-quick-filter-toolbar.js');
    const el = document.createElement('sherpa-app-header') as WithRender;
    // populate() only wires UP consumer-slotted children — it never creates them.
    // Pre-place the empty hosts in the light DOM before calling populate().
    el.innerHTML =
      '<sherpa-breadcrumbs slot="breadcrumb"></sherpa-breadcrumbs>' +
      '<sherpa-quick-filter-toolbar slot="filters"></sherpa-quick-filter-toolbar>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({
      breadcrumb: [{ label: 'Home' }, { label: 'Reports' }],
      filters: [{ id: 'all', label: 'All', active: true }, { id: 'mine', label: 'Mine' }],
    });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const crumbs = el.querySelector('sherpa-breadcrumbs[slot="breadcrumb"]') as WithRender;
    const qft = el.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    await crumbs.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    // ONE NAME. The crumbs' own event bubbles composed, so it surfaces on the
    // header under its own name — the header used to re-emit it as
    // `breadcrumb-click`, which was the same action with two names.
    let clicked = false;
    el.addEventListener('breadcrumb-select', () => (clicked = true));
    crumbs.dispatchEvent(new CustomEvent('breadcrumb-select', {
      bubbles: true, composed: true, detail: { index: 0, label: 'Home' },
    }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      hasCrumbs: !!crumbs,
      hasFilters: !!qft,
      clicked,
    };
  });
  expect(r.hasCrumbs).toBe(true);
  expect(r.hasFilters).toBe(true);
  expect(r.clicked).toBe(true); // breadcrumb-select reaches a listener on the header
});

test('the action cluster is in Figma order, with Figma glyphs', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    for (const flag of ['back', 'ai', 'labs', 'theme-toggle', 'account', 'help', 'menu']) {
      el.setAttribute(`data-${flag}`, '');
    }
    el.setAttribute('data-notifications', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const s = el.shadowRoot!;
    // Composed children render after the host, and a button with no shadow root
    // measures zero-width — which the `shown` filter below would then drop.
    await Promise.all(
      [...s.querySelectorAll('sherpa-button')].map(
        (b) => (b as HTMLElement & { rendered?: Promise<void> }).rendered,
      ),
    );

    // Everything the cluster draws, in DOM order, skipping what CSS hides.
    const shown = (n: Element) => (n as HTMLElement).getBoundingClientRect().width > 0;
    const order = [...s.querySelector('.actions')!.children]
      .flatMap((n) => (n.classList.contains('notifications') ? [...n.children] : [n]))
      .filter((n) => shown(n))
      .map((n) => {
        if (n.classList.contains('divider')) return '|';
        if (n.classList.contains('notif-badge')) return 'badge';
        // A composed sherpa-button keeps its glyph in its OWN shadow root; the
        // host only carries data-icon-start.
        const attr = n.getAttribute('data-icon-start');
        if (attr) return attr.replace('fa-solid fa-', '');
        const icon = n.querySelector('i');
        return icon ? icon.className.replace('fa-solid fa-', '') : n.className;
      });
    return { order };
  });

  // Read from the App Header node's `Actions` slot (150:3690). The order is the
  // design's, not a convenience: beaker stands alone and moon stands alone, which
  // is why the dividers fall where they do. The code used to group
  // chat+beaker+moon, with a chat button Figma does not have.
  expect(r.order).toEqual([
    'wand-magic-sparkles', // Ask N-zo (AI)
    'flask',               // beaker
    '|',
    'moon',
    '|',
    'bell',                // Figma: bell-ring — fa-bell-on is PRO and renders nothing
    'badge',
    'user-gear',           // Figma: user-settings — it opens SETTINGS
    'headset',             // Figma: headset — talk to support, not read docs
    '|',
    'grip',                // Figma: app-switcher — a grid, not a hamburger
  ]);
});

/* Narrower than reforged-icons.spec.ts on purpose, and both are worth having:
   that one scans the SOURCE, so it catches a Pro class the moment it is written;
   this one walks what the header actually RENDERS, so it also catches a glyph
   that never reaches the DOM. */
test('every action icon actually renders (an unknown name draws NOTHING)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    for (const flag of ['back', 'ai', 'labs', 'theme-toggle', 'account', 'help', 'menu']) {
      el.setAttribute(`data-${flag}`, '');
    }
    el.setAttribute('data-notifications', '3');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // Every action is a composed sherpa-button, so the drawing is inside ITS
    // shadow root — the host only carries the icon name as an attribute.
    const hosts = [...el.shadowRoot!.querySelectorAll('sherpa-button[data-icon-start]')];
    await Promise.all(hosts.map((b) => (b as HTMLElement & { rendered?: Promise<void> }).rendered));
    return hosts.map((b) => {
      const box = (b as HTMLElement & { shadowRoot: ShadowRoot })
        .shadowRoot.querySelector('.icon-start');
      const ink = box?.querySelector('path')?.getBoundingClientRect();
      return {
        name: b.getAttribute('data-icon-start') ?? '',
        hasSvg: box?.querySelector('svg') !== null && box?.querySelector('svg') !== undefined,
        inkW: ink?.width ?? 0,
        inkH: ink?.height ?? 0,
      };
    });
  });

  // An icon the set does not hold leaves the wrapper EMPTY — no drawing, no
  // error. `fa-bell-on` (Figma's `bell-ring`) was exactly that as a Pro webfont
  // class, and shipped blank until it was measured in a browser rather than
  // assumed from the name. Measuring the PATH is what catches it: the wrapper
  // is its full size either way.
  expect(r.length).toBeGreaterThan(0);
  for (const g of r) {
    expect(`${g.name}: has drawing`).toBe(`${g.name}: ${g.hasSvg ? 'has drawing' : 'EMPTY'}`);
    expect(Math.max(g.inkW, g.inkH), `${g.name}: painted nothing`).toBeGreaterThan(0);
  }
});

/**
 * A TRIGGER SHOWS WHAT IT OPENED.
 *
 * `sherpa-button` draws `data-open` for a menu it OWNS. The notifications
 * panel lives in the HOST, so the header had no way to know — the bell opened
 * a panel and went on looking closed.
 *
 * TRAP T-a-trigger-shows-what-it-opened
 */
test('the bell reports the panel state the host gives it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header');
    el.setAttribute('data-notifications', '4');
    document.getElementById('root')!.replaceChildren(el);
    await customElements.whenDefined('sherpa-app-header');
    await (el as HTMLElement & { rendered?: Promise<void> }).rendered;

    const bell = el.shadowRoot!.querySelector('.notif-btn') as HTMLElement & {
      rendered?: Promise<void>;
    };
    // A COMPOSED child renders on its own clock. TRAP T-custom-element-upgrade
    await customElements.whenDefined('sherpa-button');
    await bell.rendered;

    const read = (): Record<string, unknown> => ({
      open: bell.hasAttribute('data-open'),
      // `data-open` is what sherpa-button already draws its ring from.
      ring: getComputedStyle(bell.shadowRoot!.querySelector('.trigger')!).boxShadow,
    });

    const closed = read();
    el.setAttribute('data-notifications-open', '');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const opened = read();
    el.removeAttribute('data-notifications-open');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { closed, opened, shut: read() };
  });

  expect(r.closed).toMatchObject({ open: false, ring: 'none' });
  expect(r.opened).toMatchObject({ open: true });
  // The ring is the accent one sherpa-button already owns — not a new colour.
  expect(r.opened['ring']).toContain('rgb(59, 76, 205)');
  // …and it goes away again. Off is not gone, but closed IS closed.
  expect(r.shut).toMatchObject({ open: false, ring: 'none' });
});
