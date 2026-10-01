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
    }], { style: 'inline-size: 400px' });
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