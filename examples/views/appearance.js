/**
 * Settings › Appearance. Colour mode and density are the APP's session values,
 * so this page writes them there and the app's subscribers paint <html>.
 */
import { initSettingsPage } from './settings-page.js';

export async function init(root, { session }) {
  await Promise.all(['sherpa-select-group', 'sherpa-slider', 'sherpa-switch']
    .map((tag) => customElements.whenDefined(tag)));

  const modeGroup = root.querySelector('#mode-group');
  await modeGroup.populate([
    { value: 'light', label: 'Light', description: 'Bright, high-contrast surfaces.' },
    { value: 'dark',  label: 'Dark',  description: 'Dim surfaces for low light.' },
    { value: 'auto',  label: 'Auto',  description: 'Follow the operating system.' },
  ]);
  modeGroup.value = session.get('/theme/mode');
  modeGroup.addEventListener('change', (e) => {
    if (e.detail?.value) session.set('/theme/mode', e.detail.value);
  });

  const compact = root.querySelector('#sw-compact');
  compact.checked = session.get('/theme/density') === 'compact';
  compact.addEventListener('change', (e) => {
    session.set('/theme/density', (e.detail?.checked ?? compact.checked) ? 'compact' : 'default');
  });

  root.querySelector('#page-size').populate({ value: 30 });

  await initSettingsPage(root, { label: 'Appearance' });
}
