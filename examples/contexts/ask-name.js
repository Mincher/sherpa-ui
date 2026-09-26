/**
 * ask-name.js — ask for a NAME in the page's own sherpa-dialog, never the
 * browser's `prompt()`. Will, 2026-09-25.
 *
 * Map:
 * - namePrompt — wire one Name dialog; returns ask(value), which resolves the name, or null
 */

/**
 * The dialog holds ONE `sherpa-input-text` and a footer of Cancel, then Save.
 * A name is needed: Save with none leaves the dialog open.
 */
export function namePrompt(dialog, signal) {
  const field = dialog.querySelector('sherpa-input-text');
  const [cancel, save] = dialog.querySelectorAll('sherpa-container-footer sherpa-button');
  /** Who waits for the open dialog's answer. */
  let waiting = null;
  const answer = (name) => {
    const done = waiting;
    waiting = null;
    done?.(name);
  };
  const commit = () => {
    const name = String(field?.value ?? '').trim();
    if (!name || !waiting) return;
    answer(name);
    dialog.close();
  };
  save?.addEventListener('button-click', commit, { signal });
  cancel?.addEventListener('button-click', () => dialog.close(), { signal });
  field?.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); }, { signal });
  // Cancel, Escape or the backdrop: no name.
  dialog.addEventListener('close', () => answer(null), { signal });

  return (value = '') => new Promise((resolve) => {
    answer(null);
    waiting = resolve;
    if (field) field.value = value;
    dialog.show();
    field?.focus();
  });
}
