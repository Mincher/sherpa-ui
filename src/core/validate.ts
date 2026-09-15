/**
 * validate.ts — is this value allowed?
 *
 * One answer shape for every caller: a field that checks itself as you type, a
 * store that refuses a bad `insert`, a form that reports on submit. They have
 * different timing and different consequences, but "what is wrong with this"
 * should not be three different questions.
 *
 * ## The contract is Standard Schema's
 *
 * `standardschema.dev` is a community INTERFACE CONVENTION — not a spec, not a
 * TC39 proposal — under which a schema advertises a `~standard` property holding
 * a `validate` function. Zod, Valibot and ArkType all implement it.
 *
 * It is duck-typed, so Sherpa can accept any of them WITHOUT importing anything
 * and without gaining a dependency. `rules()` below builds a schema of the same
 * shape, so a caller who wants nothing extra uses the built-in and a caller who
 * already has Zod passes that instead — through the same door:
 *
 *   new ArrayStore(rows, { schema: rules({ email: [required(), email()] }) })
 *   new ArrayStore(rows, { schema: zodSchema })
 *
 * Two details of that contract are honoured here and matter downstream:
 *
 *  - `validate()` may return a result OR a promise of one. Every caller must
 *    handle both — which is also what makes an async rule ("is this username
 *    taken?") work through the same door as a synchronous one.
 *  - An issue is `{ message, path? }`. Sherpa's own Issue stays compatible
 *    rather than inventing a different shape.
 */

/* ── The answer ─────────────────────────────────────────────────────── */

/**
 * One thing that is wrong.
 *
 * `path` is Standard Schema's, and it is an ARRAY because a value can be nested:
 * `['address', 'postcode']` names a field inside a field. A top-level value has
 * no path at all.
 */
export interface Issue {
  message: string;
  path?: ReadonlyArray<PropertyKey>;
}

/**
 * What a validation says.
 *
 * Standard Schema's own shape: `issues` ABSENT means valid, and the parsed
 * `value` is then present. That is deliberately not a `valid: boolean` — a
 * schema may COERCE ("42" → 42), and the caller needs what it settled on rather
 * than only whether it passed.
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
 * A caller that awaits works with a synchronous schema too, so nothing has to
 * branch on which kind it was given.
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
 * Returns a message when the value is WRONG and nothing when it is fine, which
 * reads the way the rule is named: `required()` returns "Required" when it is
 * missing.
 *
 * It may be async, so "is this username taken?" is the same kind of thing as
 * "is this a number" and needs no second mechanism.
 */
export type Rule = (value: unknown) => string | undefined | Promise<string | undefined>;

/**
 * Is this value absent?
 *
 * Empty string counts, because a text input that has been cleared holds `''` and
 * a reader means the same thing by it as by never typing. Zero and `false` do
 * NOT count — they are answers.
 */
function absent(value: unknown): boolean {
  return value == null || value === '' || (Array.isArray(value) && value.length === 0);
}

/**
 * There has to be something here.
 *
 * Every other rule PASSES an absent value, so a field can be optional and still
 * be constrained when filled. Only this one objects to emptiness, which is what
 * lets `[min(3)]` mean "if you write something, write three characters" and
 * `[required(), min(3)]` mean "write something, and make it three".
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
 * has no meaningful size, and returns null so the rule passes rather than
 * inventing a comparison — a rule that cannot judge should not object.
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
 * Deliberately loose: `something@something.something`. A stricter regex rejects
 * addresses that are real (RFC 5322 allows quoted strings and comments), and the
 * only way to know an address works is to send to it. This catches typing a name
 * into the email box, which is what a client-side check is for.
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
 * The escape hatch, and the reason the rule set stays small: a check nobody else
 * needs does not have to be in the library to be usable.
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
 * caller. A store takes `{ schema }` and never asks which it was given.
 *
 *   rules({ email: [required(), email()], seats: number() })
 *
 * Rules on one field run IN ORDER and stop at the first failure. A field that is
 * empty should say "Required", not "Required" and "Must be at least 3
 * characters" — the second is noise when the first is the reason.
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
              // FIRST failure only, per field — see above.
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
 * For a field validating itself as it is typed, where building a whole record
 * to check one value would be the wrong shape. Same rules, same messages — the
 * form and the field cannot disagree about what is allowed.
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
 * A form-level summary needs to point at fields; this is the lookup that makes
 * that cheap, and it flattens the path so a caller compares plain strings.
 */
export function issuesFor(result: Result, field: string): string[] {
  return (result.issues ?? [])
    .filter((issue) => String(issue.path?.[0] ?? '') === field)
    .map((issue) => issue.message);
}
