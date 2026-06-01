/**
 * calendar-helper.js
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
 * Parse an ISO date string (YYYY-MM-DD) to a local-time Date, or null.
 * @param {string|null|undefined} s
 * @returns {Date|null}
 */
// @ts-expect-error - TODO: Fix type
export function isoToDate(s) {
  if (!s) return null;
  const [y, m, d] = s.split('-').map(Number);
  if (!y || isNaN(y)) return null;
  return new Date(y, m - 1, d);
}

/**
 * Format a Date to an ISO string (YYYY-MM-DD) in local time.
 * @param {Date|null} d
 * @returns {string}
 */
// @ts-expect-error - TODO: Fix type
export function dateToIso(d) {
  if (!d) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Format an ISO date string to a human-readable display string.
 * e.g. "2024-05-27" → "May 27, 2024"
 * @param {string} isoStr
 * @returns {string}
 */
// @ts-expect-error - TODO: Fix type
export function formatDateDisplay(isoStr) {
  const d = isoToDate(isoStr);
  if (!d) return '';
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(d);
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
 * @param {HTMLElement}           container      - The .cal-days grid element
 * @param {HTMLTemplateElement}   tpl            - Template with a single .cal-day button
 * @param {Date}                  viewDate       - Month / year to display
 * @param {string|null}           selectedIso    - Selected (or range-start) ISO date
 * @param {string|null}           selectedEndIso - Range-end ISO date (range pickers only)
 * @param {string|null}           minIso         - Minimum selectable date ISO
 * @param {string|null}           maxIso         - Maximum selectable date ISO
 * @param {(iso: string) => void} onSelect       - Called when a non-disabled day is clicked
 */
export function renderCalendarGrid(
  // @ts-expect-error - TODO: Fix type
  container,
  // @ts-expect-error - TODO: Fix type
  tpl,
  // @ts-expect-error - TODO: Fix type
  viewDate,
  // @ts-expect-error - TODO: Fix type
  selectedIso,
  // @ts-expect-error - TODO: Fix type
  selectedEndIso,
  // @ts-expect-error - TODO: Fix type
  minIso,
  // @ts-expect-error - TODO: Fix type
  maxIso,
  // @ts-expect-error - TODO: Fix type
  onSelect,
) {
  const year  = viewDate.getFullYear();
  const month = viewDate.getMonth();

  const firstDay    = new Date(year, month, 1);
  const lastDay     = new Date(year, month + 1, 0);
  const prevLastDay = new Date(year, month, 0);

  const todayIso = dateToIso(new Date());
  const minDate  = isoToDate(minIso);
  const maxDate  = isoToDate(maxIso);
  const selStart = isoToDate(selectedIso);
  const selEnd   = isoToDate(selectedEndIso);

  container.innerHTML = '';

  /** Clone one day cell from the prototype template. */
  // @ts-expect-error - TODO: Fix type
  const makeCell = (dayNum, cellYear, cellMonth, flags = {}) => {
    const thisDate = new Date(cellYear, cellMonth, dayNum);
    const iso      = dateToIso(thisDate);
    const frag     = tpl.content.cloneNode(true);
    const btn      = frag.querySelector('.cal-day');

    btn.textContent = dayNum;

    // @ts-expect-error - TODO: Fix type
    if (flags.otherMonth) {
      btn.dataset["otherMonth"] = 'true';
      btn.disabled = true;
    } else {
      // Accessibility
      btn.setAttribute(
        'aria-label',
        new Intl.DateTimeFormat('en-US', {
          month: 'long', day: 'numeric', year: 'numeric',
        }).format(thisDate),
      );

      const isDisabled = (minDate && thisDate < minDate) || (maxDate && thisDate > maxDate);
      const isSelected = iso === selectedIso || iso === selectedEndIso;
      const isInRange  = selStart && selEnd && thisDate > selStart && thisDate < selEnd;
      const isToday    = iso === todayIso;

      if (isDisabled) {
        btn.disabled = true;
        btn.dataset["disabled"] = 'true';
      }
      if (isSelected) btn.dataset["selected"] = 'true';
      if (isInRange)  btn.dataset["inRange"]   = 'true';
      if (isToday)    btn.dataset["today"]     = 'true';

      btn.setAttribute('aria-pressed', String(isSelected));

      if (!isDisabled) {
        // @ts-expect-error - TODO: Fix type
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          onSelect(iso);
        });
      }
    }

    return frag;
  };

  // Trailing days from previous month (padding)
  const startDow = firstDay.getDay();
  for (let i = startDow - 1; i >= 0; i--) {
    container.appendChild(
      makeCell(prevLastDay.getDate() - i, year, month - 1, { otherMonth: true }),
    );
  }

  // Current month days
  for (let d = 1; d <= lastDay.getDate(); d++) {
    container.appendChild(makeCell(d, year, month));
  }

  // Leading days for next month (padding)
  const endDow = lastDay.getDay();
  for (let d = 1; d <= 6 - endDow; d++) {
    container.appendChild(
      makeCell(d, year, month + 1, { otherMonth: true }),
    );
  }
}
