import { test, expect } from './harness';

/**
 * A narrow panel folds its button groups into the "More actions" menu, a group at a time: the
 * modes first, then the docks, then the content's own; a row presses its control.
 * TRAP T-a-panel-folds-its-groups-into-the-more-menu
 */
type PanelEl = HTMLElement & { rendered?: Promise<void>; show(): void };

test('as the panel narrows its groups fold into the more menu, and a row presses its control', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 900 });
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-overlay-panel') as PanelEl;
    el.setAttribute('data-heading', 'A long panel heading');
    for (const a of ['data-minimisable', 'data-floatable', 'data-expandable', 'data-external', 'data-dismissible']) el.setAttribute(a, '');
    el.innerHTML = '<sherpa-button slot="actions" class="mine" data-size="sm" aria-label="Mine">Mine</sherpa-button>';
    el.style.setProperty('--_width', '640px');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    el.show();
    await window.__settled();
    const read = async (width: number) => {
      el.style.setProperty('--_width', `${width}px`);
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
      await window.__settled();
      const shown = (sel: string) => getComputedStyle(el.shadowRoot!.querySelector(sel)!).display !== 'none';
      return { modes: shown('.modes'), docks: shown('.docks'), custom: shown('.custom'), fold: shown('.fold') };
    };
    const out = { wide: await read(640), mid: await read(300), narrow: await read(256), minimised: false };
    // The first folded row is Minimise: choosing it presses that button.
    el.shadowRoot!.querySelector('.fold-menu')!.dispatchEvent(new CustomEvent('menu-select', { detail: { value: 'modes:0' } }));
    await window.__settled();
    out.minimised = el.getAttribute('data-mode') === 'tab';
    return out;
  });
  expect(r.wide).toEqual({ modes: true, docks: true, custom: true, fold: false });
  // The modes go first; the docks stay while the title still has its room.
  expect(r.mid).toMatchObject({ modes: false, docks: true, fold: true });
  expect(r.narrow).toMatchObject({ modes: false, fold: true });
  expect(r.minimised).toBe(true);
});
