import { test, expect } from './harness';

/**
 * ON/OFF SHAPES — Will, TODOs 497, 503, 698. With the page's `data-toggle-shapes`, a
 * toggle shows its state by a shape, not by its fill alone: the Checkbox's box,
 * EMPTY while off and ticked while on — a filter chip's, a simple Switch's knob,
 * a grid tag's. Off the page's setting, no box.
 * TRAP T-a-toggle-shows-its-state-by-a-shape
 */
test('with data-toggle-shapes, a chip and a simple Switch wear a box, ticked while on; otherwise none', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const chip = document.createElement('sherpa-quick-filter') as HTMLElement & { rendered?: Promise<void>; current: boolean };
    chip.setAttribute('data-label', 'Status');
    const sw = document.createElement('sherpa-switch') as HTMLElement & { rendered?: Promise<void>; checked: boolean };
    sw.setAttribute('data-type', 'simple');
    document.getElementById('root')!.replaceChildren(chip, sw);
    await Promise.all([chip.rendered, sw.rendered]);
    const box = (el: HTMLElement) => {
      const tick = el.shadowRoot!.querySelector<HTMLElement>('.tick')!;
      if (getComputedStyle(tick).display === 'none') return 'none';
      return getComputedStyle(tick, '::before').content === 'none' ? 'empty' : 'ticked';
    };
    const shown = () => ({ chip: box(chip), sw: box(sw) });
    const states: Record<string, unknown> = {};
    chip.current = true;
    sw.checked = true;
    await window.__settled();
    states['page off'] = shown();
    document.documentElement.toggleAttribute('data-toggle-shapes', true);
    states['on'] = shown();
    // A step over its 14px text, so it reads. TODO 698
    const tick = chip.shadowRoot!.querySelector<HTMLElement>('.tick')!.getBoundingClientRect();
    states['chip box'] = [tick.width, tick.height];
    chip.current = false;
    sw.checked = false;
    await window.__settled();
    states['off'] = shown();
    document.documentElement.removeAttribute('data-toggle-shapes');
    return states;
  });
  expect(r).toEqual({
    'page off': { chip: 'none', sw: 'none' },
    on: { chip: 'ticked', sw: 'ticked' },
    'chip box': [16, 16],
    off: { chip: 'empty', sw: 'empty' },
  });
});
