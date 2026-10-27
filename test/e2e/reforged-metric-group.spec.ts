import { test, expect, type Page } from './fixture';

/**
 * sherpa-metric-group (TODO 402): one row of metrics across the layout grid.
 * Apart, each metric is solo; at the grid's mobile width, and while a sticky
 * group is stuck, they join as one object. Stuck is a view timeline, so
 * Chromium and WebKit; Firefox sticks with a plain row.
 * TRAP T-a-metric-group-knows-it-is-stuck
 */
const HARNESS = '/test/reforged/harness.html';

const GROUP = (id: string, n: number): string => `<sherpa-metric-group id="${id}" data-sticky>${
  Array.from({ length: n }, (_, i) => `<sherpa-metric data-label="M${i + 1}" data-value="${i + 1}"></sherpa-metric>`).join('')
}</sherpa-metric-group>`;

/** A scroll box: a grid of a group, cards, a second group, then more cards. */
async function open(page: Page, width = 1280): Promise<void> {
  await page.setViewportSize({ width, height: 720 });
  await page.goto(HARNESS);
  await page.waitForFunction(() => window.__reforgedReady === true);
  await page.evaluate(async ([a, b]) => {
    const cards = (n: number): string => '<div data-col-span="small" style="block-size:88px;background:#ddd"></div>'.repeat(n);
    document.getElementById('root')!.innerHTML = `<div id="box" style="block-size:400px;overflow:auto">
      <sherpa-layout-grid>${a}${cards(12)}${b}${cards(40)}</sherpa-layout-grid></div>`;
    await customElements.whenDefined('sherpa-metric-group');
    await window.__settled();
  }, [GROUP('one', 3), GROUP('two', 2)]);
}

/** Scroll the box, then read a group: where it sits, its gap, its metrics' corners and edges. */
const look = (page: Page, id: string, y?: number) => page.evaluate(async ([id, y]) => {
  const box = document.getElementById('box')!;
  if (y != null) box.scrollTop = y as number;
  await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  const group = document.getElementById(id as string)!;
  const kids = [...group.children] as HTMLElement[];
  const cs = kids.map((k) => getComputedStyle(k));
  const after = getComputedStyle(group, '::after');
  const value = getComputedStyle(kids[0]!.shadowRoot!.querySelector('.value')!);
  return {
    top: Math.round(group.getBoundingClientRect().top - box.getBoundingClientRect().top),
    // What it draws, and what it holds in the page.
    drawn: Math.round(group.shadowRoot!.querySelector('slot')!.getBoundingClientRect().height),
    held: Math.round(group.getBoundingClientRect().height),
    value: value.fontSize,
    trend: getComputedStyle(kids[0]!.shadowRoot!.querySelector('.trend')!).display,
    gap: Math.round(kids[1]!.getBoundingClientRect().left - kids[0]!.getBoundingClientRect().right),
    corners: cs.map((c) => [c.borderStartStartRadius, c.borderStartEndRadius].join(' ')),
    // The edge as set: a drawn width under 1px reads as 1px.
    inner: cs[0]!.getPropertyValue('--sherpa-border-right').trim(),
    shadow: after.content === 'none' || after.blockSize === '0px' ? 0 : Number(after.opacity),
    foot: [cs[0]!.borderEndStartRadius, cs.at(-1)!.borderEndEndRadius].join(' '),
  };
}, [id, y ?? null] as const);

const SOLO = ['4px 4px', '4px 4px', '4px 4px'];
const JOINED = ['4px 0px', '0px 0px', '0px 4px'];

test('apart, each metric is solo, 16px from the next, across every column', async ({ page }) => {
  await open(page);
  const r = await look(page, 'one', 0);
  expect(r).toMatchObject({ top: 16, gap: 16, corners: SOLO, inner: '0.5px' });
  const across = await page.evaluate(() => {
    const grid = document.querySelector('sherpa-layout-grid')!.getBoundingClientRect();
    const g = document.getElementById('one')!.getBoundingClientRect();
    return Math.round(grid.width - g.width);
  });
  expect(across, 'the grid\'s side padding, 8px each side').toBe(16);
});

test('at the grid\'s mobile width the metrics join as one object', async ({ page }) => {
  await open(page, 400);
  expect(await look(page, 'one', 0)).toMatchObject({ gap: 0, corners: JOINED, inner: '0.25px' });
});

test('a sticky group joins the moment it sticks, and parts on the way back', async ({ page, browserName }) => {
  await open(page);
  expect(await look(page, 'one', 15)).toMatchObject({ top: 1, gap: 16, corners: SOLO, shadow: 0 });
  // Down the grid it is still at the top (the second group not yet stuck).
  const far = await look(page, 'one', 300);
  expect(far.top).toBe(0);
  if (browserName === 'firefox') {
    expect(far, 'no view timeline: a plain row').toMatchObject({ gap: 16, corners: SOLO });
    return;
  }
  expect(far).toMatchObject({ gap: 0, corners: JOINED, inner: '0.25px', shadow: 1 });
  expect(await look(page, 'one', 0)).toMatchObject({ top: 16, gap: 16, corners: SOLO, shadow: 0 });
});

test('two stuck groups are each half a row, the second under the first; the page never moves', async ({ page, browserName }) => {
  await open(page);
  const row = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('sherpa-layout-grid')!)
    .getPropertyValue('--sherpa-layout-grid-row-height')));
  const card = () => page.evaluate(() => {
    const last = document.querySelector('sherpa-layout-grid')!.lastElementChild!;
    return Math.round(last.getBoundingClientRect().top - document.getElementById('box')!.getBoundingClientRect().top
      + document.getElementById('box')!.scrollTop);
  });
  const before = await card();
  // One stuck: a full row, its value full size.
  const alone = await look(page, 'one', 200);
  const two = await look(page, 'two', 2000);
  const one = await look(page, 'one');
  expect(await card(), 'the page never moves').toBe(before);
  expect(alone).toMatchObject({ top: 0, drawn: row, held: row, trend: 'flex' });
  expect(alone.value).not.toBe('14px');
  if (browserName === 'firefox') {
    expect(two, 'no view timeline: full rows').toMatchObject({ top: row, drawn: row, gap: 16 });
    expect(one).toMatchObject({ top: 0, drawn: row });
    return;
  }
  expect(two).toMatchObject({ top: row / 2, drawn: row / 2, held: row, gap: 0, value: '14px', trend: 'none' });
  expect(one).toMatchObject({ top: 0, drawn: row / 2, held: row, gap: 0, value: '14px', trend: 'none' });
  // ONE object: a square joint, and one shadow, at the foot.
  expect(one).toMatchObject({ foot: '0px 0px', shadow: 0 });
  expect(two).toMatchObject({ corners: ['0px 0px', '0px 0px'], foot: '4px 4px', shadow: 1 });
  // Back up past the second's line, the first is a full row again.
  expect(await look(page, 'one', 200)).toMatchObject({ drawn: row, trend: 'flex' });
});

test('a sticky group alone never halves', async ({ page }) => {
  await open(page);
  await page.evaluate(() => document.getElementById('two')!.removeAttribute('data-sticky'));
  const row = await page.evaluate(() => parseFloat(getComputedStyle(document.querySelector('sherpa-layout-grid')!)
    .getPropertyValue('--sherpa-layout-grid-row-height')));
  expect(await look(page, 'one', 2000)).toMatchObject({ top: 0, drawn: row });
});
