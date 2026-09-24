/** Settings › User Profile. */
import { initSettingsPage } from './settings-page.js';

export async function init(root) {
  await initSettingsPage(root, { label: 'User Profile' });
}
