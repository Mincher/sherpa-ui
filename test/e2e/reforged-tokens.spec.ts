import { test, expect } from './harness';

/**
 * Token layer proof — the Figma-projected token layer (Primitives → Core →
 * Style (Sherpa)) resolving in the light DOM and inheriting into shadow roots,
 * plus mode handling owned by the layer (not components). Names follow the
 * consolidated Figma taxonomy; values are the Figma-resolved ones.
 */


test('semantic tokens resolve through the display-mode + style layers in the light DOM', async ({ page }) => {
  const v = await page.evaluate(() => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    // resolve a semantic colour by painting it — computed value follows the alias chain
    // Strong action colour resolves through the Saturated look tier (--_status-surface).
    probe.setAttribute('data-look', 'saturated');
    probe.style.background = 'var(--_status-surface)';
    const accent = getComputedStyle(probe).backgroundColor;
    const space = getComputedStyle(document.documentElement).getPropertyValue('--sherpa-display-mode-space-base').trim();
    probe.remove();
    return { space, accent };
  });
  expect(v.space).toBe('16px'); // --sherpa-display-mode-space-base = 16px
  expect(v.accent).toBe('rgb(59, 76, 205)'); // #3b4ccd — the Saturated look strong accent
});

test('tokens inherit into a shadow root (button uses the real accent, not a fallback)', async ({ page }) => {
  const bg = await page.evaluate(async () => {
    const el = document.createElement('sherpa-button') as HTMLElement & { rendered?: Promise<void> };
    el.textContent = 'Save';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.setAttribute('data-look', 'saturated'); // primary = the Saturated look tier (no data-variant)
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.trigger')!).backgroundColor;
  });
  expect(bg).toBe('rgb(59, 76, 205)'); // #3b4ccd — primary routes through the Saturated look
});

test('the layer owns mode: data-mode="dark" re-points semantic tokens; components are mode-agnostic', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const probe = document.createElement('div');
    document.body.appendChild(probe);
    probe.style.background = 'var(--sherpa-theme-surface-default-base)';
    const read = () => getComputedStyle(probe).backgroundColor;
    const light = read();
    document.documentElement.setAttribute('data-mode', 'dark');
    const dark = read();
    document.documentElement.removeAttribute('data-mode');
    probe.remove();
    return { light, dark };
  });
  expect(r.light).toBe('rgb(255, 255, 255)'); // #ffffff — light app surface
  expect(r.dark).toBe('rgb(12, 11, 17)'); // #0c0b11 — dark app surface (re-pointed)
  expect(r.light).not.toBe(r.dark);
});

test('the icon scale IS the text scale — one step, one size', async ({ page }) => {
  const r = await page.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const px = (name: string): string => cs.getPropertyValue(name).trim();
    return {
      icon: {
        '2xs': px('--sherpa-theme-size-icon-2xs'),
        xs: px('--sherpa-theme-size-icon-xs'),
        sm: px('--sherpa-theme-size-icon-sm'),
        md: px('--sherpa-theme-size-icon-md'),
      },
      text: {
        xs: px('--sherpa-theme-content-size-xs'),
        base: px('--sherpa-theme-content-size-base'),
        large: px('--sherpa-theme-content-size-large'),
        h2: px('--sherpa-theme-content-size-h2'),
      },
    };
  });

  // Will's ruling, 2026-09-10: icons and text share ONE scale, so an icon is the
  // same size as the text beside it. The icon steps alias the content/size/* vars,
  // which alias the font scale — there is no separate icon ramp any more.
  //
  // Before this, size/icon/xs was 16 while content/size/base was 14, so every
  // 14px label sat next to a 16px icon: one increment too big, everywhere.
  expect(r.icon['xs']).toBe(r.text['base']); // 14
  expect(r.icon['2xs']).toBe(r.text['xs']); // 10
  expect(r.icon['sm']).toBe(r.text['large']); // 16
  expect(r.icon['md']).toBe(r.text['h2']); // 20

  // …and the concrete values, so a re-point in Figma that breaks the pairing is
  // caught rather than silently agreeing with itself.
  expect(r.icon['xs']).toBe('14px');
  expect(r.icon['2xs']).toBe('10px');
});

test('the layout grid projects a unitless column COUNT that responds to width', async ({ page }) => {
  const read = async (width: number): Promise<Record<string, string | number>> => {
    await page.setViewportSize({ width, height: 800 });
    return page.evaluate(() => {
      const root = getComputedStyle(document.documentElement);
      // A grid in the light DOM, so the projected @layer layout utility applies.
      const box = document.createElement('div');
      box.className = 'sherpa-grid';
      const child = document.createElement('div');
      child.setAttribute('data-span', '6');
      box.appendChild(child);
      document.getElementById('root')!.replaceChildren(box);
      const cs = getComputedStyle(box);
      const out = {
        columns: root.getPropertyValue('--sherpa-layout-grid-columns').trim(),
        maxWidth: root.getPropertyValue('--sherpa-layout-grid-max-width').trim(),
        // The resolved track list. `repeat(4px, …)` is INVALID, so a px column
        // count silently voided the whole declaration and left one implicit track.
        tracks: cs.gridTemplateColumns.split(' ').length,
        gap: cs.columnGap,
      };
      box.remove();
      return out;
    });
  };

  const mobile = await read(420);
  const tablet = await read(900);
  const desktop = await read(1440);

  // Figma's Layout collection modes ARE the breakpoints. None of them projected
  // before: only the primary (mobile) values reached :root, so the grid never
  // responded to width at all.
  expect(mobile['columns']).toBe('4');
  expect(tablet['columns']).toBe('8');
  expect(desktop['columns']).toBe('12');

  // A COUNT must be unitless. As `4px` the repeat() was invalid and the grid
  // collapsed to a single implicit track — the whole layout silently did nothing.
  expect(mobile['columns']).not.toContain('px');
  expect(mobile['tracks']).toBe(4);
  expect(tablet['tracks']).toBe(8);
  expect(desktop['tracks']).toBe(12);

  // The max width tracks the breakpoint too.
  expect(mobile['maxWidth']).toBe('480px');
  expect(tablet['maxWidth']).toBe('768px');
  expect(desktop['maxWidth']).toBe('1280px');
});
