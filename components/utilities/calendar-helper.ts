/**
 * calendar-helper.ts
 * Shared calendar-rendering utilities for sherpa-input-date,
 * sherpa-input-date-range, and any other component that needs a
 * month-grid calendar popup.
 *
 * All functions are pure / side-effect-free except renderCalendarGrid,
 * which mutates the supplied container element.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export const WEEKDAY_SHORT = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

/**
 * Parse an ISO date string (YYYY-MM-DD) to a Temporal.PlainDate, or null.
 */
export function isoToDate(s: string | null | undefined): Temporal.PlainDate | null {
  if (!s) return null;
  try { return Temporal.PlainDate.from(s); }
  catch { return null; }
}

/**
 * Format a Temporal.PlainDate to an ISO string (YYYY-MM-DD).
 */
export function dateToIso(d: Temporal.PlainDate | null | undefined): string {
  return d?.toString() ?? '';
}

/**
 * Format an ISO date string to a human-readable display string.
 * e.g. "2024-05-27" → "May 27, 2024"
 */
export function formatDateDisplay(isoStr: string | null | undefined): string {
  const d = isoToDate(isoStr);
  if (!d) return '';
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/**
 * Render a calendar month grid into a container element.
 * Clears existing content and inserts new day buttons cloned from the
 * provided template prototype element.
 *
 * Each button gets data-* attributes set by CSS:
 *   data-selected="true"   — matches selectedIso or selectedEndIso
 *   data-today="true"      — is today's date
 *   data-in-range="true"   — falls between selectedIso and selectedEndIso
 *   data-other-month="true" — padding day from prev/next month
 *   disabled               — before minDate or after maxDate
 *
 * @param container      - The .cal-days grid element
 * @param tpl            - Template with a single .cal-day button
 * @param viewDate       - Month / year to display (any day in the month works)
 * @param selectedIso    - Selected (or range-start) ISO date
 * @param selectedEndIso - Range-end ISO date (range pickers only)
 * @param minIso         - Minimum selectable date ISO
 * @param maxIso         - Maximum selectable date ISO
 * @param onSelect       - Called when a non-disabled day is clicked
 */
export function renderCalendarGrid(
  container: HTMLElement,
  tpl: HTMLTemplateElement,
  viewDate: Temporal.PlainDate,
  selectedIso: string | null,
  selectedEndIso: string | null,
  minIso: string | null,
  maxIso: string | null,
  onSelect: (iso: string) => void,
) {
  const firstDay     = viewDate.with({ day: 1 });
  const lastDayNum   = viewDate.daysInMonth;
  const lastDay      = viewDate.with({ day: lastDayNum });
  const prevLastDay  = viewDate.subtract({ months: 1 }).daysInMonth;

  const today    = Temporal.Now.plainDateISO();
  const minDate  = isoToDate(minIso);
  const maxDate  = isoToDate(maxIso);
  const selStart = isoToDate(selectedIso);
  const selEnd   = isoToDate(selectedEndIso);

  container.innerHTML = '';

  const makeCell = (
    date: Temporal.PlainDate,
    flags: { otherMonth?: boolean } = {},
  ): DocumentFragment => {
    const iso  = date.toString();
    const frag = tpl.content.cloneNode(true) as DocumentFragment;
    const btn  = frag.querySelector<HTMLButtonElement>('.cal-day');
    if (!btn) return frag;

    btn.textContent = String(date.day);

    if (flags.otherMonth) {
      btn.dataset["otherMonth"] = 'true';
      btn.disabled = true;
    } else {
      btn.setAttribute(
        'aria-label',
        date.toLocaleString('en-US', { month: 'long', day: 'numeric', year: 'numeric' }),
      );

      const isDisabled = (minDate !== null && Temporal.PlainDate.compare(date, minDate) < 0) ||
                         (maxDate !== null && Temporal.PlainDate.compare(date, maxDate) > 0);
      const isSelected = iso === selectedIso || iso === selectedEndIso;
      const isInRange  = selStart !== null && selEnd !== null &&
                         Temporal.PlainDate.compare(date, selStart) > 0 &&
                         Temporal.PlainDate.compare(date, selEnd) < 0;
      const isToday    = today.equals(date);

      if (isDisabled) {
        btn.disabled = true;
        btn.dataset["disabled"] = 'true';
      }
      if (isSelected) btn.dataset["selected"] = 'true';
      if (isInRange)  btn.dataset["inRange"]   = 'true';
      if (isToday)    btn.dataset["today"]     = 'true';

      btn.setAttribute('aria-pressed', String(isSelected));

      if (!isDisabled) {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(iso);
        });
      }
    }

    return frag;
  };

  // Temporal.dayOfWeek: 1=Mon … 7=Sun → convert to Sun=0 … Sat=6 for grid alignment
  const startDow  = firstDay.dayOfWeek % 7;
  const prevMonth = firstDay.subtract({ months: 1 });

  // Trailing days from previous month (padding)
  for (let i = startDow - 1; i >= 0; i--) {
    container.appendChild(
      makeCell(prevMonth.with({ day: prevLastDay - i }), { otherMonth: true }),
    );
  }

  // Current month days
  for (let day = 1; day <= lastDayNum; day++) {
    container.appendChild(makeCell(viewDate.with({ day })));
  }

  // Leading days for next month (padding)
  const endDow    = lastDay.dayOfWeek % 7;
  const nextMonth = firstDay.add({ months: 1 });
  for (let day = 1; day <= 6 - endDow; day++) {
    container.appendChild(makeCell(nextMonth.with({ day }), { otherMonth: true }));
  }
}
