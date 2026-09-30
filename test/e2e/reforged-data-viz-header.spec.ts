import { test, expect } from './harness';

/**
 * sherpa-data-viz-header — Figma's Data Viz Header (1456:30467), TODO 9b: an
 * icon, a title in small light caps with an optional line under it, and
 * icon-only actions; 20 px tall with only a title, its 0.5 px rule inside it.
 */
test('the title is small light caps; the icon, the line under it and the actions show only when given', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const make = async (attrs: Record<string, string>, inner = ''): Promise<HTMLElement> => {
      const el = document.createElement('sherpa-data-viz-header') as HTMLElement & { rendered?: Promise<void> };
      el.style.inlineSize = '386px';
      for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
      el.innerHTML = inner;
      document.getElementById('root')!.appendChild(el);
      await el.rendered;
      await window.__settled();
      return el;
    };
    const look = (el: HTMLElement) => {
      const sr = el.shadowRoot!;
      const on = (s: string) => !!sr.querySelector<HTMLElement>(s)?.checkVisibility();
      const title = getComputedStyle(sr.querySelector('.title')!);
      return {
        height: Math.round(el.getBoundingClientRect().height),
        rule: getComputedStyle(el).boxShadow.includes('inset'),
        title: [title.fontSize, title.lineHeight, title.fontWeight, title.textTransform],
        text: sr.querySelector('.title')!.textContent,
        icon: on('.left'), line: on('.metadata'), actions: on('.actions'),
      };
    };
    const bare = look(await make({ 'data-heading': 'Alerts by category' }));
    const full = look(await make(
      { 'data-heading': 'Alerts', 'data-icon': 'home', 'data-description': 'Last 30 days' },
      '<sherpa-button slot="actions" data-type="icon" data-size="xs" data-icon-start="ellipses-vertical" aria-label="More"></sherpa-button>',
    ));
    return { bare, full };
  });
  expect(r.bare).toEqual({
    height: 20, rule: true, title: ['12px', '16px', '300', 'uppercase'],
    text: 'Alerts by category', icon: false, line: false, actions: false,
  });
  expect(r.full).toMatchObject({ icon: true, line: true, actions: true });
  // The line under the title: 2 + 16 + 2 + 16 + 2.
  expect(r.full.height).toBe(38);
});
