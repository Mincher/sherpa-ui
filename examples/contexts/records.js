/**
 * records.js — the Records Context: a customer grid, its filters, and CRUD.
 *
 * The router opens its data and filters from `records.json`; this module keeps
 * the page's own work. The nav and the header are shared and live in index.html.
 *
 * Map:
 * - init — wire this Context's own work over the source it is handed — add, edit, delete, save; returns its teardown
 */
import {
  SherpaToast, persistView, reduceRows, saveFilterAs, deleteSavedFilter, labelId, matchesFilter,
} from '../../dist/index.js';
import { namePrompt } from './ask-name.js';
import { plans, customerOrgs } from './records-data.js';

/* THE PAGE IS ITS DEFINITION: the router opened records.json — every field,
   scope, hold and saved filter, the grid's configuration, the header's chips
   and the kept Query — and hands over the source. TRAP T-a-page-is-its-definition */
export async function init(root, { source }) {
  const store = source.store;
  const grid      = root.querySelector('#grid');
  const qft       = root.querySelector('#qft');
  const dialog    = root.querySelector('#dialog');
  const planGroup = root.querySelector('#f-plan');
  const custField = root.querySelector('#f-customer');
  /* The FILTER PANEL lives in the app shell, not in this Context's markup:
     it is app chrome, and the shell owns where a panel sits beside the
     content. TRAP T-the-shell-owns-the-panel-areas */
  const panel       = document.querySelector('sherpa-app-shell #filter-panel');
  const confirm     = root.querySelector('#confirm');
  const confirmText = root.querySelector('#confirm-text');

  /* Shared nav + header (live in index.html). */
  const header = document.querySelector('sherpa-app-shell > sherpa-app-header');
  const headerBar = header?.querySelector('sherpa-quick-filter-toolbar[slot="filters"]');

  await Promise.all([
    customElements.whenDefined('sherpa-app-header'),
    customElements.whenDefined('sherpa-data-grid'),
    customElements.whenDefined('sherpa-quick-filter-toolbar'),
    customElements.whenDefined('sherpa-toolbar'),
    customElements.whenDefined('sherpa-pagination'),
    customElements.whenDefined('sherpa-dialog'),
    customElements.whenDefined('sherpa-select-group'),
    customElements.whenDefined('sherpa-toast'),
  ]);

  /* No trail: moving between Contexts is the NAV's to show. A crumb is for a
     workflow or a drilldown. Will, 2026-09-26. */
  await header?.populate({ breadcrumb: [] });

  /* Plan radio group in the dialog. */
  planGroup.populate(plans.map((p) => ({ value: p.toLowerCase(), label: p })));

  /* The SAME organisations the Customer chip offers, so a record can never be
     saved against one the filter does not know.
     TRAP T-a-chip-filters-the-values-the-data-has */
  custField.populate(customerOrgs.map((v) => ({ value: v, label: v })));

  /* ONE AbortController for the whole Context — every bind and listener takes
     its `signal`. Without a teardown the source keeps pushing rows into
     components the router has already removed. */
  const page = new AbortController();
  const signal = page.signal;

  /** The bar that holds a scope's saved filters. */
  const barFor = (scope) => (scope === 'view' ? headerBar : qft);

  /* SAVED FILTERS FROM THE PANEL, which answers for the bar in panel mode.
     Each is a REQUEST, as Add and Remove are: the BAR owns the list.
     TRAP T-the-panel-saves-a-whole-scope */
  panel?.setAttribute('data-saveable', '');
  signal.addEventListener('abort', () => panel?.removeAttribute('data-saveable'), { once: true });
  panel?.addEventListener('filter-save', (e) => void saveAndPack(e.detail), { signal });
  panel?.addEventListener('filter-edit', (e) => void barFor(e.detail.scope)?.unpackFilter?.(e.detail.id), { signal });
  panel?.addEventListener('filter-delete', (e) => barFor(e.detail.scope)?.deleteFilter?.(e.detail.id), { signal });

  /* THE SOURCE, REACHABLE — `debugState()` answers a filter bug in one paste.
     Example app only: a library never writes to `window`.
     TRAP T-a-bug-report-should-be-a-paste */
  window.sherpa = { ...(window.sherpa ?? {}), source, store };

  /* The GAUGE alone is bound by hand: it shows RISK, not health, so low reads
     green on the left as every other gauge does. Every row, never a page.
     TRAP T-a-summary-binds-to-all-the-rows · TRAP T-an-aggregate-returns-the-number */
  const gauge = root.querySelector('#r-gauge');
  if (gauge) source.bind(gauge, { readonly: true, rows: 'all', signal, as: (rows) => 100 - reduceRows(rows, 'mean', 'health') });

  /* SAVE PACKS: the bar asks, this page names the filter and keeps it over the
     CUSTOMER records — not over this page — and the bar shows it in place of
     the fields it came from. TRAP T-save-packs-the-fields-into-one-chip
     TRAP T-a-saved-filter-lives-with-its-data */
  const askFilterName = namePrompt(root.querySelector('#save-filter'), signal);
  /** ASK for the name in the page's own dialog. True once it is saved. */
  const saveAndPack = async ({ readings, label: was }) => {
    // After an Edit the old name is offered, so the same name updates it.
    const label = await askFilterName(was ?? '');
    if (!label) return false;
    saveFilterAs('customers', label, readings);
    source.declarePreset(`custom:${labelId(label)}`, readings, { label, editable: true });
    qft.packFilter({ id: `custom:${labelId(label)}`, label, readings });
    return true;
  };
  qft.addEventListener('filter-save', (e) => void saveAndPack(e.detail), { signal });
  // DELETE: the bar has let it go; this page forgets it. TRAP T-edit-unpacks-a-saved-filter
  qft.addEventListener('filter-delete', (e) => {
    deleteSavedFilter('customers', e.detail.id.replace(/^custom:/, ''));
    source.declarePreset(e.detail.id, undefined);
  }, { signal });

  /* THE GRID'S SELECTION across a reload. Only that: the provider keeps the
     Query — its filter AND its arrangement — so a second keeper here would
     put an old sort over a View's. TRAP T-a-reload-replays-the-readers-answers */
  persistView('records', { source, elements: { grid } }, {
    grid: () => ({ select: [grid.selectedKeys] }),
  }, { source: false, signal });

  await source.load();

  /* ROW ACTIONS — the grid REPORTS an action; this view decides what it means.
     A grid that deleted the row itself would own state the store owns. */

  /** The record being edited, or null for a new one. */
  let editing = null;

  /** Open the dialog for one record, or for a new one when given nothing. */
  const form = root.querySelector('#customer-form');
  const openDialog = (record) => {
    editing = record ? record.email : null;
    dialog.dataset.heading = record ? 'Edit customer' : 'Add customer';
    // A clean form: the last save's values and errors go.
    form.reset();
    root.querySelector('#f-name').value = record?.name ?? '';
    root.querySelector('#f-email').value = record?.email ?? '';
    // Always written, so a second open never inherits the last record's org.
    custField.value = record?.customer ?? customerOrgs[0];
    // show(), not the native showModal() — the component owns modality and the
    // `open` attribute.
    dialog.show();
  };

  /**
   * Delete records, after the reader has confirmed.
   *
   * Failure is caught PER RECORD, so a bulk delete that fails halfway says what
   * happened. The screen is never updated by hand: the store announces its own
   * change and every bound view reloads, so a record that did NOT delete stays.
   *
   * TRAP T-a-failed-mutation-must-reach-the-reader.
   */
  const deleteRecords = async (records) => {
    const failed = [];
    for (const record of records) {
      try {
        await store.remove(record.email);
      } catch (err) {
        failed.push({ record, err });
      }
    }

    const gone = records.length - failed.length;
    // The record the details panel shows is gone: shut it.
    if (records.some((r) => r.email === grid.currentKey && !failed.some((f) => f.record === r))) details?.hide();
    // KEEP what refused, so the reader can try those again; a full success
    // clears the selection, because `select([])` is a clear.
    grid.select(failed.map((f) => f.record.email));

    if (gone) {
      SherpaToast.success(
        gone === 1 ? `${records[0].name} deleted` : `${gone} customers deleted`,
        { value: 'The store announced the change; every bound view reloaded.' },
      );
    }
    if (failed.length) {
      // With the reason: a failure the reader cannot see is a record they think
      // is gone.
      const first = failed[0];
      SherpaToast.critical(
        failed.length === 1
          ? `Could not delete ${first.record.name}`
          : `Could not delete ${failed.length} of ${records.length} customers`,
        { value: String(first.err?.message ?? first.err ?? 'The store refused the change.') },
      );
    }
  };

  /** Held in a closure, not on the dialog: the dialog is the question. */
  let pendingDelete = [];

  const askToDelete = (records) => {
    if (!records.length) return;
    pendingDelete = records;
    confirm.dataset['heading'] =
      records.length === 1 ? 'Delete customer?' : `Delete ${records.length} customers?`;
    // NAMED, not counted, when there is one — "Delete 1 customer?" is not a
    // question the reader can answer.
    confirmText.textContent = records.length === 1
      ? `${records[0].name} will be permanently deleted. This cannot be undone.`
      : `${records.length} customers will be permanently deleted. This cannot be undone.`;
    confirm.show();
  };

  root.querySelector('#confirm-cancel')?.addEventListener('click', () => {
    pendingDelete = [];
    confirm.close();
  }, { signal });

  root.querySelector('#confirm-delete')?.addEventListener('click', () => {
    const records = pendingDelete;
    pendingDelete = [];
    // SHUT FIRST: the mutation reloads every bound view, and a modal left open
    // over a grid rebuilding beneath it reads as stuck.
    confirm.close();
    void deleteRecords(records);
  }, { signal });

  /** One place both surfaces route through, so they cannot behave differently. */
  const runAction = (id, records) => {
    if (!records.length) return;
    if (id === 'edit') openDialog(records[0]);
    // ASK, never delete outright. The awaiting happens after the reader answers.
    if (id === 'delete') askToDelete(records);
  };

  grid.addEventListener('row-action', (e) => {
    runAction(e.detail.id, e.detail.records ?? []);
  }, { signal });

  /* DETAILS: the current row opens its record in the app's details panel. A
     drilldown, so the header's trail names it; its first crumb shuts it.
     TRAP T-a-current-row-opens-its-details */
  const details = document.getElementById('details');
  const detailFields = details?.querySelector('.details-fields');
  const steps = [...(details?.querySelectorAll('.details-step') ?? [])];
  const NUMBER = new Intl.NumberFormat();
  // UTC: a date-only value is midnight UTC, and a local zone would show the day before.
  const DAY = new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeZone: 'UTC' });
  /** A value as a reader reads it, by its field's declared type. */
  const shown = (field, value) => {
    const { type, labels } = source.fieldFacts(field);
    if (value == null || value === '') return '—';
    if (type === 'number') return NUMBER.format(Number(value));
    const day = type === 'date' ? new Date(String(value)) : null;
    if (day && !Number.isNaN(day.valueOf())) return DAY.format(day);
    return labels?.[value] ?? String(value);
  };
  /** Draw a record in the panel: every declared field, under its label. */
  const drawDetails = (record) => {
    details.dataset.heading = String(record.name ?? '');
    detailFields?.populate(Object.keys(record)
      .filter((field) => source.fieldFacts(field).label)
      .map((field) => ({ key: source.fieldFacts(field).label, value: shown(field, record[field]) })));
    for (const step of steps) step.toggleAttribute('disabled', !grid.neighbour(Number(step.dataset.by)));
  };
  const showDetails = (record) => {
    if (!record || !details) return;
    drawDetails(record);
    void header?.populate({ breadcrumb: [
      { label: header.getAttribute('data-heading') || 'Records', href: location.search },
      { label: String(record.name ?? '') },
    ] });
    details.show();
  };
  grid.addEventListener('row-select', (e) => showDetails(e.detail.row), { signal });
  for (const step of steps) {
    step.addEventListener('button-click', () => showDetails(grid.stepCurrent(Number(step.dataset.by))), { signal });
  }
  details?.addEventListener('panel-close', () => void header?.populate({ breadcrumb: [] }), { signal });
  document.addEventListener('breadcrumb-select', (e) => {
    if (e.detail.index === 0 && details?.open) details.hide();
  }, { signal });
  // An edit reloads the rows: redraw the record from them, if it is still on the page.
  source.addEventListener('change', () => {
    const record = details?.open ? grid.current : null;
    if (record) drawDetails(record);
  }, { signal });

  /* THE BULK BAR. `grid.actionsFor(count)` is the row menu's own list, narrowed
     to what survives a multi-row selection — so Edit disappears the moment a
     second row is ticked, without this view knowing why. */
  const bulkCount = root.querySelector('#bulk-count');
  const bulkActions = root.querySelector('#bulk-actions');

  grid.addEventListener('selection-change', () => {
    const records = grid.selectedRecords;
    bulkCount.hidden = records.length === 0;
    bulkCount.textContent = `${records.length} selected`;

    bulkActions.replaceChildren();
    for (const action of grid.actionsFor(records.length)) {
      const button = document.createElement('sherpa-button');
      /* TRANSPARENT: a bulk bar sits ON a surface, so a bordered button draws
         a box inside a box. `ghost` is not a look this system has — both
         branches of a dead ternary said it, so every bulk action fell back to
         the default and wore a grey border. */
      button.dataset.look = 'transparent';
      if (action.danger) button.dataset.status = 'critical';
      if (action.icon) button.dataset.iconStart = action.icon;
      button.textContent = action.label;
      button.addEventListener('button-click', () => {
        runAction(action.id, grid.selectedRecords);
      });
      bulkActions.appendChild(button);
    }
  }, { signal });

  // Dialog open/close + save → toast.
  root.querySelector('#add-btn').addEventListener('button-click', () => openDialog(null));
  root.querySelector('#cancel-btn').addEventListener('button-click', () => dialog.close());

  /* SAVE SUBMITS THE FORM: the browser checks every required field, shows
     its message and focuses the first one wrong — and fires `submit` only
     when all pass. No field is filled in for the reader. TODO 61
     TRAP T-a-form-value-follows-every-write */
  root.querySelector('#save-btn').addEventListener('button-click', () => form.requestSubmit(), { signal });
  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get('name'));
    const email = String(data.get('email'));
    const customer = String(data.get('customer'));
    const plan = String(data.get('plan') ?? '');

    /* EDIT or ADD through one form. `editing` holds the key from the row's
       Edit action; update MERGES, so the rest of the record survives. The store
       announces the change, and every bound view reloads. */
    if (editing) {
      const saved = await store.update(editing, { name, email, customer });
      editing = null;
      dialog.close();
      SherpaToast.success(`${saved.name} updated`, { value: 'The record was saved.' });
      return;
    }

    const created = new Date().toISOString().slice(0, 10);
    const record = await store.insert({
      name,
      email,
      customer,
      status: 'trial',
      plan: plan ? plan[0].toUpperCase() + plan.slice(1) : 'Free',
      region: 'EMEA',
      tier: 'Bronze',
      owner: 'Unassigned',
      seats: 1,
      spend: 0,
      openTickets: 0,
      health: 100,
      created,
      lastSeen: created,
    });

    dialog.close();
    // SAY WHERE IT WENT: a new record the page's filters hide reads as a save
    // that did nothing. TODO 61
    SherpaToast.success(`${name} saved`, {
      value: matchesFilter(record, source.state.filter)
        ? 'The customer record was created.'
        : 'The customer record was created. The filters on this page hide it.',
    });
  }, { signal });

  /* The teardown the router calls when it swaps away. ONE abort ends every
     binding, the persister and the view picker. */
  return () => {
    page.abort();
    details?.hide();
  };
}
