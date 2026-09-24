/** Settings › Accessibility. */
import { initSettingsPage } from './settings-page.js';

export async function init(root) {
  await initSettingsPage(root, { label: 'Accessibility' });
}
