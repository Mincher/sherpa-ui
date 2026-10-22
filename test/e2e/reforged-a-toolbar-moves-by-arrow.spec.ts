import { test, expect, type Page } from './harness';

/**
 * A TOOLBAR MOVES BY ARROW — TODO 318 (Will: A). Left, Right, Home and End move
 * between a toolbar's controls, slotted ones too; Tab still visits each one. A
 * control keeps the keys it uses: a number box steps on Up and Down, a select
 * walks its items, a text box moves its caret.
 * TRAP T-a-toolbar-moves-by-arrow-and-keeps-its-tabs
 */
/** The focused control, through every shadow root: its own name. */
const focused = (page: Page): Promise<string> => page.evaluate(() => {
  let at: Element | null = document.activeElement;
  while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  const host = (at?.getRootNode() as ShadowRoot).host as HTMLElement | undefined;
  return (at as HTMLElement | null)?.dataset['name'] ?? host?.dataset['name'] ?? host?.closest<HTMLElement>('[data-name]')?.dataset['name'] ?? at?.localName ?? '';
});

test('a toolbar: the arrows move between controls, and each control keeps its own keys', async ({ page }) => {
  await page.evaluate(async () => {
    const bar = document.createElement('sherpa-toolbar');
    bar.innerHTML = `
      <div slot="leading">
        <sherpa-button data-name="first">First</sherpa-button>
        <button data-name="second">Second</button>
        <sherpa-input-text data-type="number" data-name="count" value="5" aria-label="Count"></sherpa-input-text>
      </div>
      <div slot="trailing">
        <select data-name="pick" aria-label="Pick"><option>One</option><option>Two</option><option>Three</option></select>
        <input data-name="find" aria-label="Find" value="abc" />
      </div>`;
    document.getElementById('root')!.replaceChildren(bar);
    await window.__settled();
    bar.querySelector('sherpa-button')!.shadowRoot!.querySelector('button')!.focus();
  });
  const seen: string[] = [await focused(page)];
  await page.keyboard.press('ArrowRight');
  seen.push(await focused(page));
  await page.keyboard.press('ArrowRight');
  seen.push(await focused(page));
  // A number box: Up steps its value, and Right moves its caret — the focus stays.
  await page.keyboard.press('ArrowUp');
  await page.keyboard.press('ArrowRight');
  seen.push(await focused(page));
  const count = await page.evaluate(() => (document.querySelector('sherpa-input-text') as HTMLElement & { value: string }).value);
  // Tab still goes to the next control.
  await page.keyboard.press('Tab');
  seen.push(await focused(page));
  // A select: Down is its own; Right moves on.
  await page.keyboard.press('ArrowDown');
  seen.push(await focused(page));
  await page.keyboard.press('ArrowRight');
  seen.push(await focused(page));
  // A text box: Home is its caret's.
  await page.keyboard.press('Home');
  seen.push(await focused(page));
  // From the last control, Right comes round to the first.
  await page.evaluate(() => (document.activeElement as HTMLElement).blur());
  await page.evaluate(() => document.querySelector<HTMLElement>('button[data-name="second"]')!.focus());
  await page.keyboard.press('Home');
  seen.push(await focused(page));
  expect(seen).toEqual(['first', 'second', 'count', 'count', 'pick', 'pick', 'find', 'find', 'first']);
  expect(count).toBe('6');
});

test('a filter bar: Right and Left move between its chips', async ({ page }) => {
  await page.evaluate(async () => {
    const filters = ['status', 'plan', 'tier'].map((id) => ({
      id, label: id, select: 'multiple', options: [{ value: 'a', label: 'a' }, { value: 'b', label: 'b' }],
    }));
    const bar = await window.__mount('sherpa-quick-filter-toolbar', filters, { style: 'inline-size: 1200px' });
    await window.__settled();
    const chip = bar.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="status"]')!;
    chip.shadowRoot!.querySelector<HTMLElement>('.body')!.focus();
  });
  const id = (): Promise<string> => page.evaluate(() => {
    let at: Element | null = document.activeElement;
    while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
    return ((at?.getRootNode() as ShadowRoot).host as HTMLElement).dataset['id'] ?? '';
  });
  const seen = [await id()];
  await page.keyboard.press('ArrowRight');
  seen.push(await id());
  await page.keyboard.press('ArrowRight');
  seen.push(await id());
  await page.keyboard.press('ArrowLeft');
  seen.push(await id());
  expect(seen).toEqual(['status', 'plan', 'tier', 'plan']);
});
