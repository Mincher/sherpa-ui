import { test, expect } from './harness';

/**
 * A minimised panel is a small HORIZONTAL tab, inset 16px from the side of its area as a docked panel is. A lone tab has
 * four rounded corners; several in one area are one control group: the shared edges square, the outer corners round.
 * TRAP T-a-minimised-panel-is-a-tab
 */
type Panel = HTMLElement & { rendered?: Promise<void>; show(): void; minimise(on: boolean): void };

for (const side of ['end', 'start'] as const) {
  test(`${side} area: one tab is a rounded pill inset 16px; three are stitched into one group`, async ({ page }) => {
    await page.setViewportSize({ width: 1500, height: 900 });
    const r = await page.evaluate(async (side) => {
      const root = document.getElementById('root')!;
      const panel = (id: string) => `<sherpa-overlay-panel id="${id}" slot="panel-${side}" open data-heading="Panel ${id}" data-minimisable data-fixed${side === 'start' ? '="start"' : ''}><p>${id}</p></sherpa-overlay-panel>`;
      root.innerHTML = `<sherpa-app-shell data-no-nav style="block-size: 100vh"><p>Context</p>${panel('a')}</sherpa-app-shell>`;
      await window.__settled();
      const radii = (id: string) => {
        const tab = document.getElementById(id)!.shadowRoot!.querySelector('.tab')!;
        const cs = getComputedStyle(tab);
        const b = tab.getBoundingClientRect();
        return { corners: [cs.borderTopLeftRadius, cs.borderTopRightRadius, cs.borderBottomRightRadius, cs.borderBottomLeftRadius], wide: b.width > b.height, left: Math.round(b.left), right: Math.round(innerWidth - b.right), top: Math.round(b.top), bottom: Math.round(b.bottom), group: tab.getAttribute('data-group') };
      };
      (document.getElementById('a') as Panel).minimise(true);
      await window.__settled();
      const one = radii('a');
      for (const id of ['b', 'c']) {
        const el = document.createRange().createContextualFragment(panel(id));
        document.querySelector('sherpa-app-shell')!.append(el);
      }
      await window.__settled();
      (document.getElementById('b') as Panel).minimise(true);
      (document.getElementById('c') as Panel).minimise(true);
      await window.__settled();
      return { one, three: ['a', 'b', 'c'].map(radii) };
    }, side);
    expect(r.one.wide).toBe(true);
    expect(r.one.group).toBe('vertical-solo');
    expect(r.one.corners).toEqual(['4px', '4px', '4px', '4px']);
    expect(side === 'end' ? r.one.right : r.one.left).toBe(16);
    expect(r.three.map((t) => t.group)).toEqual(['vertical-start', 'vertical-mid', 'vertical-end']);
    // The shared edges are square; the outer corners round.
    expect(r.three[0]!.corners).toEqual(['4px', '4px', '0px', '0px']);
    expect(r.three[1]!.corners).toEqual(['0px', '0px', '0px', '0px']);
    expect(r.three[2]!.corners).toEqual(['0px', '0px', '4px', '4px']);
    // One below the other, touching.
    expect(r.three[1]!.top).toBe(r.three[0]!.bottom);
    expect(r.three[2]!.top).toBe(r.three[1]!.bottom);
  });
}
