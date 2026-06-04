// @ts-nocheck
import { expect } from '@esm-bundle/chai';
import { FormManager } from '../../components/utilities/form-manager.js';

function makeField(name: string, value = '', required = false): HTMLInputElement {
  const el = document.createElement('input');
  el.setAttribute('name', name);
  el.value = value;
  if (required) el.setAttribute('required', '');
  return el;
}

function makeContainer(...fields: HTMLInputElement[]): HTMLDivElement {
  const container = document.createElement('div');
  for (const f of fields) container.appendChild(f);
  return container;
}

/* ── read() ─────────────────────────────────────────────────────────── */

describe('FormManager.read()', () => {
  it('returns an empty object when no fields present', () => {
    const form = new FormManager(makeContainer());
    expect(form.read()).to.deep.equal({});
  });

  it('reads all field values by name', () => {
    const form = new FormManager(makeContainer(
      makeField('username', 'alice'),
      makeField('email', 'alice@example.com'),
    ));
    expect(form.read()).to.deep.equal({ username: 'alice', email: 'alice@example.com' });
  });

  it('returns empty string for fields with no value', () => {
    const form = new FormManager(makeContainer(makeField('title', '')));
    expect(form.read().title).to.equal('');
  });
});

/* ── get() ──────────────────────────────────────────────────────────── */

describe('FormManager.get()', () => {
  it('returns the value of a named field', () => {
    const form = new FormManager(makeContainer(makeField('city', 'London')));
    expect(form.get('city')).to.equal('London');
  });

  it('returns empty string when field not found', () => {
    const form = new FormManager(makeContainer());
    expect(form.get('nonexistent')).to.equal('');
  });
});

/* ── populate() ─────────────────────────────────────────────────────── */

describe('FormManager.populate()', () => {
  it('sets field values from an object', () => {
    const field = makeField('device');
    const form = new FormManager(makeContainer(field));
    form.populate({ device: 'WS-01' });
    expect(field.value).to.equal('WS-01');
  });

  it('ignores keys for which no field exists', () => {
    const field = makeField('name');
    const form = new FormManager(makeContainer(field));
    expect(() => form.populate({ other: 'value' })).to.not.throw();
    expect(field.value).to.equal('');
  });

  it('converts null values to empty string', () => {
    const field = makeField('notes', 'something');
    const form = new FormManager(makeContainer(field));
    form.populate({ notes: null });
    expect(field.value).to.equal('');
  });

  it('converts numeric values to strings', () => {
    const field = makeField('count');
    const form = new FormManager(makeContainer(field));
    form.populate({ count: 42 });
    expect(field.value).to.equal('42');
  });

  it('does nothing when called with null', () => {
    const field = makeField('name', 'original');
    const form = new FormManager(makeContainer(field));
    form.populate(null);
    expect(field.value).to.equal('original');
  });
});

/* ── clear() ────────────────────────────────────────────────────────── */

describe('FormManager.clear()', () => {
  it('clears all field values to empty string', () => {
    const fields = [makeField('a', 'foo'), makeField('b', 'bar')];
    const form = new FormManager(makeContainer(...fields));
    form.clear();
    expect(fields[0].value).to.equal('');
    expect(fields[1].value).to.equal('');
  });

  it('does nothing when no fields exist', () => {
    const form = new FormManager(makeContainer());
    expect(() => form.clear()).to.not.throw();
  });
});

/* ── validate() ─────────────────────────────────────────────────────── */

describe('FormManager.validate()', () => {
  it('returns empty array when all required fields are filled', () => {
    const form = new FormManager(makeContainer(makeField('name', 'Alice', true)));
    expect(form.validate()).to.deep.equal([]);
  });

  it('returns field names for required-but-empty fields', () => {
    const form = new FormManager(makeContainer(
      makeField('name', '', true),
      makeField('email', '', true),
    ));
    const missing = form.validate();
    expect(missing).to.include('name');
    expect(missing).to.include('email');
  });

  it('ignores non-required fields even if empty', () => {
    const form = new FormManager(makeContainer(makeField('notes', '')));
    expect(form.validate()).to.deep.equal([]);
  });

  it('treats whitespace-only values as empty', () => {
    const form = new FormManager(makeContainer(makeField('name', '   ', true)));
    expect(form.validate()).to.include('name');
  });

  it('returns empty array when no required fields exist', () => {
    const form = new FormManager(makeContainer(makeField('optional', '')));
    expect(form.validate()).to.deep.equal([]);
  });
});
