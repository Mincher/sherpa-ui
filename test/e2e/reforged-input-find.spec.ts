import { test, expect } from '@playwright/test';

/**
 * A FIND — Will, TODO 136: *"A variant of the search input, a Find input, that
 * locates string matches and allows the user to jump to the next/previous
 * match using 2 stepper buttons, like the numeric sherpa input has."* With
 * `data-replace`, a pencil opens Find & Replace: Replace, Replace all (asked
 * first), Previous and Next.
 *
 * The field cannot see what it searches, so it ASKS: `find-step` and
 * `find-replace`. The grid answers a step with `findStep()`.
 * TRAP T-a-find-asks-its-host-to-step
 */
const HARNESS = '/test/reforged/harness.html';

type Field = HTMLElement & { value: string };

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

test('a Find: the search glyph, two steppers that ASK, and Enter and Shift+Enter', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const el = document.createElement('sherpa-input-text') as Field;
    el.setAttribute('data-type', 'find');
    el.setAttribute('aria-label', 'Find customers');
    document.getElementById('root')!.appendChild(el);
    await settled();
    const sr = el.shadowRoot!;
    const control = sr.querySelector<HTMLInputElement>('.control')!;
    const steps = [...sr.querySelectorAll<HTMLElement>('.steppers .find-step')];
    const heard: unknown[] = [];
    el.addEventListener('find-step', (e) => heard.push((e as CustomEvent).detail));
    const shown = (sel: string) => getComputedStyle(sr.querySelector(sel)!).display !== 'none';
    const look = {
      placeholder: control.placeholder, type: control.type,
      glyph: shown('.icon-start') && !!sr.querySelector('.icon-start svg'),
      steps: steps.map((s) => [s.getAttribute('data-icon-start'), s.getAttribute('aria-label')]),
      pencil: shown('.find-replace'),
    };
    // Nothing typed: nothing to step to.
    const empty = steps.map((s) => s.hasAttribute('disabled'));
    el.value = 'dana';
    const typed = steps.map((s) => s.hasAttribute('disabled'));
    const key = (shiftKey: boolean) => control.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', shiftKey, bubbles: true }));
    key(false);
    key(true);
    steps[0]!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    // The host found none: the steppers go inactive, and ask nothing.
    el.dataset['matches'] = '0';
    const none = steps.map((s) => s.hasAttribute('disabled'));
    key(false);
    return { look, empty, typed, none, heard };
  });

  expect(r.look).toEqual({
    placeholder: 'Find', type: 'text', glyph: true,
    steps: [['chevron-up', 'Previous match'], ['chevron-down', 'Next match']],
    pencil: false,
  });
  expect(r.empty).toEqual([true, true]);
  expect(r.typed).toEqual([false, false]);
  expect(r.none).toEqual([true, true]);
  expect(r.heard).toEqual([
    { direction: 1, value: 'dana' }, { direction: -1, value: 'dana' }, { direction: -1, value: 'dana' },
  ]);
});

test('Find & Replace: Replace asks at once; Replace all asks the reader first', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const el = document.createElement('sherpa-input-text') as Field;
    el.setAttribute('data-type', 'find');
    el.setAttribute('data-replace', '');
    el.setAttribute('aria-label', 'Find');
    document.getElementById('root')!.appendChild(el);
    await settled();
    const sr = el.shadowRoot!;
    const heard: unknown[] = [];
    for (const type of ['find-step', 'find-replace', 'input', 'change']) {
      el.addEventListener(type, (e) => heard.push({ type, ...(e as CustomEvent).detail }));
    }
    const press = (sel: string) => sr.querySelector(sel)!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();
    el.value = 'Dana';
    const pencil = sr.querySelector('.find-replace')!;
    const pencilShown = getComputedStyle(pencil).display !== 'none';
    press('.find-replace');
    await settled();
    const menu = sr.querySelector<HTMLElement & { open: boolean }>('.replace-menu')!;
    const opened = { open: menu.open, expanded: pencil.getAttribute('aria-expanded') };

    // The replacement is the MENU's: typing it reports nothing from this field.
    const withField = sr.querySelector<HTMLElement & { value: string }>('.replace-with')!;
    const inner = withField.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    inner.value = 'Ravi';
    inner.dispatchEvent(new Event('input', { bubbles: true, composed: true }));
    const typedHeard = heard.length;

    press('.replace-one');
    // The footer's own Previous and Next ask too.
    const footer = [...menu.querySelectorAll<HTMLElement>('.find-step')];
    footer[1]!.shadowRoot!.querySelector<HTMLElement>('.trigger')!.click();

    // Replace all: the dialog first. Cancel asks nothing.
    const dialog = sr.querySelector<HTMLElement & { open: boolean }>('.replace-confirm')!;
    const all = sr.querySelector('.replace-more sherpa-menu')!.querySelector<HTMLButtonElement>('button[value="replace-all"]')!;
    all.click();
    await settled();
    const asked = { open: dialog.open, text: sr.querySelector('.replace-confirm-text')!.textContent };
    press('.replace-cancel');
    await settled();
    const cancelled = { open: dialog.open, heard: heard.length };
    all.click();
    await settled();
    press('.replace-all');
    await settled();
    return { pencilShown, opened, typedHeard, asked, cancelled, closed: dialog.open, heard };
  });

  expect(r.pencilShown).toBe(true);
  expect(r.opened).toEqual({ open: true, expanded: 'true' });
  expect(r.typedHeard).toBe(0);
  expect(r.asked).toEqual({ open: true, text: 'Every match of “Dana” becomes “Ravi”.' });
  expect(r.cancelled).toEqual({ open: false, heard: 2 });
  expect(r.closed).toBe(false);
  expect(r.heard).toEqual([
    { type: 'find-replace', value: 'Dana', replacement: 'Ravi', all: false },
    { type: 'find-step', direction: 1, value: 'Dana' },
    { type: 'find-replace', value: 'Dana', replacement: 'Ravi', all: true },
  ]);
});

test('a grid steps through its marks, round the end, and asks for the next page past its last', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const settled = (window as unknown as { __settled: () => Promise<void> }).__settled;
    const grid = await (window as unknown as { __mount: (t: string, d?: unknown, a?: Record<string, string>) => Promise<HTMLElement> })
      .__mount('sherpa-data-grid', undefined, { style: 'inline-size: 800px' }) as HTMLElement & {
      populate(d: unknown): void;
      findStep(d: 1 | -1): { index: number; count: number };
    };
    const columns = [{ field: 'name', header: 'Name' }, { field: 'owner', header: 'Owner' }];
    grid.populate({ columns, rows: [
      { id: 1, name: 'Dana Ray', owner: 'Ravi' }, { id: 2, name: 'Ann', owner: 'Dana' }, { id: 3, name: 'Bo', owner: 'Cy' },
    ] });
    grid.dataset['needles'] = '*:contains:dana';
    await settled();
    const current = () => [...grid.shadowRoot!.querySelectorAll('mark.match')].findIndex((m) => m.hasAttribute('data-current'));
    const steps = [grid.findStep(1), grid.findStep(1), grid.findStep(1), grid.findStep(-1)];
    const at = current();

    // Two pages: past the last mark, it ASKS for the next, then lands on its first.
    const asked: unknown[] = [];
    grid.addEventListener('page-change', (e) => asked.push((e as CustomEvent).detail));
    grid.dataset['page'] = '1';
    grid.dataset['totalPages'] = '2';
    await settled();
    // A redraw starts again at the first.
    const again = [grid.findStep(1), grid.findStep(1)];
    const off = grid.findStep(1);
    grid.populate({ columns, rows: [{ id: 4, name: 'Dana Two', owner: 'Ed' }] });
    await settled();
    return { steps, at, again, asked, off, landed: current() };
  });

  // Marks in reading order: "Dana" in row 1's name, then row 2's owner.
  expect(r.steps).toEqual([
    { index: 0, count: 2 }, { index: 1, count: 2 }, { index: 0, count: 2 }, { index: 1, count: 2 },
  ]);
  expect(r.at).toBe(1);
  expect(r.again).toEqual([{ index: 0, count: 2 }, { index: 1, count: 2 }]);
  expect(r.off).toEqual({ index: -1, count: 2 });
  expect(r.asked).toEqual([{ page: 2 }]);
  expect(r.landed).toBe(0);
});