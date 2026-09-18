import { test, expect } from './harness';

/**
 * renderElement + renderView on the reforged base — the JSON→view path. Proves the
 * reforged components compose declaratively from data: an element node builds an
 * element (props/slots/children/data), and a view-definition composes an id-addressed
 * tree with reactive $state binding, `writes` wiring, and the light-DOM view frame.
 */


test('renderElement builds an element with props, slots and children', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderElement } = await import('/dist/index.js');
    const el = renderElement({
      type: 'sherpa-container',
      props: { 'data-elevation': 'md' },
      slots: { header: { type: 'sherpa-tag', props: {}, children: [] } },
      children: [{ type: 'sherpa-button', props: { 'data-label': 'Go' } }],
    }) as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.appendChild(el);
    await (el as { rendered?: Promise<void> }).rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      elevation: el.getAttribute('data-elevation'),
      headerTag: el.querySelector('[slot="header"]')?.tagName.toLowerCase() ?? null,
      childButton: !!el.querySelector('sherpa-button'),
    };
  });
  expect(r.elevation).toBe('md');
  expect(r.headerTag).toBe('sherpa-tag');
  expect(r.childButton).toBe(true);
});

test('a whole SCREEN is one element: the app shell, named like any other', async ({ page }) => {
  /* TRAP T-the-shell-is-a-component-not-a-region-map.

     renderView used to take a `shell: { nav, header, body }` option that
     hand-built a <div class="sherpa-view"> and tagged each child with a
     data-region. That was a SECOND implementation of `sherpa-app-shell` — which
     already owns the frame, its nav state machine and its inset CSS, and which
     every screen in examples/ used instead. The option had exactly one
     consumer: this test.

     The shell is now an ELEMENT in the registry like everything else. Nothing
     had to be added to support it; the id registry already did. */
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el, elements } = renderView({
      root: 'shell',
      elements: {
        shell: {
          type: 'sherpa-app-shell',
          slots: { nav: 'nav', header: 'hdr' },
          children: ['body'],
        },
        nav: { type: 'sherpa-nav' },
        hdr: { type: 'sherpa-app-header' },
        body: { type: 'sherpa-container', children: ['tag'] },
        tag: { type: 'sherpa-tag', props: {} },
      },
    }) as { el: HTMLElement; elements: Record<string, HTMLElement> };
    document.getElementById('root')!.replaceChildren(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      // THE ROOT IS THE COMPONENT, not a div wearing a class.
      rootTag: el.tagName.toLowerCase(),
      // Named slots are filled by ID, and the slot attribute proves projection.
      navSlot: el.querySelector('sherpa-nav')?.getAttribute('slot') ?? null,
      headerSlot: el.querySelector('sherpa-app-header')?.getAttribute('slot') ?? null,
      // The body goes in the DEFAULT slot — no `slot` attribute at all.
      bodySlot: el.querySelector('sherpa-container')?.getAttribute('slot'),
      nested: !!el.querySelector('sherpa-container sherpa-tag'),
      // Every id still comes back, the shell included.
      ids: Object.keys(elements).sort(),
    };
  });

  expect(r.rootTag).toBe('sherpa-app-shell');
  expect(r.navSlot).toBe('nav');
  expect(r.headerSlot).toBe('header');
  expect(r.bodySlot).toBeNull();
  expect(r.nested).toBe(true);
  expect(r.ids).toEqual(['body', 'hdr', 'nav', 'shell', 'tag']);
});

test('$state data binding populates from state and re-populates on write', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el, state } = renderView({
      root: 'nav',
      state: { items: [{ id: 'a', label: 'Alpha' }] },
      elements: {
        nav: { type: 'sherpa-nav', data: { $state: '/items' } },
      },
    }) as { el: HTMLElement & { rendered?: Promise<void> }; state: { set: (p: string, v: unknown) => void } };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    // Scope to .content — the nav rail also stamps its default quick items
    // (Home · Recent · Favorites) into the header, which aren't state rows.
    const before = el.shadowRoot!.querySelectorAll('.content .nav-row').length;

    state.set('/items', [
      { id: 'a', label: 'Alpha' },
      { id: 'b', label: 'Beta' },
      { id: 'c', label: 'Gamma' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const after = el.shadowRoot!.querySelectorAll('.content .nav-row').length;
    return { before, after };
  });
  expect(r.before).toBe(1);
  expect(r.after).toBe(3); // the bound consumer re-populated from the state write
});

test('writes wiring: one element writes state, a bound consumer reacts', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el, state } = renderView({
      root: 'wrap',
      state: { picked: null },
      elements: {
        wrap: { type: 'sherpa-container', children: ['nav', 'echo'] },
        nav: {
          type: 'sherpa-nav',
          data: [
            { id: 'x', label: 'X' },
            { id: 'y', label: 'Y' },
          ],
          writes: [{ on: 'nav-select', to: '/picked', value: '$detail.id' }],
        },
        echo: { type: 'sherpa-tag', props: { 'data-label': { $state: '/picked' } } },
      },
    }) as { el: HTMLElement; state: { get: (p: string) => unknown } };
    document.getElementById('root')!.appendChild(el);

    // Wait deterministically for the nav to render + populate its rows.
    const nav = el.querySelector('sherpa-nav') as HTMLElement & { rendered?: Promise<void> };
    await nav.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const yRow = Array.from(nav.shadowRoot!.querySelectorAll<HTMLElement>('.nav-row')).find(
      (r) => r.dataset['id'] === 'y'
    )!;
    const yItem = yRow.querySelector('sherpa-nav-item') as HTMLElement & { rendered?: Promise<void> };
    await yItem.rendered;
    (yItem.shadowRoot!.querySelector('.nav-button, .nav-link') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const echo = el.querySelector('sherpa-tag')!;
    return { stateVal: state.get('/picked'), echoLabel: echo.getAttribute('data-label') };
  });
  expect(r.stateVal).toBe('y'); // nav-select wrote /picked
  expect(r.echoLabel).toBe('y'); // the $state-bound consumer updated
});

/**
 * `SessionStore.persist` — a preference that survives a reload, in one line.
 *
 * What every app was writing instead: a key constant, a try/catch to read, a
 * try/catch to write, and a wrapper to keep the two in step. Four pieces to get
 * right PER PREFERENCE — and `examples/index.html` had exactly that for the
 * theme, which is the copy every consumer would have made.
 */
test('persist restores on registration and writes through on every set', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { SessionStore } = await import('/dist/index.js');
    localStorage.removeItem('sherpa:session:/theme/mode');

    // FIRST VISIT: nothing stored, so the initial value stands.
    const a = new SessionStore({ theme: { mode: 'light' } });
    const restoredA = a.persist('/theme/mode');
    a.set('/theme/mode', 'dark');

    // A SECOND STORE, as a reload would build: the value is already there
    // BEFORE anything subscribes, which is the point — a theme picked last week
    // should not flash light first.
    const b = new SessionStore({ theme: { mode: 'light' } });
    const restoredB = b.persist('/theme/mode');
    const afterReload = b.get('/theme/mode');

    // A BRANCH write persists a leaf registered beneath it — otherwise setting
    // `/theme` would silently lose what setting `/theme/mode` keeps.
    b.set('/theme', { mode: 'light' });
    const c = new SessionStore({});
    c.persist('/theme/mode');
    const afterBranchWrite = c.get('/theme/mode');

    // A SUBSCRIBER on the branch hears a leaf write, which is why this is
    // addressed by pointer rather than by a flat key.
    const heard: unknown[] = [];
    c.subscribe('/theme', (v) => heard.push(v));
    c.set('/theme/mode', 'dark');

    // forget() stops persisting AND clears what was stored.
    c.forget('/theme/mode');
    const stored = localStorage.getItem('sherpa:session:/theme/mode');

    return { restoredA, restoredB, afterReload, afterBranchWrite, heard, stored };
  });

  expect(r.restoredA, 'nothing stored on a first visit').toBe(false);
  expect(r.restoredB, 'the second store finds the written value').toBe(true);
  expect(r.afterReload).toBe('dark');
  expect(r.afterBranchWrite).toBe('light');
  expect(r.heard).toEqual([{ mode: 'dark' }]);
  expect(r.stored, 'forget() clears storage').toBeNull();
});
