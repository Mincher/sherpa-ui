import { test, expect, type SherpaEl } from './harness';

/** A component STATE follows its Style mode token — TRAP T-a-state-colour-binds-the-style-mode. */

test('an on chip repaints when its Style mode token changes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chip = document.createElement('sherpa-quick-filter') as SherpaEl;
    chip.setAttribute('data-label', 'On');
    chip.setAttribute('data-current', '');
    document.getElementById('root')!.appendChild(chip);
    await chip.rendered;
    const body = chip.shadowRoot!.querySelector<HTMLElement>('.body')!;
    // The token wiring is under test, not the fade.
    body.style.transition = 'none';
    const read = () => {
      const s = getComputedStyle(body);
      return { bg: s.backgroundColor, border: s.borderTopColor, ink: s.color };
    };
    const before = read();
    // What a re-projection does when Figma moves the mode.
    const root = document.documentElement.style;
    root.setProperty('--sherpa-style-active-surface-base', 'rgb(1, 2, 3)');
    root.setProperty('--sherpa-style-active-border-base-1', 'rgb(4, 5, 6)');
    root.setProperty('--sherpa-style-active-content-base', 'rgb(7, 8, 9)');
    const after = read();
    for (const p of ['surface-base', 'border-base-1', 'content-base']) root.removeProperty(`--sherpa-style-active-${p}`);
    return { before, after };
  });
  expect(r.after).toEqual({ bg: 'rgb(1, 2, 3)', border: 'rgb(4, 5, 6)', ink: 'rgb(7, 8, 9)' });
  expect(r.before.bg).not.toBe('rgb(1, 2, 3)');
});

test('a pin reaches inside a shadow root: a toolbar that starts favourited lights its star', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const bar = document.createElement('sherpa-quick-filter-toolbar') as SherpaEl;
    bar.setAttribute('data-type', 'view');
    bar.setAttribute('data-favourite', '');
    document.getElementById('root')!.appendChild(bar);
    await bar.rendered;
    const star = bar.shadowRoot!.querySelector<SherpaEl>('[data-act="favourite"]')!;
    await star.rendered;
    const trigger = star.shadowRoot!.querySelector<HTMLElement>('.trigger')!;
    trigger.style.transition = 'none';
    const probe = document.createElement('div');
    probe.style.background = 'var(--sherpa-style-active-surface-base)';
    document.body.appendChild(probe);
    const want = getComputedStyle(probe).backgroundColor;
    probe.remove();
    return { status: star.getAttribute('data-status'), bg: getComputedStyle(trigger).backgroundColor, want };
  });
  // The star sits in the toolbar's shadow root, where tokens.css never reaches.
  // TRAP T-tokens-css-never-reaches-shadow
  expect(r.status).toBe('active');
  expect(r.bg).toBe(r.want);
});

test('a look token follows dark mode, as a ref does and a hex could not', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const item = document.createElement('sherpa-nav-item') as SherpaEl;
    item.setAttribute('data-label', 'Current');
    item.setAttribute('data-current', '');
    document.getElementById('root')!.appendChild(item);
    await item.rendered;
    item.style.transition = 'none';
    const html = document.documentElement;
    const read = () => ({
      ink: getComputedStyle(item).color,
      token: getComputedStyle(html).getPropertyValue('--sherpa-style-transparent-active-content-base').trim(),
    });
    html.dataset['mode'] = 'light';
    const light = read();
    html.dataset['mode'] = 'dark';
    const dark = read();
    delete html.dataset['mode'];
    return { light, dark };
  });
  // Both modes resolve to a real colour, so "differs" means something.
  expect(r.light.token).toMatch(/^#[0-9a-f]{6}$/i);
  expect(r.dark.token).toMatch(/^#[0-9a-f]{6}$/i);
  expect(r.dark.token).not.toBe(r.light.token);
  expect(r.dark.ink).not.toBe(r.light.ink);
});
