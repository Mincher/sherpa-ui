import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * A TAG field — plan 749 P2, Will 2026-11-05: *"Tag Inputs for comma separated text input ...
 * If there's not enough space then the final tag shows '+2'."* `sherpa-input-text
 * data-type="tags"`: `value` is the comma string, `.tags` the array. Real keys and real clicks.
 * TRAP T-a-tag-field-counts-what-css-clips · TRAP T-a-host-error-is-the-hosts
 */
type Field = HTMLElement & { value: string; tags: string[] };

/** A field of this width in the page, its events heard in `window.__heard`. */
async function mount(page: Page, width: number, attrs = '', value = ''): Promise<void> {
  await page.evaluate(async ({ width, attrs, value }) => {
    document.getElementById('root')!.innerHTML =
      `<div style="inline-size:${width}px"><sherpa-input-text id="t" data-type="tags" data-label="Methods" ${attrs} value="${value}"></sherpa-input-text></div>`;
    const el = document.getElementById('t') as Field;
    const heard: unknown[] = [];
    (window as unknown as { __heard: unknown[] }).__heard = heard;
    for (const type of ['tags-change', 'change', 'input']) el.addEventListener(type, (e) => heard.push([type, (e as CustomEvent).detail]));
    await window.__settled();
  }, { width, attrs, value });
}

const tags = (page: Page) => page.evaluate(() => {
  const el = document.getElementById('t') as Field;
  return { value: el.value, tags: el.tags, chips: [...el.shadowRoot!.querySelectorAll<HTMLElement>('.tags > .tag')].map((c) => c.dataset['tag']) };
});

const heard = (page: Page) => page.evaluate(() => (window as unknown as { __heard: unknown[] }).__heard);

test('Enter and comma make tags; the value and .tags agree; a repeat is ignored', async ({ page }) => {
  await mount(page, 480);
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.type('Email');
  await page.keyboard.press('Enter');
  await page.keyboard.type('SMS,');
  await page.keyboard.type('Email');
  await page.keyboard.press('Enter');
  expect(await tags(page)).toEqual({ value: 'Email,SMS', tags: ['Email', 'SMS'], chips: ['Email', 'SMS'] });
  const said = await heard(page);
  expect(said).toEqual([
    ['tags-change', { tags: ['Email'], added: ['Email'], removed: [] }], ['input', { value: 'Email' }], ['change', { value: 'Email' }],
    ['tags-change', { tags: ['Email', 'SMS'], added: ['SMS'], removed: [] }], ['input', { value: 'Email,SMS' }], ['change', { value: 'Email,SMS' }],
  ]);
});

test('typed words fire no input or change; blur commits them', async ({ page }) => {
  await mount(page, 480);
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.type('Push');
  expect(await heard(page)).toEqual([]);
  await page.keyboard.press('Tab');
  expect((await tags(page)).value).toBe('Push');
});

test('inserted text with commas splits into tags, in every engine', async ({ page }) => {
  await mount(page, 480);
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.insertText('a, b,c');
  expect((await tags(page)).tags).toEqual(['a', 'b']);
  await page.keyboard.press('Enter');
  expect((await tags(page)).tags).toEqual(['a', 'b', 'c']);
});

test('a paste of commas and lines splits into tags', async ({ page, browserName }) => {
  // Firefox ignores the data of a scripted ClipboardEvent.
  test.skip(browserName !== 'chromium', 'a scripted paste carries data in Chromium only');
  await mount(page, 480);
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.evaluate(() => {
    const control = (document.getElementById('t') as HTMLElement).shadowRoot!.querySelector<HTMLInputElement>('.control')!;
    const data = new DataTransfer();
    data.setData('text', 'a, b,c\nd');
    control.dispatchEvent(new ClipboardEvent('paste', { clipboardData: data, bubbles: true, cancelable: true, composed: true }));
  });
  expect((await tags(page)).tags).toEqual(['a', 'b', 'c', 'd']);
});

test('Backspace on an empty field removes the last tag; arrows move between tags; Delete removes the one in focus', async ({ page }) => {
  await mount(page, 480, '', 'a,b,c');
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.press('Backspace');
  expect((await tags(page)).value).toBe('a,b');
  await page.keyboard.press('ArrowLeft');
  const on = () => page.evaluate(() => (document.getElementById('t') as HTMLElement).shadowRoot!.activeElement?.getAttribute('data-tag') ?? (document.getElementById('t') as HTMLElement).shadowRoot!.activeElement?.className);
  expect(await on()).toBe('b');
  await page.keyboard.press('ArrowLeft');
  expect(await on()).toBe('a');
  await page.keyboard.press('ArrowRight');
  await page.keyboard.press('ArrowRight');
  expect(await on()).toBe('control');
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Delete');
  expect(await tags(page)).toMatchObject({ value: 'a' });
  expect(await on()).toBe('a');
  await page.keyboard.press('Backspace');
  expect((await tags(page)).value).toBe('');
  expect(await on()).toBe('control');
});

test('the x on a tag removes it', async ({ page }) => {
  await mount(page, 480, '', 'a,b');
  await page.locator('#t').locator('.tag[data-tag="a"]').locator('.close').click();
  expect((await tags(page)).value).toBe('b');
});

test('overflow: at three widths the count is the tags wrapped away; +N shows only then; the button always shows', async ({ page }) => {
  const words = 'Email,SMS,Push,Slack,Teams,Webhook,Pager';
  const read = () => page.evaluate(() => {
    const el = document.getElementById('t') as HTMLElement;
    const sr = el.shadowRoot!;
    const box = sr.querySelector<HTMLElement>('.tags')!.getBoundingClientRect();
    const chips = [...sr.querySelectorAll<HTMLElement>('.tags > .tag')];
    const more = sr.querySelector<HTMLElement>('.more')!;
    const button = sr.querySelector<HTMLElement>('.tags-button')!.getBoundingClientRect();
    const seen = chips.filter((c) => { const r = c.getBoundingClientRect(); return r.bottom <= box.bottom + 0.5 && r.right <= box.right + 0.5; });
    return {
      overflow: el.getAttribute('data-overflow'),
      hidden: chips.filter((c) => c.hasAttribute('inert')).length,
      seen: seen.length,
      moreShown: getComputedStyle(more).display !== 'none' && more.getBoundingClientRect().width > 0,
      moreText: more.textContent, moreLabel: more.getAttribute('aria-label'),
      button: button.width > 0,
    };
  });
  const counts: number[] = [];
  for (const width of [900, 520, 360]) {
    await mount(page, width, '', words);
    await page.waitForTimeout(100);
    const r = await read();
    expect(r.button).toBe(true);
    expect(r.hidden + r.seen).toBe(7);
    if (r.hidden === 0) {
      expect(r.overflow).toBeNull();
      expect(r.moreShown).toBe(false);
    } else {
      expect(r.overflow).toBe(String(r.hidden));
      expect(r.moreShown).toBe(true);
      expect(r.moreText).toBe(`+${r.hidden}`);
      expect(r.moreLabel).toBe(`${r.hidden} more`);
    }
    counts.push(r.hidden);
  }
  expect(counts[0]).toBe(0);
  expect(counts[2]!).toBeGreaterThan(counts[1]!);
  expect(counts[1]!).toBeGreaterThan(0);
});

test('the button and the +N open the same menu; unticking removes a tag; Escape closes and returns focus', async ({ page }) => {
  await mount(page, 360, '', 'Email,SMS,Push,Slack,Teams,Webhook,Pager');
  await page.waitForTimeout(100);
  const sr = (sel: string) => page.locator('#t').locator(sel);
  await sr('.tags-button').click();
  const menu = sr('.tags-menu');
  await expect(menu).toHaveAttribute('open', '');
  const rows = () => page.evaluate(() => [...(document.getElementById('t') as HTMLElement).shadowRoot!.querySelectorAll<HTMLInputElement>('.tags-menu input[type="checkbox"]')].filter((i) => i.value).map((i) => [i.value, i.checked]));
  const listed = await rows();
  expect(listed.map((r) => r[0])).toEqual(['Email', 'SMS', 'Push', 'Slack', 'Teams', 'Webhook', 'Pager']);
  expect(listed.every((r) => r[1])).toBe(true);
  await page.keyboard.press('Escape');
  await expect(menu).not.toHaveAttribute('open', '');
  // WebKit does not focus a pressed button, and is not a target.
  if (test.info().project.name !== 'webkit') await expect(sr('.tags-button')).toBeFocused();
  // The +N opens the same menu.
  await sr('.more').click();
  await expect(menu).toHaveAttribute('open', '');
  expect((await rows()).length).toBe(7);
  // Untick one: the tag goes, and `tags-change` says which.
  await page.evaluate(() => { (document.getElementById('t') as Field).tags; });
  await page.locator('#t').locator('.tags-menu input[value="SMS"]').click();
  expect((await tags(page)).value).toBe('Email,Push,Slack,Teams,Webhook,Pager');
  const last = (await heard(page)).filter((h) => (h as unknown[])[0] === 'tags-change').at(-1);
  expect(last).toEqual(['tags-change', { tags: ['Email', 'Push', 'Slack', 'Teams', 'Webhook', 'Pager'], added: [], removed: ['SMS'] }]);
  // Ticked back, it returns in its place.
  await page.locator('#t').locator('.tags-menu input[value="SMS"]').click();
  expect((await tags(page)).value).toBe('Email,SMS,Push,Slack,Teams,Webhook,Pager');
});

test('readonly shows tags without an x; disabled refuses; the placeholder shows only with no tags', async ({ page }) => {
  await mount(page, 480, 'readonly', 'a,b');
  const dismiss = await page.evaluate(() => [...(document.getElementById('t') as HTMLElement).shadowRoot!.querySelectorAll('.tags > .tag')].map((c) => c.hasAttribute('data-dismissible')));
  expect(dismiss).toEqual([false, false]);
  await page.locator('#t').locator('.control-row > .control').first().focus();
  await page.keyboard.press('ArrowLeft');
  await page.keyboard.press('Delete');
  expect((await tags(page)).value).toBe('a,b');
  await mount(page, 480, 'disabled', 'a');
  await expect(page.locator('#t').locator('.control-row > .control').first()).toBeDisabled();
  await mount(page, 480, 'placeholder="Add one"');
  const ph = () => page.evaluate(() => getComputedStyle((document.getElementById('t') as HTMLElement).shadowRoot!.querySelector('.control')!, '::placeholder').color);
  const empty = await ph();
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.type('x,');
  expect(await ph()).not.toBe(empty);
  expect(empty).not.toBe('rgba(0, 0, 0, 0)');
});

test('a plain field is unchanged: one value, its own input and change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-input-text id="p" value="a,b"></sherpa-input-text>';
    const el = document.getElementById('p') as Field;
    await window.__settled();
    return { value: el.value, tags: el.shadowRoot!.querySelector('.tags'), control: el.shadowRoot!.querySelector<HTMLInputElement>('.control')!.value };
  });
  expect(r).toEqual({ value: 'a,b', tags: null, control: 'a,b' });
});

test('suggestions: the menu offers them unticked; a word typed as a label is its value; a chip says its label (plan 749 P4)', async ({ page }) => {
  await mount(page, 480);
  await page.evaluate(() => { (document.getElementById('t') as Field & { suggestions: unknown }).suggestions = [{ value: 'email', label: 'Email' }, { value: 'sms', label: 'SMS' }]; });
  await page.locator('#t').locator('.control-row > .control').first().click();
  await page.keyboard.type('EMAIL');
  await page.keyboard.press('Enter');
  // Open: a word that names none is a tag of its own.
  await page.keyboard.type('Pager');
  await page.keyboard.press('Enter');
  expect(await tags(page)).toEqual({ value: 'email,Pager', tags: ['email', 'Pager'], chips: ['email', 'Pager'] });
  expect(await page.locator('#t').locator('.tags > .tag').allTextContents()).toEqual(['Email', 'Pager']);
  await page.locator('#t').locator('.tags-button').click();
  const rows = () => page.evaluate(() => [...(document.getElementById('t') as HTMLElement).shadowRoot!.querySelectorAll<HTMLInputElement>('.tags-menu input[type="checkbox"]')].filter((i) => i.value).map((i) => [i.value, i.checked]));
  expect(await rows()).toEqual([['email', true], ['Pager', true], ['sms', false]]);
  await page.locator('#t').locator('.tags-menu input[value="sms"]').click();
  expect((await tags(page)).tags).toEqual(['email', 'Pager', 'sms']);
});

test('data-closed refuses a stranger: it is no tag, stays typed, and the field says why; mended, the message goes (plan 749 P4)', async ({ page }) => {
  await mount(page, 480, 'data-closed');
  await page.evaluate(() => { (document.getElementById('t') as Field & { suggestions: unknown }).suggestions = [{ value: 'Email' }, { value: 'SMS' }]; });
  const control = page.locator('#t').locator('.control-row > .control').first();
  await control.click();
  await page.keyboard.type('Fax');
  await page.keyboard.press('Enter');
  const state = () => page.evaluate(() => {
    const el = document.getElementById('t') as Field;
    return { tags: el.tags, typed: el.shadowRoot!.querySelector<HTMLInputElement>('.control')!.value, error: el.getAttribute('data-error'), invalid: el.shadowRoot!.querySelector('.control')!.getAttribute('aria-invalid') };
  });
  expect(await state()).toEqual({ tags: [], typed: 'Fax', error: '“Fax” is not one of the choices.', invalid: 'true' });
  // A comma and a paste are refused the same way; a known word among them is taken.
  await control.fill('');
  await page.keyboard.type('sms,Telex,');
  expect(await state()).toEqual({ tags: ['SMS'], typed: 'Telex', error: '“Telex” is not one of the choices.', invalid: 'true' });
  expect((await heard(page)).filter((h) => (h as unknown[])[0] === 'tags-change')).toEqual([['tags-change', { tags: ['SMS'], added: ['SMS'], removed: [] }]]);
  // The message is red, and goes once the word is mended.
  await expect(page.locator('#t').locator('.message').first()).toBeVisible();
  await page.keyboard.press('Backspace');
  expect((await state()).error).toBeNull();
  await control.fill('Email');
  await page.keyboard.press('Enter');
  expect(await state()).toEqual({ tags: ['SMS', 'Email'], typed: '', error: null, invalid: 'false' });
});

test('a message the HOST wrote is the host\'s: a focus and a blur leave it, and the field\'s own waits behind it (plan 749 P4)', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-input-text id="h" data-label="Name" required data-error="That name is taken."></sherpa-input-text><button type="button">Next</button>';
    await window.__settled();
  });
  const control = page.locator('#h').locator('.control').first();
  const error = () => page.locator('#h').getAttribute('data-error');
  await control.click();
  await page.keyboard.press('Tab');
  await expect(control).not.toBeFocused();
  expect(await error()).toBe('That name is taken.');
  await expect(control).toHaveAttribute('aria-invalid', 'true');
  // The host takes it away: the field's own check speaks again, on the next blur.
  await page.evaluate(() => document.getElementById('h')!.removeAttribute('data-error'));
  await control.click();
  await page.keyboard.press('Tab');
  expect(await error()).toBeTruthy();
  expect(await error()).not.toBe('That name is taken.');
});
