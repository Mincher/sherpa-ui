import { test, expect } from '@playwright/test';

/**
 * THE FORM CONTROLS TAKE PART IN A PLAIN <form>: what each submits, and when
 * the form refuses. A radio submits under its shared `name`, as native radios
 * do, and REQUIRED is its group's; a select group gives its `name` to its
 * radios (Will, 2026-09-29). TRAP T-a-form-value-follows-every-write
 * TRAP T-radios-in-shadow-roots-are-not-one-group
 */
const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('checkbox, switch, radio group and select group: what a form sends, and when it refuses', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `
      <form id="f">
        <sherpa-select-checkbox name="terms" value="yes" required></sherpa-select-checkbox>
        <sherpa-switch name="alerts" value="on"></sherpa-switch>
        <sherpa-select-radio name="size" value="s" required></sherpa-select-radio>
        <sherpa-select-radio name="size" value="m" required></sherpa-select-radio>
        <sherpa-select-group name="plan" data-label="Plan"></sherpa-select-group>
      </form>`;
    const form = root.querySelector<HTMLFormElement>('#f')!;
    const group = form.querySelector('sherpa-select-group') as HTMLElement & {
      populate(d: unknown): Promise<void>; value: string | null;
    };
    await group.populate([{ value: 'free' }, { value: 'pro' }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const sent = () => [...new FormData(form).entries()].map(([k, v]) => `${k}=${v}`).sort();
    const before = { valid: form.checkValidity(), sent: sent() };
    (form.querySelector('sherpa-select-checkbox') as HTMLElement & { checked: boolean }).checked = true;
    (form.querySelector('sherpa-switch') as HTMLElement & { checked: boolean }).checked = true;
    // ONE radio ticked makes the whole required group acceptable.
    (form.querySelectorAll('sherpa-select-radio')[1] as HTMLElement & { checked: boolean }).checked = true;
    group.value = 'pro';
    return { before, after: { valid: form.checkValidity(), sent: sent() } };
  });
  expect(r.before).toEqual({ valid: false, sent: [] });
  expect(r.after).toEqual({ valid: true, sent: ['alerts=on', 'plan=pro', 'size=m', 'terms=yes'] });
});
