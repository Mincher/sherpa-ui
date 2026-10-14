import { test, expect } from './harness';

/**
 * A page opens a dialog from MARKUP — `commandfor` / `command`, the platform's
 * invoker commands — with no script. The button's real <button> is in its
 * shadow root, where an id cannot reach the page; it carries the ELEMENT.
 * TRAP T-a-button-commands-by-markup
 */
test('a button opens a dialog and a panel, and a button in the dialog shuts it — all by markup', async ({ page }) => {
  const r = await page.evaluate(async () => {
    // The button comes BEFORE what it commands, as a page writes it.
    document.getElementById('root')!.innerHTML = '<sherpa-button id="open" commandfor="d" command="--show">Edit</sherpa-button>'
      + '<sherpa-button id="peek" commandfor="p" command="--show">Peek</sherpa-button>'
      + '<sherpa-dialog id="d" data-heading="Edit"><p>Body</p>'
      + '<sherpa-container-footer slot="footer"><sherpa-button id="shut" commandfor="d" command="--hide">Close</sherpa-button>'
      + '</sherpa-container-footer></sherpa-dialog>'
      + '<sherpa-overlay-panel id="p" data-heading="Details"></sherpa-overlay-panel>';
    const press = async (id: string): Promise<void> => {
      document.getElementById(id)!.shadowRoot!.querySelector('button')!.click();
      await window.__settled();
    };
    const open = (id: string): boolean => (document.getElementById(id) as HTMLElement & { open: boolean }).open;
    await Promise.all([...document.querySelectorAll('sherpa-button, sherpa-dialog, sherpa-overlay-panel')]
      .map((el) => (el as HTMLElement & { rendered: Promise<void> }).rendered));
    await press('open');
    const shown = open('d');
    await press('shut');
    const shut = open('d');
    await press('peek');
    return { shown, shut, peek: open('p') };
  });
  expect(r).toEqual({ shown: true, shut: false, peek: true });
});
