import { test, expect } from './harness';

/**
 * THE FORM CONTROLS TAKE PART IN A PLAIN <form>: what each submits, and when
 * the form refuses. A radio submits under its shared `name`, as native radios
 * do, and REQUIRED is its group's; a select group gives its `name` to its
 * radios (Will, 2026-09-29). TRAP T-a-form-value-follows-every-write
 * TRAP T-radios-in-shadow-roots-are-not-one-group
 */
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
    await window.__settled();
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

/* Only a form control has a form's doors, as a native control does: a badge has
   no checkValidity. Plan 695 P6 · TRAP T-a-flag-brings-the-base-methods */
test('only a form control answers checkValidity and reportValidity', async ({ page }) => {
  const r = await page.evaluate(async () => {
    type Doors = HTMLElement & { checkValidity?: () => boolean; reportValidity?: () => boolean };
    const input = await window.__mount<Doors>('sherpa-input-text', undefined, { required: '' });
    const badge = await window.__mount<Doors>('sherpa-badge');
    return { input: input.checkValidity?.(), reports: typeof input.reportValidity, badge: 'checkValidity' in badge || 'reportValidity' in badge };
  });
  expect(r).toEqual({ input: false, reports: 'function', badge: false });
});
