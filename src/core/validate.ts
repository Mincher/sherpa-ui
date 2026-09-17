/**
 * validate.ts — is this value allowed?
 *
 * One answer shape for every caller: a field that checks itself as you type, a
 * store that refuses a bad `insert`, a form that reports on submit. They have
 * different timing and different consequences, but "what is wrong with this"
 * should not be three different questions.
 *
 * TRAP T-standard-schema-is-duck-typed — the contract is Standard Schema's, and
 * accepting Zod / Valibot / ArkType costs no dependency.
 */

/* ── The answer ─────────────────────────────────────────────────────── */

/**
 * One thing that is wrong.
 *
 * `path` is Standard Schema's — an array, because a value can be nested. A
 * top-level value has no path at all.
 */
export interface Issue {
  message: string;
  path?: ReadonlyArray<PropertyKey>;
}

/**
 * What a validation says.
 *
 * Standard Schema's own shape: `issues` ABSENT means valid, and the parsed
 * `value` is then present — TRAP T-standard-schema-is-duck-typed.
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
 * The duck type. Declared, never imported — that is what keeps this
 * zero-dependency while still accepting Zod, Valibot and ArkType.
 *
 * TRAP T-standard-schema-is-duck-typed.
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

/**
 * Run a schema and always hand back a promise.
 *
 * A caller that awaits works with a synchronous schema too, so nothing branches
 * on which kind it was given.
 */
export async function validate<T>(
  schema: StandardSchema<unknown, T>,
  value: unknown,
): Promise<Result<T>> {
  return schema['~standard'].validate(value);
}

/* ── Rules ──────────────────────────────────────────────────────────── */

/**
 * One check on one value.
 *
 * Returns a message when the value is WRONG and nothing when it is fine. It may
 * be async, so "is this username taken?" needs no second mechanism.
 */
export type Rule = (value: unknown) => string | undefined | Promise<string | undefined>;

/**
 * Is this value absent?
 *
 * TRAP T-every-rule-but-required-passes-absent — `''` counts, zero and `false`
 * do not.
 */
function absent(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * There has to be something here.
 *
 * TRAP T-every-rule-but-required-passes-absent — only this rule objects to
 * emptiness, which is what makes an optional-but-constrained field possible.
 */
export function required(message = 'Required'): Rule {
  return (value) => (absent(value) ? message : undefined);
}

/** A number, and a real one — NaN and Infinity are not values a field can hold. */
export function number(message = 'Must be a number'): Rule {
  return (value) => {
    if (absent(value)) return undefined;
    const n = typeof value === 'number' ? value : Number(value);
    return Number.isFinite(n) ? undefined : message;
  };
}

/** At least this much. Numbers compare; strings and arrays measure their length. */
export function min(limit: number, message?: string): Rule {
  return (value) => {
    if (absent(value)) return undefined;
    const size = sizeOf(value);
    if (size == null) return undefined;
    return size < limit ? (message ?? defaultLimitMessage(value, 'at least', limit)) : undefined;
  };
}

/** At most this much. The mirror of `min`. */
export function max(limit: number, message?: string): Rule {
  return (value) => {
    if (absent(value)) return undefined;
    const size = sizeOf(value);
    if (size == null) return undefined;
    return size > limit ? (message ?? defaultLimitMessage(value, 'at most', limit)) : undefined;
  };
}

/**
 * What `min`/`max` compare.
 *
 * A NUMBER is its own size; a string or an array is its length. Anything else
 * returns null so the rule passes —
 * TRAP T-every-rule-but-required-passes-absent.
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
  return (value) => {
    if (absent(value)) return undefined;
    return re.test(String(value)) ? undefined : message;
  };
}

/**
 * Looks like an email address.
 *
 * TRAP T-email-check-is-deliberately-loose — a stricter regex rejects real
 * addresses, and only sending to one proves it works.
 */
export function email(message = 'Enter a valid email address'): Rule {
  return pattern(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, message);
}

/** A URL the platform's own parser accepts — no regex to get wrong. */
export function url(message = 'Enter a valid URL'): Rule {
  return (value) => {
    if (absent(value)) return undefined;
    return URL.canParse(String(value)) ? undefined : message;
  };
}

/** One of these. The allowed set is compared as STRINGS, as an attribute would. */
export function oneOf(allowed: readonly unknown[], message?: string): Rule {
  const set = new Set(allowed.map((v) => String(v)));
  return (value) => {
    if (absent(value)) return undefined;
    return set.has(String(value))
      ? undefined
      : (message ?? `Must be one of: ${allowed.join(', ')}`);
  };
}

/**
 * Anything else.
 *
 * The escape hatch, and why the rule set stays small.
 */
export function custom(check: Rule): Rule {
  return check;
}

/* ── Building a schema from rules ───────────────────────────────────── */

/** A field's rules — one, or several run in order. */
export type FieldRules = Rule | readonly Rule[];

/** A record's rules, keyed by field. */
export type RuleMap = Readonly<Record<string, FieldRules>>;

/**
 * Turn rules into a Standard Schema.
 *
 * So the built-in and a third-party schema are the SAME kind of thing to every
 * caller — TRAP T-standard-schema-is-duck-typed. Rules on one field run IN ORDER
 * and stop at the first failure
 * (TRAP T-every-rule-but-required-passes-absent).
 *
 *   rules({ email: [required(), email()], seats: number() })
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
 * Run one field's rules on its own.
 *
 * For a field validating itself as it is typed. Same rules, same messages —
 * TRAP T-every-rule-but-required-passes-absent.
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

/**
 * Every issue for one field, as a message list.
 *
 * Flattens the path so a form-level summary compares plain strings.
 */
export function issuesFor(result: Result, field: string): string[] {
  return (result.issues ?? [])
    .filter((issue) => String(issue.path?.[0] ?? '') === field)
    .map((issue) => issue.message);
}
