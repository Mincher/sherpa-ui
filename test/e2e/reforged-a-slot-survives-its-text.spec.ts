import { test, expect } from './harness';

/**
 * A text prop and a slot share a box: the text is the FALLBACK, and slotted
 * content wins — filled at the first render, filled later, or only whitespace.
 * The text never overwrites the slot. TRAP T-slot-guards-only-when-filled
 */
test('a slotted icon, heading or caption shows, whenever it arrives; the text shows when none does', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const frames = () => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    const shown = (el: Element | null) => !!el && (el as HTMLElement).getClientRects().length > 0;
    root.innerHTML = '<sherpa-container-header data-heading="A"><span slot="icon" id="star1">★</span></sherpa-container-header>'
      + '<sherpa-container-header data-heading="B" data-icon="home" id="late"></sherpa-container-header>'
      + '<sherpa-toast id="t1"></sherpa-toast>'
      + '<sherpa-toast id="t2" data-heading="Saved">\n  </sherpa-toast>'
      + '<sherpa-gauge-chart id="g" value="5" data-caption="Plain"></sherpa-gauge-chart>';
    const els = [...root.children] as (HTMLElement & { rendered: Promise<void> })[];
    await Promise.all(els.map((e) => e.rendered));
    // Content that arrives after the first render.
    const star2 = Object.assign(document.createElement('span'), { slot: 'icon', id: 'star2', textContent: '☆' });
    root.querySelector('#late')!.append(star2);
    const hello = document.createTextNode('Hello');
    root.querySelector('#t1')!.append(hello);
    const rich = Object.assign(document.createElement('b'), { slot: 'caption', textContent: 'Rich' });
    root.querySelector('#g')!.append(rich);
    await frames();
    const t2 = root.querySelector('#t2')!.shadowRoot!;
    const g = root.querySelector('#g')!.shadowRoot!;
    return {
      iconAtFirst: !!document.getElementById('star1')!.assignedSlot,
      iconLater: !!star2.assignedSlot,
      headingLater: !!hello.assignedSlot,
      whitespaceShowsText: shown(t2.querySelector('.heading')) && (t2.querySelector('.heading') as HTMLElement).innerText.trim(),
      captionLater: !!rich.assignedSlot && !shown(g.querySelector('.caption-text')),
    };
  });
  expect(r).toEqual({ iconAtFirst: true, iconLater: true, headingLater: true, whitespaceShowsText: 'Saved', captionLater: true });
});
