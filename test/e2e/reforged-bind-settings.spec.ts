import { test, expect } from './fixture';

/**
 * A SETTING IS A POINTER: a control that says `data-setting="/pointer"` shows
 * that session value, and writes it back as the reader changes it — a switch
 * a boolean, a select its value, a number kept a number. TODO 191.
 * TRAP T-a-setting-is-a-pointer
 */
test('bindSettings draws each control from the session, writes its change back, and stops on abort', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  const r = await page.evaluate(`(async () => {
    const { SessionStore, bindSettings } = await import('/dist/index.js');
    const root = document.getElementById('root');
    root.innerHTML = '<sherpa-switch data-setting="/a/on"></sherpa-switch>'
      + '<sherpa-select-group data-setting="/a/size"></sherpa-select-group>';
    const [sw, group] = root.children;
    await Promise.all([sw.rendered, group.rendered]);
    await group.populate(['10', '25', '50'].map((value) => ({ value, label: value })));
    const session = new SessionStore({ a: { on: true, size: 25 } });
    const stop = new AbortController();
    bindSettings(root, session, { signal: stop.signal });
    const drawn = { on: sw.checked, size: group.value };
    sw.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { checked: false } }));
    group.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: '50' } }));
    const written = { on: session.get('/a/on'), size: session.get('/a/size') };
    session.set('/a/on', true);
    const redrawn = sw.checked;
    stop.abort();
    session.set('/a/on', false);
    group.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { value: '10' } }));
    return { drawn, written, redrawn, afterAbort: { checked: sw.checked, size: session.get('/a/size') } };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({
    drawn: { on: true, size: '25' },
    written: { on: false, size: 50 },
    redrawn: true,
    afterAbort: { checked: true, size: 50 },
  });
});

/* A NEW switch — its key holds no value yet — still writes a boolean, never its
   `value` "on": an app's `=== true` read it as off. TODO 331's Demos setting. */
test('a switch whose key holds nothing yet writes true and false', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
  const r = await page.evaluate(`(async () => {
    const { SessionStore, bindSettings } = await import('/dist/index.js');
    const root = document.getElementById('root');
    root.innerHTML = '<sherpa-switch data-setting="/fresh/flag"></sherpa-switch>';
    const sw = root.firstElementChild;
    await sw.rendered;
    const session = new SessionStore({});
    bindSettings(root, session);
    sw.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { checked: true, value: 'on' } }));
    const on = session.get('/fresh/flag');
    sw.dispatchEvent(new CustomEvent('change', { bubbles: true, detail: { checked: false, value: 'on' } }));
    return { on, off: session.get('/fresh/flag') };
  })()`) as Record<string, unknown>;
  expect(r).toEqual({ on: true, off: false });
});
