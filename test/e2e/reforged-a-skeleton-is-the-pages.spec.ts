import { test, expect } from './harness';

/**
 * THE SKELETON IS THE PAGE'S — Will, TODO 113. A component's first draw never
 * waits a frame, so the one wait a reader sees is before its code loads.
 * page.css shimmers an element not yet defined, after 300 ms, and hides its
 * bare children; defined, it draws as itself.
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
