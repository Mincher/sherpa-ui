/**
 * examples/contexts/settings.js — every Settings Context, inside the Settings
 * overlay. Its header carries the View chip alone; a picked View swaps the one
 * container.
 */
import { SherpaToast, onViewPicked, viewOptions } from '../../dist/index.js';
import { SETTINGS_VIEWS } from './settings-views.js';

/* Colour mode and density are the APP's session values, so these write them
   there and the app's own subscribers paint <html>. Keyed by View id. */
const WIRING = {
  async theme(region, session) {
    await customElements.whenDefined('sherpa-select-group');
    const modes = region.querySelector('#mode-group');
    await modes.populate([
      { value: 'light', label: 'Light', description: 'Bright, high-contrast surfaces.' },
      { value: 'dark',  label: 'Dark',  description: 'Dim surfaces for low light.' },
      { value: 'auto',  label: 'Auto',  description: 'Follow the operating system.' },
    ]);
    modes.value = session.get('/theme/mode');
    modes.addEventListener('change', (e) => {
      if (e.detail?.value) session.set('/theme/mode', e.detail.value);
    });
  },

  async layout(region, session) {
    await customElements.whenDefined('sherpa-select-group');
    const density = region.querySelector('#density');
    await density.populate([
      { value: 'compact', label: 'Compact', description: 'Tighter spacing for dense Contexts.' },
      { value: 'default', label: 'Default', description: 'The standard spacing.' },
      { value: 'comfortable', label: 'Comfortable', description: 'More room around everything.' },
    ]);
    density.value = session.get('/theme/density');
    density.addEventListener('change', (e) => {
      if (e.detail?.value) session.set('/theme/density', e.detail.value);
    });
    const pageSize = region.querySelector('#page-size');
    await pageSize.populate(['10', '25', '50', '100'].map((value) => ({ value, label: value })));
    pageSize.value = '25';
  },
};

/** `label` is the Context row's; `header` is the Settings overlay's own. */
export async function init(root, { session, context, label, header }) {
  await Promise.all(['sherpa-app-header', 'sherpa-toast'].map((t) => customElements.whenDefined(t)));
  const views = SETTINGS_VIEWS[context];
  const first = Object.keys(views)[0];
  const region = root.querySelector('#view-region');

  await header?.populate({
    // Settings has no data to filter, so the View chip is the whole bar.
    filters: [{
      id: 'view', label: 'View', persistent: true, active: true, select: 'single',
      options: viewOptions(views),
    }],
  });

  // The first View is the template's markup, already on screen.
  await WIRING[first]?.(region, session);

  const page = new AbortController();
  onViewPicked(header, views, { elements: { header } }, {
    into: region,
    applied: first,
    signal: page.signal,
    /* A View with content is FRESH markup, so it is wired every time. The first
       one is re-attached, not rebuilt, and keeps its listeners. */
    after: ({ id, view }) => { if (view.content) void WIRING[id]?.(region, session); },
  });

  root.querySelector('.cancel-btn')?.addEventListener('click', () => {
    SherpaToast.info('No changes were saved.', { duration: 3000 });
  }, { signal: page.signal });
  root.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    SherpaToast.success(`${label} saved`, { duration: 4000 });
  }, { signal: page.signal });

  return () => page.abort();
}
