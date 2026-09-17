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

test('renderView composes an id-addressed tree into the view frame', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { renderView } = await import('/dist/index.js');
    const { el } = renderView({
      root: 'body',
      shell: { nav: 'nav', header: 'hdr' },
      elements: {
        body: { type: 'sherpa-container', children: ['tag'] },
        tag: { type: 'sherpa-tag', props: {} },
        nav: { type: 'sherpa-nav' },
        hdr: { type: 'sherpa-container' },
      },
    }) as { el: HTMLElement };
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return {
      frame: el.className,
      navRegion: el.querySelector('[data-region="nav"]')?.tagName.toLowerCase() ?? null,
      headerRegion: el.querySelector('[data-region="header"]')?.tagName.toLowerCase() ?? null,
      bodyRegion: el.querySelector('[data-region="body"]')?.tagName.toLowerCase() ?? null,
      bodyTag: !!el.querySelector('sherpa-container sherpa-tag'),
    };
  });
  expect(r.frame).toBe('sherpa-view'); // light-DOM view frame, not a custom element
  expect(r.navRegion).toBe('sherpa-nav');
  expect(r.headerRegion).toBe('sherpa-container');
  expect(r.bodyRegion).toBe('sherpa-container');
  expect(r.bodyTag).toBe(true);
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
