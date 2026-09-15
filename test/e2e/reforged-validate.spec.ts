import { expect, test } from '@playwright/test';

/**
 * validate.ts — one answer shape for every caller.
 *
 * A field checking itself as you type, a store refusing a bad insert, and a form
 * reporting on submit have different timing and different consequences, but
 * "what is wrong with this" should not be three different questions.
 */
test.beforeEach(async ({ page }) => {
  await page.goto('/test/harness.html');
});

test('rules() builds a Standard Schema, and reports the first failure per field', async ({
  page,
}) => {
  const r = await page.evaluate(async () => {
    const { rules, required, email, min, number, isValid, isSchema, issuesFor } =
      (await import('/dist/index.js')) as unknown as Record<string, never> &
        typeof import('../../src/core/validate.js');

    const schema = rules({
      // TWO rules on one field: they run IN ORDER and stop at the first that
      // fails, so an empty field says "Required" rather than that AND "Must be
      // at least 3 characters" — the second is noise when the first is why.
      name: [required(), min(3)],
      email: [required(), email()],
      seats: number(),
    });

    // DUCK-TYPED. A Zod, Valibot or ArkType schema satisfies the same check,
    // which is what lets a caller pass one without this library importing any.
    const looksStandard = isSchema(schema);

    const empty = await schema['~standard'].validate({});
    const badEmail = await schema['~standard'].validate({
      name: 'Ada',
      email: 'not-an-address',
      seats: 4,
    });
    const good = await schema['~standard'].validate({
      name: 'Ada',
      email: 'ada@example.com',
      seats: 4,
    });

    return {
      looksStandard,
      emptyMessages: (empty.issues ?? []).map((i) => `${String(i.path?.[0])}: ${i.message}`),
      emailOnly: issuesFor(badEmail, 'email'),
      // An absent optional value PASSES every rule but `required`, which is what
      // lets a field be optional and still constrained when filled.
      seatsWhenEmpty: issuesFor(empty, 'seats'),
      goodIsValid: isValid(good),
      // Standard Schema reports the PARSED value, not a boolean — a schema may
      // coerce, and the caller needs what it settled on.
      goodValue: good.value,
    };
  });

  expect(r.looksStandard).toBe(true);

  // One message per field, the first that failed.
  expect(r.emptyMessages).toEqual(['name: Required', 'email: Required']);
  expect(r.emailOnly).toEqual(['Enter a valid email address']);
  expect(r.seatsWhenEmpty).toEqual([]);

  expect(r.goodIsValid).toBe(true);
  expect(r.goodValue).toEqual({ name: 'Ada', email: 'ada@example.com', seats: 4 });
});

test('a rule may be ASYNC, and runs through the same door', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { rules, custom, validate } = (await import(
      '/dist/index.js'
    )) as unknown as typeof import('../../src/core/validate.js');

    // "Is this username taken?" is the case this exists for — a check that has
    // to ask something else, with no second mechanism to learn.
    const taken = new Set(['ada']);
    const schema = rules({
      username: custom(async (value) => {
        await new Promise((res) => setTimeout(res, 10));
        return taken.has(String(value)) ? 'Already taken' : undefined;
      }),
    });

    const clash = await validate(schema, { username: 'ada' });
    const free = await validate(schema, { username: 'grace' });
    return { clash: clash.issues?.[0]?.message, free: free.issues };
  });

  expect(r.clash).toBe('Already taken');
  expect(r.free).toBeUndefined();
});

/**
 * V5 — the guard is on the STORE.
 *
 * A form is not the only way a record arrives: a REST response, a paste, a
 * script and a second UI all reach the same records, and a rule enforced in one
 * screen is not a rule.
 */
test('a store with a schema refuses a bad write and never announces it', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore, rules, required, min, ValidationError } = (await import(
      '/dist/index.js'
    )) as unknown as typeof import('../../src/core/stores.js') &
      typeof import('../../src/core/validate.js');

    const store = new ArrayStore([{ id: 1, name: 'Ada' }], {
      schema: rules({ name: [required(), min(3)] }),
    });

    const announced: unknown[] = [];
    store.addEventListener('change', (e) => announced.push((e as CustomEvent).detail.type));

    let refused: unknown = null;
    try {
      await store.insert({ id: 2, name: '' });
    } catch (err) {
      refused = err;
    }

    const afterRefusal = (await store.load()).total;

    // …and a good one goes through.
    await store.insert({ id: 3, name: 'Grace' });
    const afterGood = (await store.load()).total;

    // An UPDATE checks the MERGED row, not the patch — a schema sees whole
    // records, so `{ id: 1 }` alone would fail `required` for a field the update
    // never mentioned.
    let patchOk = true;
    try {
      await store.update(1, { id: 1 });
    } catch {
      patchOk = false;
    }

    return {
      isValidationError: refused instanceof ValidationError,
      issues: (refused as { issues?: { message: string; path?: unknown[] }[] })?.issues?.map(
        (i) => `${String(i.path?.[0])}: ${i.message}`,
      ),
      // NOTHING was announced for the refused write — the row never existed, so
      // no bound component ever saw it.
      announced,
      afterRefusal,
      afterGood,
      patchOk,
    };
  });

  expect(r.isValidationError).toBe(true);
  // The ISSUES travel with the error, so a form can put each beside its field —
  // a single "invalid" string would force the UI to guess.
  expect(r.issues).toEqual(['name: Required']);

  expect(r.afterRefusal).toBe(1);
  expect(r.afterGood).toBe(2);
  // The REFUSED write announced nothing — only the two that succeeded did. A
  // change event for a row that was never saved would tell every bound component
  // to reload for nothing, and a listener that trusted it would show a record
  // the store does not hold.
  expect(r.announced).toEqual(['insert', 'update']);

  expect(r.patchOk).toBe(true);
});

test('a store WITHOUT a schema is unchanged', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { ArrayStore } = (await import(
      '/dist/index.js'
    )) as unknown as typeof import('../../src/core/stores.js');

    // No schema means no check, so this cannot break a caller that had none.
    const store = new ArrayStore([]);
    await store.insert({ id: 1, name: '' });
    return (await store.load()).total;
  });

  expect(r).toBe(1);
});
