import { test, expect, type Bar } from './harness';

/**
 * THE GREEN AND THE BADGE READ ONE ANSWER.
 *
 * A chip decided its condition colour from its MENU's mode — condition mode, and
 * answered — while its fx badge came from the STATE: a named op or any rows.
 * So a chip answered by a typed condition in LIST mode wore the fx badge and
 * NOT the green: the same filter read as custom and as default at once. Both
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
    // The edge eases to its colour: read it once it is there.
    await Promise.all(c.shadowRoot!.querySelector('.body')!.getAnimations().map((a) => a.finished.catch(() => {})));
    return {
      on: c.hasAttribute('data-current'),
      green: c.getAttribute('data-condition') === 'advanced',
      edge: getComputedStyle(c.shadowRoot!.querySelector('.body')!).borderTopColor,
      // The badge is `data-count` — a number of picks, or the fx mark.
      badge: c.dataset['count'] ?? '',
    };
  }, def);
}

test('a TYPED condition in list mode is Advanced — and wears the active edge, as a Simple chip does', async ({ page }) => {
  const r = await chip(page, {
    id: 'owner', label: 'Owner', select: 'multiple', active: true, custom: true,
    op: 'contains', text: 'Da',
    options: [{ value: 'Dana', label: 'Dana' }, { value: 'Ravi', label: 'Ravi' }],
  });
  expect(r.green).toBe(true);
  // The ACTIVE edge, light mode — no colour of its own. Will, TODO 156.
  // TRAP T-a-conditioned-chip-reads-as-active
  expect(r.edge).toBe('rgb(192, 70, 255)');
  const simple = await chip(page, {
    id: 'plan', label: 'Plan', select: 'multiple', active: true,
    options: [{ value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }],
  });
  expect(simple.edge).toBe(r.edge);
  // The badge is RESULTS since TODO 60 — never a condition's mark.
  expect(r.badge).toBe('');
});

test('a ticked value is Simple: neither green nor fx', async ({ page }) => {
  const r = await chip(page, {
    id: 'plan', label: 'Plan', select: 'multiple', active: true,
    options: [{ value: 'Pro', label: 'Pro', selected: true }, { value: 'Free', label: 'Free' }],
  });
  expect(r.on).toBe(true);
  expect(r.green).toBe(false);
  expect(r.badge).not.toBe('fx');
});
