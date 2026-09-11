import { test, expect } from '@playwright/test';

/**
 * sherpa-calendar-cell — the Figma "Calendar Cell" (276:16589), which Will split
 * onto the Calendar page as one of the visual parts a calendar is built FROM.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
});

test('each State paints the fill the node names, on the inner content box', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const mk = async (state?: string) => {
      const cell = document.createElement('sherpa-calendar-cell') as HTMLElement & {
        rendered?: Promise<void>;
      };
      cell.setAttribute('data-label', '15');
      if (state) cell.setAttribute('data-state', state);
      document.getElementById('root')!.appendChild(cell);
      await cell.rendered;
      const content = cell.shadowRoot!.querySelector('.content') as HTMLElement;
      const cs = getComputedStyle(content);
      return {
        bg: cs.backgroundColor,
        radius: cs.borderTopLeftRadius,
        label: content.textContent!.trim(),
        // 32x32 — display-mode/size/2xl.
        h: cell.shadowRoot!.querySelector('.cell')!.getBoundingClientRect().height,
      };
    };
    return {
      default: await mk(),
      today: await mk('today'),
      selected: await mk('selected'),
      rangeMid: await mk('range-mid'),
    };
  });

  // The STATE lives on the inner Content box, not the host — that is the node's
  // own structure, and it is what lets a range square its inner corners while
  // the button keeps its own focus ring.
  expect(r.default.bg).toBe('rgba(0, 0, 0, 0)'); // the node's #FFFFFF00
  expect(r.default.label).toBe('15');
  expect(r.default.h).toBeCloseTo(32, 0);

  // today → style-surface/info at 30% (#008BBA4D). Today is a statement of
  // fact, not a selection, which is why it is the info tint and not the active.
  expect(r.today.bg).toBe('rgba(0, 139, 186, 0.3)');

  // selected → surface/active/base (#F2DFFF).
  expect(r.selected.bg).toBe('rgb(242, 223, 255)');

  // A RANGE's middle squares its corners so a run reads as one band — the
  // node's selected-range variant has rounding 0 for exactly this reason.
  expect(r.default.radius).toBe('4px');
  expect(r.rangeMid.radius).toBe('0px');
});

test('it is a real button: it fires cell-click, and disabled suppresses it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const cell = document.createElement('sherpa-calendar-cell') as HTMLElement & {
      rendered?: Promise<void>;
    };
    cell.setAttribute('data-label', '9');
    cell.setAttribute('data-value', '2026-08-09');
    document.getElementById('root')!.appendChild(cell);
    await cell.rendered;

    const seen: unknown[] = [];
    cell.addEventListener('cell-click', (e) => seen.push((e as CustomEvent).detail));
    const btn = cell.shadowRoot!.querySelector('button') as HTMLElement;
    btn.click();
    await new Promise((res) => setTimeout(res, 20));

    cell.setAttribute('disabled', '');
    await new Promise((res) => setTimeout(res, 20));
    const btnDisabled = (cell.shadowRoot!.querySelector('button') as HTMLButtonElement).disabled;
    btn.click();
    await new Promise((res) => setTimeout(res, 20));

    return { seen, btnDisabled };
  });

  // ONE event — the second click was suppressed.
  expect(r.seen).toEqual([{ value: '2026-08-09' }]);
  // …and `disabled` is mirrored onto the real control, so the BROWSER owns the
  // behaviour rather than CSS pretending.
  expect(r.btnDisabled).toBe(true);
});

test('a calendar COMPOSES these cells rather than drawing its own', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const cal = document.createElement('sherpa-calendar') as HTMLElement & {
      rendered?: Promise<void>;
    };
    cal.setAttribute('data-type', 'range');
    cal.setAttribute('data-value-start', '2026-08-10');
    cal.setAttribute('data-value-end', '2026-08-14');
    document.getElementById('root')!.appendChild(cal);
    await cal.rendered;
    const cells = [...cal.shadowRoot!.querySelectorAll('.cal-days > *')] as (HTMLElement & {
      rendered?: Promise<void>;
      shadowRoot: ShadowRoot;
    })[];
    await Promise.all(cells.map((c) => c.rendered));
    return {
      tag: cells[10]!.localName,
      states: cells
        .filter((c) => c.dataset['state'])
        .map((c) => ({ label: c.dataset['label'], state: c.dataset['state'] })),
    };
  });

  expect(r.tag).toBe('sherpa-calendar-cell');

  // A range's two ENDS keep their outer corners and square the ones that meet
  // the band, so the code's range half is three states where the node draws one
  // (it is drawn as the middle of a run).
  const range = r.states.filter((s) => s.state!.startsWith('range'));
  expect(range[0]).toEqual({ label: '10', state: 'range-start' });
  expect(range.at(-1)).toEqual({ label: '14', state: 'range-end' });
  expect(range.slice(1, -1).every((s) => s.state === 'range-mid')).toBe(true);
});
