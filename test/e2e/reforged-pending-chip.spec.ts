import { test, expect, type Bar } from './harness';

/**
 * A PENDING CHIP: changed, not yet applied — the active edge and NO fill.
 * Will, 2026-09-26 (TODO 46). Only a change that waits can be pending, and
 * only a remote one waits: its own open menu's draft, or a field its source
 * lists in `data-pending`. Locally a tick goes straight to active.
 * TRAP T-a-pending-chip-has-no-fill
 */
test('a remote chip is pending while its menu holds a draft; Apply makes it active', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar', undefined, { 'data-remote': '' });
    el.populate([
      { id: 'plan', label: 'Plan', select: 'multiple',
        options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] },
      { id: 'tier', label: 'Tier', select: 'multiple', active: true,
        options: [{ value: 'Gold', label: 'Gold', selected: true }] },
    ]);
    await window.__settled();
    const chip = (id: string) => el.shadowRoot!.querySelector<HTMLElement>(`.chip[data-id="${id}"]`)!;
    // After the chip's colour TRANSITION, or the read is half-way between two looks.
    const settle = () => new Promise((res) => setTimeout(res, 300));
    const look = async (id: string) => {
      await settle();
      const body = chip(id).shadowRoot!.querySelector('.body')!;
      const cs = getComputedStyle(body);
      return { pending: chip(id).hasAttribute('data-pending'), bg: cs.backgroundColor, edge: cs.borderTopColor };
    };
    const off = await look('plan');
    const on = await look('tier');
    const menu = chip('plan').querySelector('sherpa-menu') as HTMLElement & { show(): void; shadowRoot: ShadowRoot };
    menu.show();
    await window.__settled();
    chip('plan').querySelector<HTMLInputElement>('input[value="Pro"]')!.click();
    await window.__settled();
    const drafted = await look('plan');
    menu.shadowRoot.querySelector<HTMLElement>('.apply')!.click();
    await window.__settled();
    const applied = { ...(await look('plan')), current: chip('plan').hasAttribute('data-current') };
    // The SOURCE says a field waits — a panel edit on a remote source.
    el.setAttribute('data-pending', 'tier');
    await window.__settled();
    const told = await look('tier');
    return { off, on, drafted, applied, told };
  });

  expect(r.off.pending).toBe(false);
  // Drafted: the ACTIVE edge, and the OFF chip's fill — no on-tint.
  expect(r.drafted).toEqual({ pending: true, bg: r.off.bg, edge: r.drafted.edge });
  expect(r.drafted.edge).not.toBe(r.off.edge);
  expect(r.applied.pending).toBe(false);
  expect(r.applied.current).toBe(true);
  expect(r.applied.bg).toBe(r.on.bg);
  // An ON chip told it is pending loses its fill too.
  expect(r.told).toEqual({ pending: true, bg: r.off.bg, edge: r.drafted.edge });
});

test('locally a chip is never pending — a tick is applied at once', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = await window.__mount<Bar>('sherpa-quick-filter-toolbar');
    el.populate([{ id: 'plan', label: 'Plan', select: 'multiple',
      options: [{ value: 'Pro', label: 'Pro' }, { value: 'Free', label: 'Free' }] }]);
    await window.__settled();
    const chip = el.shadowRoot!.querySelector<HTMLElement>('.chip[data-id="plan"]')!;
    const menu = chip.querySelector('sherpa-menu') as HTMLElement & { show(): void };
    menu.show();
    await window.__settled();
    chip.querySelector<HTMLInputElement>('input[value="Pro"]')!.click();
    await window.__settled();
    return { pending: chip.hasAttribute('data-pending'), current: chip.hasAttribute('data-current') };
  });
  expect(r).toEqual({ pending: false, current: true });
});
