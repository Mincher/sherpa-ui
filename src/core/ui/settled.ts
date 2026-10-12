/**
 * settled.ts — wait until every Sherpa element under a root has drawn, and its transitions ended.
 * TRAP T-settled-waits-for-renders-not-transitions
 *
 * Map:
 * - settled — resolve once a tree's components have rendered, their data stamped, and their transitions finished
 */

type Root = Document | DocumentFragment | Element;

/** Every pending `rendered` under a root, shadow roots included. */
function pending(root: Root, out: Set<Promise<void>>): Set<Promise<void>> {
  for (const el of root.querySelectorAll('*')) {
    const rendered = (el as Element & { rendered?: Promise<void> }).rendered;
    if (el.localName.startsWith('sherpa-') && rendered) out.add(rendered);
    if (el.shadowRoot) pending(el.shadowRoot, out);
  }
  return out;
}

/**
 * Resolve once every `sherpa-*` element under `root` has rendered — again,
 * as drawing one can stamp more — its `populate()` has run, two frames have
 * painted, and every clock-driven transition has ended. For an app that must
 * measure, or a test: never a fixed timeout.
 */
export async function settled(root: Root = document, passes = 3): Promise<void> {
  for (let i = 0; i < passes; i++) {
    await Promise.all(pending(root, new Set()));
    // populate() runs in a LATER microtask than the `rendered` just awaited.
    await Promise.resolve();
    await Promise.resolve();
  }
  await new Promise<void>((r) => requestAnimationFrame(() => requestAnimationFrame(() => r())));
  // A popover's `toggle` comes a TASK later, and a menu writes `open` from it.
  await new Promise<void>((r) => setTimeout(r, 0));
  /* ON THE CLOCK, RUNNING, and with an END: a scroll-driven, a paused or an
     infinite animation — a loader, an indeterminate bar — never finishes. */
  const doc = root instanceof Document ? root : root.ownerDocument ?? document;
  // A document does not list its shadow trees' animations, so each is asked.
  const all = new Set([
    ...doc.getAnimations().filter((a) => root === doc || within(root, (a.effect as KeyframeEffect | null)?.target ?? null)),
    ...shadows(root, []).flatMap((sr) => sr.getAnimations()),
  ]);
  await Promise.all([...all]
    .filter((a) => a.timeline === doc.timeline && a.playState === 'running'
      && Number.isFinite(a.effect?.getComputedTiming().endTime ?? Infinity))
    .map(ended));
}

/** Done when it finishes or is cancelled — or is no longer drawn: Firefox never
 *  ticks an animation under a closed `<details>` or `content-visibility: hidden`. */
function ended(a: Animation): Promise<void> {
  return new Promise((done) => {
    void a.finished.then(() => done(), () => done());
    const look = (): void => {
      const target = (a.effect as KeyframeEffect | null)?.target;
      if (a.playState !== 'running' || (target && (!target.isConnected || !target.checkVisibility()))) done();
      else requestAnimationFrame(look);
    };
    look();
  });
}

/** Every shadow root at or under `root`. */
function shadows(root: Root, out: ShadowRoot[]): ShadowRoot[] {
  if (root instanceof ShadowRoot) out.push(root);
  else if (root instanceof Element && root.shadowRoot) shadows(root.shadowRoot, out);
  for (const el of root.querySelectorAll('*')) if (el.shadowRoot) shadows(el.shadowRoot, out);
  return out;
}

/** `node` is `root` or inside it, across shadow roots. */
function within(root: Root, node: Node | null): boolean {
  for (let at = node; at; at = at.parentNode ?? (at instanceof ShadowRoot ? at.host : null)) {
    if (at === root) return true;
  }
  return false;
}
