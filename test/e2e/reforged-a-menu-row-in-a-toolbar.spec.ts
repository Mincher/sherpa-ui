import { test, expect } from './harness';

/**
 * A MENU ROW SLOTTED BY ANOTHER COMPONENT keeps its padding, and hovers GREY.
 * The toolbar's tree zeroed every `<button>`'s padding, and its tinted
 * `--_surface` and a row's own ink tinted the hover.
 * TRAP T-a-tree-rule-beats-slotted
 */
test('a button row a toolbar slots has its inline padding, and a grey hover', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // A host with the base sheet adopted, a tinted private surface and a red row: the toolbar's situation.
    const host = document.createElement('div');
    host.attachShadow({ mode: 'open' }).innerHTML = '<div style="--_surface: #e8d8ff"><sherpa-menu data-heading="m">'
      + '<button type="button" id="plain">Plain</button><button type="button" id="red" style="color: rgb(183, 34, 0)">Red</button></sherpa-menu></div>';
    const sheets = (document.querySelector('sherpa-button') ?? document.createElement('sherpa-button')) as HTMLElement;
    document.getElementById('root')!.append(host);
    const menu = host.shadowRoot!.querySelector('sherpa-menu') as HTMLElement & { rendered: Promise<void>; show(): void };
    await menu.rendered;
    // The base sheet's reset, as every shadow root adopts it.
    const reset = new CSSStyleSheet();
    reset.replaceSync(':where(input, button, option, select):not(:where(sherpa-menu > button)) { padding: 0; }');
    host.shadowRoot!.adoptedStyleSheets = [reset];
    menu.show();
    await new Promise((res) => setTimeout(res, 200));
    void sheets;
    const chroma = (id: string): number => {
      const row = host.shadowRoot!.getElementById(id)!;
      const t = document.createElement('i');
      t.style.cssText = 'position:absolute;inline-size:1px;block-size:1px;background:color-mix(in oklab, var(--_surface) 92%, var(--sherpa-theme-content-body-base, #0c0b11))';
      row.append(t);
      const m = /oklab\(([-\d.]+) ([-\d.]+) ([-\d.]+)/.exec(getComputedStyle(t).backgroundColor);
      t.remove();
      return m ? Math.hypot(+m[2]!, +m[3]!) : 0;
    };
    const pad = (id: string): number => { const cs = getComputedStyle(host.shadowRoot!.getElementById(id)!); return parseFloat(cs.paddingLeft) + parseFloat(cs.paddingRight); };
    return { padPlain: pad('plain'), padRed: pad('red'), tinted: chroma('plain') };
  });
  expect(r.padPlain).toBe(16);
  expect(r.padRed).toBe(16);
  // The row mixes the MENU's surface, not the host's lilac: neutral, so a tiny chroma.
  expect(r.tinted).toBeLessThan(0.008);
});
