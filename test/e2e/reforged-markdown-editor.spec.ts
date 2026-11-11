import { test, expect, type Page } from './harness';

/**
 * sherpa-markdown-editor (plan 892): a Markdown text, edited as it reads. Its value is the Markdown; the formatted view
 * draws it, a mark showing while the caret is in its span; every edit — a key, a paste, a tool — is the text's, and
 * Undo takes it back. A value reads as a purple chip, and `insertValue` puts one at the caret. A form control.
 */
type Editor = HTMLElement & { value: string; valueLabels: Record<string, string>; insertValue(key: string): void; rendered: Promise<void> };

const mount = (page: Page, attrs: Record<string, string> = {}): Promise<void> => page.evaluate(async (a) => {
  const el = document.createElement('sherpa-markdown-editor') as Editor;
  el.style.inlineSize = '640px';
  for (const [k, v] of Object.entries(a)) el.setAttribute(k, v);
  const form = document.createElement('form');
  const away = document.createElement('button');
  away.type = 'button';
  away.id = 'away';
  away.textContent = 'Away';
  form.append(el, away);
  document.getElementById('root')!.append(form);
  await el.rendered;
  await window.__settled();
  (window as never as { said: string[] }).said = [];
  for (const type of ['input', 'change']) el.addEventListener(type, (e) => (window as never as { said: string[] }).said.push(`${type}:${(e as CustomEvent).detail?.value}`));
}, attrs);

const editor = 'sherpa-markdown-editor';
const content = `${editor} .content`;
const value = (page: Page): Promise<string> => page.locator(editor).evaluate((el) => (el as Editor).value);
const said = (page: Page): Promise<string[]> => page.evaluate(() => (window as never as { said: string[] }).said);
const mod = (page: Page): Promise<string> => page.evaluate(() => (/mac/i.test(navigator.platform) ? 'Meta' : 'Control'));
/** The caret to its line's start or end: on a Mac Home and End scroll, as Cmd+Left and Cmd+Right do not. */
const toLine = async (page: Page, end: boolean): Promise<void> => {
  const key = await mod(page);
  await page.keyboard.press(key === 'Meta' ? `Meta+${end ? 'ArrowRight' : 'ArrowLeft'}` : end ? 'End' : 'Home');
};
test('it draws the Markdown as it reads: a heading, a bold span with its marks hidden, a list, a value in purple', async ({ page }) => {
  await mount(page, { value: '# Title\nHi **there** {s.name}\n- one\n1. first', 'data-label': 'Message' });
  await page.locator(editor).evaluate((el) => { (el as Editor).valueLabels = { '{s.name}': 'Customers › Name' }; });
  const r = await page.locator(editor).evaluate((el) => {
    const root = el.shadowRoot!;
    const lines = [...root.querySelectorAll('.content > .line')] as HTMLElement[];
    const strong = root.querySelector<HTMLElement>('.span[data-kind="strong"]')!;
    const chip = root.querySelector<HTMLElement>('.value')!;
    return {
      blocks: lines.map((l) => [l.dataset['block'], l.dataset['level'] ?? null]),
      text: lines.map((l) => l.textContent),
      lead: getComputedStyle(root.querySelector('.lead')!).display,
      weight: getComputedStyle(strong).fontWeight,
      marks: [...strong.querySelectorAll('.mark')].map((m) => getComputedStyle(m).display),
      chip: [chip.textContent, chip.dataset['key'], getComputedStyle(chip).color],
      bullet: getComputedStyle(lines[2]!, '::before').content,
      number: getComputedStyle(lines[3]!, '::before').content,
      name: root.querySelector('.content')!.getAttribute('aria-labelledby'),
    };
  });
  expect(r.blocks).toEqual([['heading', '1'], ['paragraph', null], ['bullet', null], ['number', null]]);
  expect(r.lead).toBe('none');
  expect(Number(r.weight)).toBeGreaterThanOrEqual(700);
  expect(r.marks).toEqual(['none', 'none']);
  expect(r.chip).toEqual(['Customers › Name', '{s.name}', 'rgb(131, 0, 182)']);
  expect(r.bullet).toBe('"•"');
  expect(r.number).toContain('1');
  expect(r.name).toBe('label');
  expect(await value(page)).toBe('# Title\nHi **there** {s.name}\n- one\n1. first');
});

test('typing writes Markdown, and a span reads formatted as it is closed', async ({ page }) => {
  await mount(page);
  await page.locator(content).click();
  await page.keyboard.type('Hello **world**');
  expect(await value(page)).toBe('Hello **world**');
  const strong = page.locator(`${content} .span[data-kind="strong"]`);
  await expect(strong).toHaveCount(1);
  // The caret is at its end, so its marks show; away from it, they hide.
  await expect(strong.locator('.mark').first()).toBeVisible();
  await toLine(page, false);
  await expect(strong.locator('.mark').first()).toBeHidden();
  expect((await said(page)).at(-1)).toBe('input:Hello **world**');
});

test('Enter goes on with a list, an empty item ends it; Backspace at an item\'s start takes its bullet', async ({ page }) => {
  await mount(page);
  await page.locator(content).click();
  await page.keyboard.type('- one');
  await page.keyboard.press('Enter');
  await page.keyboard.type('two');
  expect(await value(page)).toBe('- one\n- two');
  await page.keyboard.press('Enter');
  await page.keyboard.press('Enter');
  expect(await value(page)).toBe('- one\n- two\n');
  await page.keyboard.type('after');
  await page.keyboard.press('ArrowUp');
  await toLine(page, false);
  await page.keyboard.press('Backspace');
  expect(await value(page)).toBe('- one\ntwo\nafter');
});

test('the tools: Bold on a selection, the text style, a numbered list; Undo and Redo', async ({ page }) => {
  await mount(page, { value: 'make this bold' });
  await page.locator(content).click();
  await toLine(page, true);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.locator(`${editor} .tool[data-action="strong"]`).click();
  expect(await value(page)).toBe('make this **bold**');
  await expect(page.locator(`${editor} .tool[data-action="strong"]`)).toHaveAttribute('aria-pressed', 'true');
  // The text style: a heading.
  await page.locator(`${editor} .style`).click();
  await page.locator(`${editor} .styles button[value="h2"]`).click();
  expect(await value(page)).toBe('## make this **bold**');
  await expect(page.locator(`${editor} .style`)).toHaveAttribute('data-label', 'Heading 2');
  await page.locator(`${editor} .tool[data-action="number"]`).click();
  expect(await value(page)).toBe('1. make this **bold**');
  await page.locator(`${editor} .tool[data-action="undo"]`).click();
  expect(await value(page)).toBe('## make this **bold**');
  await page.locator(`${editor} .tool[data-action="undo"]`).click();
  await page.locator(`${editor} .tool[data-action="undo"]`).click();
  expect(await value(page)).toBe('make this bold');
  await page.locator(`${editor} .tool[data-action="redo"]`).click();
  expect(await value(page)).toBe('make this **bold**');
});

test('the keys: Bold and Undo by the primary key; Tab moves a list item, and elsewhere leaves the box', async ({ page }) => {
  await mount(page);
  const key = await mod(page);
  await page.locator(content).click();
  await page.keyboard.type('a ');
  await page.keyboard.press(`${key}+b`);
  await page.keyboard.type('b');
  expect(await value(page)).toBe('a **b**');
  await page.keyboard.press(`${key}+z`);
  expect(await value(page)).toBe('a ****');
  await page.keyboard.press(`${key}+z`);
  expect(await value(page)).toBe('a ');
  await page.locator(editor).evaluate((el) => { (el as Editor).value = '- one\n- two'; });
  await page.locator(content).click();
  await toLine(page, true);
  await page.keyboard.press('Tab');
  expect(await value(page)).toBe('- one\n  - two');
  await page.keyboard.press('Shift+Tab');
  expect(await value(page)).toBe('- one\n- two');
  // Not in an item: Tab moves on, as in any field.
  await page.locator(editor).evaluate((el) => { (el as Editor).value = 'plain'; });
  await page.locator(content).click();
  await page.keyboard.press('Tab');
  expect(await page.locator(editor).evaluate((el) => el.shadowRoot!.activeElement?.classList.contains('content') ?? false)).toBe(false);
  expect(await value(page)).toBe('plain');
});

test('the Markdown view is the text itself; an edit there is the same value', async ({ page }) => {
  await mount(page, { value: 'Hi **you**' });
  await page.locator(`${editor} .view[data-view="markdown"]`).click();
  await expect(page.locator(editor)).toHaveAttribute('data-view', 'markdown');
  const source = page.locator(`${editor} .source`);
  await expect(source).toBeVisible();
  await expect(page.locator(content)).toBeHidden();
  await expect(source).toHaveValue('Hi **you**');
  await source.click();
  await toLine(page, true);
  await page.keyboard.type('!');
  expect(await value(page)).toBe('Hi **you**!');
  await page.locator(`${editor} .view[data-view="formatted"]`).click();
  await expect(page.locator(content)).toBeVisible();
  await expect(page.locator(`${content} .span[data-kind="strong"]`)).toHaveText('**you**');
});

test('insertValue puts a value at the caret, a space before it after a word; Backspace takes it whole', async ({ page }) => {
  await mount(page, { value: 'Hi there' });
  await page.locator(content).click();
  await toLine(page, true);
  for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowLeft');
  await page.locator(editor).evaluate((el) => (el as Editor).insertValue('{s.name}'));
  expect(await value(page)).toBe('Hi {s.name} there');
  await expect(page.locator(`${content} .value`)).toHaveText('s.name');
  await page.keyboard.press('Backspace');
  expect(await value(page)).toBe('Hi  there');
});

test('a paste is its plain text; change goes out when focus leaves; the form submits the Markdown', async ({ page }) => {
  await mount(page, { name: 'message', required: '' });
  expect(await page.locator('form').evaluate((f) => (f as HTMLFormElement).checkValidity())).toBe(false);
  await page.locator(content).click();
  await page.evaluate(() => {
    // A paste's data, as the platform hands it: a script's own DataTransfer is not read in every engine.
    const paste = new ClipboardEvent('paste', { bubbles: true, cancelable: true, composed: true });
    Object.defineProperty(paste, 'clipboardData', { value: { getData: (type: string) => (type === 'text/plain' ? '- a\r\n- b' : '') } });
    document.querySelector('sherpa-markdown-editor')!.shadowRoot!.querySelector('.content')!.dispatchEvent(paste);
  });
  expect(await value(page)).toBe('- a\n- b');
  await page.locator('#away').click();
  expect((await said(page)).filter((s) => s.startsWith('change'))).toEqual(['change:- a\n- b']);
  const sent = await page.locator('form').evaluate((f) => [(f as HTMLFormElement).checkValidity(), new FormData(f as HTMLFormElement).get('message')]);
  expect(sent).toEqual([true, '- a\n- b']);
});

test('Link puts the selection in a link, its address selected to type over', async ({ page }) => {
  await mount(page, { value: 'see docs' });
  await page.locator(content).click();
  await toLine(page, true);
  for (let i = 0; i < 4; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.locator(`${editor} .tool[data-action="link"]`).click();
  expect(await value(page)).toBe('see [docs](https://)');
  await page.keyboard.type('example.com');
  expect(await value(page)).toBe('see [docs](example.com)');
  await expect(page.locator(`${content} .span[data-kind="link"]`)).toHaveAttribute('title', 'example.com');
});

test('read only, it shows the text as it reads, with nothing to press; disabled, its box and tools are off', async ({ page }) => {
  await mount(page, { value: '**fixed**', readonly: '', name: 'note' });
  expect(await page.locator('form').evaluate((f) => [...new FormData(f as HTMLFormElement).entries()])).toEqual([['note', '**fixed**']]);
  await expect(page.locator(`${editor} .bar`)).toBeHidden();
  await expect(page.locator(content)).toHaveAttribute('contenteditable', 'false');
  await page.locator(content).click();
  await page.keyboard.type('x');
  expect(await value(page)).toBe('**fixed**');
  await page.locator(editor).evaluate((el) => { el.removeAttribute('readonly'); el.setAttribute('disabled', ''); });
  await expect(page.locator(`${editor} .bar`)).toBeVisible();
  await expect(page.locator(`${editor} .tool[data-action="strong"]`)).toHaveAttribute('disabled', '');
  await expect(page.locator(`${editor} .view[data-view="markdown"]`)).toHaveAttribute('disabled', '');
  await expect(page.locator(content)).toHaveAttribute('aria-disabled', 'true');
  // Off, it sends nothing, as a disabled field.
  expect(await page.locator('form').evaluate((f) => [...new FormData(f as HTMLFormElement).keys()])).toEqual([]);
});

test('moved, it still hears the caret: a span\'s marks show while the caret is in it', async ({ page }) => {
  await mount(page, { value: 'a **b** c' });
  await page.locator(editor).evaluate((el) => {
    const other = document.createElement('div');
    document.getElementById('root')!.append(other);
    other.append(el);
  });
  const mark = page.locator(`${content} .span[data-kind="strong"] .mark`).first();
  await expect(mark).toBeHidden();
  await page.locator(content).click();
  await toLine(page, false);
  for (let i = 0; i < 3; i++) await page.keyboard.press('ArrowRight');
  await expect(mark).toBeVisible();
  await toLine(page, true);
  await expect(mark).toBeHidden();
});
