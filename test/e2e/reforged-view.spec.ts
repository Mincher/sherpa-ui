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
