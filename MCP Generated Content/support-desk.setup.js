// @ts-nocheck
// support-desk.setup.js — populates the Support Desk page and wires the
// Add-ticket dialog up to a confirmation toast.
//
// The page does not render its own <sherpa-view-header>. The setup
// script configures the docs shell's view-header (the one in
// index.html that is a child of <sherpa-layout-grid>) via
// globalThis.docsView.setHeading / setTitleIcon / setActions. The
// "New ticket" trigger lives in the section-header's actions slot so
// it stays inside the page root and the existing id-based wiring keeps
// working.

const TICKET_COLS = [
  { field: 'id',         name: 'ID',         type: 'string' },
  { field: 'subject',    name: 'Subject',    type: 'string' },
  { field: 'severity',   name: 'Severity',   type: 'string' },
  { field: 'channel',    name: 'Channel',    type: 'string' },
  { field: 'assignee',   name: 'Assignee',   type: 'string' },
  { field: 'sla',        name: 'SLA',        type: 'string' },
  { field: 'opened',     name: 'Opened',     type: 'string' },
];

const TICKETS = [
  { id: 'TCK-4921', subject: 'Cannot log in after password reset',          severity: 'P1', channel: 'email',  assignee: 'A. Patel',   sla: '00:42', opened: '08:14' },
  { id: 'TCK-4922', subject: 'API 504 on /v1/invoices',                     severity: 'P1', channel: 'portal', assignee: 'unassigned', sla: '00:18', opened: '08:38' },
  { id: 'TCK-4923', subject: 'Invoice missing VAT line',                    severity: 'P3', channel: 'email',  assignee: 'M. Olsen',   sla: '3 d',   opened: '09:02' },
  { id: 'TCK-4924', subject: 'SSO loop on Okta test tenant',                severity: 'P2', channel: 'chat',   assignee: 'A. Patel',   sla: '1:12',  opened: '09:18' },
  { id: 'TCK-4925', subject: 'CSV export truncated at 10k rows',            severity: 'P2', channel: 'portal', assignee: 'S. García',  sla: '2:01',  opened: '09:23' },
  { id: 'TCK-4926', subject: 'Webhook deliveries dropped (last 4 h)',       severity: 'P2', channel: 'portal', assignee: 'unassigned', sla: '0:54',  opened: '09:31' },
  { id: 'TCK-4927', subject: 'Need to add 2FA for sub-account',              severity: 'P3', channel: 'phone',  assignee: 'M. Olsen',   sla: '4 d',   opened: '09:44' },
  { id: 'TCK-4928', subject: 'Mobile app stuck on splash (iOS 17.5)',        severity: 'P3', channel: 'email',  assignee: 'J. Park',    sla: '1 d',   opened: '10:02' },
  { id: 'TCK-4929', subject: 'Refund requested — duplicate charge',         severity: 'P2', channel: 'email',  assignee: 'S. García',  sla: '1:28',  opened: '10:14' },
  { id: 'TCK-4930', subject: 'Dark mode resets on every refresh',           severity: 'P3', channel: 'portal', assignee: 'A. Patel',   sla: '2 d',   opened: '10:21' },
  { id: 'TCK-4931', subject: 'GraphQL rate limit too aggressive for plan',  severity: 'P2', channel: 'chat',   assignee: 'J. Park',    sla: '1:46',  opened: '10:33' },
  { id: 'TCK-4932', subject: 'Bulk-import mapping: dropdown misaligned',     severity: 'P3', channel: 'portal', assignee: 'unassigned', sla: '3 d',   opened: '10:48' },
];

const q = (root, sel) => root.querySelector(sel);

export default {
  'support-desk-page': async (outlet) => {
    // Configure the docs shell's view-header (sole view-header on page).
    const view = globalThis.docsView;
    view.setHeading('Tickets', [
      { label: 'Support', href: '#/' },
      { label: 'Queue' },
    ]);
    view.setTitleIcon('<span class="fa-solid fa-headset sherpa-icon" aria-hidden="true"></span>');
    // Page actions (other than the New-ticket button which lives in the
    // section-header's actions slot) could go here; none in this page.
    view.setActions('');

    const all = outlet.querySelectorAll('*');
    await Promise.all(
      [...all]
        .filter(el => el.tagName?.startsWith('SHERPA-') && el.rendered)
        .map(el => el.rendered)
    );

    const grid = q(outlet, 'sherpa-data-grid');
    grid?.setData?.({ columns: TICKET_COLS, rows: TICKETS });

    // Wire New-ticket dialog: clicking the section-header button opens
    // the dialog, the dialog's confirm button dispatches a success toast.
    const openBtn   = q(outlet, '#new-ticket-btn');
    const dialog    = q(outlet, '#new-ticket-dialog');
    const submitBtn = q(outlet, '#new-ticket-submit');
    const cancelBtn = q(outlet, '#new-ticket-cancel');

    openBtn?.addEventListener?.('button-click', () => dialog?.show?.());
    cancelBtn?.addEventListener?.('button-click', () => dialog?.hide?.());
    submitBtn?.addEventListener?.('button-click', () => {
      dialog?.hide?.();
      // sherpa-toast is a static-factory component — fire a global toast.
      document.dispatchEvent(
        new CustomEvent('sherpa-toast', {
          detail: { status: 'success', label: 'Ticket created', value: 'Assigned to triage queue.' },
        })
      );
      // Also append a visible toast element to the outlet (fallback if the
      // global factory isn't bound).
      const toast = document.createElement('sherpa-toast');
      toast.setAttribute('data-status', 'success');
      toast.setAttribute('data-label', 'Ticket created');
      toast.setAttribute('data-value', 'TCK-4933 added to the Open queue.');
      toast.setAttribute('data-duration', '4000');
      document.body.appendChild(toast);
      // Re-trigger by appending — the element is observed by SherpaElement.
    });
  },
};
