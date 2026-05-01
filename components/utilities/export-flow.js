/**
 * ExportFlow — Wires view-level and container-level export dialogs.
 *
 * Initialises the full export dialog for a content area and auto-wires
 * per-container "container-export" menu items to mini export dialogs.
 * Replaces ~70 lines of duplicated export boilerplate per view.
 *
 * @module export-flow
 *
 * @example
 * import { initExportFlow } from 'sherpa-ui/components/utilities/export-flow.js';
 *
 * initExportFlow(contentArea, {
 *   title: 'Device Management Export',
 *   buildExportDialog,          // from ExportDialogBuilder
 *   buildExportDialogForContainer,
 *   exportWithConfig,           // from ExportService
 * });
 */

/**
 * @typedef {Object} ExportFlowOptions
 * @property {string} [title] — Default title for the view-level export dialog
 * @property {function(HTMLElement, string): {dialog: HTMLElement, getConfig: function}} buildExportDialog
 * @property {function(HTMLElement): {dialog: HTMLElement, getConfig: function}} buildExportDialogForContainer
 * @property {function(Object): Promise<void>} exportWithConfig
 */

/**
 * Wire view-level and container-level export dialogs for a content area.
 * @param {HTMLElement} contentArea — The <sherpa-layout-grid> element
 * @param {ExportFlowOptions} options
 */
export function initExportFlow(contentArea, options) {
  if (!contentArea) return;

  const {
    title = 'Export',
    buildExportDialog,
    buildExportDialogForContainer,
    exportWithConfig,
  } = options;

  const containerDialogs = new Map();
  let viewDialog = null;

  // View-level export dialog
  if (buildExportDialog) {
    const { dialog, getConfig } = buildExportDialog(contentArea, title);
    viewDialog = dialog;
    document.body.appendChild(dialog);

    dialog.querySelector('.export-cancel-btn')
      ?.addEventListener('button-click', () => dialog.hide());

    dialog.querySelector('.export-confirm-btn')
      ?.addEventListener('button-click', async () => {
        const config = getConfig();
        dialog.hide();
        await exportWithConfig(config);
      });

    // Listen for viewexport from sherpa-view-header (bubbles + composed)
    document.addEventListener('view-export', () => {
      viewDialog?.show();
    });

    // Listen for gridexport from sherpa-data-grid (bubbles + composed)
    contentArea.addEventListener('grid-export', () => {
      viewDialog?.show();
    });
  }

  // Per-container export dialogs (wired via menu-item-click + data-event="container-export")
  if (buildExportDialogForContainer) {
    for (const container of contentArea.querySelectorAll('sherpa-container')) {
      if (!container.querySelector('[data-menu]')) continue;

      container.addEventListener('menu-item-click', (e) => {
        const menuItem = e.detail?.element;
        if (menuItem?.getAttribute('data-event') !== 'container-export') return;

        const key = container.getAttribute('data-title') || 'Container';

        if (!containerDialogs.has(key)) {
          const { dialog: miniDialog, getConfig } = buildExportDialogForContainer(container);
          containerDialogs.set(key, miniDialog);
          document.body.appendChild(miniDialog);

          miniDialog.querySelector('.export-cancel-btn')
            ?.addEventListener('button-click', () => miniDialog.hide());

          miniDialog.querySelector('.export-confirm-btn')
            ?.addEventListener('button-click', async () => {
              const config = getConfig();
              miniDialog.hide();
              await exportWithConfig(config);
            });
        }

        containerDialogs.get(key).show();
      });
    }
  }
}
