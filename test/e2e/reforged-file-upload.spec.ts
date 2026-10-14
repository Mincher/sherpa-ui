import { test, expect } from './harness';

/** sherpa-file-upload — drop zone + file list. Adding files fires file-add; remove works. */


test('renders a drop zone and mirrors accept/multiple to the input', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-accept', 'image/*');
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const input = el.shadowRoot!.querySelector<HTMLInputElement>('.file-input')!;
    return { dropZone: !!el.shadowRoot?.querySelector('.drop-zone'), accept: input.accept, multiple: input.multiple };
  });
  expect(r.dropZone).toBe(true);
  expect(r.accept).toBe('image/*');
  expect(r.multiple).toBe(true);
});

test('dropping files renders the list and fires file-add', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let count = -1;
    el.addEventListener('file-add', (e) => (count = (e as CustomEvent).detail.files.length));

    const dt = new DataTransfer();
    dt.items.add(new File(['a'], 'a.txt', { type: 'text/plain' }));
    dt.items.add(new File(['bb'], 'b.txt', { type: 'text/plain' }));
    el.shadowRoot!.querySelector('.drop-zone')!.dispatchEvent(
      new DragEvent('drop', { dataTransfer: dt, bubbles: true }),
    );
    await (window as unknown as { __settled: () => Promise<void> }).__settled();

    return {
      fired: count,
      rows: el.shadowRoot!.querySelectorAll('.file-item').length,
      hasFiles: el.hasAttribute('data-has-files'),
    };
  });
  expect(r.fired).toBe(2);
  expect(r.rows).toBe(2);
  expect(r.hasFiles).toBe(true);
});

type FileEl = HTMLElement & { rendered?: Promise<void> };

test('adding files fires file-add; the actions row and details appear', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    el.setAttribute('data-max-size', '4 MB');
    el.setAttribute('data-accept', '.png');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    let added = -1;
    el.addEventListener('file-add', (e) => (added = (e as CustomEvent).detail.added.length));
    const dt = new DataTransfer();
    dt.items.add(new File(['x'], 'a.png', { type: 'image/png' }));
    dt.items.add(new File(['y'], 'b.png', { type: 'image/png' }));
    el.shadowRoot!.querySelector('.drop-zone')!.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    const s = el.shadowRoot!;
    return {
      added,
      actionsVisible: getComputedStyle(s.querySelector('.actions')!).display !== 'none',
      maxSize: s.querySelector('.max-size')!.textContent,
      allowed: s.querySelector('.allowed-types')!.textContent,
    };
  });
  expect(r.added).toBe(2);
  expect(r.actionsVisible).toBe(true);
  expect(r.maxSize).toContain('4 MB');
  expect(r.allowed).toContain('.png');
});

test('the upload button fires file-upload-start with the files', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as FileEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['doc.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let count = -1;
    el.addEventListener('file-upload-start', (e) => (count = (e as CustomEvent).detail.files.length));
    await pressComposed(el.shadowRoot!.querySelector('.upload'));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { count };
  });
  expect(r.count).toBe(1);
});

test('clear all empties the list and fires file-clear', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['a.txt', 'b.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let cleared = false;
    el.addEventListener('file-clear', () => (cleared = true));
    await pressComposed(el.shadowRoot!.querySelector('.clear-all'));
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { cleared, rows: el.shadowRoot!.querySelectorAll('.file-item').length, hasFiles: el.hasAttribute('data-has-files') };
  });
  expect(r.cleared).toBe(true);
  expect(r.rows).toBe(0);
  expect(r.hasFiles).toBe(false);
});

test('removing a file fires file-remove with the removed file', async ({ page }) => {
  const r = await page.evaluate(async () => {
  /** Click a composed sherpa-button: await its own render, hit its inner trigger. */
  async function pressComposed(host: Element | null): Promise<void> {
    const btn = host as (HTMLElement & { rendered?: Promise<void>; shadowRoot?: ShadowRoot }) | null;
    await btn?.rendered;
    (btn?.shadowRoot?.querySelector('button') as HTMLElement | null)?.click();
  }
  
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['keep.txt', 'drop.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let removedName: string | null = null;
    el.addEventListener('file-remove', (e) => (removedName = (e as CustomEvent).detail.removed.name));
    await pressComposed(el.shadowRoot!.querySelectorAll('.file-remove')[1]);
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { removedName, rows: el.shadowRoot!.querySelectorAll('.file-item').length };
  });
  expect(r.removedName).toBe('drop.txt');
  expect(r.rows).toBe(1);
});

// The row's name comes from `File.name`, which lives on the PROTOTYPE rather
// than being an own property — so a field reader that enumerated own keys would
// render every row blank. Nothing else asserted the name, so breaking it was
// silent.
test('each row shows its real file name', async ({ page }) => {
  const names = await page.evaluate(async () => {
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['invoice.pdf', 'photo.png']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return [...el.shadowRoot!.querySelectorAll('.file-name')].map((n) => n.textContent);
  });
  expect(names).toEqual(['invoice.pdf', 'photo.png']);
});

/** A status is the FILE's, kept as data: an add or a remove redraws every row.
 *  TODO 113. TRAP T-a-value-is-data-the-ticks-are-drawn */
test('a file keeps its status through an add and a remove', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-file-upload') as HTMLElement & {
      rendered?: Promise<void>; setFileStatus(index: number, status: string): void;
    };
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    const drop = (...names: string[]): void => {
      const dt = new DataTransfer();
      for (const name of names) dt.items.add(new File([name], name, { type: 'text/plain' }));
      el.shadowRoot!.querySelector('.drop-zone')!.dispatchEvent(new DragEvent('drop', { dataTransfer: dt, bubbles: true }));
    };
    const statuses = (): string[] => [...el.shadowRoot!.querySelectorAll('.file-status')].map((s) => s.textContent ?? '');
    drop('a.txt', 'b.txt');
    el.setFileStatus(1, 'Uploaded');
    drop('c.txt');
    const afterAdd = statuses();
    // Remove a.txt: b.txt moves to row 0, and its status goes with it.
    const remove = el.shadowRoot!.querySelector('.file-item .file-remove') as HTMLElement & { rendered?: Promise<void> };
    await remove.rendered;
    (remove.shadowRoot!.querySelector('button') as HTMLElement).click();
    await window.__settled();
    return { afterAdd, afterRemove: statuses() };
  });
  expect(r).toEqual({ afterAdd: ['', 'Uploaded', ''], afterRemove: ['Uploaded', ''] });
});
