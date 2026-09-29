import { test, expect, type Bar } from './harness';

/**
 * A MENU KEEPS BOTH ANSWERS — TODO 102.
 *
 * Will, 2026-09-29: "The initial switch from simple filter to advanced should
 * carry over the conditions. e.g. X and Y are selected becomes Equals X OR
 * Equals Y. As soon as the advanced conditions deviate from the simple
 * conditions then that mirroring should be disabled. Users should still be
 * free to toggle between simple and advanced modes at any point and have
 * their parameters maintained."
 * TRAP T-both-answers-are-kept
 */

type Row = { op: string; join?: string; text?: string; picked?: string[] };
type Reading = { picked?: string[]; conditions?: Row[]; mode?: string; mirror?: boolean };
type Menu = HTMLElement & { shadowRoot: ShadowRoot; mode: string; reading: Reading; values: string[] };

const OWNERS = [
  { value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Mo', label: 'Mo' },
];

/** A bar with one Owner chip that offers Advanced, and its menu. */
async function ownerMenu(page: import('@playwright/test').Page): Promise<void> {
  await page.evaluate(async (options) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [
      { id: 'owner', label: 'Owner', select: 'multiple', advanced: true, options },
    ], { style: 'inline-size: 1200px' });
    await window.__settled();
    const menu = bar.shadowRoot!.querySelector('.chip[data-id="owner"] sherpa-menu') as Menu;
    const w = window as unknown as Record<string, unknown>;
    w['menu'] = menu;
    w['tick'] = async (value: string, on: boolean) => {
      const box = [...menu.querySelectorAll('input')].find((i) => i.value === value)!;
      box.checked = on;
      box.dispatchEvent(new Event('change', { bubbles: true }));
      await window.__settled();
    };
    w['flip'] = async () => {
      const sw = menu.shadowRoot.querySelector('.use-advanced-switch') as HTMLElement & { shadowRoot: ShadowRoot };
      sw.shadowRoot.querySelector<HTMLElement>('.input')!.click();
      await window.__settled();
    };
    // A reader's edit: row one's condition becomes "starts with R".
    w['edit'] = async () => {
      const row = menu.shadowRoot.querySelector('.condition-row')!;
      const cond = row.querySelector('.condition') as HTMLElement & { value: string };
      cond.value = 'startswith';
      cond.dispatchEvent(new Event('change', { bubbles: true }));
      const box = row.querySelector('.condition-value') as HTMLElement & { value: string };
      box.value = 'R';
      box.dispatchEvent(new Event('input', { bubbles: true }));
      await window.__settled();
    };
  }, OWNERS);
}

test('Advanced mirrors the picks until the reader edits a row, and the switch goes both ways', async ({ page }) => {
  await ownerMenu(page);
  const r = await page.evaluate(async () => {
    const w = window as unknown as {
      menu: Menu; tick(v: string, on: boolean): Promise<void>; flip(): Promise<void>; edit(): Promise<void>;
    };
    const { menu } = w;
    await w.tick('Dana', true);
    await w.tick('Ravi', true);
    await w.flip();
    const carried = menu.reading;
    await w.flip();
    const back = menu.reading;
    // Still a mirror: a pick in Simple redraws the rows.
    await w.tick('Ravi', false);
    const followed = menu.reading;
    await w.flip();
    await w.edit();
    const edited = menu.reading;
    await w.flip();
    // No longer a mirror: a pick leaves the rows alone.
    await w.tick('Mo', true);
    const kept = menu.reading;
    await w.flip();
    return { carried, back, followed, edited, kept, mode: menu.mode };
  });

  const EQ = (v: string, join?: string): Row => (join ? { op: 'eq', join, picked: [v] } : { op: 'eq', picked: [v] });
  expect(r.carried).toEqual({
    picked: ['Dana', 'Ravi'], conditions: [EQ('Dana'), EQ('Ravi', 'or')], mode: 'advanced', mirror: true,
  });
  // Back to Simple: the picks were never lost, and the rows are kept too.
  expect(r.back).toEqual({ ...r.carried, mode: 'simple' });
  expect(r.followed).toEqual({ picked: ['Dana'], conditions: [EQ('Dana')], mode: 'simple', mirror: true });
  expect(r.edited).toEqual({
    picked: ['Dana'], conditions: [{ op: 'startswith', text: 'R' }], mode: 'advanced', mirror: false,
  });
  expect(r.kept).toEqual({
    picked: ['Dana', 'Mo'], conditions: [{ op: 'startswith', text: 'R' }], mode: 'simple', mirror: false,
  });
  expect(r.mode).toBe('advanced');
});

test('a reading drawn into the menu shows both answers; one with no mode lets its rows decide', async ({ page }) => {
  await ownerMenu(page);
  const r = await page.evaluate(async () => {
    const { menu } = window as unknown as { menu: Menu };
    const both = {
      picked: ['Mo'], conditions: [{ op: 'startswith', text: 'R' }], mode: 'simple', mirror: false,
    };
    menu.reading = both;
    await window.__settled();
    const simple = { mode: menu.mode, reading: menu.reading };
    menu.reading = { ...both, mode: 'advanced' };
    await window.__settled();
    const advanced = menu.mode;
    menu.reading = { picked: [], mode: 'simple' };
    await window.__settled();
    menu.reading = { conditions: [{ op: 'startswith', text: 'D' }] };
    await window.__settled();
    return { simple, advanced, legacy: menu.mode };
  });

  expect(r.simple).toEqual({ mode: 'simple', reading: {
    picked: ['Mo'], conditions: [{ op: 'startswith', text: 'R' }], mode: 'simple', mirror: false,
  } });
  expect(r.advanced).toBe('advanced');
  expect(r.legacy).toBe('advanced');
});
