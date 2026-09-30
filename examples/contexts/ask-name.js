/**
 * ask-name.js — ask for a NAME in the page's own sherpa-dialog, never the
 * browser's `prompt()`. Will, 2026-09-25.
 *
 * Map:
 * - namePrompt — wire one Name dialog; returns ask(value), which resolves the name, or null
 * - confirmPrompt — wire one Confirm dialog; returns ask(question), which resolves true or false
 * - resetPrompt — wire the Reset all dialog; returns ask(), which resolves null, or the name to save under first
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
  dialog.addEventListener('dialog-close', () => answer(null), { signal });

  return (value = '') => new Promise((resolve) => {
    answer(null);
    waiting = resolve;
    if (field) field.value = value;
    dialog.show();
    field?.focus();
  });
}

/**
 * The dialog holds ONE `<p>` and a footer of Cancel, then the action. Each ask
 * names its heading, its words, its action, and whether it is critical.
 */
export function confirmPrompt(dialog, signal) {
  const text = dialog.querySelector('p');
  const [cancel, ok] = dialog.querySelectorAll('sherpa-container-footer sherpa-button');
  let waiting = null;
  const answer = (yes) => {
    const done = waiting;
    waiting = null;
    done?.(yes);
  };
  ok?.addEventListener('button-click', () => { answer(true); dialog.close(); }, { signal });
  cancel?.addEventListener('button-click', () => dialog.close(), { signal });
  dialog.addEventListener('dialog-close', () => answer(false), { signal });

  return ({ heading, words, action, critical = false }) => new Promise((resolve) => {
    answer(false);
    waiting = resolve;
    dialog.dataset.heading = heading;
    dialog.toggleAttribute('data-status', critical);
    if (critical) dialog.dataset.status = 'critical';
    if (text) text.textContent = words;
    if (ok) ok.textContent = action;
    dialog.show();
  });
}

/**
 * The Reset all dialog: a `<p>`, a switch that shows ONE name field, and a
 * footer of Cancel, then the action. It resolves null for no; else `{ save }`
 * — the name to keep the filters under first, or null. With the switch on a
 * name is needed: the action with none leaves the dialog open. TODO 129.
 */
export function resetPrompt(dialog, signal) {
  const toggle = dialog.querySelector('sherpa-switch');
  const field = dialog.querySelector('sherpa-input-text');
  const [cancel, ok] = dialog.querySelectorAll('sherpa-container-footer sherpa-button');
  let waiting = null;
  const answer = (value) => {
    const done = waiting;
    waiting = null;
    done?.(value);
  };
  const saving = () => !!toggle?.checked;
  const reveal = () => {
    if (!field) return;
    field.hidden = !saving();
    if (saving()) field.focus();
  };
  const commit = () => {
    if (!waiting) return;
    const name = String(field?.value ?? '').trim();
    if (saving() && !name) {
      field?.setAttribute('data-error', 'Enter a name to save the filters under.');
      field?.focus();
      return;
    }
    answer({ save: saving() ? name : null });
    dialog.close();
  };
  toggle?.addEventListener('change', reveal, { signal });
  ok?.addEventListener('button-click', commit, { signal });
  cancel?.addEventListener('button-click', () => dialog.close(), { signal });
  field?.addEventListener('input', () => field.removeAttribute('data-error'), { signal });
  field?.addEventListener('keydown', (e) => { if (e.key === 'Enter') commit(); }, { signal });
  dialog.addEventListener('dialog-close', () => answer(null), { signal });

  return () => new Promise((resolve) => {
    answer(null);
    waiting = resolve;
    // Off each time: a save is asked for, never left on.
    if (toggle) toggle.checked = false;
    if (field) {
      field.value = '';
      field.removeAttribute('data-error');
    }
    reveal();
    dialog.show();
  });
}
