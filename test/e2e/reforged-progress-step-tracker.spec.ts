import { test, expect } from './harness';

/** sherpa-progress-step-tracker — steps from populate(); data-current-step drives done/active/todo. */


test('renders one node per step and marks states around the current step', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-step-tracker') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    el.setAttribute('data-current-step', '1');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'Details' }, { label: 'Review' }, { label: 'Done' }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    const steps = Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.step'));
    return { count: steps.length, states: steps.map((s) => s.getAttribute('data-state')) };
  });
  expect(r.count).toBe(3);
  // step 0 done, step 1 active (current), step 2 todo
  expect(r.states).toEqual(['done', 'active', 'todo']);
});

test('advancing data-current-step re-marks the states', async ({ page }) => {
  const states = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-step-tracker') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ label: 'A' }, { label: 'B' }, { label: 'C' }]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    el.setAttribute('data-current-step', '2');
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return Array.from(el.shadowRoot!.querySelectorAll<HTMLElement>('.step')).map((s) =>
      s.getAttribute('data-state'),
    );
  });
  expect(states).toEqual(['done', 'done', 'active']);
});

// The label and description are the step's only CONTENT, and nothing else here
// read them — so a wrong field name drew three numbered but nameless steps and
// every state assertion still passed.
test('each step shows its label, its description and its 1-based number', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-progress-step-tracker') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (d: unknown) => void;
    };
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([
      { label: 'Details', description: 'Who you are' },
      { label: 'Review' },
    ]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const pick = (sel: string): (string | null)[] =>
      Array.from(el.shadowRoot!.querySelectorAll(sel)).map((n) => n.textContent);
    return {
      labels: pick('.step .label'),
      descriptions: pick('.step .description'),
      numbers: pick('.step .number'),
    };
  });
  expect(r.labels).toEqual(['Details', 'Review']);
  // An absent description renders empty rather than "undefined".
  expect(r.descriptions).toEqual(['Who you are', '']);
  // Counted from one — the position, not the index.
  expect(r.numbers).toEqual(['1', '2']);
});
