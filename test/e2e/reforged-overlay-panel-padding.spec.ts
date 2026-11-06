import { test, expect } from './harness';

/**
 * ONE PADDING for every overlay panel's content (Will, 847): the body's, a Display Mode space token (16px, the 4px
 * grid), so content never touches the panel's edge or the area's border; `data-padding="none"` for content that
 * fills it. The inset is read from the boxes. TRAP T-a-node-list-is-a-panels-content
 */
test('a panel pads its content by one token; none opts out', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-overlay-panel id="a" open data-heading="A" style="inline-size: 400px; block-size: 300px"><div id="ka" style="block-size: 40px"></div></sherpa-overlay-panel>'
      + '<sherpa-overlay-panel id="b" open data-heading="B" data-padding="none" style="inline-size: 400px; block-size: 300px"><div id="kb" style="block-size: 40px"></div></sherpa-overlay-panel>';
    await window.__settled();
    const inset = (p: string, k: string): number => {
      const body = (document.getElementById(p)!.shadowRoot!.querySelector('.body') as HTMLElement).getBoundingClientRect();
      return Math.round(document.getElementById(k)!.getBoundingClientRect().left - body.left);
    };
    const open = async (id: string): Promise<void> => { (document.getElementById(id) as unknown as { show(): void }).show(); await window.__settled(); };
    const body = document.getElementById('a')!.shadowRoot!.querySelector('.body') as HTMLElement;
    await open('a');
    const padded = inset('a', 'ka');
    const pad = getComputedStyle(body).paddingLeft;
    await open('b');
    return { padded, none: inset('b', 'kb'), pad };
  });
  expect(r).toEqual({ padded: 16, none: 0, pad: '16px' });
});
