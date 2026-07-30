import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

const PROPOSAL = `
  <sherpa-proposal-preview data-rationale="Tighten the alert filter">
    <sherpa-proposal-op slot="ops" data-op="add" data-target="filter:sev" data-field="severity" data-value="critical">Add severity = critical</sherpa-proposal-op>
    <sherpa-proposal-op slot="ops" data-op="remove-edge" data-target="edge:12">Remove edge 12</sherpa-proposal-op>
    <div slot="decision">
      <button data-action="accept">Accept</button>
      <button data-action="reject">Reject</button>
      <button data-action="edit">Edit</button>
    </div>
  </sherpa-proposal-preview>`;

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

test('getOps() returns structured ops from slotted proposal-op children', async ({ page }) => {
  await mount(page, PROPOSAL, 'sherpa-proposal-preview');
  const ops = await page.evaluate(() => {
    const p = document.querySelector('sherpa-proposal-preview') as HTMLElement & { getOps?: () => unknown[] };
    return p.getOps!();
  });
  expect(ops).toHaveLength(2);
  expect(ops[0]).toMatchObject({ op: 'add', target: 'filter:sev', field: 'severity', value: 'critical' });
  expect(ops[1]).toMatchObject({ op: 'remove-edge', target: 'edge:12' });
});

test('decision buttons emit canonical proposal-accept/reject/edit', async ({ page }) => {
  await mount(page, PROPOSAL, 'sherpa-proposal-preview');
  const r = await page.evaluate(() => {
    const p = document.querySelector('sherpa-proposal-preview')!;
    const got: Record<string, unknown> = {};
    p.addEventListener('proposal-accept', (e: any) => (got.accept = e.detail));
    p.addEventListener('proposal-reject', () => (got.reject = true));
    p.addEventListener('proposal-edit', () => (got.edit = true));
    (p.querySelector('[data-action="accept"]') as HTMLElement).click();
    (p.querySelector('[data-action="reject"]') as HTMLElement).click();
    (p.querySelector('[data-action="edit"]') as HTMLElement).click();
    return got;
  });
  expect((r.accept as { ops: unknown[] }).ops).toHaveLength(2);
  expect(r.reject).toBe(true);
  expect(r.edit).toBe(true);
});

test('edge ops render distinct glyphs from node ops', async ({ page }) => {
  await mount(page, PROPOSAL, 'sherpa-proposal-preview');
  const glyphs = await page.evaluate(() => {
    const q = (op: string) => {
      const el = document.querySelector(`sherpa-proposal-op[data-op="${op}"]`)!;
      const tag = el.shadowRoot!.querySelector('.tag')!;
      return getComputedStyle(tag, '::after').content;
    };
    return { add: q('add'), removeEdge: q('remove-edge') };
  });
  // distinct content strings (add uses "+", remove-edge uses an arrow glyph)
  expect(glyphs.add).not.toBe(glyphs.removeEdge);
});
