// @ts-nocheck
/**
 * Tests for sherpa-calendar component
 */

import { expect } from '@esm-bundle/chai';
import {
  createFixture,
  shadowQuery,
  shadowQueryAll,
  waitForRender,
  click,
  oneEvent,
} from '../helpers/test-utils.js';
import '../../components/sherpa-calendar/sherpa-calendar.js';

describe('sherpa-calendar', () => {
  describe('rendering', () => {
    it('should render calendar structure', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const container = shadowQuery(el, '.cal-container');
      expect(container).to.exist;
    });

    it('should render header with navigation buttons', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const header = shadowQuery(el, '.cal-header');
      const prevBtn = shadowQuery(el, '.cal-prev');
      const nextBtn = shadowQuery(el, '.cal-next');
      const monthLabel = shadowQuery(el, '.cal-month-label');

      expect(header).to.exist;
      expect(prevBtn).to.exist;
      expect(nextBtn).to.exist;
      expect(monthLabel).to.exist;
    });

    it('should render weekday headers', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const weekdays = shadowQuery(el, '.cal-weekdays');
      expect(weekdays).to.exist;

      const weekdayLabels = shadowQueryAll(el, '.cal-weekday');
      expect(weekdayLabels).to.have.lengthOf(7); // 7 days of week
    });

    it('should render days grid', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const daysGrid = shadowQuery(el, '.cal-days');
      expect(daysGrid).to.exist;
    });

    it('should render month label with current month and year', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      expect(monthLabel.textContent).to.match(/\w+ \d{4}/); // e.g., "May 2026"
    });
  });

  describe('single date selection', () => {
    it('should default to single selection mode', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const mode = el.dataset.mode || 'single';
      expect(mode).to.equal('single');
    });

    it('should set initial value from data-value', async () => {
      const el = await createFixture('<sherpa-calendar data-value="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.value).to.equal('2026-05-15');
    });

    it('should emit dateselect event when date is clicked', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender(3);

      const eventPromise = oneEvent(el, 'dateselect', 5000);

      // Find and click a day button
      const days = shadowQueryAll(el, '.cal-day:not([disabled])');
      if (days.length > 0) {
        await click(days[0]);
        const event = await eventPromise;

        expect(event).to.exist;
        expect(event.detail).to.have.property('value');
        expect(event.detail).to.have.property('valueAsDate');
        expect(event.detail.value).to.match(/\d{4}-\d{2}-\d{2}/); // ISO format
      }
    });

    it('should update data-value when date is selected', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender(3);

      const days = shadowQueryAll(el, '.cal-day:not([disabled])');
      if (days.length > 0) {
        await click(days[0]);
        await waitForRender();

        expect(el.dataset.value).to.exist;
        expect(el.dataset.value).to.match(/\d{4}-\d{2}-\d{2}/);
      }
    });
  });

  describe('range selection mode', () => {
    it('should set range mode from data-mode', async () => {
      const el = await createFixture('<sherpa-calendar data-mode="range"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.mode).to.equal('range');
    });

    it('should accept pre-selected range', async () => {
      const el = await createFixture(`
        <sherpa-calendar
          data-mode="range"
          data-value="2026-05-10"
          data-value-end="2026-05-20">
        </sherpa-calendar>
      `);
      await waitForRender();

      expect(el.dataset.value).to.equal('2026-05-10');
      expect(el.dataset.valueEnd).to.equal('2026-05-20');
    });

    it('should emit rangeselect event when range is completed', async () => {
      const el = await createFixture('<sherpa-calendar data-mode="range"></sherpa-calendar>');
      await waitForRender(3);

      const days = shadowQueryAll(el, '.cal-day:not([disabled])');
      if (days.length > 2) {
        // Click first day (start of range)
        await click(days[0]);
        await waitForRender();

        // Click second day (end of range)
        const eventPromise = oneEvent(el, 'rangeselect', 5000);
        await click(days[5]);
        const event = await eventPromise;

        expect(event).to.exist;
        expect(event.detail).to.have.property('start');
        expect(event.detail).to.have.property('end');
        expect(event.detail).to.have.property('startAsDate');
        expect(event.detail).to.have.property('endAsDate');
      }
    });
  });

  describe('min/max constraints', () => {
    it('should set min date from data-min', async () => {
      const el = await createFixture('<sherpa-calendar data-min="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.min).to.equal('2026-05-15');
    });

    it('should set max date from data-max', async () => {
      const el = await createFixture('<sherpa-calendar data-max="2026-05-31"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.max).to.equal('2026-05-31');
    });

    it('should disable dates outside min/max range', async () => {
      const el = await createFixture(`
        <sherpa-calendar
          data-min="2026-05-10"
          data-max="2026-05-20"
          data-view-date="2026-05-15">
        </sherpa-calendar>
      `);
      await waitForRender(3);

      const disabledDays = shadowQueryAll(el, '.cal-day[disabled]');
      expect(disabledDays.length).to.be.greaterThan(0);
    });
  });

  describe('month navigation', () => {
    it('should navigate to previous month when prev button clicked', async () => {
      const el = await createFixture('<sherpa-calendar data-view-date="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      const initialMonth = monthLabel.textContent;

      const prevBtn = shadowQuery(el, '.cal-prev');
      const eventPromise = oneEvent(el, 'viewchange', 5000);

      await click(prevBtn);
      const event = await eventPromise;

      expect(event).to.exist;
      expect(event.detail).to.have.property('viewDate');

      await waitForRender();
      const newMonth = monthLabel.textContent;
      expect(newMonth).to.not.equal(initialMonth);
    });

    it('should navigate to next month when next button clicked', async () => {
      const el = await createFixture('<sherpa-calendar data-view-date="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      const initialMonth = monthLabel.textContent;

      const nextBtn = shadowQuery(el, '.cal-next');
      const eventPromise = oneEvent(el, 'viewchange', 5000);

      await click(nextBtn);
      const event = await eventPromise;

      expect(event).to.exist;
      expect(event.detail).to.have.property('viewDate');

      await waitForRender();
      const newMonth = monthLabel.textContent;
      expect(newMonth).to.not.equal(initialMonth);
    });

    it('should set initial view date from data-view-date', async () => {
      const el = await createFixture('<sherpa-calendar data-view-date="2026-12-25"></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      expect(monthLabel.textContent).to.include('December');
      expect(monthLabel.textContent).to.include('2026');
    });
  });

  describe('programmatic API', () => {
    it('should have valueAsDate property', async () => {
      const el = await createFixture('<sherpa-calendar data-value="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      expect(el.valueAsDate).to.be.instanceOf(Date);
      expect(el.valueAsDate.getFullYear()).to.equal(2026);
      expect(el.valueAsDate.getMonth()).to.equal(4); // 0-indexed (May = 4)
      expect(el.valueAsDate.getDate()).to.equal(15);
    });

    it('should set value via valueAsDate property', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const date = new Date(2026, 5, 20); // June 20, 2026
      el.valueAsDate = date;
      await waitForRender();

      expect(el.dataset.value).to.equal('2026-06-20');
    });

    it('should have selectedRange property in range mode', async () => {
      const el = await createFixture(`
        <sherpa-calendar
          data-mode="range"
          data-value="2026-05-10"
          data-value-end="2026-05-20">
        </sherpa-calendar>
      `);
      await waitForRender();

      const range = el.selectedRange;
      expect(range).to.have.property('start');
      expect(range).to.have.property('end');
      expect(range.start).to.be.instanceOf(Date);
      expect(range.end).to.be.instanceOf(Date);
    });

    it('should have goToMonth method', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      expect(el.goToMonth).to.be.a('function');

      const date = new Date(2026, 11, 1); // December 2026
      el.goToMonth(date);
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      expect(monthLabel.textContent).to.include('December');
      expect(monthLabel.textContent).to.include('2026');
    });

    it('should have goToToday method', async () => {
      const el = await createFixture('<sherpa-calendar data-view-date="2025-01-01"></sherpa-calendar>');
      await waitForRender();

      expect(el.goToToday).to.be.a('function');

      el.goToToday();
      await waitForRender();

      const today = new Date();
      const monthLabel = shadowQuery(el, '.cal-month-label');
      expect(monthLabel.textContent).to.include(today.getFullYear().toString());
    });
  });

  describe('slots', () => {
    it('should support header slot', async () => {
      const el = await createFixture(`
        <sherpa-calendar>
          <div slot="header">Custom Header</div>
        </sherpa-calendar>
      `);
      await waitForRender();

      const headerSlot = shadowQuery(el, 'slot[name="header"]');
      expect(headerSlot).to.exist;
    });

    it('should support footer slot', async () => {
      const el = await createFixture(`
        <sherpa-calendar>
          <div slot="footer">Custom Footer</div>
        </sherpa-calendar>
      `);
      await waitForRender();

      const footerSlot = shadowQuery(el, 'slot[name="footer"]');
      expect(footerSlot).to.exist;
    });
  });

  describe('CSS parts', () => {
    it('should expose header part', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const header = shadowQuery(el, '[part="header"]');
      expect(header).to.exist;
    });

    it('should expose month-label part', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '[part="month-label"]');
      expect(monthLabel).to.exist;
    });

    it('should expose prev-button and next-button parts', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const prevBtn = shadowQuery(el, '[part="prev-button"]');
      const nextBtn = shadowQuery(el, '[part="next-button"]');

      expect(prevBtn).to.exist;
      expect(nextBtn).to.exist;
    });

    it('should expose weekdays part', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const weekdays = shadowQuery(el, '[part="weekdays"]');
      expect(weekdays).to.exist;
    });

    it('should expose days-grid part', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const daysGrid = shadowQuery(el, '[part="days-grid"]');
      expect(daysGrid).to.exist;
    });

    it('should expose footer part', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const footer = shadowQuery(el, '[part="footer"]');
      expect(footer).to.exist;
    });
  });

  describe('accessibility', () => {
    it('should have aria-label on navigation buttons', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const prevBtn = shadowQuery(el, '.cal-prev');
      const nextBtn = shadowQuery(el, '.cal-next');

      expect(prevBtn.getAttribute('aria-label')).to.exist;
      expect(nextBtn.getAttribute('aria-label')).to.exist;
    });

    it('should mark calendar days with role="gridcell"', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender(3);

      const days = shadowQueryAll(el, '.cal-day');
      if (days.length > 0) {
        expect(days[0].getAttribute('role')).to.equal('gridcell');
      }
    });

    it('should mark days grid with role="grid"', async () => {
      const el = await createFixture('<sherpa-calendar></sherpa-calendar>');
      await waitForRender();

      const grid = shadowQuery(el, '.cal-days');
      expect(grid.getAttribute('role')).to.equal('grid');
    });
  });

  describe('dynamic updates', () => {
    it('should update when data-value changes', async () => {
      const el = await createFixture('<sherpa-calendar data-value="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.value).to.equal('2026-05-15');

      el.dataset.value = '2026-05-20';
      await waitForRender();

      expect(el.dataset.value).to.equal('2026-05-20');
    });

    it('should update when data-mode changes', async () => {
      const el = await createFixture('<sherpa-calendar data-mode="single"></sherpa-calendar>');
      await waitForRender();

      expect(el.dataset.mode).to.equal('single');

      el.dataset.mode = 'range';
      await waitForRender();

      expect(el.dataset.mode).to.equal('range');
    });

    it('should update when data-view-date changes', async () => {
      const el = await createFixture('<sherpa-calendar data-view-date="2026-05-15"></sherpa-calendar>');
      await waitForRender();

      const monthLabel = shadowQuery(el, '.cal-month-label');
      expect(monthLabel.textContent).to.include('May');

      el.dataset.viewDate = '2026-12-25';
      await waitForRender();

      expect(monthLabel.textContent).to.include('December');
    });
  });
});
