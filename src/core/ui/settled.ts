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
  // ON THE CLOCK only: a scroll-driven animation never finishes.
  const doc = root instanceof Document ? root : root.ownerDocument ?? document;
  await Promise.all(doc.getAnimations()
    .filter((a) => a.timeline === doc.timeline)
    .map((a) => a.finished.catch(() => {})));
}
