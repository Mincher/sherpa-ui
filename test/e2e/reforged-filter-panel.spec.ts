import { test, expect } from './harness';

/**
 * THE FILTER PANEL (new) — sherpa-ui 847. Content of an overlay panel: its search, Suggest, Save group, ⋮ and count are
 * cloned into the panel's header slots and leave with it; the panel's own float and Pop come BEFORE the ⋮; it
 * opens and shuts its panel, and `panel-close` says why. Real header, real presses, boxes read.
 * TRAP T-a-content-adopts-its-panels-header
 */

const MOUNT = `
  const root = document.getElementById('root');
  root.innerHTML = '<sherpa-overlay-panel id="p" open data-heading="Filters" data-searchable data-search-placeholder="Search filters" data-floatable data-minimisable data-dismissible style="block-size: 420px; inline-size: 520px;">'
    + '<sherpa-filter-panel id="fp" data-scope="view data" data-suggest data-saveable data-count-applied data-applied="3"></sherpa-filter-panel></sherpa-overlay-panel>';
  const panel = document.getElementById('p');
  const content = document.getElementById('fp');
  await window.__settled();
`;

test('its controls are cloned into the panel header, and the panel\'s own buttons come before the ⋮', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    const left = (el) => el.getBoundingClientRect().left;
    const q = (sel) => panel.querySelector(':scope > ' + sel);
    const float = panel.shadowRoot.querySelector('.float');
    return {
      slots: [...panel.children].map((c) => c.localName + (c.slot ? '[' + c.slot + ']' : '')),
      shown: ['.column-suggest', '.saved-group', '.column-more', '.applied-count'].map((s) => q(s) && q(s).getBoundingClientRect().width > 0),
      badge: q('.applied-count').getAttribute('aria-label'),
      floatBeforeMore: left(float) < left(q('.column-more')),
      moreIsLast: left(q('.column-more')) >= Math.max(...[...panel.shadowRoot.querySelectorAll('.modes sherpa-button')].map(left)),
    };
  })()`) as { slots: string[]; shown: boolean[]; badge: string; floatBeforeMore: boolean; moreIsLast: boolean };
  expect(r.slots).toEqual(['sherpa-filter-panel', 'sherpa-badge[badge]', 'sherpa-button[actions]', 'sherpa-group[actions]', 'sherpa-button[overflow]']);
  expect(r.shown).toEqual([true, true, true, true]);
  expect(r.badge).toBe('3 filters applied');
  expect(r.floatBeforeMore).toBe(true);
  expect(r.moreIsLast).toBe(true);
});

test('its controls leave with it, and come back when it is moved', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    const n = () => panel.children.length;
    const before = n();
    const other = document.createElement('div');
    root.append(other);
    content.remove();
    const gone = n();
    panel.append(content);
    await window.__settled();
    return { before, gone, back: n() };
  })()`) as { before: number; gone: number; back: number };
  expect(r.before).toBe(5);
  expect(r.gone).toBe(0);
  expect(r.back).toBe(5);
});

test('its show, hide and open are its panel\'s, and a close says why', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    const heard = [];
    panel.addEventListener('panel-close', (e) => heard.push(e.detail.reason));
    const states = [content.open];
    content.hide('width');
    await window.__settled();
    states.push(content.open, panel.hasAttribute('open'));
    content.show();
    await window.__settled();
    states.push(content.open);
    content.hide();
    await window.__settled();
    return { states, heard };
  })()`) as { states: boolean[]; heard: string[] };
  expect(r.states).toEqual([true, false, false, true]);
  expect(r.heard).toEqual(['width', 'reader']);
});

test('the Save group, Suggest and the count follow what the page says', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    const q = (s) => panel.querySelector(':scope > ' + s);
    const read = () => ({ suggest: !q('.column-suggest').hidden, group: !q('.saved-group').hidden, save: !panel.querySelector('.column-save-as').hidden,
      count: !q('.applied-count').hidden });
    const all = read();
    content.removeAttribute('data-saveable');
    content.removeAttribute('data-suggest');
    content.setAttribute('data-applied', '0');
    await window.__settled();
    return { all, none: read() };
  })()`) as { all: Record<string, boolean>; none: Record<string, boolean> };
  expect(r.all).toEqual({ suggest: true, group: true, save: true, count: true });
  expect(r.none).toEqual({ suggest: false, group: false, save: false, count: false });
});

test('the panel\'s own search row fills the header, says panel-search, and the content finds by it', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    const input = panel.shadowRoot.querySelector('.search');
    const header = panel.shadowRoot.querySelector('.header').getBoundingClientRect();
    const box = input.getBoundingClientRect();
    const heard = [];
    panel.addEventListener('panel-search', (e) => heard.push(e.detail.value));
    panel.search = 'em';
    panel.search = '';
    return { fills: Math.abs((header.width) - box.width) < 40 && box.width > 300, ph: input.getAttribute('placeholder'), heard, inContent: !!content.querySelector('.find') };
  })()`) as { fills: boolean; ph: string; heard: string[]; inContent: boolean };
  expect(r.fills).toBe(true);
  expect(r.ph).toBe('Search filters');
  expect(r.heard).toEqual(['em', '']);
  expect(r.inContent).toBe(false);
});

/* A divider only BETWEEN two groups that show a control: never leading, never trailing. TRAP T-a-panel-divides-only-between-shown-groups */
const dividers = `(panel) => [...panel.shadowRoot.querySelectorAll('.divider')].filter((d) => getComputedStyle(d).display !== 'none').map((d) => [...d.classList].find((c) => c !== 'divider'))`;

test('a panel draws a divider only between groups that show a control', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    const read = ${dividers};
    ${MOUNT}
    const all = read(panel);
    // Nothing on offer from the content: the Save group, Suggest and the count hidden, the ⋮ still there.
    content.removeAttribute('data-saveable');
    content.removeAttribute('data-suggest');
    await window.__settled();
    const noActions = read(panel);
    // A panel with no actions at all, only its own buttons.
    root.innerHTML = '<sherpa-overlay-panel id="q" open data-heading="Plain" data-floatable data-minimisable data-dismissible></sherpa-overlay-panel>';
    await window.__settled();
    const plain = read(document.getElementById('q'));
    return { all, noActions, plain };
  })()`) as { all: string[]; noActions: string[]; plain: string[] };
  // The content's actions first, then dock, then the modes, then the ⋮, then close: a divider after each shown group but the last.
  expect(r.all).toEqual(['after-custom', 'after-docks', 'after-modes', 'after-overflow']);
  // No group before the modes: no leading divider; the ⋮ and the close still divide.
  expect(r.noActions).toEqual(['after-docks', 'after-modes', 'after-overflow']);
  // Only the panel's own buttons and the close: one divider, between them.
  expect(r.plain).toEqual(['after-docks', 'after-modes']);
});

/* Limit to matching and Hide invalid are the PAGE's: the View bar's ⋮ holds them and its value sets every scope, so the panel's ⋮ has neither. Will, TODO 870 */
test('the panel\'s ⋮ holds no Limit or Hide invalid row', async ({ page }) => {
  const r = await page.evaluate(`(async () => {
    ${MOUNT}
    content.setAttribute('data-limit-options', 'on');
    content.setAttribute('data-hide-unmatched', 'on');
    await window.__settled();
    await window.__moreRow(content, 'reset');
    return [...content.shadowRoot.querySelectorAll('.more-menu [value], .more-menu input')].map((n) => n.value);
  })()`) as string[];
  expect(r).toContain('reset');
  expect(r).not.toContain('limit-options');
  expect(r).not.toContain('hide-unmatched');
});
