/**
 * examples/views/settings.js — the settings-form view's logic.
 *
 * Exported as init(root): populates the data-driven controls (theme radios,
 * slider) inside `root`, and wires the dark-mode / density switches, the theme
 * radios, and the cancel / save → SherpaToast flow. The shared nav/header live
 * once in index.html. Behaviour is identical to the old standalone settings.html.
 */
import { SherpaToast } from '../../dist/index.js';

export async function init(root) {
  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-select-group'),
    customElements.whenDefined('sherpa-slider'),
    customElements.whenDefined('sherpa-switch'),
    customElements.whenDefined('sherpa-toast'),
  ]);

  /* ── Shared header (lives in index.html) ──────────────────────── */
  const header = document.querySelector('sherpa-app-shell sherpa-app-header');
  header?.populate({
    breadcrumb: [
      // Every crumb links to a REAL page. The trail used to name sections
      // that do not exist ('Monitoring', 'Workspace') and point at dead `#`
      // anchors, so clicking one went nowhere.
      { label: 'Home', href: '?view=dashboard' },
      { label: 'Preferences' },
    ],
  });
  header?.setAttribute('data-heading', 'Settings');
  header?.setAttribute('data-icon', 'fa-solid fa-sliders');

  /* ── Populate the data-driven form controls ───────────────────── */
  const themeGroup = root.querySelector('#theme-group');
  themeGroup.populate([
    { value: 'light', label: 'Light', description: 'Bright, high-contrast surfaces.' },
    { value: 'dark',  label: 'Dark',  description: 'Dim surfaces for low light.' },
    { value: 'auto',  label: 'Auto',  description: 'Follow the operating system.' },
  ]);
  // Pre-select the current theme radio.
  themeGroup.value = 'light';

  root.querySelector('#page-size').populate({ value: 30 });

  /* ── Wire interactivity ───────────────────────────────────────── */

  // Dark-mode switch → flip <html data-mode> live.
  const darkSwitch = root.querySelector('#sw-dark');
  darkSwitch.addEventListener('change', (e) => {
    const dark = e.detail?.checked ?? darkSwitch.checked;
    document.documentElement.setAttribute('data-mode', dark ? 'dark' : 'light');
  });

  // Compact density switch → flip <html data-density> for a bonus live demo.
  root.querySelector('#sw-compact').addEventListener('change', (e) => {
    const on = e.detail?.checked ?? false;
    if (on) document.documentElement.setAttribute('data-density', 'compact');
    else document.documentElement.removeAttribute('data-density');
  });

  // Theme radios → keep the picked theme in sync (demo only).
  themeGroup.addEventListener('change', (e) => {
    console.log('theme →', e.detail?.value);
  });

  // Cancel → info toast.
  root.querySelector('#cancel-btn').addEventListener('click', () => {
    SherpaToast.info('No changes were saved.', { duration: 3000 });
  });

  // Save (form submit) → success toast summarising the form.
  const form = root.querySelector('#settings-form');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const theme = themeGroup.value ?? 'light';
    const perPage = root.querySelector('#page-size').value ?? '30';
    const features = root.querySelector('#features').value ?? [];
    SherpaToast.success('Settings saved', { duration: 4000 });
    console.log('saved →', { theme, perPage, features });
  });
}
