import { test, expect } from './harness';

/**
 * settled() waits only for what will end, and only under its root — TODO 225.
 * TRAP T-settled-waits-for-renders-not-transitions
 */
type Settled = (root?: Document | Element | DocumentFragment) => Promise<void>;

test('an infinite animation, and a paused one, do not hold settled() for ever', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const lib = '/dist/index.js';
    const { settled } = await import(lib) as { settled: Settled };
    const root = document.getElementById('root')!;
    const spin = document.createElement('div');
    const held = document.createElement('div');
    root.replaceChildren(spin, held);
    spin.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400, iterations: Infinity });
    held.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 400 }).pause();
    const wait = settled();
    return Promise.race([wait.then(() => 'settled'), new Promise<string>((done) => setTimeout(() => done('hung'), 1500))]);
  });
  expect(r).toBe('settled');
});

test('given a part of the page, settled() waits on that part alone — shadow roots included', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const lib = '/dist/index.js';
    const { settled } = await import(lib) as { settled: Settled };
    const root = document.getElementById('root')!;
    const part = document.createElement('div');
    const elsewhere = document.createElement('div');
    root.replaceChildren(part, elsewhere);
    elsewhere.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 5000 });
    const host = document.createElement('div');
    part.append(host);
    const inner = host.attachShadow({ mode: 'open' }).appendChild(document.createElement('span'));
    const fade = inner.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 300 });
    const t0 = performance.now();
    const outcome = await Promise.race([settled(part).then(() => 'settled'), new Promise<string>((done) => setTimeout(() => done('hung'), 2500))]);
    return { outcome, waitedForInner: fade.playState === 'finished', ms: performance.now() - t0 };
  });
  expect(r.outcome).toBe('settled');
  expect(r.waitedForInner).toBe(true);
  expect(r.ms).toBeLessThan(2500);
});
