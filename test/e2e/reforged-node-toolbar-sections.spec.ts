import { test, expect } from './harness';
import type { Page } from '@playwright/test';

/**
 * The node editor's toolbar is four sections with a small divider between each: Fetch, Play, Pause and Stop;
 * Undo, Redo and Save; the graph's shape; the view (Collapse all, Hide unconnected). Play goes on from a pause; Pause and Stop can be pressed only while a
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

test('four button groups: Fetch, Play, Pause, Stop | Undo, Redo, Save | the graph\'s shape | the view, with a divider between each', async ({ page }) => {
  await mount(page);
  const order = await page.evaluate(() => [...document.querySelector('#bar')!.shadowRoot!.querySelectorAll('.tools > *')].flatMap((n) => (n.classList.contains('divider') ? ['|'] : n.localName === 'sherpa-group' ? [...n.children].map((c) => c.className.split(' ')[0]) : [n.className])));
  expect(order).toEqual(['fetch', 'play', 'pause', 'stop', '|', 'undo', 'redo', 'save', '|', 'tie', 'group', 'arrange', 'unfurl', 'frame', '|', 'collapse', 'hide']);
  const dividers = await page.evaluate(() => [...document.querySelector('#bar')!.shadowRoot!.querySelectorAll('.divider')].map((d) => { const r = d.getBoundingClientRect(); return [r.width > 0, r.height > 0]; }));
  expect(dividers).toEqual([[true, true], [true, true], [true, true]]);
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

test('no app header has a divider under it', async ({ page }) => {
  const line = await page.evaluate(async () => {
    const header = document.createElement('sherpa-app-header') as HTMLElement & { rendered?: Promise<void> };
    document.getElementById('root')!.replaceChildren(header);
    await header.rendered;
    await window.__settled();
    const cs = getComputedStyle(header);
    return { width: cs.borderBlockEndWidth, style: cs.borderBlockEndStyle, colour: cs.borderBlockEndColor };
  });
  expect(line).toMatchObject({ width: '0px', style: 'none' });
});

test('each section is its own sherpa-group, and the gap each side of a divider is wider than the buttons\'', async ({ page }) => {
  await mount(page);
  const read = await page.evaluate(() => {
    const sr = document.querySelector('#bar')!.shadowRoot!;
    const groups = [...sr.querySelectorAll('.tools > sherpa-group')];
    const div = sr.querySelector('.divider')!.getBoundingClientRect();
    const [a, b] = [groups[0]!.getBoundingClientRect(), groups[1]!.getBoundingClientRect()];
    return { groups: groups.length, before: Math.round(div.left - a.right), after: Math.round(b.left - div.right) };
  });
  expect(read.groups).toBe(4);
  expect(read.before).toBeGreaterThanOrEqual(8);
  expect(read.after).toBeGreaterThanOrEqual(8);
});
