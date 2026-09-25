import { test, expect, type Bar } from './harness';

/**
 * THE BLUE AND THE BADGE READ ONE ANSWER.
 *
 * A chip decided its info-blue from its MENU's mode — condition mode, and
 * answered — while its fx badge came from the STATE: a named op or any rows.
 * So a chip answered by a typed condition in LIST mode wore the fx badge and
 * NOT the blue: the same filter read as custom and as default at once. Both
 * read `state.condition` now.
 * TRAP T-one-condition-system
 */
async function chip(page: import('@playwright/test').Page, def: Record<string, unknown>) {
  return page.evaluate(async (d) => {
    const bar = await window.__mount<Bar>('sherpa-quick-filter-toolbar', [d],
      { style: 'inline-size: 1200px' });
    await window.__settled();
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const c = bar.shadowRoot!.querySelector<HTMLElement>('.chips > .chip')!;
    return {
      on: c.hasAttribute('data-current'),
      blue: c.getAttribute('data-condition') === 'custom',
      // The badge is `data-count` — a number of picks, or the fx mark.
      badge: c.dataset['count'] ?? '',
    };
  }, def);
}

test('a TYPED condition in list mode is custom: blue AND fx', async ({ page }) => {
  const r = await chip(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true, conditions: true,
    op: 'contains', text: 'Da',
    options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
  });
  expect(r.blue).toBe(true);
  expect(r.badge).toBe('fx');
});

test('a ticked value is default: neither blue nor fx', async ({ page }) => {
  const r = await chip(page, {
    id: 'plan', label: 'Plan', select: 'multiple', active: true,
    options: [{ value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }],
  });
  expect(r.on).toBe(true);
  expect(r.blue).toBe(false);
  expect(r.badge).not.toBe('fx');
});
