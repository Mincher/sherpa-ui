import { test, expect } from '@playwright/test';

/**
 * ONE VOCABULARY OPENS AND CLOSES EVERY COMPONENT.
 *
 * Each of these wraps a different platform API — `<dialog>` for dialog and
 * overlay-panel, `popover` for menu and notifications — and each native API
 * spells closing differently (`close()` vs `hidePopover()`). An app author
 * should not have to know which.
 *
 * `show()` / `hide()` is Sherpa's pair; `close()` is accepted everywhere so the
 * platform spelling still works.
 *
 * `dismiss()` on callout and toast is NOT a synonym: it REMOVES the element.
 *
 * TRAP T-one-verb-proxies-to-the-native-one
 */
const OPENERS = [
  ['sherpa-dialog', '<sherpa-dialog data-heading="H">b</sherpa-dialog>'],
  ['sherpa-overlay-panel', '<sherpa-overlay-panel data-heading="H">b</sherpa-overlay-panel>'],
  ['sherpa-menu', '<sherpa-menu data-heading="H"></sherpa-menu>'],
  ['sherpa-notifications', '<sherpa-notifications></sherpa-notifications>'],
] as const;

for (const [tag, html] of OPENERS) {
  test(tag + ' answers to show, hide and close', async ({ page }) => {
    await page.goto('/test/reforged/harness.html');
    const r = await page.evaluate(async ([tag, html]) => {
      await customElements.whenDefined(tag);
      document.getElementById('root')!.innerHTML = html;
      const el = document.getElementById('root')!.firstElementChild as HTMLElement & {
        rendered?: Promise<void>;
        show?: () => void; hide?: () => void; close?: () => void;
        open?: boolean;
      };
      await el.rendered;
      const shut = () => !(el.hasAttribute('open') || el.open === true);

      const verbs = (['show', 'hide', 'close'] as const)
        .map((m) => typeof el[m] === 'function');

      el.show?.();
      await new Promise((r) => setTimeout(r, 60));
      el.hide?.();
      await new Promise((r) => setTimeout(r, 60));
      const hideShuts = shut();

      // close() must reach the same place, not recurse.
      el.show?.();
      await new Promise((r) => setTimeout(r, 60));
      el.close?.();
      await new Promise((r) => setTimeout(r, 60));
      return { verbs, hideShuts, closeShuts: shut() };
    }, [tag, html] as const);

    expect(r.verbs, 'show, hide and close all exist').toEqual([true, true, true]);
    expect(r.hideShuts, 'hide() closes it').toBe(true);
    expect(r.closeShuts, 'close() closes it too').toBe(true);
  });
}

test('dismiss REMOVES the element — it is not a synonym for hide', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const gone = await page.evaluate(async () => {
    await customElements.whenDefined('sherpa-callout');
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-callout data-heading="H">b</sherpa-callout>';
    const el = root.firstElementChild as HTMLElement & {
      rendered?: Promise<void>; dismiss?: () => void;
    };
    await el.rendered;
    el.dismiss?.();
    return !root.querySelector('sherpa-callout');
  });
  expect(gone).toBe(true);
});
