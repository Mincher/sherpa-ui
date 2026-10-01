/**
 * examples/contexts/settings.js — every Settings Context, inside the Settings
 * overlay. One page each, a section header before each set of settings; the
 * header's Jump to chip scrolls to them.
 *
 * Map:
 * - init — wire one Settings page inside the overlay: each setting writes the app's session
 */
import { SherpaToast } from '../../dist/index.js';

/* Colour mode, density and the nav hierarchy are the APP's session values, so
   these write them there and the app's own subscribers paint. Each wires its
   own controls, and does nothing on a page without them. */
const WIRING = [
  async (root, session) => {
    const modes = root.querySelector('#mode-group');
    if (!modes) return;
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

  async (root, session) => {
    const density = root.querySelector('#density');
    if (!density) return;
    await density.populate([
      { value: 'compact', label: 'Compact', description: 'Tighter spacing for dense Contexts.' },
      { value: 'default', label: 'Default', description: 'The standard spacing.' },
      { value: 'comfortable', label: 'Comfortable', description: 'More room around everything.' },
    ]);
    density.value = session.get('/theme/density');
    density.addEventListener('change', (e) => {
      if (e.detail?.value) session.set('/theme/density', e.detail.value);
    });
  },

  async (root) => {
    const pageSize = root.querySelector('#page-size');
    if (!pageSize) return;
    await pageSize.populate(['10', '25', '50', '100'].map((value) => ({ value, label: value })));
    pageSize.value = '25';
  },

  (root, session) => {
    const hierarchy = root.querySelector('#nav-hierarchy');
    if (!hierarchy) return;
    hierarchy.checked = session.get('/nav/hierarchy');
    hierarchy.addEventListener('change', (e) => session.set('/nav/hierarchy', e.detail.checked));
  },

  // Experiments: TODO 143 and TODO 59. Each switch writes its own session key.
  (root, session) => {
    for (const [id, key] of [['#experiment-sticky-metrics', 'stickyMetrics'], ['#experiment-keep-content', 'keepContent']]) {
      const sw = root.querySelector(id);
      if (!sw) continue;
      sw.checked = session.get(`/experiments/${key}`);
      sw.addEventListener('change', (e) => session.set(`/experiments/${key}`, e.detail.checked));
    }
  },

  /* A draft per View: for the tab, and across sessions. The second means
     nothing without the first. TRAP T-a-view-keeps-a-draft */
  (root, session) => {
    const drafts = root.querySelector('#filters-drafts');
    const across = root.querySelector('#filters-drafts-across');
    if (!drafts || !across) return;
    const sync = () => {
      drafts.checked = session.get('/filters/drafts');
      across.checked = session.get('/filters/drafts') && session.get('/filters/draftsAcross');
      across.toggleAttribute('disabled', !session.get('/filters/drafts'));
    };
    sync();
    drafts.addEventListener('change', (e) => { session.set('/filters/drafts', e.detail.checked); sync(); });
    across.addEventListener('change', (e) => session.set('/filters/draftsAcross', e.detail.checked));
  },
];

/** `label` is the Context row's; `header` is the Settings overlay's own. */
export async function init(root, { session, label, header }) {
  await Promise.all(['sherpa-select-group', 'sherpa-quick-filter', 'sherpa-toast']
    .map((t) => customElements.whenDefined(t)));
  await Promise.all(WIRING.map((wire) => wire(root, session)));

  /* Jump to: one row per section header, read off the page so the two cannot
     disagree. A page of one section has nowhere to jump. */
  const jump = header?.querySelector('sherpa-quick-filter[data-type="jump"]');
  const sections = [...root.querySelectorAll('sherpa-section-header[id]')];
  if (jump) {
    jump.hidden = sections.length < 2;
    await jump.populate(sections.map((s) => ({ value: s.id, label: s.dataset.heading })));
  }

  const page = new AbortController();
  /* Only a page of typed values has a footer; the rest apply as they change. */
  root.querySelector('.cancel-btn')?.addEventListener('click', () => {
    SherpaToast.info('No changes were saved.', { duration: 3000 });
  }, { signal: page.signal });
  // sherpa-button is not form-associated, so Save submits the form itself.
  root.querySelector('.save-btn')?.addEventListener('click', () => {
    root.querySelector('form')?.requestSubmit();
  }, { signal: page.signal });
  root.querySelector('form')?.addEventListener('submit', (e) => {
    e.preventDefault();
    SherpaToast.success(`${label} saved`, { duration: 4000 });
  }, { signal: page.signal });

  return () => page.abort();
}
