import { test, expect } from '@playwright/test';

/**
 * sherpa-breadcrumbs on the reforged base — populate() rendering from a crumb
 * array via the .crumb-tpl cloning prototype, current-page marking on the last
 * crumb (aria-current, no href), CSS separators, and the breadcrumb-select
 * event on click.
 */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(
    () => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true,
  );
  await page.evaluate(() => customElements.whenDefined('sherpa-breadcrumbs'));
});

interface CrumbEl extends HTMLElement {
  rendered?: Promise<void>;
  populate: (data: unknown) => void;
}

test('populate renders one crumb per item in order', async ({ page }) => {
  const labels = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([
      { label: 'Home', href: '/' },
      { label: 'Projects', href: '/projects' },
      { label: 'Sherpa UI' },
    ]);
    await new Promise((r) => requestAnimationFrame(r));
    return Array.from(el.shadowRoot!.querySelectorAll('.link')).map((n) => n.textContent);
  });
  expect(labels).toEqual(['Home', 'Projects', 'Sherpa UI']);
});

test('last crumb is current (aria-current, no href); others link', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([
      { label: 'Home', href: '/' },
      { label: 'Current' },
    ]);
    await new Promise((rr) => requestAnimationFrame(rr));
    const links = Array.from(el.shadowRoot!.querySelectorAll<HTMLAnchorElement>('.link'));
    return {
      firstHref: links[0]!.getAttribute('href'),
      firstCurrent: links[0]!.getAttribute('aria-current'),
      lastHref: links[1]!.getAttribute('href'),
      lastCurrent: links[1]!.getAttribute('aria-current'),
    };
  });
  expect(r.firstHref).toBe('/');
  expect(r.firstCurrent).toBeNull();
  expect(r.lastHref).toBeNull();
  expect(r.lastCurrent).toBe('page');
});

test('current crumb is styled non-link (default body colour, distinct from links)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'Home', href: '/' }, { label: 'Here' }]);
    await new Promise((rr) => requestAnimationFrame(rr));
    const links = Array.from(el.shadowRoot!.querySelectorAll('.link'));
    return {
      linkColor: getComputedStyle(links[0]!).color,
      currentColor: getComputedStyle(links[1]!).color,
    };
  });
  expect(r.linkColor).not.toBe(r.currentColor);
});

test('separators are drawn via CSS ::before on crumbs after the first', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'A', href: '/a' }, { label: 'B', href: '/b' }, { label: 'C' }]);
    await new Promise((rr) => requestAnimationFrame(rr));
    const crumbs = Array.from(el.shadowRoot!.querySelectorAll('.crumb'));
    const sep = (n: Element) => {
      const cs = getComputedStyle(n, '::before');
      return { content: cs.content, font: cs.fontFamily };
    };
    return { first: sep(crumbs[0]!), second: sep(crumbs[1]!), third: sep(crumbs[2]!) };
  });
  // First crumb: no separator; subsequent crumbs render the Font Awesome chevron-right
  // glyph (U+F054) — Figma's 12×12 chevron-right instance.
  const CHEVRON = '""';
  expect(r.first.content).toMatch(/none|""|normal/);
  expect(r.second.content).toBe(CHEVRON);
  expect(r.third.content).toBe(CHEVRON);
  expect(r.second.font).toContain('Font Awesome 6 Free');
});

test('clicking a crumb fires breadcrumb-select with index/label/href', async ({ page }) => {
  const detail = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'Home', href: '/' }, { label: 'Projects', href: '/p' }, { label: 'Now' }]);
    await new Promise((rr) => requestAnimationFrame(rr));

    let captured: unknown = null;
    el.addEventListener('breadcrumb-select', (e) => {
      captured = (e as CustomEvent).detail;
    });
    el.shadowRoot!.querySelectorAll<HTMLElement>('.link')[1]!.click();
    return captured;
  });
  expect(detail).toEqual({ index: 1, label: 'Projects', href: '/p' });
});

test('clicking the current crumb fires with empty href', async ({ page }) => {
  const detail = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'Home', href: '/' }, { label: 'Current' }]);
    await new Promise((rr) => requestAnimationFrame(rr));

    let captured: unknown = null;
    el.addEventListener('breadcrumb-select', (e) => {
      captured = (e as CustomEvent).detail;
    });
    el.shadowRoot!.querySelectorAll<HTMLElement>('.link')[1]!.click();
    return captured;
  });
  expect(detail).toEqual({ index: 1, label: 'Current', href: '' });
});

test('re-populating replaces the previous trail', async ({ page }) => {
  const labels = await page.evaluate(async () => {
    const el = document.createElement('sherpa-breadcrumbs') as unknown as CrumbEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    el.populate([{ label: 'Old A' }, { label: 'Old B' }]);
    await new Promise((rr) => requestAnimationFrame(rr));
    el.populate([{ label: 'New' }]);
    await new Promise((rr) => requestAnimationFrame(rr));
    return Array.from(el.shadowRoot!.querySelectorAll('.link')).map((n) => n.textContent);
  });
  expect(labels).toEqual(['New']);
});
