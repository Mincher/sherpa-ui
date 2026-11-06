import { test, expect } from './harness';

/**
 * THE FILTER PANEL (new) — sherpa-ui 847. Content of an overlay panel: its search, Suggest, Save group, ⋮ and count are
 * cloned into the panel's header slots and leave with it; the panel's own float and Pop come BEFORE the ⋮; it
 * opens and shuts its panel, and `panel-close` says why. Real header, real presses, boxes read.
 * TRAP T-a-content-adopts-its-panels-header
 */

const MOUNT = `
  const root = document.getElementById('root');
  root.innerHTML = '<sherpa-overlay-panel id="p" open data-heading="Filters" data-floatable data-minimisable data-dismissible style="block-size: 420px; inline-size: 520px;">'
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
      shown: ['.column-suggest', '.saved-group', '.column-more', '.find', '.applied-count'].map((s) => q(s) && q(s).getBoundingClientRect().width > 0),
      badge: q('.applied-count').getAttribute('aria-label'),
      floatBeforeMore: left(float) < left(q('.column-more')),
      moreIsLast: left(q('.column-more')) >= Math.max(...[...panel.shadowRoot.querySelectorAll('.modes sherpa-button')].map(left)),
    };
  })()`) as { slots: string[]; shown: boolean[]; badge: string; floatBeforeMore: boolean; moreIsLast: boolean };
  expect(r.slots).toEqual(['sherpa-filter-panel', 'sherpa-input-text[description]', 'sherpa-badge[badge]', 'sherpa-button[actions]', 'sherpa-group[actions]', 'sherpa-button[overflow]']);
  expect(r.shown).toEqual([true, true, true, true, true]);
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
  expect(r.before).toBe(6);
  expect(r.gone).toBe(0);
  expect(r.back).toBe(6);
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
