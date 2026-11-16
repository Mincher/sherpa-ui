import { createHash } from 'node:crypto';
import { test, expect, type Page } from './harness';

/**
 * AN INACTIVE BUTTON KEEPS ITS TIP — Will, TODO 806: "Tooltips should still work
 * on inactive buttons. Seen in Node Editor toolbar." The tip is how a reader learns
 * WHY a tool is off, so a hover and a keyboard focus open it; a press, Enter and
 * Space still do nothing, and its look does not move.
 * TRAP T-an-inactive-button-keeps-its-tip · TRAP T-a-disabled-button-acts-on-nothing
 */

/** Undo and Tie are live; Save, Redo, Group, Arrange and Frame are off. */
async function mountBar(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 80px;';
    root.innerHTML = '<sherpa-button id="before">Before</sherpa-button> '
      + '<sherpa-node-toolbar id="bar" data-can-undo data-can-tie></sherpa-node-toolbar>';
    await window.__settled();
    const heard: string[] = [];
    const bar = document.getElementById('bar')!;
    bar.addEventListener('toolbar-select', (e) => heard.push(`select:${(e as CustomEvent).detail.action}`));
    bar.addEventListener('button-click', () => heard.push('button-click'));
    root.addEventListener('click', () => heard.push('click'));
    (window as unknown as { heard: string[] }).heard = heard;
  });
}

const settled = (page: Page): Promise<void> => page.evaluate(() => window.__settled());

const heard = (page: Page): Promise<string[]> => page.evaluate(() => (window as unknown as { heard: string[] }).heard.splice(0));

/** The tool that holds the focus now, and whether its tip is open. */
const focused = (page: Page): Promise<{ tool: string; tip: boolean }> => page.evaluate(() => {
  let at: Element | null = document.activeElement;
  while (at?.shadowRoot?.activeElement) at = at.shadowRoot.activeElement;
  const host = (at?.getRootNode() as ShadowRoot | undefined)?.host as HTMLElement | undefined;
  return { tool: host?.dataset['action'] ?? host?.id ?? '', tip: !!host?.shadowRoot?.querySelector('.tip')?.matches(':popover-open') };
});

const tipOf = (page: Page, tool: string): Promise<{ open: boolean; text: string }> => page.evaluate((one) => {
  const tip = document.getElementById('bar')!.shadowRoot!.querySelector(`sherpa-button.${one}`)!.shadowRoot!.querySelector<HTMLElement>('.tip')!;
  return { open: tip.matches(':popover-open'), text: tip.textContent ?? '' };
}, tool);

const centre = async (page: Page, tool: string): Promise<{ x: number; y: number }> => {
  const box = (await page.locator(`#bar sherpa-button.${tool}`).boundingBox())!;
  return { x: box.x + box.width / 2, y: box.y + box.height / 2 };
};

test('an inactive tool opens its tip on a hover, and a press does nothing', async ({ page }) => {
  await mountBar(page);
  for (const tool of ['save', 'group']) {
    const at = await centre(page, tool);
    await page.mouse.move(at.x, at.y);
    await expect.poll(async () => (await tipOf(page, tool)).open).toBe(true);
  }
  // It names the act, in a few words (894, PRINCIPLES 24).
  expect((await tipOf(page, 'group')).text).toContain('Save as Custom Node');
  expect(await page.locator('#bar sherpa-button.group .trigger').evaluate((t) => getComputedStyle(t).cursor)).toBe('not-allowed');

  // A real press, on the off tool, reaches nothing.
  const at = await centre(page, 'group');
  await page.mouse.click(at.x, at.y);
  await settled(page);
  expect(await heard(page)).toEqual([]);

  // A live tool still answers, so the listeners are wired.
  const undo = await centre(page, 'undo');
  await page.mouse.click(undo.x, undo.y);
  await settled(page);
  expect(await heard(page)).toEqual(expect.arrayContaining(['select:undo', 'button-click']));

  // Off the tool, its tip shuts.
  await page.mouse.move(0, 0);
  await expect.poll(async () => (await tipOf(page, 'group')).open).toBe(false);
});

test('Tab reaches an inactive tool and opens its tip; Enter and Space do nothing; the arrows step past it', async ({ page }, info) => {
  await mountBar(page);
  const TAB = info.project.name === 'webkit' ? 'Alt+Tab' : 'Tab';
  await page.locator('#before .trigger').focus();
  const seen: { tool: string; tip: boolean }[] = [];
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press(TAB);
    await expect.poll(async () => (await focused(page)).tip).toBe(true);
    seen.push(await focused(page));
  }
  expect(seen.map((s) => s.tool)).toEqual(['fetch', 'play', 'pause', 'stop', 'undo', 'redo', 'tie', 'arrange', 'unfurl', 'frame', 'group', 'save']);

  // On an off tool, Enter and Space are refused.
  await page.locator('#bar sherpa-button.redo .trigger').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await settled(page);
  expect(await heard(page)).toEqual([]);
  expect((await focused(page)).tool).toBe('redo');

  // The arrows move between LIVE tools, from wherever the focus sits.
  await page.keyboard.press('ArrowLeft');
  expect((await focused(page)).tool).toBe('undo');
  await page.locator('#bar sherpa-button.redo .trigger').focus();
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).tool).toBe('tie');
  await page.locator('#bar sherpa-button.frame .trigger').focus();
  await page.keyboard.press('ArrowRight');
  expect((await focused(page)).tool).toBe('undo');
});

/** The button's own pixels, transitions run to their end. */
const pixels = async (page: Page, id: string): Promise<string> =>
  createHash('sha1').update(await page.locator(`#${id}`).screenshot({ animations: 'disabled' })).digest('hex');

test('an inactive button looks the same at rest, hovered and pressed, in each look', async ({ page }) => {
  await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.style.cssText = 'padding: 40px; display: flex; gap: 24px; background: rgb(255, 255, 255)';
    // No tip here: its shadow would fall on the button's pixels.
    root.innerHTML = ['', 'transparent', 'saturated'].map((look, i) => {
      const attrs = `data-icon-start="floppy-disk" data-no-tip ${look ? `data-look="${look}"` : ''}`;
      return `<sherpa-button id="off${i}" ${attrs} disabled>Save</sherpa-button><sherpa-button id="on${i}" ${attrs}>Save</sherpa-button>`;
    }).join('');
    await window.__settled();
  });
  for (const i of [0, 1, 2]) {
    const id = `off${i}`;
    const box = (await page.locator(`#${id}`).boundingBox())!;
    const rest = await pixels(page, id);
    await page.mouse.move(box.x + 4, box.y + box.height / 2);
    const hovered = await pixels(page, id);
    await page.mouse.down();
    const pressed = await pixels(page, id);
    await page.mouse.up();
    await page.mouse.move(0, 0);
    expect(hovered, `${id} hovered`).toBe(rest);
    expect(pressed, `${id} pressed`).toBe(rest);
  }
  // The same read SEES a fill step: a live button's hover is not its rest.
  const live = (await page.locator('#on0').boundingBox())!;
  const rest = await pixels(page, 'on0');
  await page.mouse.move(live.x + 4, live.y + live.height / 2);
  expect(await pixels(page, 'on0')).not.toBe(rest);
});

test('in forced colours an inactive button is GrayText, as :disabled makes it', async ({ page }, info) => {
  test.skip(info.project.name === 'webkit', 'WebKit cannot emulate forced colours');
  // BEFORE the mount: an adopted sheet does not hear an emulation turned on after it.
  await page.emulateMedia({ forcedColors: 'active' });
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-button id="off" disabled>Save</sherpa-button><button id="native" disabled>Save</button>'
      + '<span id="grey" style="color: GrayText"></span>';
    await window.__settled();
    const trigger = document.getElementById('off')!.shadowRoot!.querySelector('.trigger')!;
    return {
      ink: getComputedStyle(trigger).color, border: getComputedStyle(trigger).borderTopColor,
      native: getComputedStyle(document.getElementById('native')!).color, grey: getComputedStyle(document.getElementById('grey')!).color,
    };
  });
  expect(r.ink).toBe(r.native);
  expect(r.border).toBe(r.grey);
});

test('an inactive button runs no command, even one a press set before it went off', async ({ page }) => {
  await page.evaluate(async () => {
    document.getElementById('root')!.innerHTML = '<sherpa-button id="open" commandfor="d" command="--show">Edit</sherpa-button>'
      + '<sherpa-dialog id="d" data-heading="Edit"><p>Body</p></sherpa-dialog>';
    await window.__settled();
  });
  const open = (): Promise<boolean> => page.evaluate(() => (document.getElementById('d') as HTMLElement & { open: boolean }).open);
  await page.locator('#open .trigger').click();
  await expect.poll(open).toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(open).toBe(false);

  await page.evaluate(async () => {
    document.getElementById('open')!.setAttribute('disabled', '');
    await window.__settled();
  });
  // A real press: an aria-disabled control is one Playwright will not click for us.
  const box = (await page.locator('#open').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.locator('#open .trigger').focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Space');
  await settled(page);
  expect(await open()).toBe(false);
});