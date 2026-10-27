import { test, expect } from './harness';

/**
 * ON/OFF SHAPES — Will, TODO 497. With the page's `data-toggle-shapes`, a toggle
 * shows its state by a shape, not by its fill alone: an ON filter chip leads with
 * a tick, and the simple Switch's knob wears one. Off the page's setting, or off
 * the control, no tick.
 * TRAP T-a-toggle-shows-its-state-by-a-shape
 */
test('with data-toggle-shapes, an ON chip and a simple Switch that is on wear a tick; otherwise none', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chip = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void>; current: boolean };
    chip.setAttribute('data-label', 'Status');
    const sw = document.createElement('sherpa-switch') as HTMLElement & { rendered?: Promise<void>; checked: boolean };
    sw.setAttribute('data-type', 'simple');
    document.getElementById('root')!.replaceChildren(chip, sw);
    await Promise.all([chip.rendered, sw.rendered]);
    const shown = () => ({
      chip: getComputedStyle(chip.shadowRoot!.querySelector('.tick')!).display !== 'none',
      sw: getComputedStyle(sw.shadowRoot!.querySelector('.tick')!).display !== 'none',
    });
    const states: Record<string, unknown> = {};
    chip.current = true;
    sw.checked = true;
    await window.__settled();
    states['page off'] = shown();
    document.documentElement.toggleAttribute('data-toggle-shapes', true);
    states['on'] = shown();
    chip.current = false;
    sw.checked = false;
    await window.__settled();
    states['off'] = shown();
    document.documentElement.removeAttribute('data-toggle-shapes');
    return states;
  });
  expect(r).toEqual({
    'page off': { chip: false, sw: false },
    on: { chip: true, sw: true },
    off: { chip: false, sw: false },
  });
});
