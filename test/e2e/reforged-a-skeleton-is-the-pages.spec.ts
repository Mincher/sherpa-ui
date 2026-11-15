import { test, expect } from './harness';

/**
 * THE SKELETON IS THE PAGE'S — Will, TODO 113. A component's first draw never
 * waits a frame, so the one wait a reader sees is before its code loads.
 * page.css shimmers an element not yet defined, after 300 ms, and hides its
 * bare children; defined, it draws as itself. It pulses 25 times, about 30 s,
 * then stops: WebKit keeps a CSSAnimation "running" on an element that got its
 * shadow root as it was defined, so an endless one never ended (TODO 996).
 * TRAP T-a-skeleton-is-the-pages
 */
test('an element whose code has not loaded shimmers after 300 ms, then draws as itself', async ({ page }) => {
  await page.goto('/test/reforged/harness.html');
  const r = await page.evaluate(async () => {
    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = '/dist/styles/tokens/page.css';
    await new Promise((done) => { link.onload = done; document.head.append(link); });
    const el = document.createElement('sherpa-not-yet');
    el.innerHTML = '<span>bare</span>';
    el.style.display = 'block';
    document.body.append(el);
    const read = () => {
      const style = getComputedStyle(el);
      const [anim] = el.getAnimations();
      return { name: style.animationName, delay: style.animationDelay,
        child: getComputedStyle(el.firstElementChild!).visibility, running: anim?.playState ?? null };
    };
    const waiting = read();
    customElements.define('sherpa-not-yet', class extends HTMLElement {});
    return { waiting, drawn: read() };
  });
  expect(r.waiting).toEqual({ name: 'sherpa-skeleton', delay: '0.3s', child: 'hidden', running: 'running' });
  expect(r.drawn).toEqual({ name: 'none', delay: '0s', child: 'visible', running: null });
});

// TODO 996, found by sherpa-demos-67: a wait on animations met WebKit's kept skeleton, which never ended.
test('the skeleton pulses 25 times and ends, also where an engine keeps it on an element defined since', async ({ page }) => {
  const timing = await page.evaluate(async () => {
    const w = document.createElement('div');
    document.body.appendChild(w);
    w.innerHTML = Array.from({ length: 3 }, () => '<x-skeleton-probe><span>kid</span></x-skeleton-probe>').join('');
    await new Promise((r) => setTimeout(r, 400));
    const ends = () => document.getAnimations().filter((a) => (a as CSSAnimation).animationName === 'sherpa-skeleton')
      .map((a) => { const t = a.effect!.getComputedTiming(); return [t.iterations, Math.round(Number(t.endTime))]; });
    const before = ends();
    customElements.define('x-skeleton-probe', class extends HTMLElement {
      connectedCallback() {
        if (this.shadowRoot) return;
        const root = this.attachShadow({ mode: 'open' });
        const sheet = new CSSStyleSheet();
        sheet.replaceSync(':host { display: block }');
        root.adoptedStyleSheets = [sheet];
        root.innerHTML = '<slot></slot>';
      }
    });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    return { before, after: ends() };
  });
  // Undefined: a pulse of 1.2 s after 300 ms, 25 times.
  expect(timing.before).toEqual([[25, 30300], [25, 30300], [25, 30300]]);
  // Defined: gone (Chromium, Firefox), or kept but ending (WebKit).
  for (const [iterations, end] of timing.after) expect([iterations, end]).toEqual([25, 30300]);
});
