import { test, expect } from './harness';

/**
 * A GRID HEADING KEEPS BOTH ANSWERS — TODO 102.
 *
 * The heading held one spelling of one answer (op, value, picks), so a switch
 * or a redraw kept only the answer in force. It holds the menu's whole reading
 * now: the ticks, the rows, the mode and the mirror.
 * TRAP T-both-answers-are-kept
 */

type Row = { op: string; join?: string; text?: string; picked?: string[] };
type Reading = { picked?: string[]; conditions?: Row[]; mode?: string; mirror?: boolean };
type Grid = HTMLElement & {
  populate(d: unknown): void;
  columnClause(f: string): unknown[] | null;
  columnReading(f: string): Reading | null;
  drawReading(f: string, r: Reading): void;
};

test('a heading switches both ways, each mode filters by its own answer, and a redraw keeps both', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const grid = await window.__mount<Grid>('sherpa-data-grid', {
      columns: [{ field: 'owner', header: 'Owner' }],
      rows: [{ owner: 'Dana' }, { owner: 'Ravi' }, { owner: 'Mo' }],
    }, { 'data-column-filters': true });
    await window.__settled();
    const sr = grid.shadowRoot!;
    const menu = () => sr.querySelector('.head-cell[data-field="owner"] sherpa-menu') as HTMLElement & {
      shadowRoot: ShadowRoot; mode: string;
    };
    const wait = async (): Promise<void> => {
      await window.__settled();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    };
    const tick = (value: string, on: boolean): void => {
      const box = [...menu().querySelectorAll('input')].find((i) => i.value === value)!;
      box.checked = on;
      box.dispatchEvent(new Event('change', { bubbles: true }));
    };
    const flip = async (): Promise<void> => {
      const sw = menu().shadowRoot.querySelector('.use-advanced-switch') as HTMLElement & { shadowRoot: ShadowRoot };
      sw.shadowRoot.querySelector<HTMLElement>('.input')!.click();
      await wait();
    };
    const apply = async (): Promise<void> => {
      menu().shadowRoot.querySelector<HTMLElement>('.apply')!.click();
      await wait();
    };

    // OPEN, as a reader must: a shut menu's Apply is off. TRAP T-a-disabled-button-acts-on-nothing
    const open = async (): Promise<void> => {
      const m = menu() as HTMLElement & { show(t: Element): void; hasAttribute(n: string): boolean };
      if (!m.hasAttribute('open')) m.show(sr.querySelector('.head-cell[data-field="owner"] .head-filter')!);
      await wait();
    };
    await open();
    tick('Dana', true);
    tick('Mo', true);
    await apply();
    const simple = grid.columnClause('owner');
    await open();
    await flip();
    const row = menu().shadowRoot.querySelector('.condition-row')!;
    const cond = row.querySelector('.condition') as HTMLElement & { value: string };
    cond.value = 'startswith';
    cond.dispatchEvent(new Event('change', { bubbles: true }));
    const box = row.querySelector('.condition-value') as HTMLElement & { value: string };
    box.value = 'R';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    await apply();
    const advanced = { clause: grid.columnClause('owner'), mode: grid.columnReading('owner')?.mode };
    await open();
    await flip();
    await apply();
    const back = { clause: grid.columnClause('owner'), reading: grid.columnReading('owner') };

    // A redraw from the source, naming Advanced: the heading keeps both.
    grid.drawReading('owner', { ...back.reading!, mode: 'advanced' });
    await wait();
    return {
      simple, advanced, back,
      redrawn: { clause: grid.columnClause('owner'), mode: menu().mode, reading: grid.columnReading('owner') },
    };
  });

  expect(r.simple).toEqual(['owner', 'in', ['Dana', 'Mo']]);
  // Row one was edited; row two still carries Mo from the switch.
  expect(r.advanced).toEqual({
    clause: ['or', ['owner', 'startswith', 'R'], ['owner', 'eq', 'Mo']], mode: 'advanced',
  });
  expect(r.back.clause).toEqual(['owner', 'in', ['Dana', 'Mo']]);
  expect(r.back.reading).toEqual({
    picked: ['Dana', 'Mo'],
    conditions: [{ op: 'startswith', text: 'R' }, { op: 'eq', join: 'or', picked: ['Mo'] }],
    mode: 'simple', mirror: false,
  });
  expect(r.redrawn.clause).toEqual(r.advanced.clause);
  expect(r.redrawn.mode).toBe('advanced');
  expect(r.redrawn.reading).toEqual({ ...r.back.reading, mode: 'advanced' });
});
