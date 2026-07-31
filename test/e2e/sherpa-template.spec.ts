import { test, expect } from '@playwright/test';
import { openHarness } from './support';

/**
 * Unit coverage for the SherpaTemplate binder (data → HTML) exercised through a
 * real component (breadcrumbs) — both the data-object and precompiled-HTML paths,
 * plus the individual data-bind* markers.
 */

test.beforeEach(async ({ page }) => openHarness(page));

test('binder: data path expands per-item flags (link/current/separator)', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!([{ label: 'Home', href: '/h' }, { label: 'Sub', href: '/s' }, { label: 'Now' }]);
    await new Promise((res) => setTimeout(res, 30));
    const sr = bc.shadowRoot!;
    const crumbs = [...sr.querySelectorAll('.crumb-text')].map((c) => ({
      tag: c.tagName,
      text: c.textContent,
      href: c.getAttribute('href'),
      current: c.getAttribute('aria-current'),
    }));
    return { crumbs, separators: sr.querySelectorAll('.separator').length };
  });
  expect(r.crumbs).toHaveLength(3);
  // Historic crumbs render as <a href>, the last as <span aria-current="page">.
  expect(r.crumbs[0]).toMatchObject({ tag: 'A', text: 'Home', href: '/h', current: null });
  expect(r.crumbs[2]).toMatchObject({ tag: 'SPAN', text: 'Now', href: null, current: 'page' });
  // One separator between each pair (not after the last).
  expect(r.separators).toBe(2);
});

test('binder: precompiled HTML path injects markup as-is', async ({ page }) => {
  const count = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!(
      '<a class="crumb-text" href="/x">X</a><span class="separator">/</span><span class="crumb-text" aria-current="page">Y</span>',
    );
    await new Promise((res) => setTimeout(res, 30));
    return bc.shadowRoot!.querySelectorAll('.crumb-text').length;
  });
  expect(count).toBe(2);
});

test('binder: data-bind-if removes falsy branches and keeps truthy ones', async ({ page }) => {
  // A single-item trail: only the current <span> survives; no link, no separator.
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = '<sherpa-breadcrumbs id="bc"></sherpa-breadcrumbs>';
    const bc = document.getElementById('bc') as HTMLElement & {
      rendered?: Promise<void>;
      populate?: (s: unknown) => void;
    };
    await bc.rendered;
    bc.populate!([{ label: 'Only' }]);
    await new Promise((res) => setTimeout(res, 30));
    const sr = bc.shadowRoot!;
    return {
      links: sr.querySelectorAll('a.crumb-text').length,
      current: sr.querySelectorAll('span[aria-current="page"]').length,
      separators: sr.querySelectorAll('.separator').length,
    };
  });
  expect(r.links).toBe(0);
  expect(r.current).toBe(1);
  expect(r.separators).toBe(0);
});

/**
 * Convergence: every collection component exposes a canonical populate(),
 * and its legacy setter is a thin alias that renders identically.
 */
test('populate(): canonical entry + deprecated alias parity', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const mk = async (tag: string) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>;
        populate?: (s: unknown) => void;
        setOptions?: (s: unknown) => void;
        setItems?: (s: unknown) => void;
        setSteps?: (s: unknown) => void;
      };
      root.appendChild(el);
      await el.rendered;
      return el;
    };

    // transfer-list — populate() vs setOptions()
    const tl1 = await mk('sherpa-transfer-list');
    tl1.populate!([{ value: 'a', label: 'A' }, { value: 'b', label: 'B', selected: true }]);
    const tl2 = await mk('sherpa-transfer-list');
    tl2.setOptions!([{ value: 'a', label: 'A' }, { value: 'b', label: 'B', selected: true }]);
    await new Promise((res) => setTimeout(res, 30));
    const tlCount = (el: HTMLElement) => el.shadowRoot!.querySelectorAll('.option-tpl ~ *, .pane-list sherpa-list-item, [class*="option"]').length;

    // chart-legend — populate() vs setItems()
    const cl1 = await mk('sherpa-chart-legend');
    cl1.populate!([{ label: 'X', value: 1 }, { label: 'Y', value: 2 }]);
    const cl2 = await mk('sherpa-chart-legend');
    cl2.setItems!([{ label: 'X', value: 1 }, { label: 'Y', value: 2 }]);
    await new Promise((res) => setTimeout(res, 30));
    const clCount = (el: HTMLElement) => el.shadowRoot!.querySelectorAll('.legend-item, [class*="legend-item"], .item').length;

    // step-tracker — populate(array) vs populate({steps}) vs setSteps()
    const st1 = await mk('sherpa-progress-step-tracker');
    st1.populate!([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]);
    const st2 = await mk('sherpa-progress-step-tracker');
    st2.populate!({ steps: [{ label: 'One' }, { label: 'Two' }, { label: 'Three' }] });
    const st3 = await mk('sherpa-progress-step-tracker');
    st3.setSteps!([{ label: 'One' }, { label: 'Two' }, { label: 'Three' }]);
    await new Promise((res) => setTimeout(res, 30));
    const stCount = (el: HTMLElement) => el.shadowRoot!.querySelectorAll('.step-item').length;

    return {
      tl: { populate: clCountSafe(tl1, tlCount), alias: clCountSafe(tl2, tlCount) },
      cl: { populate: clCountSafe(cl1, clCount), alias: clCountSafe(cl2, clCount) },
      st: { array: clCountSafe(st1, stCount), wrapper: clCountSafe(st2, stCount), alias: clCountSafe(st3, stCount) },
    };

    function clCountSafe(el: HTMLElement, fn: (e: HTMLElement) => number): number {
      try { return fn(el); } catch { return -1; }
    }
  });

  // Every populate() path renders, and each alias matches its canonical.
  expect(r.tl.populate).toBeGreaterThan(0);
  expect(r.tl.alias).toBe(r.tl.populate);
  expect(r.cl.populate).toBe(2);
  expect(r.cl.alias).toBe(2);
  expect(r.st.array).toBe(3);
  expect(r.st.wrapper).toBe(3);
  expect(r.st.alias).toBe(3);
});

/**
 * Unified dispatcher: the two-arity escape hatch populate(kind, data), the
 * sniffer's template branch, and the keyed-collection ({steps}) branch — all
 * resolve through SherpaElement.populate() without a per-component populate().
 */
test('populate(): explicit kind + sniffed template/collection branches', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    const mk = async (tag: string) => {
      const el = document.createElement(tag) as HTMLElement & {
        rendered?: Promise<void>;
        populate: (a: unknown, b?: unknown) => void;
      };
      root.appendChild(el);
      await el.rendered;
      return el;
    };

    // Sniffed HTML string → 'template' branch (renderTemplateSource).
    const kvHtml = await mk('sherpa-key-value-list');
    kvHtml.populate('<dt>Region</dt><dd>EMEA</dd><dt>Tier</dt><dd>Gold</dd>');

    // Forced template kind, explicit two-arg form.
    const kvForced = await mk('sherpa-key-value-list');
    kvForced.populate('template', '<dt>A</dt><dd>1</dd>');

    // Sniffed array → 'collection' (renderData).
    const kvArr = await mk('sherpa-key-value-list');
    kvArr.populate([{ key: 'K', value: 'V' }]);

    // Forced collection kind, explicit two-arg form.
    const kvArrForced = await mk('sherpa-key-value-list');
    kvArrForced.populate('collection', [{ key: 'K', value: 'V' }, { key: 'K2', value: 'V2' }]);

    // Keyed collection ({steps}) sniffed as collection on step-tracker.
    const st = await mk('sherpa-progress-step-tracker');
    st.populate({ steps: [{ label: 'One' }, { label: 'Two' }] });

    await new Promise((res) => setTimeout(res, 40));
    const dd = (el: HTMLElement) => el.shadowRoot!.querySelectorAll('dd').length;
    return {
      htmlSniffed: dd(kvHtml),
      htmlForced: dd(kvForced),
      arrSniffed: dd(kvArr),
      arrForced: dd(kvArrForced),
      stepsKeyed: st.shadowRoot!.querySelectorAll('.step-item').length,
    };
  });

  expect(r.htmlSniffed).toBe(2);  // template branch injected raw <dd>s
  expect(r.htmlForced).toBe(1);
  expect(r.arrSniffed).toBe(1);   // collection branch bound the pair template
  expect(r.arrForced).toBe(2);
  expect(r.stepsKeyed).toBe(2);   // {steps} keyed collection unwrapped
});
