/**
 * FlowManager — Orchestrates CRUD dialog flows (add / edit / delete).
 *
 * Manages dialog open/close, flow lifecycle events (flow-start, flow-progress,
 * flow-complete, flow-cancel, flow-error), and toast feedback. Discovers DOM
 * elements via data-flow attributes on buttons and dialog refs you provide.
 *
 * @module flow-manager
 *
 * @example
 * import { FlowManager } from 'sherpa-ui/components/utilities/flow-manager.js';
 *
 * const flow = new FlowManager({
 *   entity: 'device',
 *   contentArea: document.querySelector('[data-dataset="devices"]'),
 *   dialogs: {
 *     addEdit: document.getElementById('device-dialog'),
 *     delete:  document.getElementById('delete-dialog'),
 *   },
 *   onSave:   async (values, flowType) => { ... },
 *   onDelete: async (ids) => { ... },
 * });
 */

import { SherpaToast } from '../sherpa-toast/sherpa-toast.js';

/**
 * @typedef {Object} FlowManagerOptions
 * @property {string} entity — Entity name (e.g. 'device', 'detection')
 * @property {HTMLElement} contentArea — The <sherpa-layout-grid> element for dispatching flow events
 * @property {Object} dialogs
 * @property {HTMLElement} [dialogs.addEdit] — Add/Edit dialog element (sherpa-dialog)
 * @property {HTMLElement} [dialogs.delete] — Delete confirmation dialog element (sherpa-dialog)
 * @property {function(Object, 'add'|'edit'): Promise<Object>} [onSave] — Called on save; receives form values and flow type, returns saved record
 * @property {function(Array): Promise<number>} [onDelete] — Called on delete confirm; receives array of IDs, returns count removed
 * @property {function(): void} [onRefresh] — Called after successful save or delete to refresh data
 * @property {Object} [labels] — Override default button/dialog labels
 * @property {string} [labels.addTitle] — Dialog title for add flow
 * @property {string} [labels.editTitle] — Dialog title for edit flow
 * @property {string} [labels.saveLabel] — Save button label for add flow
 * @property {string} [labels.updateLabel] — Save button label for edit flow
 * @property {string} [labels.deleteTitle] — Delete dialog title
 */

export class FlowManager {
  #entity;
  #contentArea;
  #addEditDialog;
  #deleteDialog;
  #onSave;
  #onDelete;
  #onRefresh;
  #labels;

  // State
  #editingRecord = null;
  #deleteTargetIds = [];

  // Cached refs
  #saveBtn = null;
  #cancelBtn = null;
  #confirmDeleteBtn = null;
  #cancelDeleteBtn = null;

  /**
   * @param {FlowManagerOptions} options
   */
  constructor(options) {
    this.#entity = options.entity;
    this.#contentArea = options.contentArea;
    this.#addEditDialog = options.dialogs?.addEdit ?? null;
    this.#deleteDialog = options.dialogs?.delete ?? null;
    this.#onSave = options.onSave ?? null;
    this.#onDelete = options.onDelete ?? null;
    this.#onRefresh = options.onRefresh ?? null;

    const cap = this.#capitalize(this.#entity);
    this.#labels = {
      addTitle: `Add ${cap}`,
      editTitle: `Edit ${cap}`,
      saveLabel: `Save ${cap}`,
      updateLabel: `Update ${cap}`,
      deleteTitle: `Delete ${cap}`,
      ...options.labels,
    };

    this.#wireAddEditDialog();
    this.#wireDeleteDialog();
  }

  /* ── Public API ──────────────────────────────────────────────── */

  /** Open the add/edit dialog in "add" mode with an empty form. */
  startAdd() {
    if (!this.#addEditDialog) return;
    this.#editingRecord = null;
    this.#addEditDialog.setAttribute('data-label', this.#labels.addTitle);
    if (this.#saveBtn) this.#saveBtn.setAttribute('data-label', this.#labels.saveLabel);
    this.#dispatch('flow-start', { flow: 'add', entity: this.#entity });
    this.#addEditDialog.show();
  }

  /**
   * Open the add/edit dialog in "edit" mode, pre-populated.
   * @param {Object} record — The existing record to edit
   */
  startEdit(record) {
    if (!this.#addEditDialog) return;
    this.#editingRecord = record;
    this.#addEditDialog.setAttribute('data-label', this.#labels.editTitle);
    if (this.#saveBtn) this.#saveBtn.setAttribute('data-label', this.#labels.updateLabel);
    this.#dispatch('flow-start', { flow: 'edit', entity: this.#entity, data: record });
    this.#addEditDialog.show();
  }

  /**
   * Open the delete confirmation dialog.
   * @param {Array} ids — Record identifiers to delete
   * @param {string} [message] — Override the confirmation message
   */
  startDelete(ids, message) {
    if (!this.#deleteDialog || !ids.length) return;
    this.#deleteTargetIds = ids;

    const callout = this.#deleteDialog.querySelector('sherpa-callout');
    if (callout && message) callout.textContent = message;

    const count = ids.length;
    this.#deleteDialog.setAttribute('data-label',
      count > 1 ? `${this.#labels.deleteTitle} (${count})` : this.#labels.deleteTitle
    );

    this.#dispatch('flow-start', { flow: 'delete', entity: this.#entity, data: { ids } });
    this.#deleteDialog.show();
  }

  /** @returns {'add'|'edit'} Current flow type based on editing state. */
  get flowType() {
    return this.#editingRecord ? 'edit' : 'add';
  }

  /** @returns {Object|null} The record currently being edited, or null for add. */
  get editingRecord() {
    return this.#editingRecord;
  }

  /** Clean up event listeners. */
  destroy() {
    // Listeners are on child elements of dialogs we were given,
    // so they'll be GC'd when dialogs are removed. No manual cleanup needed
    // unless we add document-level listeners in the future.
  }

  /* ── Private — wiring ────────────────────────────────────────── */

  #wireAddEditDialog() {
    if (!this.#addEditDialog) return;

    this.#saveBtn = this.#addEditDialog.querySelector('[slot="footer"][data-variant="primary"]');
    this.#cancelBtn = this.#addEditDialog.querySelector('[slot="footer"][data-variant="secondary"]');

    this.#saveBtn?.addEventListener('button-click', () => this.#handleSave());
    this.#cancelBtn?.addEventListener('button-click', () => this.#handleCancelAddEdit());
  }

  #wireDeleteDialog() {
    if (!this.#deleteDialog) return;

    this.#confirmDeleteBtn = this.#deleteDialog.querySelector('[slot="footer"][data-variant="primary"]');
    this.#cancelDeleteBtn = this.#deleteDialog.querySelector('[slot="footer"][data-variant="secondary"]');

    this.#confirmDeleteBtn?.addEventListener('button-click', () => this.#handleConfirmDelete());
    this.#cancelDeleteBtn?.addEventListener('button-click', () => this.#handleCancelDelete());
  }

  /* ── Private — handlers ──────────────────────────────────────── */

  async #handleSave() {
    if (!this.#onSave) {
      this.#addEditDialog?.hide();
      return;
    }

    const flowType = this.flowType;
    this.#dispatch('flow-progress', { flow: flowType, entity: this.#entity });

    try {
      const result = await this.#onSave(this.#editingRecord, flowType);
      this.#dispatch('flow-complete', { flow: flowType, entity: this.#entity, data: result });

      const cap = this.#capitalize(this.#entity);
      SherpaToast.success(flowType === 'edit'
        ? `${cap} updated.`
        : `${cap} created.`
      );

      this.#addEditDialog?.hide();
      this.#editingRecord = null;
      this.#onRefresh?.();
    } catch (err) {
      this.#dispatch('flow-error', { flow: flowType, entity: this.#entity, error: err.message });
      SherpaToast.critical(err.message || `Failed to save ${this.#entity}.`);
    }
  }

  #handleCancelAddEdit() {
    this.#dispatch('flow-cancel', { flow: this.flowType, entity: this.#entity });
    this.#addEditDialog?.hide();
  }

  async #handleConfirmDelete() {
    if (!this.#onDelete) {
      this.#deleteDialog?.hide();
      return;
    }

    this.#dispatch('flow-progress', { flow: 'delete', entity: this.#entity, data: { ids: this.#deleteTargetIds } });

    try {
      const result = await this.#onDelete(this.#deleteTargetIds);
      this.#deleteDialog?.hide();
      this.#dispatch('flow-complete', { flow: 'delete', entity: this.#entity, data: result });

      const count = typeof result === 'number' ? result : this.#deleteTargetIds.length;
      SherpaToast.success(`${count} ${this.#entity}(s) deleted.`);

      this.#deleteTargetIds = [];
      this.#onRefresh?.();
    } catch (err) {
      this.#dispatch('flow-error', { flow: 'delete', entity: this.#entity, error: err.message });
      SherpaToast.critical(err.message || `Failed to delete ${this.#entity}.`);
    }
  }

  #handleCancelDelete() {
    this.#dispatch('flow-cancel', { flow: 'delete', entity: this.#entity });
    this.#deleteDialog?.hide();
  }

  /* ── Private — helpers ───────────────────────────────────────── */

  #dispatch(name, detail) {
    this.#contentArea?.dispatchEvent(
      new CustomEvent(name, { bubbles: true, composed: true, detail })
    );
  }

  #capitalize(s) {
    return s.charAt(0).toUpperCase() + s.slice(1);
  }
}
