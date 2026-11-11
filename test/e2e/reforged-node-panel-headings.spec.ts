import { test, expect, type Page } from './harness';

/**
 * The node panel is ONE list (Will, TODOs 786, 784): no accordions. Each category's heading sticks
 * at the top while its items scroll under it, and the next category's pushes it on. Two tabs, Preset Nodes and
 * Custom Nodes, each wear their match count while something is searched. A search hides each heading with nothing under it. A Custom Node is
 * listed under each of its tags, set in Save as Custom Node, and the search finds it by one. Real
 * pointer and keys; read back by boxes and by pixels. TRAP T-a-node-panel-lists-under-sticky-headings
 */

const LIBRARY = {
  v: 1,
  nodes: {
    'org-permissions': { v: 1, label: 'Org permissions', tags: ['permissions', 'users'], inputs: [], outputs: [], nodes: [] },
    'is-admin': { v: 1, label: 'Is admin', tags: ['permissions'], inputs: [], outputs: [], nodes: [] },
    'by-date': { v: 1, label: 'By date', inputs: [], outputs: [], nodes: [] },
    'shipped-check': { v: 1, label: 'Shipped check', tags: ['checks'], preset: true, inputs: [], outputs: [], nodes: [] },
  },
};

test.beforeEach(async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 800 });
  await page.evaluate(async (library) => {
    const root = document.getElementById('root')!;
    root.insertAdjacentHTML('beforeend', `
      <sherpa-layout-canvas id="cv" style="inline-size: 900px; block-size: 536px"><sherpa-node-toolbar slot="toolbar"></sherpa-node-toolbar><sherpa-overlay-panel data-side="start" open data-heading="Nodes" data-searchable data-search-placeholder="Search nodes" data-padding="none"><sherpa-node-list></sherpa-node-list></sherpa-overlay-panel></sherpa-layout-canvas>
      <sherpa-overlay-panel id="inspector"></sherpa-overlay-panel>
      <sherpa-dialog id="custom" data-heading="Save as Custom Node">
        <sherpa-stack data-gap="md">
          <sherpa-input-text name="label" data-label="Name" autocomplete="off" required></sherpa-input-text>
          <sherpa-input-text name="description" data-label="Description" data-multiline autocomplete="off"></sherpa-input-text>
          <sherpa-input-text name="tags" data-type="tags" data-label="Tags" autocomplete="off"></sherpa-input-text>
        </sherpa-stack>
        <sherpa-container-footer slot="footer">
          <sherpa-button data-action="cancel">Cancel</sherpa-button>
          <sherpa-button data-action="save" data-look="saturated">Save as Custom Node</sherpa-button>
        </sherpa-container-footer>
      </sherpa-dialog>`);
    await customElements.whenDefined('sherpa-node-list');
    await customElements.whenDefined('sherpa-node-toolbar');
    await (document.getElementById('cv') as HTMLElement & { rendered: Promise<void> }).rendered;
    const { bindWorkflow, SessionStore } = await import('/dist/app.js');
    const canvas = document.getElementById('cv')!;
    const flow = {
      v: 2, id: 'g',
      nodes: [
        { id: 'start', kind: 'source', x: 420, y: 40, values: { store: 'customers' } },
        { id: 'status', kind: 'field', x: 140, y: 260, values: { field: 'status' } },
        { id: 'active', kind: 'condition', x: 420, y: 260, values: { type: 'eq', b: 'active' } },
        { id: 'trial', kind: 'condition', x: 700, y: 260, values: { type: 'eq', b: 'trial' } },
      ],
      routes: [{ from: 'start/rows', to: 'status' }, { from: 'status/field', to: 'active' }, { from: 'status/field', to: 'trial' }],
    };
    (window as unknown as { ed: unknown }).ed = bindWorkflow(canvas as never, flow as never, {
      session: new SessionStore(), inspector: document.getElementById('inspector') as never, panel: canvas.querySelector('sherpa-node-list') as never,
      toolbar: canvas.querySelector('sherpa-node-toolbar') as never, customDialog: document.getElementById('custom') as never, library: structuredClone(library) as never,
      fieldsOf: { customers: { status: { label: 'Status', values: ['active', 'trial'] } } }, stores: ['customers'],
    });
    await window.__settled();
    await new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)));
  }, LIBRARY);
});

const settle = (page: Page) => page.evaluate(() => window.__settled().then(() => new Promise((done) => requestAnimationFrame(() => requestAnimationFrame(done)))));
type Box = { x: number; y: number; w: number; h: number };
/** A box in the panel's shadow root, by selector. */
const rect = (page: Page, sel: string): Promise<Box> => page.evaluate((s) => {
  const r = document.querySelector('sherpa-node-list')!.shadowRoot!.querySelector(s)!.getBoundingClientRect();
  return { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height) };
}, sel);
/** A category's block, by its heading's words. */
const category = (heading: string) => `.category:has(> .category-heading[data-heading="${heading}"])`;
/** The headings drawn now, a tag's marked with its category: what a reader sees. */
const shown = (page: Page) => page.evaluate(() => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll<HTMLElement>('.category-heading, .tag-heading')]
  .filter((h) => h.checkVisibility()).map((h) => (h.classList.contains('tag-heading') ? `› ${h.dataset['heading']}` : h.dataset['heading'])));
/** The items drawn now, by name, a Custom Node once per place it is listed. */
const names = (page: Page) => page.evaluate(() => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll<HTMLElement>('sherpa-list-item')]
  .filter((h) => h.checkVisibility()).map((h) => h.dataset['label']));
const scrollTop = (page: Page) => page.evaluate(() => document.querySelector('sherpa-node-list')!.shadowRoot!.querySelector('.categories')!.scrollTop);
/** The pixels in a row, from a point: what the screen draws there. */
async function pixels(page: Page, x: number, y: number, width: number): Promise<[number, number, number][]> {
  const shot = await page.screenshot({ clip: { x, y, width, height: 1 } });
  return page.evaluate(async (b64) => {
    const img = new Image();
    img.src = `data:image/png;base64,${b64}`;
    await img.decode();
    const c = Object.assign(document.createElement('canvas'), { width: img.width, height: img.height }).getContext('2d')!;
    c.drawImage(img, 0, 0);
    return Array.from({ length: img.width }, (_, i) => [...c.getImageData(i, 0, 1, 1).data].slice(0, 3) as [number, number, number]);
  }, shot.toString('base64'));
}
const dark = (p: [number, number, number]): boolean => Math.max(...p) < 160;

test('one list, no accordions: a heading sticks while its items scroll under it, and the next one pushes it on', async ({ page }) => {
  expect(await page.locator('sherpa-node-list sherpa-accordion').count()).toBe(0);
  expect(await shown(page)).toEqual(['Sources', 'Variables', 'Math', 'Logic', 'AI', 'Time', 'Organise', 'Utils', 'Output']);
  const list = await rect(page, '.categories');
  // The wheel, over the list, until Variables' first item passes under its heading. Each engine
  // scrolls its own distance for a notch, so it turns until it has.
  await page.mouse.move(list.x + list.w / 2, list.y + list.h / 2);
  const past = async (): Promise<boolean> => (await rect(page, category('Variables'))).y < list.y - 40;
  for (let i = 0; i < 60 && !await past(); i++) await page.mouse.wheel(0, 20);
  await settle(page);
  expect(await scrollTop(page)).toBeGreaterThan(0);
  const head = await rect(page, `${category('Variables')} > .category-heading`);
  const block = await rect(page, category('Variables'));
  // Stuck: the heading is at the top of the list, and its block is scrolled past it.
  expect(Math.abs(head.y - list.y)).toBeLessThanOrEqual(1);
  expect(block.y).toBeLessThan(list.y - 20);
  // What scrolled under it is covered: the first item's icon is behind the heading, and the
  // heading's own surface is drawn there, not the icon.
  const icon = await page.evaluate(() => {
    const item = document.querySelector('sherpa-node-list')!.shadowRoot!.querySelector('.category:has(> .category-heading[data-heading="Variables"]) sherpa-list-item')!;
    const r = item.getBoundingClientRect();
    return { x: Math.round(r.x), y: Math.round(r.y), h: Math.round(r.height) };
  });
  expect(icon.y).toBeLessThan(head.y + head.h);
  const hit = await page.evaluate(([x, y]) => document.querySelector('sherpa-node-list')!.shadowRoot!.elementFromPoint(x!, y!)?.className, [list.x + 24, head.y + head.h - 6]);
  expect(hit).toContain('category-heading');
  // Its words are ink on the left; past them, the surface, and nothing of the item under it.
  const row = await pixels(page, list.x + 8, Math.round(head.y + 10), 120);
  expect(row.some(dark), 'the heading\'s words are drawn').toBe(true);
  const under = await pixels(page, list.x + 8, Math.round(head.y + head.h - 6), Math.round(list.w - 16));
  expect(under.some(dark), `nothing shows through the heading: ${JSON.stringify(under.filter(dark).slice(0, 3))}`).toBe(false);

  // Further, the next category's heading pushes it on: the two never overlap.
  const near = async (): Promise<boolean> => (await rect(page, category('Math'))).y < list.y + 16;
  for (let i = 0; i < 60 && !await near(); i++) await page.mouse.wheel(0, 8);
  await settle(page);
  const [was, next] = [await rect(page, `${category('Variables')} > .category-heading`), await rect(page, `${category('Math')} > .category-heading`)];
  expect(was.y + was.h).toBeLessThanOrEqual(next.y + 1);
  expect(next.y).toBeGreaterThanOrEqual(list.y);
});

/** A tab, pressed as a reader does. */
const openTab = async (page: Page, id: string) => {
  await page.locator(`sherpa-node-list sherpa-tabs .tab[data-id="${id}"]`).click();
  await settle(page);
};
const badges = (page: Page) => page.locator('sherpa-node-list sherpa-tabs .badge').evaluateAll((els) => els.map((b) => ((b as HTMLElement).checkVisibility() ? b.textContent : '')));

test('two tabs: Preset Nodes lists the kinds a file gives, Custom Nodes the saved ones; there is no Jump to', async ({ page }) => {
  await expect(page.locator('sherpa-node-list .jump')).toHaveCount(0);
  expect(await page.locator('sherpa-node-list sherpa-tabs .tab .label').allTextContents()).toEqual(['Preset Nodes', 'Custom Nodes']);
  expect(await shown(page)).not.toContain('Custom Nodes');
  expect(await shown(page)).toContain('Math');
  await openTab(page, 'custom');
  expect(await shown(page)).toEqual(['Custom Nodes', '› checks', '› permissions', '› users']);
  await openTab(page, 'preset');
  expect(await shown(page)).toContain('Math');
});

test('a search narrows both tabs, a count shows on each tab, and a heading with nothing under it is hidden', async ({ page }) => {
  const find = page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])');
  expect(await badges(page)).toEqual(['', '']);
  await find.fill('round');
  expect(await shown(page)).toEqual(['Math']);
  expect(await badges(page)).toEqual(['1', '0']);
  // A Custom Node by a tag: the tab it is on says so, though the other tab is open.
  await find.fill('admin');
  expect(await badges(page)).toEqual(['0', '1']);
  await openTab(page, 'custom');
  expect(await shown(page)).toEqual(['Custom Nodes', '› permissions']);
  expect(await names(page)).toEqual(['Is admin']);
  await find.fill('users');
  expect(await shown(page)).toEqual(['Custom Nodes', '› permissions', '› users']);
  expect(await names(page)).toEqual(['Org permissions', 'Org permissions']);
  // A preset's tags are its own, read only, and find it as any tag does.
  await find.fill('checks');
  expect(await names(page)).toEqual(['Shipped check']);
  expect(await page.locator('sherpa-node-list sherpa-list-item[data-kind="shipped-check"]').getAttribute('data-description')).toMatch(/^Preset, read only/);
  await find.fill('zzz');
  expect(await shown(page)).toEqual([]);
  await expect(page.locator('sherpa-node-list .none')).toBeVisible();
  await find.fill('');
  expect(await badges(page)).toEqual(['', '']);
  await openTab(page, 'custom');
  // Untagged, a Custom Node is listed under its category's own heading, before the tags.
  const custom = await page.evaluate(() => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll('.category:has(> .category-heading[data-heading="Custom Nodes"]) :is(.category-heading, .tag-heading, sherpa-list-item)')]
    .map((e) => e.getAttribute('data-heading') ?? e.getAttribute('data-label')));
  expect(custom).toEqual(['Custom Nodes', 'By date', 'checks', 'Shipped check', 'permissions', 'Org permissions', 'Is admin', 'users', 'Org permissions']);
});

test('a tag set in Save as Custom Node, by the keys, lists the new node under it, and the search finds it by the tag', async ({ page }) => {
  const header = (heading: string) => page.locator(`#cv > sherpa-node[data-heading="${heading}"] >> .header[role="button"]`);
  // The pointer picks one, the keys add the other: its panel opens over the canvas's right side.
  await header('Condition').first().click();
  await header('Condition').nth(1).focus();
  await page.keyboard.press('Space');
  await settle(page);
  expect(await page.locator('#cv > sherpa-node[data-current]').count()).toBe(2);
  await page.locator('#cv sherpa-node-toolbar sherpa-button.group').evaluate((el) => (el.shadowRoot!.querySelector('button') as HTMLElement).click());
  await expect(page.locator('#custom')).toHaveAttribute('open', '');
  // The field offers the tags the app's Custom Nodes have already.
  expect(await page.locator('#custom sherpa-input-text[name="tags"]').evaluate((el) => (el as HTMLElement & { suggestions: { value: string }[] }).suggestions.map((s) => s.value)))
    .toEqual(['checks', 'permissions', 'users']);
  await page.locator('#custom sherpa-input-text[name="label"] input').fill('Active trials');
  const tags = page.locator('#custom sherpa-input-text[name="tags"] input.control:visible');
  await tags.click();
  await page.keyboard.type('billing');
  await page.keyboard.press('Enter');
  // A word that names a tag already there becomes that tag.
  await page.keyboard.type('Permissions,');
  await settle(page);
  expect(await page.locator('#custom sherpa-input-text[name="tags"]').evaluate((el) => (el as HTMLElement & { tags: string[] }).tags)).toEqual(['billing', 'permissions']);
  const save = (await page.locator('#custom sherpa-button[data-action="save"]').boundingBox())!;
  await page.mouse.click(save.x + save.width / 2, save.y + save.height / 2);
  await settle(page);
  await expect(page.locator('#custom')).not.toHaveAttribute('open', '');
  const made = await page.evaluate(() => (window as unknown as { ed: { library(): { nodes: Record<string, { tags?: string[] }> } } }).ed.library().nodes['active-trials']);
  expect(made?.tags).toEqual(['billing', 'permissions']);
  // Under each of its tags, beside the nodes already there.
  await openTab(page, 'custom');
  expect(await shown(page)).toContain('› billing');
  const under = (tag: string) => page.evaluate((t) => [...document.querySelector('sherpa-node-list')!.shadowRoot!.querySelectorAll(`.tag:has(> .tag-heading[data-heading="${t}"]) sherpa-list-item`)].map((i) => i.getAttribute('data-label')), tag);
  expect(await under('billing')).toEqual(['Active trials']);
  expect(await under('permissions')).toEqual(['Org permissions', 'Is admin', 'Active trials']);
  // Found by a tag, it is listed under each of its own.
  await page.locator('sherpa-overlay-panel .header > .search input:not([aria-label*="menu"])').fill('bill');
  expect(await names(page)).toEqual(['Active trials', 'Active trials']);
});
