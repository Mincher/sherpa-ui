import { test, expect } from './harness';

/**
 * A CUSTOM TITLE FOLLOWS ITS KIND (Will, 2026-11-11): a node with a name of its own says its kind first in its
 * header, "Field: Device type"; its data-heading stays its own name. One with none, or one that already starts
 * with its kind, is as it was. TRAP T-a-custom-title-follows-its-kind
 */
test('a node\'s header says its kind before a name of its own, and only once', async ({ page }) => {
  const titles = await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as HTMLElement & { rendered: Promise<void> };
    el.style.cssText = 'inline-size: 800px; block-size: 500px';
    el.innerHTML = '<sherpa-node id="own" data-heading="Device type" data-kind="Field" data-x="40" data-y="40"></sherpa-node>'
      + '<sherpa-node id="none" data-heading="Source" data-x="400" data-y="40"></sherpa-node>'
      + '<sherpa-node id="once" data-heading="Field: Device type" data-kind="Field" data-x="40" data-y="240"></sherpa-node>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const nodes = [...el.querySelectorAll<HTMLElement & { rendered: Promise<void> }>('sherpa-node')];
    await Promise.all(nodes.map((n) => n.rendered));
    const said = (id: string) => el.querySelector(`#${id}`)!.shadowRoot!.querySelector('.heading')!.getAttribute('data-heading');
    const before = said('own');
    el.querySelector('#own')!.setAttribute('data-kind', 'Value');
    return { own: before, moved: said('own'), none: said('none'), once: said('once') };
  });
  expect(titles).toEqual({ own: 'Field: Device type', moved: 'Value: Device type', none: 'Source', once: 'Field: Device type' });
});
