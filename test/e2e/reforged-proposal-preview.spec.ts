import { test, expect } from '@playwright/test';

/**
 * sherpa-proposal-preview on the reforged base — a card wrapping proposed ops.
 * Proves the title/rationale sync, the slotted-header override + rationale
 * collapse, populate([...ops]) stamping sherpa-proposal-op rows, getOps() reading
 * both slotted and stamped children, and the accept/reject decision events.
 *
 * Not in the harness index, so the spec imports both compiled modules.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(async () => {
    await import('/dist-reforged/components/sherpa-proposal-op/sherpa-proposal-op.js');
    await import('/dist-reforged/components/sherpa-proposal-preview/sherpa-proposal-preview.js');
    await Promise.all([
      customElements.whenDefined('sherpa-proposal-op'),
      customElements.whenDefined('sherpa-proposal-preview'),
    ]);
  });
});

type WithRender = HTMLElement & { rendered?: Promise<void> };
type WithPopulate = WithRender & { populate?: (d: unknown) => void };

test('data-title and data-rationale write their text nodes', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithRender;
    el.setAttribute('data-title', 'Proposed changes');
    el.setAttribute('data-rationale', 'To satisfy the request.');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return {
      title: el.shadowRoot!.querySelector('.title')!.textContent,
      rationale: el.shadowRoot!.querySelector('.rationale')!.textContent,
      rationaleVisible:
        getComputedStyle(el.shadowRoot!.querySelector('.rationale')!).display !== 'none',
    };
  });
  expect(r.title).toBe('Proposed changes');
  expect(r.rationale).toBe('To satisfy the request.');
  expect(r.rationaleVisible).toBe(true);
});

test('rationale collapses when data-rationale is absent', async ({ page }) => {
  const visible = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithRender;
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return getComputedStyle(el.shadowRoot!.querySelector('.rationale')!).display !== 'none';
  });
  expect(visible).toBe(false);
});

test('a slotted header reflects data-has-header and hides the title text node', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithRender;
    el.setAttribute('data-title', 'ignored');
    el.innerHTML = '<h3 slot="header">Custom header</h3>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));
    return {
      hasHeader: el.hasAttribute('data-has-header'),
      titleDisplay: getComputedStyle(el.shadowRoot!.querySelector('.title')!).display,
    };
  });
  expect(r.hasHeader).toBe(true);
  expect(r.titleDisplay).toBe('none');
});

test('populate([...ops]) stamps sherpa-proposal-op rows read back by getOps()', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithPopulate & {
      getOps?: () => Array<{ op: string; label?: string; target?: string }>;
    };
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    el.populate!([
      { op: 'create', label: 'Add node A', target: 'node:a' },
      { op: 'delete', label: 'Remove node B' },
    ]);
    await new Promise((res) => setTimeout(res, 10));

    const rows = el.querySelectorAll('sherpa-proposal-op');
    return {
      count: rows.length,
      firstOp: (rows[0] as HTMLElement).dataset.op,
      firstLabel: (rows[0] as HTMLElement).dataset.label,
      ops: el.getOps!(),
    };
  });
  expect(r.count).toBe(2);
  expect(r.firstOp).toBe('create');
  expect(r.firstLabel).toBe('Add node A');
  expect(r.ops).toEqual([
    { op: 'create', label: 'Add node A', target: 'node:a' },
    { op: 'delete', label: 'Remove node B' },
  ]);
});

test('getOps() reads slotted sherpa-proposal-op children', async ({ page }) => {
  const ops = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithRender & {
      getOps?: () => Array<{ op: string; label?: string }>;
    };
    el.setAttribute('data-title', 'x');
    el.innerHTML =
      '<sherpa-proposal-op data-op="update" data-label="Change field foo"></sherpa-proposal-op>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    return el.getOps!();
  });
  expect(ops).toEqual([{ op: 'update', label: 'Change field foo' }]);
});

test('built-in accept / reject buttons emit proposal-accept / proposal-reject', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithPopulate;
    el.setAttribute('data-title', 'x');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate!([{ op: 'create', label: 'Add A' }]);
    await new Promise((res) => setTimeout(res, 10));

    let acceptOps: unknown = null;
    let rejected = 0;
    el.addEventListener('proposal-accept', (e) => {
      acceptOps = (e as CustomEvent).detail.ops;
    });
    el.addEventListener('proposal-reject', () => rejected++);

    el.shadowRoot!.querySelector<HTMLElement>('.accept')!.click();
    el.shadowRoot!.querySelector<HTMLElement>('.reject')!.click();

    return { acceptOps, rejected };
  });
  expect(r.acceptOps).toEqual([{ op: 'create', label: 'Add A' }]);
  expect(r.rejected).toBe(1);
});

test('a slotted decision control with data-action="accept" emits proposal-accept', async ({ page }) => {
  const fired = await page.evaluate(async () => {
    const el = document.createElement('sherpa-proposal-preview') as WithRender;
    el.setAttribute('data-title', 'x');
    el.innerHTML = '<button slot="decision" data-action="accept">Go</button>';
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    await new Promise((res) => requestAnimationFrame(res));

    let count = 0;
    el.addEventListener('proposal-accept', () => count++);
    el.querySelector<HTMLElement>('[data-action="accept"]')!.click();
    return count;
  });
  expect(fired).toBe(1);
});
