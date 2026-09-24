/**
 * examples/views/settings-page.js — what the three Settings pages share: the
 * header (a trail and a lone View chip) and the Cancel / Save → toast flow.
 */
import { SherpaToast } from '../../dist/index.js';

export async function initSettingsPage(root, { label, onSave }) {
  await Promise.all(['sherpa-app-header', 'sherpa-toast']
    .map((tag) => customElements.whenDefined(tag)));

  const header = document.querySelector('sherpa-app-shell sherpa-app-header');
  await header?.populate({
    breadcrumb: [
      { label: 'Home', href: '?view=dashboard' },
      { label: 'Settings' },
      { label },
    ],
    // Settings pages have no data to filter, so the View chip is the whole bar.
    filters: [{
      id: 'view', label: 'View', persistent: true, active: true, select: 'single',
      options: [{ value: 'default', label: 'Default', selected: true }],
    }],
  });

  root.querySelector('.cancel-btn')?.addEventListener('click', () => {
    SherpaToast.info('No changes were saved.', { duration: 3000 });
  });
  root.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    onSave?.();
    SherpaToast.success(`${label} saved`, { duration: 4000 });
  });
}
