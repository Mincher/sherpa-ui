import { test, expect } from '@playwright/test';

/**
 * sherpa-slider on the reforged base — a single-value range control wrapping a
 * native <input type=range>. Proves min/max/step mirroring onto the input, the
 * value property + clamping, the value → fill-width bridge (via --_pct, NOT JS
 * styling), the input/change re-dispatch with a { value } detail, and disabled.
 */

const HARNESS = '/test/reforged/harness.html';

type SliderEl = HTMLElement & {
  rendered?: Promise<void>;
  value?: number;
  populate?: (d: unknown) => void;
};

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-slider'));
});

test('mirrors min/max/step/value onto the native input and the --_pct fill', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('min', '0');
    el.setAttribute('max', '200');
    el.setAttribute('step', '5');
    el.setAttribute('value', '50');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    return {
      min: input.min,
      max: input.max,
      step: input.step,
      inputValue: input.value,
      value: el.value,
      pct: el.style.getPropertyValue('--_pct').trim(),
    };
  });
  expect(r.min).toBe('0');
  expect(r.max).toBe('200');
  expect(r.step).toBe('5');
  expect(r.inputValue).toBe('50');
  expect(r.value).toBe(50);
  expect(r.pct).toBe('25%'); // 50 of 0–200 → the JS→CSS-var geometry bridge
});

test('the value property clamps to min/max and reflects to --_pct', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('min', '10');
    el.setAttribute('max', '90');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.value = 1000; // over-max
    const over = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    el.value = -1000; // under-min
    const under = { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
    return { over, under };
  });
  expect(r.over).toEqual({ value: 90, pct: '100%' });
  expect(r.under).toEqual({ value: 10, pct: '0%' });
});

test('a native input event re-dispatches as input with { value }', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    const events: Array<{ type: string; value: number }> = [];
    el.addEventListener('input', (e) =>
      events.push({ type: 'input', value: (e as CustomEvent).detail.value }),
    );
    el.addEventListener('change', (e) =>
      events.push({ type: 'change', value: (e as CustomEvent).detail.value }),
    );

    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    input.value = '60';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new Event('change', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      events,
      hostValue: el.value,
      pct: el.style.getPropertyValue('--_pct').trim(),
    };
  });
  expect(r.events).toEqual([
    { type: 'input', value: 60 },
    { type: 'change', value: 60 },
  ]);
  expect(r.hostValue).toBe(60);
  expect(r.pct).toBe('60%');
});

test('populate({ value }) sets the value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!({ value: 33 });
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { value: el.value, pct: el.style.getPropertyValue('--_pct').trim() };
  });
  expect(r.value).toBe(33);
  expect(r.pct).toBe('33%');
});

test('disabled reflects onto the input and is non-interactive', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('value', '20');
    el.setAttribute('disabled', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector('.range') as HTMLInputElement;
    return {
      inputDisabled: input.disabled,
      pointerEvents: getComputedStyle(input).pointerEvents,
    };
  });
  expect(r.inputDisabled).toBe(true);
  expect(r.pointerEvents).toBe('none');
});

test('data-show-value reveals an editable value input; typing updates the slider', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    el.setAttribute('value', '20');
    el.setAttribute('data-show-value', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // `.value-end`, not `.value-input`: range mode added a SECOND field before
    // the track, so the bare class now matches two and querySelector would take
    // the start one — which single mode keeps hidden.
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const field = el.shadowRoot!.querySelector('.value-end') as HTMLInputElement;
    const visible = getComputedStyle(field).display !== 'none';
    const initial = field.value;

    let changed = -1;
    el.addEventListener('change', (e) => (changed = (e as CustomEvent).detail.value));
    // As a reader types: into the Sherpa number field's own control.
    const control = field.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '65';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { visible, initial, changed, hostValue: el.getAttribute('value'), pct: (el.style as CSSStyleDeclaration).getPropertyValue('--_pct') };
  });
  expect(r.visible).toBe(true);
  expect(r.initial).toBe('20'); // field mirrors the initial value
  expect(r.changed).toBe(65);   // typing + commit fires change with the new value
  expect(r.hostValue).toBe('65');
  expect(r.pct).toBe('65%');    // the fill bridge tracks the typed value
});

test('the value input clamps out-of-range entries to min/max on commit', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('min', '10');
    el.setAttribute('max', '50');
    el.setAttribute('value', '30');
    el.setAttribute('data-show-value', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    // `.value-end`, not `.value-input`: range mode added a SECOND field before
    // the track, so the bare class now matches two and querySelector would take
    // the start one — which single mode keeps hidden.
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const field = el.shadowRoot!.querySelector('.value-end') as HTMLInputElement;
    const control = field.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    control.value = '999';
    control.dispatchEvent(new Event('change', { bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { fieldValue: field.value, hostValue: el.getAttribute('value') };
  });
  expect(r.fieldValue).toBe('50'); // snapped to max
  expect(r.hostValue).toBe('50');
});

/**
 * RANGE mode — two thumbs on one rail.
 *
 * There is no native two-thumb range input, so range mode stacks TWO of them and
 * gives each one end. The browser's own dragging, keyboard stepping and a11y
 * then come free for both thumbs.
 */
test('data-type="range" draws two thumbs, two fields, and a fill between them', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as HTMLElement & {
      rendered?: Promise<void>;
      range: [number, number];
    };
    el.setAttribute('data-type', 'range');
    el.setAttribute('data-show-value', '');
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    el.setAttribute('value-start', '20');
    el.setAttribute('value-end', '70');
    el.style.inlineSize = '400px';
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const shown = (sel: string): boolean =>
      getComputedStyle(sr.querySelector(sel)!).display !== 'none';
    const cs = getComputedStyle(el);

    return {
      range: el.range,
      // The fill is ONE element offset to the range's start — in single mode the
      // start is 0 and it is the old "fill from the head" behaviour exactly.
      pctStart: cs.getPropertyValue('--_pct-start').trim(),
      pct: cs.getPropertyValue('--_pct').trim(),
      secondThumb: shown('.range-end'),
      startField: shown('.value-start'),
      endField: shown('.value-end'),
      // Both inputs carry the SAME bounds, so a percentage means the same
      // position on either rail and the two thumbs compare directly.
      bounds: [sr.querySelector<HTMLInputElement>('.range')!.max,
               sr.querySelector<HTMLInputElement>('.range-end')!.max],
    };
  });

  expect(r.range).toEqual([20, 70]);
  expect(r.pctStart).toBe('20%');
  expect(r.pct).toBe('70%');
  expect(r.secondThumb).toBe(true);
  expect(r.startField).toBe(true);
  expect(r.endField).toBe(true);
  expect(r.bounds).toEqual(['100', '100']);
});

test('the range ends clamp against each other and always read low-first', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as HTMLElement & {
      rendered?: Promise<void>;
      range: [number, number];
    };
    el.setAttribute('data-type', 'range');
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    el.setAttribute('value-start', '20');
    el.setAttribute('value-end', '70');
    document.getElementById('root')!.replaceChildren(el);
    await el.rendered;
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const sr = el.shadowRoot!;
    const drag = async (sel: string, to: number): Promise<void> => {
      const input = sr.querySelector<HTMLInputElement>(sel)!;
      input.value = String(to);
      input.dispatchEvent(new Event('input', { bubbles: true }));
      await (window as unknown as { __settled: () => Promise<void> }).__settled();
    };

    const events: unknown[] = [];
    el.addEventListener('change', (e) => events.push((e as CustomEvent).detail));

    // Push the LOW thumb past the high one.
    await drag('.range', 90);
    const lowPushed = el.range;
    // …and the HIGH thumb below the low one.
    await drag('.range-end', 5);
    const highPushed = el.range;

    // Writing the property out of order comes back ordered.
    el.range = [90, 30];
    const written = el.range;

    // A commit reports BOTH ends, not one value.
    sr.querySelector<HTMLInputElement>('.range-end')!.value = '80';
    sr.querySelector<HTMLInputElement>('.range-end')!.dispatchEvent(
      new Event('change', { bubbles: true }),
    );
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return { lowPushed, highPushed, written, events };
  });

  // CLAMP, not swap: dragging the low thumb past the high one stops it there.
  // Swapping would hand the user a thumb they are no longer holding, and the
  // pointer would carry on moving the other end.
  expect(r.lowPushed).toEqual([70, 70]);
  expect(r.highPushed).toEqual([70, 70]);

  // Ordered whichever way it is written — a range whose start is above its end
  // is not a range, and every consumer would have to sort it again.
  expect(r.written).toEqual([30, 90]);

  expect(r.events).toEqual([{ start: 30, end: 80 }]);
});

test('a value field is a Sherpa number field; its event stops at the slider, which reports its own', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-slider') as SliderEl;
    el.setAttribute('data-type', 'range');
    el.setAttribute('min', '0');
    el.setAttribute('max', '100');
    el.setAttribute('step', '10');
    el.setAttribute('value-start', '20');
    el.setAttribute('value-end', '60');
    el.setAttribute('data-show-value', '');
    document.getElementById('root')!.appendChild(el);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const fields = [...el.shadowRoot!.querySelectorAll<HTMLElement>('.value-input')];
    const seen: unknown[] = [];
    // OUTSIDE the slider: only its own reports arrive, never a field's `{ value }`.
    document.addEventListener('change', (e) => seen.push((e as CustomEvent).detail));
    // The END field's Increase stepper.
    fields[1]!.shadowRoot!.querySelector('.steppers sherpa-button')!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    return {
      fields: fields.map((f) => `${f.localName}[${f.getAttribute('data-type')}]`),
      bare: el.shadowRoot!.querySelectorAll('input[type="number"]').length,
      end: el.getAttribute('value-end'),
      seen,
    };
  });
  expect(r.fields).toEqual(['sherpa-input-text[number]', 'sherpa-input-text[number]']);
  expect(r.bare).toBe(0);
  expect(r.end).toBe('70');
  expect(r.seen).toEqual([{ start: 20, end: 70 }]);
});

test('the value fields sit UNDER the track, in one row, at any width', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = [200, 640].map((w) => `<div style="inline-size: ${w}px"><sherpa-slider data-type="range" min="0" max="100000"`
      + ' value-start="0" value-end="100000" data-show-value></sherpa-slider></div>').join('');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...root.querySelectorAll('sherpa-slider')].map((el) => {
      const box = (sel: string) => el.shadowRoot!.querySelector(sel)!.getBoundingClientRect();
      const [track, start, end] = [box('.track-area'), box('.value-start'), box('.value-end')];
      return {
        under: start.top >= track.bottom && end.top >= track.bottom,
        oneRow: Math.round(start.top) === Math.round(end.top),
        halves: Math.abs(start.width - end.width) < 1,
        inside: end.right <= el.getBoundingClientRect().right + 1,
      };
    });
  });
  for (const at of r) expect(at).toEqual({ under: true, oneRow: true, halves: true, inside: true });
});
