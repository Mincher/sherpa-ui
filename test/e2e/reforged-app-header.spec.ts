import { test, expect } from './harness';

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

test.beforeEach(async ({ page }) => {
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
      icon: s.querySelector('.context-icon')!.textContent,
      iconVisible: getComputedStyle(s.querySelector('.context-icon')!).display !== 'none',
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
    await window.__settled();
    const shownText = badge.textContent;
    const shown = getComputedStyle(badge).display !== 'none';

    el.setAttribute('data-notifications', '0');
    await window.__settled();
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
      ['.notif-btn', 'notifications-click'],
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
    await window.__settled();

    return {
      seen,
      fired: actions.map(([, e]) => e),
      // No chat; and no star unasked — the View's ★ is `data-view-actions`' (TODO 425 G9).
      hasChat: !!s.querySelector('.chat'),
      hasStar: (s.querySelector('.favourite') as HTMLElement).getBoundingClientRect().width > 0,
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
    await window.__settled();
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
    await window.__settled();

    const crumbs = el.querySelector('sherpa-breadcrumbs[slot="breadcrumb"]') as WithRender;
    const qft = el.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');
    await crumbs.rendered;
    await window.__settled();

    // ONE NAME. The crumbs' own event bubbles composed, so it surfaces on the
    // header under its own name — the header used to re-emit it as
    // `breadcrumb-click`, which was the same action with two names.
    let clicked = false;
    el.addEventListener('breadcrumb-select', () => (clicked = true));
    crumbs.dispatchEvent(new CustomEvent('breadcrumb-select', {
      bubbles: true, composed: true, detail: { index: 0, label: 'Home' },
    }));
    await window.__settled();

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
        return icon ? (icon.getAttribute('data-icon') ?? icon.className) : n.className;
      });
    return { order };
  });

  // Read from the App Header node's `Actions` slot (150:3690). The order is the
  // design's, not a convenience: beaker stands alone and moon stands alone, which
  // is why the dividers fall where they do. The code used to group
  // chat+beaker+moon, with a chat button Figma does not have.
  /* These ARE the Figma names now. Each used to be a Font Awesome class with a
     comment saying which drawing it stood in for — `fa-flask` for beaker,
     `fa-user-gear` for user-settings — and the alias map did the translating.
     The names were migrated and the map deleted, so the comment and the value
     can no longer disagree. */
  expect(r.order).toEqual([
    'wand-magic-sparkles',      // Ask N-zo (AI)
    'beaker',
    '|',
    'moon',
    '|',
    'notifications',
    'badge',
    'user-settings',            // it opens SETTINGS, not a profile
    'headset',                  // talk to support, not read docs
    '|',
    'drag-handle-horizontal',   // app switcher — a grid, not a hamburger
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
    // The ones ON SCREEN: the phone's nav menu is not, at this width (TODO 17b).
    const hosts = [...el.shadowRoot!.querySelectorAll('sherpa-button[data-icon-start]')]
      .filter((b) => (b as HTMLElement).checkVisibility());
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
      ring: ((cs) => (cs.outlineStyle === 'none' ? 'none' : cs.outlineColor))(getComputedStyle(bell.shadowRoot!.querySelector('.trigger')!)),
    });

    const closed = read();
    el.setAttribute('data-notifications-open', '');
    await window.__settled();
    const opened = read();
    el.removeAttribute('data-notifications-open');
    await window.__settled();
    return { closed, opened, shut: read() };
  });

  expect(r.closed).toMatchObject({ open: false, ring: 'none' });
  expect(r.opened).toMatchObject({ open: true });
  // The ring is the accent one sherpa-button already owns — not a new colour.
  expect(r.opened['ring']).toContain('rgb(59, 76, 205)');
  // …and it goes away again. Off is not gone, but closed IS closed.
  expect(r.shut).toMatchObject({ open: false, ring: 'none' });
});

/* THE HOST TELLS THE HEADER, never reaches in: the mode on screen picks the
   theme button's glyph and words, and the bell is handed out to anchor to.
   TODO 191. TRAP T-a-shadow-reach-is-a-missing-door */
test('data-theme-mode picks the theme button, and notificationsAnchor is the bell', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender & { notificationsAnchor: HTMLElement };
    el.setAttribute('data-theme-toggle', '');
    el.setAttribute('data-notifications', '2');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const btn = el.shadowRoot!.querySelector('.theme-toggle')!;
    const light = [btn.getAttribute('data-icon-start'), btn.getAttribute('aria-label')];
    el.setAttribute('data-theme-mode', 'dark');
    const dark = [btn.getAttribute('data-icon-start'), btn.getAttribute('aria-label')];
    return { light, dark, bell: el.notificationsAnchor === el.shadowRoot!.querySelector('.notif-btn') };
  });
  expect(r).toEqual({
    light: ['moon', 'Switch to dark mode'], dark: ['sun', 'Switch to light mode'], bell: true,
  });
});

/* THE VIEW's own actions — ★, and Save with its ▾ — are the HEADER's, on its
   top row left of Ask N-zo: they never move, so they are not a toolbar's.
   Will, TODOs 425 G9 and 428 */
test('data-view-actions shows the View\'s own actions, and each fires its event', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement>('sherpa-app-header', undefined, { 'data-ai': '' });
    const shown = (sel: string) => (el.shadowRoot!.querySelector(sel) as HTMLElement).getBoundingClientRect().width > 0;
    const before = shown('.view-group');
    el.setAttribute('data-view-actions', '');
    await window.__settled();
    const heard: string[] = [];
    for (const ev of ['view-save', 'view-save-as', 'view-delete', 'data-refresh']) el.addEventListener(ev, () => heard.push(ev));
    // Left of Ask N-zo, on the top row.
    const left = el.shadowRoot!.querySelector('.view-group')!.getBoundingClientRect().right
      <= el.shadowRoot!.querySelector('.ai')!.getBoundingClientRect().left;
    const press = async (sel: string) => {
      (el.shadowRoot!.querySelector(sel)!.shadowRoot!.querySelector('button') as HTMLElement).click();
      await window.__settled();
    };
    await press('.save');
    const menu = el.shadowRoot!.querySelector('.view-menu')!;
    // Read OPEN: WebKit restyles a shut menu's rows only once it opens.
    await press('.view-more');
    const deleteShown = () => getComputedStyle(menu.querySelector('.view-delete')!).display !== 'none';
    const plain = deleteShown();
    el.setAttribute('data-custom-view', '');
    await window.__settled();
    const own = deleteShown();
    menu.querySelector<HTMLElement>('button[value="save-as"]')!.click();
    menu.querySelector<HTMLElement>('button[value="delete"]')!.click();
    await window.__settled();
    return { before, after: shown('.view-group'), heard, plain, own, left, refresh: !!el.shadowRoot!.querySelector('.refresh') };
  });
  // Refresh is the toolbar's, left of its ⋮. Will, TODO 428
  expect(r).toEqual({ before: false, after: true, heard: ['view-save', 'view-save-as', 'view-delete'], plain: false, own: true, left: true, refresh: false });
});

test('the star toggles, swaps its glyph, and reports both ways', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement>('sherpa-app-header', undefined, { 'data-view-actions': '' });

    const detail: boolean[] = [];
    el.addEventListener('view-favorite', (e) => detail.push((e as CustomEvent).detail.favourite));
    const star = el.shadowRoot!.querySelector('.favourite') as HTMLElement;
    const press = async () => {
      (star.shadowRoot!.querySelector('button') as HTMLElement).click();
      await window.__settled();
      return {
        on: el.hasAttribute('data-favourite'),
        icon: star.getAttribute('data-icon-start'),
        pressed: star.getAttribute('aria-pressed'),
        // The name says what the NEXT press does. Will, 2026-09-26.
        name: star.getAttribute('aria-label'),
        // The DRAWING, not the name — TRAP T-favourite-star-swaps-its-glyph.
        d: star.shadowRoot?.querySelector('svg path')?.getAttribute('d') ?? null,
      };
    };
    return { first: await press(), second: await press(), detail };
  });

  // The GLYPH carries the state too (outline → solid), so it survives for anyone
  // who cannot tell the brand purple from the default ink.
  expect(r.first).toMatchObject({ on: true, icon: 'star-filled', pressed: 'true', name: 'Remove from Favorites' });
  expect(r.second).toMatchObject({ on: false, icon: 'star', pressed: 'false', name: 'Add to Favorites' });
  /* The PATH must differ. Asserting the name alone is what let the two states
     resolve to one outline drawing for three months: the two weights were one
     Font Awesome name, and the weight token was dropped on the way in. They are
     two SEPARATE Figma drawings now — `star` and `star-filled`. */
  expect(r.first.d).toBeTruthy();
  expect(r.second.d).toBeTruthy();
  expect(r.first.d).not.toBe(r.second.d);
  expect(r.detail).toEqual([true, false]);
});


test('a favourited star takes the ACTIVE Style mode, face ring and ink', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement>('sherpa-app-header', undefined, { 'data-view-actions': '' });
    const star = el.shadowRoot!.querySelector('.favourite') as HTMLElement & {
      shadowRoot: ShadowRoot;
    };
    // WAIT OUT THE FADE, do not guess at it. The button transitions its
    // background, border and colour over 120ms, so a fixed wait samples the
    // middle of the animation under parallel load and reads an in-between
    // colour — rgb(255, 254, 255) instead of white, which looks like the toggle
    // failing to reverse rather than a test reading too early.
    const settled = async () => {
      const trigger = star.shadowRoot.querySelector('.trigger') as HTMLElement;
      await Promise.all(
        trigger.getAnimations().map((a) => a.finished.catch(() => undefined)),
      );
    };
    const read = () => {
      const t = getComputedStyle(star.shadowRoot.querySelector('.trigger')!);
      return {
        status: star.dataset['status'] ?? null,
        bg: t.backgroundColor,
        border: t.borderTopColor,
        ink: getComputedStyle(star.shadowRoot.querySelector('i')!).color,
      };
    };
    await settled();
    const off = read();
    (star.shadowRoot.querySelector('button') as HTMLElement).click();
    await settled();
    const on = read();

    // READ WHILE IT IS ON. These properties only exist in the favourited state,
    // so reading them after the second click returns empty strings — which is
    // what the first version of this test did, and it looked like the fix had
    // not worked at all.
    //
    // The trigger's OWN Style names are the exact chain it paints from, so the
    // comparison is like-for-like. Not a hand-converted hex (the browser rounds
    // #F2DFFF to 224, not the arithmetic 223) and not a probe elsewhere in the
    // tree (a light-DOM one resolves through tokens.css's [data-status] block,
    // a different chain).
    const sc = getComputedStyle(star.shadowRoot.querySelector('.trigger')!);
    const expected = {
      surface: sc.getPropertyValue('--sherpa-style-surface-base').trim(),
      border: sc.getPropertyValue('--sherpa-style-border-base').trim(),
      text: sc.getPropertyValue('--sherpa-style-content-base').trim(),
    };

    (star.shadowRoot.querySelector('button') as HTMLElement).click();
    await settled();

    return { off, on, backOff: read(), expected };
  });

  // Each resolved to a real colour, so the assertions below mean something — an
  // EMPTY value (the properties never reaching the button) is exactly the bug
  // this test exists for, and would otherwise pass silently.
  // Minified CSS may shorten a hex to 3 digits (#fff).
  expect(r.expected.surface).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  expect(r.expected.border).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);
  expect(r.expected.text).toMatch(/^#([0-9a-f]{3}|[0-9a-f]{6})$/i);

  // ACTIVE is a Style MODE in the design, not an invented colour. The pin
  // reaches the star inside the header's shadow root through the adopted
  // style-modes sheet — TRAP T-tokens-css-never-reaches-shadow.
  expect(r.on.status).toBe('active');

  // The ring and the ink PAINT differently from the default look. The face is
  // not asserted as changed: since 2026-09-24 the active mode's surface IS the
  // default surface in Figma. Not fixed triples either — the exact rgb depends
  // on the browser's rounding of the token hex, which is not what this tests.
  expect(r.on.border).not.toBe(r.off.border);
  expect(r.on.ink).not.toBe(r.off.ink);

  // …and they are the ACTIVE tokens, not some other colour: each painted value
  // carries the same leading channel as the property it came from.
  const firstChannel = (v: string): number => {
    const hex = /^#(..)/.exec(v);
    return hex ? parseInt(hex[1]!, 16) : Number(/(\d+)/.exec(v)?.[1] ?? -1);
  };
  expect(firstChannel(r.on.bg)).toBe(firstChannel(r.expected.surface));
  expect(firstChannel(r.on.border)).toBe(firstChannel(r.expected.border));
  expect(firstChannel(r.on.ink)).toBe(firstChannel(r.expected.text));

  // Off is the plain default look, and the toggle is REVERSIBLE — clicking again
  // returns every one of the three to exactly what it was.
  expect(r.off.status).toBe(null);
  expect(r.backOff.status).toBe(null);
  expect(r.backOff.bg).toBe(r.off.bg);
  expect(r.backOff.border).toBe(r.off.border);
  expect(r.backOff.ink).toBe(r.off.ink);
});


test('the view group is snapped: outer corners round, inner ones square', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<HTMLElement>('sherpa-app-header', undefined, { 'data-view-actions': '' });
    const kids = [...el.shadowRoot!.querySelector('.view-group')!.children] as HTMLElement[];
    return kids.map((k) => {
      const cs = getComputedStyle(k);
      const b = k.getBoundingClientRect();
      return {
        act: k.className,
        tl: parseFloat(cs.borderStartStartRadius),
        tr: parseFloat(cs.borderStartEndRadius),
        left: b.left,
        right: b.right,
      };
    });
  });

  // Figma's "Frame 1" joins the three at `structure-space/snapped` (0) so they sit
  // flush and read as ONE control. The rounding is set in the toolbar's own CSS, not
  // by [data-snap]: that selector lives in tokens.css, which is loaded into the
  // DOCUMENT and is deliberately not in sharedStyles, so it never reaches a
  // button inside this shadow root.
  expect(r.map((k) => k.act)).toEqual(['favourite', 'save', 'view-more']);
  expect(r[0]!.tl).toBeGreaterThan(0); // leading edge stays round
  expect(r[0]!.tr).toBe(0);
  expect(r[1]!.tl).toBe(0); // the middle is square all round
  expect(r[1]!.tr).toBe(0);
  expect(r[2]!.tl).toBe(0);
  expect(r[2]!.tr).toBeGreaterThan(0); // trailing edge stays round

  // …and they actually TOUCH, rather than merely looking square. The snap gap is
  // `--sherpa-structure-space-snapped`, which resolves to space/none = 0, so each
  // button starts exactly where the one before it ended — no gap, no overlap.
  // Compare with a tolerance, not `===`: sub-pixel layout makes the shared edge
  // tie only approximately.
  expect(r[1]!.left).toBeCloseTo(r[0]!.right, 2);
  expect(r[2]!.left).toBeCloseTo(r[1]!.right, 2);
});

test('the Context\'s icon and title share the actions\' row, left of them; the filters sit below', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-app-header') as WithRender;
    el.setAttribute('data-heading', 'Records');
    el.setAttribute('data-icon', 'table-columns');
    el.setAttribute('data-ai', '');
    el.style.inlineSize = '1200px';
    el.innerHTML = '<sherpa-quick-filter-toolbar slot="filters"></sherpa-quick-filter-toolbar>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await window.__settled();
    const s = el.shadowRoot!;
    const box = (sel: string) => s.querySelector(sel)!.getBoundingClientRect();
    const mid = (b: DOMRect) => Math.round(b.top + b.height / 2);
    return { title: mid(box('.title')), ai: mid(box('.ai')), titleRight: box('.title').right, aiLeft: box('.ai').left, filters: box('.filters').top };
  });
  // Will, TODO 434
  expect(r.title).toBe(r.ai);
  expect(r.titleRight).toBeLessThan(r.aiLeft);
  expect(r.filters).toBeGreaterThan(r.ai);
});
