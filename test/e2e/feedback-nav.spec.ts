import { test, expect } from '@playwright/test';
import { openHarness, mount, clearRoot } from './support';

test.beforeEach(async ({ page }) => openHarness(page));
test.afterEach(async ({ page }) => clearRoot(page));

/* ── sherpa-message ────────────────────────────────────────────── */

test('sherpa-message renders status + label and dismiss fires close', async ({ page }) => {
  await mount(page, `<sherpa-message data-status="warning" data-label="Heads up" data-dismissible></sherpa-message>`, 'sherpa-message');
  const r = await page.evaluate(async () => {
    const m = document.querySelector('sherpa-message') as HTMLElement;
    const sr = m.shadowRoot!;
    const label = sr.querySelector('.message-label')!.textContent;
    const closeBtn = sr.querySelector('.message-close') as HTMLElement & { rendered?: Promise<void> };
    if (closeBtn?.rendered) await closeBtn.rendered;
    let closed = false;
    m.addEventListener('close', () => (closed = true));
    // sherpa-message listens for the sherpa-button `button-click` event
    (closeBtn.shadowRoot!.querySelector('button.trigger') as HTMLElement).click();
    return { status: m.dataset['status'], label, closed, removed: !document.querySelector('sherpa-message') };
  });
  expect(r.status).toBe('warning');
  expect(r.label).toBe('Heads up');
  expect(r.closed).toBe(true);
  expect(r.removed).toBe(true);
});

test('sherpa-message action link fires action with href', async ({ page }) => {
  await mount(page, `<sherpa-message data-label="X" data-action-label="Details" data-action-href="/x"></sherpa-message>`, 'sherpa-message');
  const r = await page.evaluate(() => {
    const m = document.querySelector('sherpa-message')!;
    const action = m.shadowRoot!.querySelector('.message-action') as HTMLElement;
    let detail: any = null;
    m.addEventListener('action', (e: any) => (detail = e.detail));
    // Prevent the anchor's default navigation so the test context survives.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    action.click();
    return { hasAction: m.hasAttribute('data-has-action'), detail };
  });
  expect(r.hasAction).toBe(true);
  expect(r.detail).toEqual({ href: '/x' });
});

/* ── sherpa-breadcrumbs ────────────────────────────────────────── */

test('sherpa-breadcrumbs renders crumbs from data-items; last is current', async ({ page }) => {
  await mount(page, `<sherpa-breadcrumbs></sherpa-breadcrumbs>`, 'sherpa-breadcrumbs');
  const r = await page.evaluate(() => {
    const b = document.querySelector('sherpa-breadcrumbs')!;
    b.setAttribute('data-items', JSON.stringify([
      { label: 'Home', href: '/' },
      { label: 'Reports', href: '/reports' },
      { label: 'Q3' },
    ]));
    const sr = b.shadowRoot!;
    const crumbs = [...sr.querySelectorAll('.crumb-text')];
    return {
      count: crumbs.length,
      links: crumbs.filter((c) => c.tagName === 'A').length,
      lastTag: crumbs[crumbs.length - 1]!.tagName,
      lastCurrent: crumbs[crumbs.length - 1]!.getAttribute('aria-current'),
    };
  });
  expect(r.count).toBe(3);
  expect(r.links).toBe(2); // first two are links, last is a span
  expect(r.lastTag).toBe('SPAN');
  expect(r.lastCurrent).toBe('page');
});

test('sherpa-breadcrumbs clicking a non-last crumb fires breadcrumb-click', async ({ page }) => {
  await mount(page, `<sherpa-breadcrumbs></sherpa-breadcrumbs>`, 'sherpa-breadcrumbs');
  const r = await page.evaluate(() => {
    const b = document.querySelector('sherpa-breadcrumbs')!;
    b.setAttribute('data-items', JSON.stringify([
      { label: 'Home', href: '/' },
      { label: 'Reports', href: '/reports' },
      { label: 'Q3' },
    ]));
    const sr = b.shadowRoot!;
    let detail: any = null;
    b.addEventListener('breadcrumb-click', (e: any) => (detail = e.detail));
    // Prevent the anchor's default navigation so the test context survives.
    document.addEventListener('click', (e) => e.preventDefault(), { capture: true, once: true });
    (sr.querySelectorAll('.crumb-text')[1] as HTMLElement).click();
    return { detail };
  });
  expect(r.detail).toMatchObject({ index: 1, label: 'Reports', current: false, href: '/reports' });
});

/* ── sherpa-pagination ─────────────────────────────────────────── */

test('sherpa-pagination next/prev fire page-change; boundary disables', async ({ page }) => {
  await mount(page, `<sherpa-pagination data-total-rows="30" data-page-size="10" data-page="1"></sherpa-pagination>`, 'sherpa-pagination');
  const r = await page.evaluate(() => {
    const p = document.querySelector('sherpa-pagination') as HTMLElement & { totalPages: number };
    const sr = p.shadowRoot!;
    const prevBtn = sr.querySelector('.page-prev') as HTMLButtonElement;
    const nextBtn = sr.querySelector('.page-next') as HTMLButtonElement;
    let detail: any = null;
    p.addEventListener('page-change', (e: any) => (detail = e.detail));
    const prevDisabledAtStart = prevBtn.disabled; // page 1 → prev disabled
    nextBtn.click();
    return {
      totalPages: p.totalPages,
      prevDisabledAtStart,
      detail,
      page: p.dataset['page'],
      prevDisabledAfter: prevBtn.disabled,
    };
  });
  expect(r.totalPages).toBe(3);
  expect(r.prevDisabledAtStart).toBe(true);
  expect(r.detail).toMatchObject({ page: 2, pageSize: 10, totalPages: 3 });
  expect(r.page).toBe('2');
  expect(r.prevDisabledAfter).toBe(false);
});

test('sherpa-pagination next is disabled on the last page', async ({ page }) => {
  await mount(page, `<sherpa-pagination data-total-rows="30" data-page-size="10" data-page="3"></sherpa-pagination>`, 'sherpa-pagination');
  const r = await page.evaluate(() => {
    const p = document.querySelector('sherpa-pagination')!;
    const nextBtn = p.shadowRoot!.querySelector('.page-next') as HTMLButtonElement;
    return { nextDisabled: nextBtn.disabled };
  });
  expect(r.nextDisabled).toBe(true);
});

/* ── sherpa-accordion ──────────────────────────────────────────── */

test('sherpa-accordion renders label in summary and toggling opens native <details>', async ({ page }) => {
  await mount(page, `<sherpa-accordion data-label="Advanced"><p>Body</p></sherpa-accordion>`, 'sherpa-accordion');
  const r = await page.evaluate(() => {
    const a = document.querySelector('sherpa-accordion')!;
    const sr = a.shadowRoot!;
    const details = sr.querySelector('details') as HTMLDetailsElement;
    const label = sr.querySelector('.trigger-label')!.textContent;
    const startOpen = details.open;
    // Native toggle: open the details, which mirrors onto host `open`
    details.open = true;
    details.dispatchEvent(new Event('toggle'));
    return { label, startOpen, afterOpen: details.open, hostOpen: a.hasAttribute('open') };
  });
  expect(r.label).toBe('Advanced');
  expect(r.startOpen).toBe(false);
  expect(r.afterOpen).toBe(true);
  expect(r.hostOpen).toBe(true);
});

/* ── sherpa-loader ─────────────────────────────────────────────── */

test('sherpa-loader renders spinner, sets role=status, and honours data-size', async ({ page }) => {
  await mount(page, `<sherpa-loader data-size="large"></sherpa-loader>`, 'sherpa-loader');
  const r = await page.evaluate(() => {
    const l = document.querySelector('sherpa-loader') as HTMLElement;
    return {
      role: l.getAttribute('role'),
      ariaLive: l.getAttribute('aria-live'),
      hasSpinner: !!l.shadowRoot!.querySelector('.spinner'),
      size: l.dataset['size'],
    };
  });
  expect(r.role).toBe('status');
  expect(r.ariaLive).toBe('polite');
  expect(r.hasSpinner).toBe(true);
  expect(r.size).toBe('large');
});

/* ── sherpa-toast ──────────────────────────────────────────────── */

test('sherpa-toast static show() creates a toast with status/heading/value', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const Toast = customElements.get('sherpa-toast') as any;
    const toast = Toast.show({ status: 'info', heading: 'Saved', value: 'All good' });
    await toast.rendered;
    const sr = toast.shadowRoot!;
    const result = {
      status: toast.dataset['status'],
      heading: sr.querySelector('.toast-heading')!.textContent,
      value: sr.querySelector('.toast-value')!.textContent,
      inContainer: !!toast.closest('.sherpa-toast-container'),
      state: sr.querySelector('.toast')!.dataset.state,
    };
    // cleanup — toast lives in document.body, not #root
    toast.closest('.sherpa-toast-container')?.remove();
    return result;
  });
  expect(r.status).toBe('info');
  expect(r.heading).toBe('Saved');
  expect(r.value).toBe('All good');
  expect(r.inContainer).toBe(true);
  expect(r.state).toBe('visible'); // onConnect auto-shows when data-value is set
});
