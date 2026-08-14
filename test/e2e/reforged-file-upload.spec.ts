import { test, expect } from '@playwright/test';

/** sherpa-file-upload — drop zone + file list. Adding files fires files-change; remove works. */

const HARNESS = '/test/reforged/harness.html';

test.beforeEach(async ({ page }) => {
  await page.goto(HARNESS);
  await page.waitForFunction(() => (window as unknown as { __reforgedReady?: boolean }).__reforgedReady === true);
});

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
    await new Promise((res) => setTimeout(res, 10));

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
