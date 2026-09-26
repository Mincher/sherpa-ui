import { test, expect } from './harness';

/**
 * A BUTTON WITH NO VISIBLE LABEL SAYS ITS ACTION IN A TIP — its name, or
 * `data-tip`. A labelled one already says it, so only `data-tip` gives it one,
 * and a composing host can turn it off. Will, 2026-09-26.
 * TRAP T-every-button-says-its-action
 */
test('a button tip says its action, follows data-tip, and can be turned off', async ({ page }) => {
  await page.evaluate(async () => {
    const mk = (id: string, attrs: Record<string, string | boolean>, text = '') =>
      window.__mount('sherpa-button', undefined, { id, keep: true, ...attrs }).then((b) => {
        if (text) (b as HTMLElement).textContent = text;
      });
    // ROOM ABOVE each button, so the tip takes its first place, not a fallback.
    const root = document.getElementById('root')!;
    root.replaceChildren();
    root.style.cssText = 'display: flex; flex-direction: column; align-items: start; gap: 48px; padding: 64px;';
    await mk('icon', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings' });
    await mk('own', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings', 'data-tip': 'Open the settings' });
    await mk('text', {}, 'Apply');
    await mk('told', { 'data-tip': 'Apply every change' }, 'Apply');
    await mk('off', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Settings', 'data-no-tip': true });
    await mk('bold', { 'data-type': 'icon', 'data-icon-start': 'gear', 'aria-label': 'Save', 'data-look': 'saturated' });
    await mk('bare', { 'data-type': 'icon', 'data-icon-start': 'gear' });
    await window.__settled();
  });

  const read = async (id: string) => {
    await page.locator(`#${id}`).locator('.trigger').hover();
    return page.evaluate((one) => {
      const host = document.getElementById(one)!;
      const tip = host.shadowRoot!.querySelector<HTMLElement>('.tip')!;
      const trigger = host.shadowRoot!.querySelector('.trigger')!.getBoundingClientRect();
      const box = tip.getBoundingClientRect();
      const cs = getComputedStyle(tip);
      return {
        shown: cs.display !== 'none',
        text: tip.textContent,
        bg: cs.backgroundColor,
        // Anchored to its OWN button, above it.
        above: box.bottom <= trigger.top + 1 && Math.abs((box.left + box.right) / 2
          - (trigger.left + trigger.right) / 2) < trigger.width,
      };
    }, id);
  };

  const icon = await read('icon');
  expect(icon).toMatchObject({ shown: true, text: 'Settings', above: true });
  expect(await read('own')).toMatchObject({ shown: true, text: 'Open the settings' });
  // The LABEL already says it — a tip would repeat it.
  expect((await read('text')).shown).toBe(false);
  expect(await read('told')).toMatchObject({ shown: true, text: 'Apply every change' });
  expect((await read('off')).shown).toBe(false);
  // A SATURATED button's ink is white; its tip keeps its own colours.
  expect((await read('bold')).bg).toBe(icon.bg);
  expect((await read('bare')).shown).toBe(false);
});
