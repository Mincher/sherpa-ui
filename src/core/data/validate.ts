/**
 * validate.ts — is this value allowed?
 *
 * One answer shape for a field checking as you type, a store refusing an
 * `insert`, and a form reporting on submit.
 *
 * TRAP T-standard-schema-is-duck-typed
 */
// The ONE rule for "what is this value, as a string" — `oneOf` compares with
// it, so a schema and a query agree about what two values being the same means.
import { valueKey } from './store.js';

/* ── The answer ─────────────────────────────────────────────────────── */

/** One thing that is wrong. `path` is an array; a top-level value has none. */
export interface Issue {
  message: string;
  path?: ReadonlyArray<PropertyKey>;
}

/**
 * What a validation says. `issues` ABSENT means valid.
 *
 * TRAP T-standard-schema-is-duck-typed
 */
export type Result<T = unknown> =
  | { value: T; issues?: undefined }
  | { issues: ReadonlyArray<Issue>; value?: undefined };

/** Did this pass? The one place `issues === undefined` is read as a boolean. */
export function isValid<T>(result: Result<T>): result is { value: T; issues?: undefined } {
  return result.issues == null;
}

/* ── The Standard Schema interface ──────────────────────────────────── */

/**
 * The duck type. Declared, never imported — that is what accepts Zod, Valibot
 * and ArkType at zero dependency cost.
 *
 * TRAP T-standard-schema-is-duck-typed
 */
export interface StandardSchema<Input = unknown, Output = Input> {
  readonly '~standard': {
    readonly version: 1;
    readonly vendor: string;
    readonly validate: (value: Input) => Result<Output> | Promise<Result<Output>>;
  };
}

/** Is this a Standard Schema? The one shape check, so callers never repeat it. */
export function isSchema(value: unknown): value is StandardSchema {
  return (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as StandardSchema)['~standard']?.validate === 'function'
  );
}

/** Run a schema, always as a promise — so nothing branches on sync vs async. */
export async function validate<T>(
  schema: StandardSchema<unknown, T>,
  value: unknown,
): Promise<Result<T>> {
  return schema['~standard'].validate(value);
}

/* ── Rules ──────────────────────────────────────────────────────────── */

/** One check on one value: a message when WRONG, nothing when fine. May be async. */
export type Rule = (value: unknown) => string | undefined | Promise<string | undefined>;

/**
 * Is this value absent? `''` counts, zero and `false` do not.
 *
 * TRAP T-every-rule-but-required-passes-absent
 */
function absent(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * There has to be something here — the only rule that objects to emptiness.
 *
 * TRAP T-every-rule-but-required-passes-absent
 */
export function required(message = 'Required'): Rule {
  return (value) => (absent(value) ? message : undefined);
}

/**
 * A rule that only speaks when there IS a value.
 *
 * EVERY rule but `required` passes an absent value: "must be a number" has
 * nothing to say about a field nobody filled in, and saying it would make every
 * optional field fail. Six rules opened with the same guard, which is six
 * chances for a seventh to forget it and reject an empty optional field.
 *
 * TRAP T-every-rule-but-required-passes-absent
 */
function whenPresent(check: (value: unknown) => string | undefined): Rule {
  return (value) => (absent(value) ? undefined : check(value));
}

/** A number, and a real one — NaN and Infinity are not values a field can hold. */
export function number(message = 'Must be a number'): Rule {
  return whenPresent((value) => {
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? undefined : message;
  });
}

/** At least this much. Numbers compare; strings and arrays measure their length. */
export function min(limit: number, message?: string): Rule {
  return whenPresent((value) => {
    const size = sizeOf(value);
    if (size == null) return undefined;
    return size < limit ? (message ?? defaultLimitMessage(value, 'at least', limit)) : undefined;
  });
}

/** At most this much. The mirror of `min`. */
export function max(limit: number, message?: string): Rule {
  return whenPresent((value) => {
    const size = sizeOf(value);
    if (size == null) return undefined;
    return size > limit ? (message ?? defaultLimitMessage(value, 'at most', limit)) : undefined;
  });
}

/**
 * What `min`/`max` compare. Anything unmeasurable returns null, so the rule passes.
 *
 * TRAP T-every-rule-but-required-passes-absent
 */
function sizeOf(value: unknown): number | null {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string' || Array.isArray(value)) return value.length;
  return null;
}

function defaultLimitMessage(value: unknown, direction: string, limit: number): string {
  if (typeof value === 'number') return `Must be ${direction} ${limit}`;
  return `Must be ${direction} ${limit} character${limit === 1 ? '' : 's'}`;
}

/** Matches this pattern. The message should say what the shape IS, not restate it. */
export function pattern(re: RegExp, message = 'Wrong format'): Rule {
  return whenPresent((value) => (re.test(String(value)) ? undefined : message));
}

/**
 * Looks like an email address. Loose on purpose — a stricter regex rejects real ones.
 *
 * TRAP T-email-check-is-deliberately-loose
 */
export function email(message = 'Enter a valid email address'): Rule {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

/** A URL the platform's own parser accepts — no regex to get wrong. */
export function url(message = 'Enter a valid URL'): Rule {
  return whenPresent((value) => (URL.canParse(String(value)) ? undefined : message));
}

/**
 * One of these. Compared as STRINGS, as an attribute would — so `'2'` passes
 * `oneOf([1, 2, 3])`, which is the point.
 *
 * `valueKey`, not `String`: an object is its own fields and values. With
 * `String` every object was "[object Object]", so `oneOf([RAVI, DANA])`
 * accepted ANY object — a rule that lets everything through.
 * TRAP T-a-value-can-be-an-object
 */
export function oneOf(allowed: readonly unknown[], message?: string): Rule {
  const set = new Set(allowed.map(valueKey));
  return whenPresent((value) => (set.has(valueKey(value))
    ? undefined
    : (message ?? `Must be one of: ${allowed.map(valueKey).join(', ')}`)));
}

/** Anything else. The escape hatch, and why the rule set stays small. */
export function custom(check: Rule): Rule {
  return check;
}

/* ── Building a schema from rules ───────────────────────────────────── */

/** A field's rules — one, or several run in order. */
export type FieldRules = Rule | readonly Rule[];

/** A record's rules, keyed by field. */
export type RuleMap = Readonly<Record<string, FieldRules>>;

/**
 * Turn rules into a Standard Schema, so built-in and third-party are one kind of
 * thing to every caller. A field's rules run IN ORDER, stopping at the first fail.
 *
 *   rules({ email: [required(), email()], seats: number() })
 *
 * TRAP T-standard-schema-is-duck-typed
 * TRAP T-every-rule-but-required-passes-absent
 */
export function rules<T extends Record<string, unknown> = Record<string, unknown>>(
  map: RuleMap,
): StandardSchema<unknown, T> {
  return {
    '~standard': {
      version: 1,
      // Named so a caller debugging a mixed setup can tell whose schema spoke.
      vendor: 'sherpa',
      validate: async (value: unknown): Promise<Result<T>> => {
        const record = (value ?? {}) as Record<string, unknown>;
        const issues: Issue[] = [];

        for (const [field, fieldRules] of Object.entries(map)) {
          const list = Array.isArray(fieldRules) ? fieldRules : [fieldRules as Rule];
          for (const rule of list) {
            const message = await rule(record[field]);
            if (message) {
              issues.push({ message, path: [field] });
              // FIRST failure only, per field.
              break;
            }
          }
        }

        return issues.length ? { issues } : { value: record as T };
      },
    },
  };
}

/**
 * Run one field's rules on its own, for a field validating as it is typed.
 *
 * TRAP T-every-rule-but-required-passes-absent
 */
export async function validateField(
  fieldRules: FieldRules,
  value: unknown,
): Promise<string | undefined> {
  const list = Array.isArray(fieldRules) ? fieldRules : [fieldRules as Rule];
  for (const rule of list) {
    const message = await rule(value);
    if (message) return message;
  }
  return undefined;
}

/** Every issue for one field, path flattened, as a message list. */
export function issuesFor(result: Result, field: string): string[] {
  return (result.issues ?? [])
    .filter((issue) => String(issue.path?.[0] ?? '') === field)
    .map((issue) => issue.message);
}

/* ── The refusal ───────────────────────────────────────────────────────── */

/**
 * A write the schema refused. Carries the ISSUES, not just a message.
 *
 * Declared here, not beside a store, so every store throws the ONE class a
 * caller can `instanceof`.
 *
 * TRAP T-one-class-to-catch
 */
export class ValidationError extends Error {
  readonly issues: ReadonlyArray<Issue>;

  constructor(issues: ReadonlyArray<Issue>) {
    super(issues.map((i) => `${String(i.path?.[0] ?? '')}: ${i.message}`.trim()).join('; '));
    this.name = 'ValidationError';
    this.issues = issues;
  }
}
