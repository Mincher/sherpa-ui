import { test, expect } from './harness';

/** sherpa-file-upload — drop zone + file list. Adding files fires files-change; remove works. */


test('renders a drop zone and mirrors accept/multiple to the input', async ({ page }) => {
  const r = await page.evaluate(async () => {
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

test('dropping files renders the list and fires files-change', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-file-upload') as HTMLElement & { rendered?: Promise<void> };
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;

    let count = -1;
    el.addEventListener('files-change', (e) => (count = (e as CustomEvent).detail.files.length));

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
    const el = document.createElement('sherpa-file-upload') as FileEl;
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['doc.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let count = -1;
    el.addEventListener('file-upload-start', (e) => (count = (e as CustomEvent).detail.files.length));
    (el.shadowRoot!.querySelector('.upload') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { count };
  });
  expect(r.count).toBe(1);
});

test('clear all empties the list and fires file-clear', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['a.txt', 'b.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let cleared = false;
    el.addEventListener('file-clear', () => (cleared = true));
    (el.shadowRoot!.querySelector('.clear-all') as HTMLElement).click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { cleared, rows: el.shadowRoot!.querySelectorAll('.file-item').length, hasFiles: el.hasAttribute('data-has-files') };
  });
  expect(r.cleared).toBe(true);
  expect(r.rows).toBe(0);
  expect(r.hasFiles).toBe(false);
});

test('removing a file fires file-remove with the removed file', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const el = document.createElement('sherpa-file-upload') as FileEl;
    el.setAttribute('data-multiple', '');
    document.getElementById('root')!.appendChild(el);
    await el.rendered;
    { const dt = new DataTransfer(); for (const n of ['keep.txt', 'drop.txt']) dt.items.add(new File(["x"], n, { type: "text/plain" })); el.shadowRoot!.querySelector(".drop-zone")!.dispatchEvent(new DragEvent("drop", { dataTransfer: dt, bubbles: true })); }
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    let removedName: string | null = null;
    el.addEventListener('file-remove', (e) => (removedName = (e as CustomEvent).detail.removed.name));
    const secondRemove = el.shadowRoot!.querySelectorAll('.file-remove')[1] as HTMLElement;
    secondRemove.click();
    await (window as unknown as { __settled: () => Promise<void> }).__settled();
    return { removedName, rows: el.shadowRoot!.querySelectorAll('.file-item').length };
  });
  expect(r.removedName).toBe('drop.txt');
  expect(r.rows).toBe(1);
});
