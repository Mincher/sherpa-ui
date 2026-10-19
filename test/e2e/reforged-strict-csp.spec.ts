import { test, expect } from './fixture';

/**
 * Sherpa runs on a page with a STRICT CSP — no inline script or style, and
 * Trusted Types enforced where the engine has them (TODO 215).
 * TRAP T-sherpa-runs-under-a-strict-csp
 */
test('templates, icons, an embedded calendar and a View\'s markup draw, and nothing is refused', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/test/reforged/csp.html');
  await page.waitForFunction(() => (window as unknown as { __cspReady?: boolean }).__cspReady === true);
  const r = await page.evaluate(async () => {
    const lib = '/dist/index.js';
    const { settled, parseViewMarkup } = await import(lib) as {
      settled(): Promise<void>; parseViewMarkup(markup: string): { fragment: DocumentFragment };
    };
    const root = document.getElementById('root')!;
    root.replaceChildren();
    const button = document.createElement('sherpa-button');
    button.setAttribute('data-icon-start', 'plus');
    button.textContent = 'Add';
    const menu = document.createElement('sherpa-menu');
    menu.setAttribute('data-inline', '');
    const calendar = document.createElement('sherpa-calendar');
    calendar.setAttribute('data-embedded', '');
    menu.append(calendar);
    root.append(button, menu);
    root.append(parseViewMarkup('<sherpa-badge>3</sherpa-badge>').fragment);
    await settled();
    const prev = menu.querySelector<HTMLElement>('.cal-header-projected .cal-prev');
    return {
      trustedTypes: typeof (window as unknown as { trustedTypes?: unknown }).trustedTypes !== 'undefined',
      button: (button.shadowRoot?.childElementCount ?? 0) > 0,
      icon: (button.shadowRoot?.querySelector('svg')?.childElementCount ?? 0) > 0,
      corner: prev ? getComputedStyle(prev).getPropertyValue('--sherpa-border-rounding-top-left').trim() : null,
      styled: prev?.getAttribute('style') ?? null,
      badge: (root.querySelector('sherpa-badge')?.shadowRoot?.childElementCount ?? 0) > 0,
      violations: (window as unknown as { __violations: string[] }).__violations,
    };
  });
  expect(r).toMatchObject({ button: true, icon: true, badge: true, violations: [] });
  expect(r.corner).toBe('4px');
  expect(r.styled).toBeNull();
  expect(errors).toEqual([]);
});
