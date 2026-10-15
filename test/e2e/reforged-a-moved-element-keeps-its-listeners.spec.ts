import { test, expect } from './harness';
import { EXAMPLES } from '../a11y/examples.mjs';

/**
 * A MOVED element is disconnected and connected again. Its slots must still
 * set `data-has-*`, and its own listeners must still hear — `onRender` runs
 * once, so nothing it wired may hang on the disconnect signal.
 * TRAP T-abort-controller-per-connect
 */
const TAGS = Object.keys(EXAMPLES);

test('every component, once moved, still marks what is slotted into it', async ({ page }) => {
  const dead = await page.evaluate(async ({ tags, fixtures }) => {
    const root = document.getElementById('root')!;
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const out: string[] = [];
    for (const tag of tags) {
      const box = document.createElement('div');
      box.innerHTML = (fixtures as Record<string, { html: string }>)[tag]!.html;
      root.replaceChildren(box);
      const el = box.querySelector(tag) as HTMLElement & { rendered?: Promise<void> };
      if (!el) continue;
      await el.rendered;
      // The move.
      const other = document.createElement('div');
      root.append(other);
      other.append(el);
      await window.__settled();
      const names = [...el.shadowRoot!.querySelectorAll('slot')].map((s) => s.name);
      for (const name of names) {
        const attr = name ? `data-has-${name}` : 'data-has-content-slot';
        if (el.hasAttribute(attr)) continue;
        const child = document.createElement('span');
        child.textContent = 'x';
        if (name) child.slot = name;
        el.append(child);
        await frames();
        if (!el.hasAttribute(attr)) out.push(`${tag} ${attr}`);
        child.remove();
        await frames();
      }
    }
    return out;
  }, { tags: TAGS, fixtures: EXAMPLES });
  expect(dead).toEqual([]);
});

test('once moved, a slider, a tooltip, a nav and a dialog still hear', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const frames = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    root.innerHTML = '<div class="a">'
      + '<sherpa-slider data-label="Volume" min="0" max="100" value="40"></sherpa-slider>'
      + '<sherpa-tooltip data-floating data-text="Delete"><button>x</button></sherpa-tooltip>'
      + '<sherpa-nav></sherpa-nav>'
      + '<sherpa-dialog data-type="overlay" data-heading="Edit" open></sherpa-dialog>'
      + '</div><div class="b"></div>';
    const els = [...root.querySelectorAll<HTMLElement & { rendered: Promise<void> }>('.a > *')];
    await Promise.all(els.map((el) => el.rendered));
    root.querySelector('.b')!.append(...els);
    await window.__settled();
    const [slider, tooltip, nav, dialog] = els as [HTMLElement, HTMLElement, HTMLElement, HTMLElement & { open: boolean }];

    const range = slider.shadowRoot!.querySelector<HTMLInputElement>('.range')!;
    let changed: unknown = null;
    slider.addEventListener('change', (e) => { changed = (e as CustomEvent).detail?.value; });
    range.value = '70';
    range.dispatchEvent(new Event('change', { bubbles: true }));

    tooltip.dispatchEvent(new PointerEvent('pointerenter'));
    await frames();
    const tip = tooltip.shadowRoot!.querySelector('.bubble')!.matches(':popover-open');

    nav.dispatchEvent(new PointerEvent('pointerenter'));
    const navState = nav.dataset['navState'];

    dialog.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    await frames();
    return { changed, tip, navState, dialogOpen: dialog.open };
  });
  expect(r).toEqual({ changed: 70, tip: true, navState: 'hover', dialogOpen: false });
});
