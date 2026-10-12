import { test, expect } from './harness';

/**
 * FORMS, COMPLETE. A control inside a disabled <fieldset> is disabled, as by
 * its own `disabled`; a form reset puts back its first state. TODO 214
 * TRAP T-a-form-control-follows-its-fieldset
 */
test('a disabled fieldset disables each control inside it; a reset puts back its first state', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<form><fieldset>
      <sherpa-input-text name="a" value="x"></sherpa-input-text>
      <sherpa-switch name="s" checked></sherpa-switch>
      <sherpa-select-checkbox name="c"></sherpa-select-checkbox>
      <sherpa-select-radio name="r" value="1" checked></sherpa-select-radio>
      <sherpa-select-radio name="r" value="2"></sherpa-select-radio>
    </fieldset></form>`;
    const settle = (window as unknown as { __settled(): Promise<void> }).__settled;
    await settle();
    const form = root.querySelector('form')!;
    const fieldset = root.querySelector('fieldset')!;
    const hosts = [...fieldset.children] as HTMLElement[];
    const inner = (h: HTMLElement) => h.shadowRoot!.querySelector<HTMLInputElement>('input, select, textarea')!;
    const state = () => hosts.map((h) => `${h.localName.replace('sherpa-', '')}:${h.matches(':disabled')}/${inner(h).disabled}`);
    fieldset.disabled = true;
    await settle();
    const off = state();
    fieldset.disabled = false;
    await settle();
    const on = state();

    const [text, sw, box, one, two] = hosts as Array<HTMLElement & { checked: boolean; value: string }>;
    const field = inner(text!);
    field.value = 'y';
    field.dispatchEvent(new Event('input', { bubbles: true }));
    sw!.checked = false;
    box!.checked = true;
    two!.checked = true;
    one!.checked = false;
    await settle();
    const changed = [...new FormData(form)].map(([k, v]) => `${k}=${v}`);
    form.reset();
    await settle();
    return { off, on, changed, reset: [...new FormData(form)].map(([k, v]) => `${k}=${v}`) };
  });
  expect(r.off).toEqual(['input-text:true/true', 'switch:true/true', 'select-checkbox:true/true', 'select-radio:true/true', 'select-radio:true/true']);
  expect(r.on).toEqual(['input-text:false/false', 'switch:false/false', 'select-checkbox:false/false', 'select-radio:false/false', 'select-radio:false/false']);
  expect(r.changed).toEqual(['a=y', 'c=on', 'r=2']);
  expect(r.reset).toEqual(['a=x', 's=on', 'r=1']);
});

/* Five controls submitted nothing: a slider, a select card, a calendar, a file
   upload, a transfer list. Each joins its form now, and a reset puts back its
   first state. TODO 214 */
test('the slider, select card, calendar, file upload and transfer list submit their values, and reset', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `<form><fieldset>
      <sherpa-slider name="seats" value="30"></sherpa-slider>
      <sherpa-slider name="band" data-type="range" value-start="10" value-end="90"></sherpa-slider>
      <sherpa-select-card name="plan" value="pro" data-selected></sherpa-select-card>
      <sherpa-calendar name="due" data-value="2026-10-12"></sherpa-calendar>
      <sherpa-calendar name="span" data-type="range" data-value-start="2026-10-01" data-value-end="2026-10-05"></sherpa-calendar>
      <sherpa-file-upload name="docs" data-multiple></sherpa-file-upload>
      <sherpa-transfer-list name="regions"></sherpa-transfer-list>
    </fieldset></form>`;
    const settle = (window as unknown as { __settled(): Promise<void> }).__settled;
    const list = root.querySelector('sherpa-transfer-list') as HTMLElement & { populate(d: unknown): Promise<void>; selected: string[] };
    await list.populate([{ value: 'emea', selected: true }, { value: 'apac' }, { value: 'latam' }]);
    await settle();
    const form = root.querySelector('form')!;
    const entries = () => [...new FormData(form)].map(([k, v]) => `${k}=${typeof v === 'string' ? v : v.name}`);
    const first = entries();

    (root.querySelector('sherpa-slider') as HTMLElement & { value: number }).value = 55;
    (root.querySelector('sherpa-select-card') as HTMLElement & { selected: boolean }).selected = false;
    root.querySelector('sherpa-calendar')!.setAttribute('data-value', '2026-11-01');
    const drop = new DataTransfer();
    drop.items.add(new File(['a'], 'a.txt'));
    drop.items.add(new File(['b'], 'b.txt'));
    const upload = root.querySelector('sherpa-file-upload')!;
    upload.shadowRoot!.querySelector('.drop-zone')!.dispatchEvent(new DragEvent('drop', { bubbles: true, cancelable: true, dataTransfer: drop }));
    list.selected = ['apac', 'latam'];
    await settle();
    const changed = entries();

    form.reset();
    await settle();
    const reset = entries();

    // Inside a disabled fieldset, a press does nothing.
    root.querySelector('fieldset')!.disabled = true;
    await settle();
    const card = root.querySelector('sherpa-select-card') as HTMLElement & { selected: boolean };
    card.shadowRoot!.querySelector<HTMLElement>('.card')!.click();
    const slider = root.querySelector('sherpa-slider')!;
    return { first, changed, reset, cardAfterPress: card.selected, sliderOff: slider.shadowRoot!.querySelector<HTMLInputElement>('.range')!.disabled };
  });
  expect(r.first).toEqual(['seats=30', 'band=10', 'band=90', 'plan=pro', 'due=2026-10-12', 'span=2026-10-01', 'span=2026-10-05', 'regions=emea']);
  expect(r.changed).toEqual(['seats=55', 'band=10', 'band=90', 'due=2026-11-01', 'span=2026-10-01', 'span=2026-10-05', 'docs=a.txt', 'docs=b.txt', 'regions=apac', 'regions=latam']);
  expect(r.reset).toEqual(r.first);
  expect(r.cardAfterPress).toBe(true);
  expect(r.sliderOff).toBe(true);
});
