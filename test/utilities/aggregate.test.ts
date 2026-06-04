// @ts-nocheck
import { expect } from '@esm-bundle/chai';
import {
  agg,
  truncateDate,
  groupAndAggregate,
  applyLocalFilters,
  applySort,
  computeMetricSummary,
  buildColumns,
} from '../../components/utilities/aggregate.js';

/* ── agg() ──────────────────────────────────────────────────────────── */

describe('agg()', () => {
  it('count returns total length including nulls', () => {
    expect(agg([1, 2, null, 'x'], 'count')).to.equal(4);
  });

  it('count returns 0 for empty array', () => {
    expect(agg([], 'count')).to.equal(0);
  });

  it('count_distinct counts unique values', () => {
    expect(agg([1, 1, 2, 3, 2], 'count_distinct')).to.equal(3);
  });

  it('sum adds numeric values', () => {
    expect(agg([1, 2, 3], 'sum')).to.equal(6);
  });

  it('sum returns 0 for empty numeric values after filtering', () => {
    expect(agg([null, null], 'sum')).to.equal(0);
  });

  it('avg computes mean', () => {
    expect(agg([2, 4, 6], 'avg')).to.equal(4);
  });

  it('mean is an alias for avg', () => {
    expect(agg([10, 20], 'mean')).to.equal(15);
  });

  it('min returns smallest value', () => {
    expect(agg([5, 3, 8, 1], 'min')).to.equal(1);
  });

  it('max returns largest value', () => {
    expect(agg([5, 3, 8, 1], 'max')).to.equal(8);
  });

  it('last returns the final element', () => {
    expect(agg([10, 20, 30], 'last')).to.equal(30);
  });

  it('last returns 0 for empty array', () => {
    expect(agg([], 'last')).to.equal(0);
  });

  it('throws on unknown aggregation function', () => {
    expect(() => agg([1], 'median')).to.throw('Unknown aggregation');
  });

  it('coerces string numbers', () => {
    expect(agg(['5', '10'], 'sum')).to.equal(15);
  });
});

/* ── truncateDate() ─────────────────────────────────────────────────── */

describe('truncateDate()', () => {
  it('truncates to year (4 chars)', () => {
    expect(truncateDate('2024-06-15', 'year')).to.equal('2024');
  });

  it('truncates to month (7 chars)', () => {
    expect(truncateDate('2024-06-15', 'month')).to.equal('2024-06');
  });

  it('truncates to day (10 chars)', () => {
    expect(truncateDate('2024-06-15T12:00:00Z', 'day')).to.equal('2024-06-15');
  });

  it('returns string unchanged for unknown grain', () => {
    expect(truncateDate('2024-06-15', 'week')).to.equal('2024-06-15');
  });

  it('handles null input', () => {
    expect(truncateDate(null, 'year')).to.equal('');
  });

  it('handles undefined input', () => {
    expect(truncateDate(undefined, 'month')).to.equal('');
  });
});

/* ── groupAndAggregate() ────────────────────────────────────────────── */

describe('groupAndAggregate()', () => {
  const records = [
    { category: 'A', value: 10 },
    { category: 'A', value: 20 },
    { category: 'B', value: 5 },
    { category: 'B', value: 15 },
    { category: 'B', value: 10 },
  ];

  it('groups by a single field and sums', () => {
    const result = groupAndAggregate(records, ['category'], [{ field: 'value', agg: 'sum' }]);
    const byCategory = Object.fromEntries(result.map((r) => [r.category, r.value]));
    expect(byCategory['A']).to.equal(30);
    expect(byCategory['B']).to.equal(30);
  });

  it('groups by a single field and counts', () => {
    const result = groupAndAggregate(records, ['category'], [{ field: 'value', agg: 'count' }]);
    const byCategory = Object.fromEntries(result.map((r) => [r.category, r.value]));
    expect(byCategory['A']).to.equal(2);
    expect(byCategory['B']).to.equal(3);
  });

  it('returns one row per unique key', () => {
    const result = groupAndAggregate(records, ['category'], [{ field: 'value', agg: 'sum' }]);
    expect(result).to.have.length(2);
  });

  it('handles multiple group fields', () => {
    const multi = [
      { cat: 'A', sub: 'x', v: 1 },
      { cat: 'A', sub: 'x', v: 2 },
      { cat: 'A', sub: 'y', v: 5 },
      { cat: 'B', sub: 'x', v: 10 },
    ];
    const result = groupAndAggregate(multi, ['cat', 'sub'], [{ field: 'v', agg: 'sum' }]);
    expect(result).to.have.length(3);
    const axSum = result.find((r) => r.cat === 'A' && r.sub === 'x')?.v;
    expect(axSum).to.equal(3);
  });

  it('applies date truncation via dateGroupMap', () => {
    const dated = [
      { date: '2024-01-10', value: 1 },
      { date: '2024-01-20', value: 2 },
      { date: '2024-02-05', value: 4 },
    ];
    const result = groupAndAggregate(
      dated,
      ['date'],
      [{ field: 'value', agg: 'sum' }],
      { date: 'month' }
    );
    expect(result).to.have.length(2);
    const jan = result.find((r) => r.date === '2024-01');
    expect(jan?.value).to.equal(3);
  });

  it('returns empty array for empty input', () => {
    expect(groupAndAggregate([], ['category'], [{ field: 'v', agg: 'sum' }])).to.deep.equal([]);
  });
});

/* ── applyLocalFilters() ────────────────────────────────────────────── */

describe('applyLocalFilters()', () => {
  const records = [
    { name: 'Alice', age: 30, country: 'US' },
    { name: 'Bob', age: 25, country: 'UK' },
    { name: 'Charlie', age: 35, country: 'US' },
    { name: 'Diana', age: 28, country: 'CA' },
  ];

  it('returns all records with no filters', () => {
    expect(applyLocalFilters(records, [])).to.deep.equal(records);
  });

  it('eq operator filters by equality (case-insensitive)', () => {
    const result = applyLocalFilters(records, [{ field: 'country', operator: 'eq', value: 'us' }]);
    expect(result).to.have.length(2);
  });

  it('= operator is alias for eq', () => {
    const result = applyLocalFilters(records, [{ field: 'country', operator: '=', value: 'US' }]);
    expect(result).to.have.length(2);
  });

  it('ne operator excludes matching records', () => {
    const result = applyLocalFilters(records, [{ field: 'country', operator: 'ne', value: 'US' }]);
    expect(result).to.have.length(2);
    expect(result.every((r) => r.country !== 'US')).to.be.true;
  });

  it('in operator matches any of the provided values', () => {
    const result = applyLocalFilters(records, [
      { field: 'country', operator: 'in', values: ['US', 'CA'] },
    ]);
    expect(result).to.have.length(3);
  });

  it('AND-chains multiple filters', () => {
    const result = applyLocalFilters(records, [
      { field: 'country', operator: 'eq', value: 'US' },
      { field: 'age', operator: 'gt', value: 30 },
    ]);
    expect(result).to.have.length(1);
    expect(result[0].name).to.equal('Charlie');
  });

  it('skips filters with null field', () => {
    const result = applyLocalFilters(records, [{ field: null }]);
    expect(result).to.have.length(4);
  });

  it('returns records unchanged when filters is not an array', () => {
    expect(applyLocalFilters(records, null)).to.deep.equal(records);
  });
});

/* ── applySort() ────────────────────────────────────────────────────── */

describe('applySort()', () => {
  const rows = [
    { name: 'Charlie', age: 35 },
    { name: 'Alice', age: 30 },
    { name: 'Bob', age: 25 },
  ];

  it('sorts ascending by string field', () => {
    const result = applySort(rows, [{ field: 'name', direction: 'asc' }]);
    expect(result.map((r) => r.name)).to.deep.equal(['Alice', 'Bob', 'Charlie']);
  });

  it('sorts descending by string field', () => {
    const result = applySort(rows, [{ field: 'name', direction: 'desc' }]);
    expect(result.map((r) => r.name)).to.deep.equal(['Charlie', 'Bob', 'Alice']);
  });

  it('sorts numerically', () => {
    const result = applySort(rows, [{ field: 'age', direction: 'asc' }]);
    expect(result.map((r) => r.age)).to.deep.equal([25, 30, 35]);
  });

  it('does not mutate the original array', () => {
    const copy = [...rows];
    applySort(rows, [{ field: 'name', direction: 'asc' }]);
    expect(rows).to.deep.equal(copy);
  });

  it('returns rows unchanged when orderBy is empty', () => {
    const result = applySort(rows, []);
    expect(result).to.deep.equal(rows);
  });

  it('places nulls last', () => {
    const withNull = [{ v: 5 }, { v: null }, { v: 2 }];
    const result = applySort(withNull, [{ field: 'v', direction: 'asc' }]);
    expect(result[result.length - 1].v).to.be.null;
  });
});

/* ── computeMetricSummary() ─────────────────────────────────────────── */

describe('computeMetricSummary()', () => {
  it('returns zeroed summary for empty records', () => {
    const result = computeMetricSummary([], null, null, null);
    expect(result).to.deep.equal({ total: 0, delta: 0, deltaPercent: 0, values: [], count: 0 });
  });

  it('returns total count when no measure or date field', () => {
    const records = [{ x: 1 }, { x: 2 }, { x: 3 }];
    const result = computeMetricSummary(records, null, null, null);
    expect(result.total).to.equal(3);
  });

  it('aggregates value field for total when measure provided', () => {
    const records = [
      { date: '2024-01', amount: 100 },
      { date: '2024-02', amount: 200 },
    ];
    const result = computeMetricSummary(
      records,
      [{ field: 'amount', agg: 'sum' }],
      'date',
      null
    );
    expect(result.total).to.equal(300);
  });

  it('sparkline values array has one entry per time bucket', () => {
    const records = [
      { date: '2024-01', amount: 100 },
      { date: '2024-01', amount: 50 },
      { date: '2024-02', amount: 200 },
    ];
    const result = computeMetricSummary(
      records,
      [{ field: 'amount', agg: 'sum' }],
      'date',
      null
    );
    expect(result.values).to.have.length(2);
  });
});

/* ── buildColumns() ─────────────────────────────────────────────────── */

describe('buildColumns()', () => {
  it('builds column objects from field metadata', () => {
    const meta = [
      { name: 'revenue', type: 'number', label: 'Revenue' },
      { name: 'region', type: 'string' },
    ];
    const result = buildColumns(meta, ['revenue', 'region']);
    expect(result).to.have.length(2);
    expect(result[0].field).to.equal('revenue');
    expect(result[0].name).to.equal('Revenue');
    expect(result[0].type).to.equal('number');
  });

  it('uses field name as display name when label absent', () => {
    const meta = [{ name: 'region', type: 'string' }];
    const result = buildColumns(meta, ['region']);
    expect(result[0].name).to.be.a('string').that.is.not.empty;
  });

  it('returns empty array when fieldNames is empty', () => {
    expect(buildColumns([], [])).to.deep.equal([]);
  });
});
