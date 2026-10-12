import { test, expect } from './harness';

/**
 * A LIST TAKES ITS CHILDREN AS DATA. A page that writes only HTML can fill the
 * tab strip, the breadcrumbs, a select's options and key-value pairs; a child
 * added later is followed, and populate() wins once given. TODO 212
 * TRAP T-a-list-takes-its-children-as-data
 */
test('plain HTML fills the tabs, the breadcrumbs, a select and a key-value list', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const root = document.getElementById('root')!;
    root.innerHTML = `
      <sherpa-tabs><div data-tab="a" data-label="Alpha">A</div><div data-tab="b" data-label="Beta">B</div></sherpa-tabs>
      <sherpa-breadcrumbs><a href="/home">Home</a><a href="/records">Records</a><a>Ann</a></sherpa-breadcrumbs>
      <sherpa-input-text data-type="select" data-label="Tier"><option value="g">Gold</option><option value="s">Silver</option></sherpa-input-text>
      <sherpa-key-value-list><dt>Customers</dt><dd>12</dd><dt>Trials</dt><dd>3</dd></sherpa-key-value-list>`;
    const settle = (window as unknown as { __settled(): Promise<void> }).__settled;
    await settle();
    const $ = <T extends Element>(tag: string, sel: string): T[] =>
      [...document.querySelector(tag)!.shadowRoot!.querySelectorAll<T>(sel)];
    const look = () => ({
      tabs: $('sherpa-tabs', '.tab').map((t) => t.textContent?.trim()),
      current: document.querySelector('sherpa-tabs')!.getAttribute('data-current-id'),
      crumbs: $<HTMLAnchorElement>('sherpa-breadcrumbs', '.link').map((a) => `${a.textContent}${a.getAttribute('aria-current') ? '*' : ''}`),
      options: $<HTMLOptionElement>('sherpa-input-text', 'select option').map((o) => `${o.value}:${o.textContent}`),
      pairs: $('sherpa-key-value-list', '.key, .value').map((n) => n.textContent),
    });
    const first = look();
    // A child added later is followed.
    const crumbs = document.querySelector('sherpa-breadcrumbs')!;
    crumbs.insertAdjacentHTML('beforeend', '<a>Edit</a>');
    await settle();
    const added = look().crumbs;
    // populate() wins, and the children are no longer read.
    await (crumbs as HTMLElement & { populate(d: unknown): Promise<void> }).populate([{ label: 'Only' }]);
    crumbs.insertAdjacentHTML('beforeend', '<a>Ignored</a>');
    await settle();
    return { first, added, populated: look().crumbs };
  });
  expect(r.first).toEqual({
    tabs: ['Alpha', 'Beta'], current: 'a',
    crumbs: ['Home', 'Records', 'Ann*'],
    options: ['g:Gold', 's:Silver'],
    pairs: ['Customers', '12', 'Trials', '3'],
  });
  expect(r.added).toEqual(['Home', 'Records', 'Ann', 'Edit*']);
  expect(r.populated).toEqual(['Only*']);
});
