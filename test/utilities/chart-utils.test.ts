// @ts-nocheck
import { expect } from '@esm-bundle/chai';
import {
  getSegmentField,
  isSegmentEnabled,
  getActiveSort,
  applySegmentBy,
  syncChartTitle,
} from '../../components/utilities/chart-utils.js';

function makeHost(attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement('div');
  for (const [k, v] of Object.entries(attrs)) {
    el.setAttribute(k, v);
  }
  return el;
}

/* ── getSegmentField() ──────────────────────────────────────────────── */

describe('getSegmentField()', () => {
  it('returns null when attribute is absent', () => {
    expect(getSegmentField(makeHost())).to.be.null;
  });

  it('returns null for empty attribute', () => {
    expect(getSegmentField(makeHost({ 'data-segment-field': '' }))).to.be.null;
  });

  it('returns the field name when set', () => {
    expect(getSegmentField(makeHost({ 'data-segment-field': 'region' }))).to.equal('region');
  });
});

/* ── isSegmentEnabled() ─────────────────────────────────────────────── */

describe('isSegmentEnabled()', () => {
  it('returns false when no segment field', () => {
    expect(isSegmentEnabled(makeHost())).to.be.false;
  });

  it('returns false when segment mode is "off"', () => {
    const host = makeHost({ 'data-segment-field': 'region', 'data-segment-mode': 'off' });
    expect(isSegmentEnabled(host)).to.be.false;
  });

  it('returns true when field set and mode is not "off"', () => {
    const host = makeHost({ 'data-segment-field': 'region', 'data-segment-mode': 'on' });
    expect(isSegmentEnabled(host)).to.be.true;
  });

  it('returns true when field set and mode attribute is absent', () => {
    const host = makeHost({ 'data-segment-field': 'region' });
    expect(isSegmentEnabled(host)).to.be.true;
  });
});

/* ── getActiveSort() ────────────────────────────────────────────────── */

describe('getActiveSort()', () => {
  it('returns null when no sort direction set', () => {
    expect(getActiveSort(makeHost())).to.be.null;
  });

  it('returns null when direction is "off"', () => {
    expect(getActiveSort(makeHost({ 'data-sort-direction': 'off' }))).to.be.null;
  });

  it('returns { dir } when direction is "asc"', () => {
    const result = getActiveSort(makeHost({ 'data-sort-direction': 'asc' }));
    expect(result).to.deep.equal({ dir: 'asc' });
  });

  it('returns { dir } when direction is "desc"', () => {
    const result = getActiveSort(makeHost({ 'data-sort-direction': 'desc' }));
    expect(result).to.deep.equal({ dir: 'desc' });
  });
});

/* ── applySegmentBy() ───────────────────────────────────────────────── */

describe('applySegmentBy()', () => {
  it('does nothing when data lacks segmentBy key', () => {
    const host = makeHost();
    applySegmentBy(host, { other: 'value' });
    expect(host.getAttribute('data-segment-field')).to.be.null;
  });

  it('sets segment attributes when segmentBy has a value', () => {
    const host = makeHost();
    applySegmentBy(host, { segmentBy: 'category' });
    expect(host.getAttribute('data-segment-field')).to.equal('category');
    expect(host.getAttribute('data-segment-mode')).to.equal('on');
  });

  it('removes segment attributes when segmentBy is falsy', () => {
    const host = makeHost({ 'data-segment-field': 'old', 'data-segment-mode': 'on' });
    applySegmentBy(host, { segmentBy: '' });
    expect(host.getAttribute('data-segment-field')).to.be.null;
    expect(host.getAttribute('data-segment-mode')).to.be.null;
  });

  it('removes segment attributes when segmentBy is null', () => {
    const host = makeHost({ 'data-segment-field': 'old', 'data-segment-mode': 'on' });
    applySegmentBy(host, { segmentBy: null });
    expect(host.getAttribute('data-segment-field')).to.be.null;
  });
});

/* ── syncChartTitle() ───────────────────────────────────────────────── */

describe('syncChartTitle()', () => {
  it('does nothing when titleEl is null', () => {
    const host = makeHost();
    expect(() => syncChartTitle(null, host)).to.not.throw();
  });

  it('renders "All <entity>" when no active segment', () => {
    const titleEl = document.createElement('span');
    const host = document.createElement('div');
    host.dataset['title'] = 'Orders';
    syncChartTitle(titleEl, host);
    expect(titleEl.textContent).to.include('All');
    expect(titleEl.textContent).to.include('Order');
  });

  it('renders "<entity> by <field>" when segment is active', () => {
    const titleEl = document.createElement('span');
    const host = makeHost({
      'data-segment-field': 'region',
      'data-segment-mode': 'on',
    });
    host.dataset['title'] = 'Sales';
    syncChartTitle(titleEl, host);
    expect(titleEl.textContent).to.include('by');
    expect(titleEl.textContent?.toLowerCase()).to.include('region');
  });

  it('treats segment mode "off" as no active segment', () => {
    const titleEl = document.createElement('span');
    const host = makeHost({
      'data-segment-field': 'region',
      'data-segment-mode': 'off',
    });
    host.dataset['title'] = 'Revenue';
    syncChartTitle(titleEl, host);
    expect(titleEl.textContent).to.include('All');
  });
});
