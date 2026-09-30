import { test, expect } from './harness';

/**
 * THE PANEL KEEPS BOTH ANSWERS — TODO 102.
 *
 * In the panel, Simple's answer is the field's value CHIPS and Advanced's is
 * its menu's rows. The switch carries the chips over — X and Y become Equals X
 * OR Equals Y — and the rows follow the chips until the reader edits one.
 * TRAP T-both-answers-are-kept
 */

type Row = { op: string; join?: string; text?: string; picked?: string[] };
type Reading = { picked?: string[]; conditions?: Row[]; mode?: string; mirror?: boolean };
type Panel = HTMLElement & {
  show(): void;
  readings: Record<string, Record<string, Reading>>;
  setFieldReading(id: string, r: Reading): void;
};

const OWNERS = [
  { value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }, { value: 'Mo', label: 'Mo' },
];

test('the switch carries the chips over, the rows follow them until edited, and both answers are kept', async ({ page }) => {
  const r = await page.evaluate(async (options) => {
    const panel = await window.__mount<Panel>('sherpa-filter-panel', [{
      scope: 'data', label: 'Data', filters: [{ id: 'owner', label: 'Owner', select: 'multiple', advanced: true, options }],
    }], { style: 'inline-size: 400px', 'data-min-width': '0' });
    panel.show();
    await window.__settled();
    const sr = panel.shadowRoot!;
    const field = sr.querySelector('.field[data-field="owner"]')!;
    const wait = async (): Promise<void> => {
      await window.__settled();
      await new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(res)));
    };
    const chip = async (value: string): Promise<void> => {
      const one = field.querySelector(`.value[data-value="${value}"]`) as HTMLElement & { shadowRoot: ShadowRoot };
      one.shadowRoot.querySelector<HTMLElement>('.body')!.click();
      await wait();
    };
    const flip = async (): Promise<void> => {
      const sw = field.querySelector('.field-advanced') as HTMLElement & { shadowRoot: ShadowRoot };
      sw.shadowRoot.querySelector<HTMLElement>('button')!.click();
      await wait();
    };
    const read = (): Reading => {
      const { picked, conditions, mode, mirror } = panel.readings['data']!['owner']!;
      return { picked, conditions, mode, mirror };
    };

    await chip('Dana');
    await chip('Mo');
    await flip();
    const carried = read();
    await flip();
    await chip('Mo');
    const followed = read();
    await flip();
    const menu = field.querySelector('sherpa-menu')!;
    const row = menu.shadowRoot!.querySelector('.condition-row')!;
    const cond = row.querySelector('.condition') as HTMLElement & { value: string };
    cond.value = 'startswith';
    cond.dispatchEvent(new Event('change', { bubbles: true }));
    const box = row.querySelector('.condition-value') as HTMLElement & { value: string };
    box.value = 'R';
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await wait();
    await flip();
    await chip('Ravi');
    const kept = read();

    // A redraw from the source names the mode, and the panel keeps it.
    panel.setFieldReading('owner', { ...kept, mode: 'advanced' });
    await wait();
    return {
      carried, followed, kept,
      redrawn: { advanced: field.hasAttribute('data-advanced'), reading: read() },
    };
  }, OWNERS);

  const EQ = (v: string, join?: string): Row => (join ? { op: 'eq', join, picked: [v] } : { op: 'eq', picked: [v] });
  expect(r.carried).toEqual({
    picked: ['Dana', 'Mo'], conditions: [EQ('Dana'), EQ('Mo', 'or')], mode: 'advanced', mirror: true,
  });
  // Back in Simple, a chip moved, and the mirrored rows followed it.
  expect(r.followed).toEqual({ picked: ['Dana'], conditions: [EQ('Dana')], mode: 'simple', mirror: true });
  // Edited, the rows are the reader's: a chip no longer moves them.
  expect(r.kept).toEqual({
    picked: ['Dana', 'Ravi'], conditions: [{ op: 'startswith', text: 'R' }], mode: 'simple', mirror: false,
  });
  expect(r.redrawn).toEqual({ advanced: true, reading: { ...r.kept, mode: 'advanced' } });
});

/**
 * WILL'S BUG, in the panel on the Records page: the source draws every answer
 * back, and the panel forced a field with rows back to Advanced. Runs against
 * the EXAMPLES server (:4200): the round trip is the app's.
 */
test('a Records panel field switches back to Simple after a typed row, and keeps both answers', async ({ page }) => {
  await page.goto('http://localhost:4200/?context=records');
  await page.waitForFunction(() =>
    !!document.querySelector('#context-root sherpa-data-grid')?.shadowRoot?.querySelector('.row, [role="row"]'));
  const r = await page.evaluate(async () => {
    const wait = (ms: number): Promise<void> => new Promise((res) => setTimeout(res, ms));
    (document.querySelector('sherpa-provider') as HTMLElement & { filterMode: string }).filterMode = 'panel';
    await wait(800);
    const panel = document.querySelector('#filter-panel') as Panel;
    const source = (window as unknown as { sherpa: { source: { debugState(): { total: number } } } }).sherpa.source;
    const field = [...panel.shadowRoot!.querySelectorAll('[data-scope="data"] .field')]
      .find((f) => (f.querySelector('.field-title')?.textContent ?? '').trim().toLowerCase() === 'owner')!;
    const values = [...field.querySelectorAll<HTMLElement>('.value')];
    const chip = async (one: HTMLElement): Promise<void> => {
      (one as HTMLElement & { shadowRoot: ShadowRoot }).shadowRoot.querySelector<HTMLElement>('.body')!.click();
      await wait(500);
    };
    const flip = async (): Promise<void> => {
      const sw = field.querySelector('.field-advanced') as HTMLElement & { shadowRoot: ShadowRoot };
      sw.shadowRoot.querySelector<HTMLElement>('button')!.click();
      await wait(700);
    };
    const snap = () => {
      const menu = field.querySelector('sherpa-menu') as HTMLElement & { reading: Reading };
      return {
        advanced: field.hasAttribute('data-advanced'),
        rows: (menu.reading.conditions ?? []).length,
        total: source.debugState().total,
      };
    };
    await chip(values[0]!);
    await chip(values[1]!);
    const picked = source.debugState().total;
    await flip();
    // The flip alone moves no rows: it reports once its rows are drawn.
    const flipped = source.debugState().total;
    const menu = field.querySelector('sherpa-menu')!;
    const row = menu.shadowRoot!.querySelector('.condition-row')!;
    const cond = row.querySelector('.condition') as HTMLElement & { value: string };
    cond.value = 'startswith';
    cond.dispatchEvent(new Event('change', { bubbles: true }));
    await wait(400);
    const box = row.querySelector('.condition-value') as HTMLElement & { value: string };
    box.value = (values[0]!.dataset['value'] ?? '').slice(0, 1);
    box.dispatchEvent(new Event('input', { bubbles: true }));
    await wait(700);
    const typed = snap();
    await flip();
    const simple = snap();
    await flip();
    return { picked, flipped, typed, simple, advanced: snap() };
  });

  // Read at once, a menu just built has no rows: the report said "Advanced,
  // no rows" and every row came back. TRAP T-a-rebuilt-row-reads-empty-for-a-tick
  expect(r.flipped).toBe(r.picked);
  expect(r.typed).toMatchObject({ advanced: true, rows: 2 });
  expect(r.simple).toEqual({ advanced: false, rows: 2, total: r.picked });
  expect(r.advanced).toEqual(r.typed);
});
