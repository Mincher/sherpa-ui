import { test, expect, type Page } from './harness';

/**
 * A node's P4 rows (plan 749): Is one of takes TAGS, typed by real keys; where its Field's values are known
 * the tags are CLOSED, and a stranger is refused and said; a Value › List connected in OVERRIDES them, read
 * only, and cut gives its own back (D7). A Start is a date and time that reads in words, picked from a
 * calendar or typed; a row's own fault is drawn in it, red, in words, and a focus and a blur leave it.
 * TRAP T-a-row-says-its-own-fault · TRAP T-a-host-error-is-the-hosts
 */
type Canvas = HTMLElement & { rendered: Promise<void> };
type Rgb = [number, number, number];

test.beforeEach(async ({ page }) => {
  // Wide enough that the inspector opens beside the canvas, not over a node.
  await page.setViewportSize({ width: 1600, height: 900 });
  await page.evaluate(async () => {
    const el = document.createElement('sherpa-layout-canvas') as Canvas;
    el.style.cssText = 'inline-size: 1100px; block-size: 700px';
    document.getElementById('root')!.appendChild(el);
    const panel = document.createElement('sherpa-overlay-panel');
    panel.id = 'inspector';
    document.getElementById('root')!.appendChild(panel);
    await el.rendered;
  });
});

const BIND = `async (connections, plan = [], status = ['active'], start = '2024-01-12T09:30', places = 2) => {
  const { bindWorkflow, SessionStore } = await import('/dist/app.js');
  const canvas = document.querySelector('#root sherpa-layout-canvas');
  const flow = { v: 3, byHand: true, id: 'g', nodes: [
    { id: 'l', kind: 'value', x: 0, y: 0, heading: 'Plans', values: { type: 'list', value: ['Team', 'Free'] } },
    { id: 'p', kind: 'condition', x: 330, y: 0, heading: 'By plan', values: { type: 'in', ...(plan.length ? { b: plan } : {}) } },
    { id: 's', kind: 'condition', x: 660, y: 0, heading: 'By status', values: { type: 'in', b: status } },
    // Below the Conditions, which their Operation row makes taller; each Condition tests a Field (plan 783).
    { id: 't', kind: 'time', x: 0, y: 440, heading: 'When', values: { type: 'between', start } },
    { id: 'm', kind: 'math', x: 330, y: 440, heading: 'Round', values: { type: 'round', places } },
    { id: 'fp', kind: 'field', x: 660, y: 440, heading: 'Plan', values: { field: 'plan' } },
    { id: 'fs', kind: 'field', x: 880, y: 440, heading: 'Status', values: { field: 'status' } },
  ], connections: [{ from: 'fp/field', to: 'p' }, { from: 'fs/field', to: 's' }, ...connections] };
  window.editor = bindWorkflow(canvas, flow, {
    session: new SessionStore(), inspector: document.getElementById('inspector'),
    fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial'] }, plan: { label: 'Plan' } } }, rowsFrom: 'customers',
  });
  window.saved = [];
  document.addEventListener('definition-save', (e) => window.saved.push(e.detail.definition));
  await window.__settled();
  await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
}`;
/** Connections, then Is one of's own values on Plan and on Status, the Start, and Places. */
const bind = (page: Page, connections: unknown[] = [], ...rest: unknown[]) => page.evaluate(`(${BIND})(...${JSON.stringify([connections, ...rest])})`);
const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
const values = (page: Page) => page.evaluate(`Object.fromEntries(window.editor.workflow().nodes.map((n) => [n.id, n.values ?? null]))`) as Promise<Record<string, Record<string, unknown>>>;
const field = (heading: string, name: string) => `#root sherpa-node[data-heading="${heading}"] sherpa-input-text[name="${name}"]`;
const shown = (page: Page, heading: string, name: string) => page.evaluate((sel) => {
  const el = document.querySelector<HTMLElement & { tags: string[]; value: string }>(sel)!;
  const typed = el.shadowRoot!.querySelector<HTMLInputElement>('.control')!;
  return { tags: el.dataset['type'] === 'tags' ? el.tags : undefined, value: el.value, typed: typed.value, error: el.getAttribute('data-error'), readonly: el.hasAttribute('readonly') };
}, field(heading, name));
test('Is one of takes tags by real keys: Enter and a comma each make one, and the draft holds the list', async ({ page }) => {
  await bind(page);
  await page.locator(`${field('By plan', 'b')} .control-row > .control`).first().click();
  await page.keyboard.type('Pro');
  await page.keyboard.press('Enter');
  await page.keyboard.type('Enterprise,');
  await settle(page);
  expect((await shown(page, 'By plan', 'b')).tags).toEqual(['Pro', 'Enterprise']);
  expect((await values(page))['p']).toEqual({ type: 'in', b: ['Pro', 'Enterprise'] });
  // Backspace on the empty text takes the last away: one edit, the draft follows.
  await page.keyboard.press('Backspace');
  await settle(page);
  expect((await values(page))['p']!['b']).toEqual(['Pro']);
  // The Values row's socket takes an object (D17).
  expect(await page.locator('#root sherpa-node[data-heading="By plan"] sherpa-node-row:has([name="b"])').getAttribute('data-input-socket')).toBe('object');
});

test('a list of known values is ONE dropdown of ticks: its menu ticks the field\'s values; a tick adds, an untick removes (TRAP T-a-multi-select-is-one-row)', async ({ page }) => {
  await bind(page);
  // The single pick's own input, with `multiple`: its face says the picks, no tags and no typing.
  const seen = await page.evaluate((sel) => {
    const el = document.querySelector(sel) as HTMLElement & { values: string[] };
    return { type: el.getAttribute('data-type'), multiple: el.hasAttribute('multiple'), values: el.values, says: el.shadowRoot!.querySelector('select')!.selectedOptions[0]?.textContent };
  }, field('By status', 'b'));
  expect(seen).toEqual({ type: 'select', multiple: true, values: ['active'], says: 'active' });
  // Its menu lists the field's values, ticked as held; a tick adds one.
  await page.locator(field('By status', 'b')).locator('select.control').first().click();
  const menu = page.locator(`${field('By status', 'b')} .picks-menu`).first();
  await expect(menu).toHaveAttribute('open', '');
  const rows = () => page.evaluate((sel) => [...document.querySelector(sel)!.shadowRoot!.querySelectorAll<HTMLInputElement>('.picks-menu .menu-row:not(.qf-all) input[type="checkbox"]')].map((i) => [i.value, i.checked]), field('By status', 'b'));
  expect(await rows()).toEqual([['active', true], ['trial', false]]);
  // Select all leads it, as a filter chip's does (Will, 2026-11-14): some ticked, it is mixed.
  expect(await menu.locator('.menu-row').first().evaluate((r) => [r.classList.contains('qf-all'), (r.querySelector('input') as HTMLInputElement).indeterminate])).toEqual([true, true]);
  await menu.locator('input[value="trial"]').click();
  await settle(page);
  expect((await values(page))['s']!['b']).toEqual(['active', 'trial']);
  // An untick removes one.
  await menu.locator('input[value="active"]').click();
  await page.keyboard.press('Escape');
  await settle(page);
  expect((await values(page))['s']!['b']).toEqual(['trial']);
});

test('a Value › List connected to Is one of OVERRIDES its tags (D7): read only, its own kept; cut, they are back', async ({ page }) => {
  await bind(page, [{ from: 'l/value', to: 'p/b' }], ['Pro']);
  expect(await shown(page, 'By plan', 'b')).toMatchObject({ tags: ['Team', 'Free'], readonly: true });
  expect(await page.locator(field('By plan', 'b')).getAttribute('data-description')).toBe('Custom values, from Value: Plans › Value');
  // Read only: no tag can be taken off, and the draft keeps the row's own.
  expect(await page.evaluate((sel) => [...document.querySelector(sel)!.shadowRoot!.querySelectorAll('.tags > .tag')].map((c) => c.hasAttribute('data-dismissible')), field('By plan', 'b'))).toEqual([false, false]);
  expect((await values(page))['p']!['b']).toEqual(['Pro']);
  // The connector picked and deleted: its own tags are back, and editable.
  const [mx, my] = await page.evaluate(() => {
    const hit = document.querySelector<SVGPolylineElement>('#root svg.graph-connectors polyline[data-to="p/b"]')!;
    const p = hit.points.getItem(Math.floor(hit.points.numberOfItems / 2));
    const m = hit.getScreenCTM()!;
    return [m.a * p.x + m.e, m.d * p.y + m.f];
  });
  await page.mouse.click(mx!, my!);
  await page.keyboard.press('Delete');
  await settle(page);
  expect(await shown(page, 'By plan', 'b')).toMatchObject({ tags: ['Pro'], readonly: false });
});

/** The colour most of a box is painted, as a reader sees it. */
async function paint(page: Page, where: ReturnType<Page['locator']>): Promise<Rgb> {
  const box = (await where.boundingBox())!;
  const shot = await page.screenshot({ clip: box });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    const data = c.getImageData(0, 0, img.width, img.height).data;
    const count = new Map<string, number>();
    for (let i = 0; i < data.length; i += 4) { const k = `${data[i]},${data[i + 1]},${data[i + 2]}`; count.set(k, (count.get(k) ?? 0) + 1); }
    return [...count].sort((a, b) => b[1] - a[1])[0]![0].split(',').map(Number) as Rgb;
  }, shot.toString('base64'));
}

test('a row\'s own fault is drawn in it, red, in words — a stranger held, a day the calendar has not, a part of a place — and a blur leaves it', async ({ page }) => {
  await bind(page, [], [], ['active', 'gold'], '2024-02-30', 2.5);
  expect((await shown(page, 'By status', 'b')).error).toBe('"gold" is not a value of Status');
  expect((await shown(page, 'When', 'start')).error).toBe('"2024-02-30" is not a date: pick one, or write it as 31 Jan 2024');
  expect((await shown(page, 'Round', 'places')).error).toBe('2.5 is not a whole number');
  const message = page.locator(`${field('By status', 'b')} .message`).first();
  await expect(message).toBeVisible();
  const [r, g, b] = await paint(page, message);
  expect(r, `a red bar, ${[r, g, b]}`).toBeGreaterThan(150);
  expect(g).toBeLessThan(90);
  expect(b).toBeLessThan(90);
  // The host's words are the host's: a focus and a blur, with nothing changed, leave them.
  await page.locator(`${field('Round', 'places')} .control-row > .control`).first().click();
  await page.keyboard.press('Tab');
  await settle(page);
  expect((await shown(page, 'Round', 'places')).error).toBe('2.5 is not a whole number');
  // Mended, it goes.
  await page.locator(`${field('Round', 'places')} .control-row > .control`).first().fill('3');
  await page.keyboard.press('Enter');
  await settle(page);
  expect((await shown(page, 'Round', 'places')).error).toBeNull();
  expect((await values(page))['m']).toEqual({ type: 'round', places: 3 });
});

test('a Start reads in words; one typed in words or ISO is kept as ISO; a calendar pick sets it', async ({ page }) => {
  await bind(page);
  expect((await shown(page, 'When', 'start')).value).toBe('12 Jan 2024, 09:30');
  const control = page.locator(`${field('When', 'start')} .control-row > .control`).first();
  await control.fill('3 Feb 2024');
  await control.press('Enter');
  await settle(page);
  expect((await values(page))['t']!['start']).toBe('2024-02-03');
  expect((await shown(page, 'When', 'start')).value).toBe('03 Feb 2024');
  await control.fill('2024-03-04 08:15');
  await control.press('Enter');
  await settle(page);
  expect((await values(page))['t']!['start']).toBe('2024-03-04T08:15');
  // A typed day the calendar has not stays as typed, and says why.
  await control.fill('31 Feb 2024');
  await control.press('Enter');
  await settle(page);
  expect((await values(page))['t']!['start']).toBe('31 Feb 2024');
  expect((await shown(page, 'When', 'start')).error).toBe('"31 Feb 2024" is not a date: pick one, or write it as 31 Jan 2024');
  // The calendar: its button opens it; a day is the field's change, in ISO.
  await control.fill('2024-03-04');
  await control.press('Enter');
  await settle(page);
  await page.locator(`${field('When', 'start')} sherpa-button[aria-label="Pick a date and time"]`).click();
  const day = page.locator(`${field('When', 'start')} sherpa-calendar .cal-cell[data-iso="2024-03-20"]`);
  await expect(day).toBeVisible();
  await day.click();
  await settle(page);
  expect((await values(page))['t']!['start']).toBe('2024-03-20');
  expect((await shown(page, 'When', 'start')).value).toBe('20 Mar 2024');
});
