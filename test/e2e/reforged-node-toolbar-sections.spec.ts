import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * The node editor's toolbar is three sections with a small divider between each: Fetch, Play, Pause and Stop;
 * Undo, Redo and Save; the graph's shape. Play goes on from a pause; Pause and Stop can be pressed only while a
 * run is on. Real pointer where it presses; the states read from the buttons.
 */
async function mount(page: Page): Promise<void> {
  await page.evaluate(async () => {
    const bar = document.createElement('sherpa-node-toolbar') as HTMLElement & { rendered?: Promise<void> };
    bar.id = 'bar';
    document.getElementById('root')!.replaceChildren(bar);
    await bar.rendered;
    await window.__settled();
  });
}
const off = (page: Page) => page.evaluate(() => Object.fromEntries(['fetch', 'play', 'pause', 'stop'].map((n) => [n, document.querySelector('#bar')!.shadowRoot!.querySelector(`.${n}`)!.hasAttribute('disabled')])));
const set = (page: Page, attrs: Record<string, boolean>) => page.evaluate(async (a) => {
  const bar = document.querySelector('#bar')!;
  for (const [k, v] of Object.entries(a)) bar.toggleAttribute(k, v);
  await window.__settled();
}, attrs);

test('three sections: Fetch, Play, Pause, Stop | Undo, Redo, Save | the graph\'s shape, with a divider between each', async ({ page }) => {
  await mount(page);
  const order = await page.evaluate(() => [...document.querySelector('#bar')!.shadowRoot!.querySelectorAll('.tools > *')].map((n) => (n.classList.contains('divider') ? '|' : n.className.split(' ')[0])));
  expect(order).toEqual(['fetch', 'play', 'pause', 'stop', '|', 'undo', 'redo', 'save', '|', 'tie', 'group', 'arrange', 'unfurl', 'frame']);
  const dividers = await page.evaluate(() => [...document.querySelector('#bar')!.shadowRoot!.querySelectorAll('.divider')].map((d) => { const r = d.getBoundingClientRect(); return [r.width > 0, r.height > 0]; }));
  expect(dividers).toEqual([[true, true], [true, true]]);
});

test('Play starts; while it runs Play and Fetch wait and Pause and Stop work; paused, Play goes on and Pause is off', async ({ page }) => {
  await mount(page);
  await set(page, { 'data-can-play': true, 'data-can-fetch': true });
  expect(await off(page)).toEqual({ fetch: false, play: false, pause: true, stop: true });
  await set(page, { 'data-simulating': true });
  expect(await off(page)).toEqual({ fetch: true, play: true, pause: false, stop: false });
  await set(page, { 'data-paused': true });
  expect(await off(page)).toEqual({ fetch: true, play: false, pause: true, stop: false });
  await set(page, { 'data-simulating': false, 'data-paused': false });
  expect(await off(page)).toEqual({ fetch: false, play: false, pause: true, stop: true });
});

test('a press on Play, Pause and Stop says so, once each, only while the button is on', async ({ page }) => {
  await mount(page);
  await page.evaluate(() => { (window as unknown as { heard: string[] }).heard = []; document.querySelector('#bar')!.addEventListener('toolbar-select', (e) => (window as unknown as { heard: string[] }).heard.push((e as CustomEvent<{ action: string }>).detail.action)); });
  const press = async (name: string) => {
    const r = await page.evaluate((n) => { const b = document.querySelector('#bar')!.shadowRoot!.querySelector(`.${n}`)!.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2 }; }, name);
    await page.mouse.click(r.x, r.y);
    await page.evaluate(() => window.__settled());
  };
  await set(page, { 'data-can-play': true });
  await press('pause');
  await press('stop');
  await press('play');
  await set(page, { 'data-simulating': true });
  await press('pause');
  await set(page, { 'data-paused': true });
  await press('play');
  await press('stop');
  expect(await page.evaluate(() => (window as unknown as { heard: string[] }).heard)).toEqual(['play', 'pause', 'play', 'stop']);
});

test('the app header has an optional thin divider under it, in the Style\'s border, as the nav\'s and the tabs\' lines are', async ({ page }) => {
  const line = () => page.evaluate(async (on) => {
    const header = document.createElement('sherpa-app-header') as HTMLElement & { rendered?: Promise<void> };
    header.id = 'hd';
    if (on) header.setAttribute('data-divider', '');
    document.getElementById('root')!.replaceChildren(header);
    await header.rendered;
    await window.__settled();
    const cs = getComputedStyle(header);
    return { width: cs.borderBlockEndWidth, style: cs.borderBlockEndStyle, colour: cs.borderBlockEndColor };
  }, true);
  const bare = await page.evaluate(async () => {
    const header = document.createElement('sherpa-app-header') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.replaceChildren(header);
    await header.rendered;
    return getComputedStyle(header).borderBlockEndStyle;
  });
  expect(bare).toBe('none');
  expect(await line()).toMatchObject({ style: 'solid', colour: 'rgb(179, 179, 195)' });
});
