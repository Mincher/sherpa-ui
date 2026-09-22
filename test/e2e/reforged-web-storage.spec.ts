import { test, expect } from './harness';

/**
 * WEB STORAGE CANNOT THROW THROUGH THIS MODULE.
 *
 * `localStorage` throws on ACCESS — not on read, on touching the global — in a
 * private window, with site data blocked, and during preview or thumbnail
 * capture. `persist-view.ts` and `session.ts` each carried a byte-identical
 * `storage()` plus a try/catch at every call site: nineteen catch blocks
 * across three files guarding one quirk.
 *
 * TRAP T-storage-access-throws
 */

/** Make every `localStorage` touch throw, the way a blocked window does. */
const BLOCK = `
  window.__realLocalStorage = Object.getOwnPropertyDescriptor(window, 'localStorage');
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    get() { throw new DOMException('blocked', 'SecurityError'); },
  });
`;

const RESTORE = `
  if (window.__realLocalStorage) {
    Object.defineProperty(window, 'localStorage', window.__realLocalStorage);
  }
`;

test('every access survives a store that throws on touch', async ({ page }) => {
  const r = await page.evaluate(async ({ block, restore }) => {
    const { readText, writeText, readJson, writeJson, removeKey } =
      (await import('/dist/core/browser/web-storage.js')) as {
        readText: (k: string, key: string) => string | null;
        writeText: (k: string, key: string, v: string) => void;
        readJson: <T>(k: string, key: string, fallback: T) => T;
        writeJson: (k: string, key: string, v: unknown) => void;
        removeKey: (k: string, key: string) => void;
      };

    // eslint-disable-next-line no-new-func
    new Function(block)();
    const out: Record<string, unknown> = {};
    try {
      out.readText = readText('local', 'probe');
      out.readJson = readJson('local', 'probe', { fell: 'back' });
      writeText('local', 'probe', 'v');
      writeJson('local', 'probe', { a: 1 });
      removeKey('local', 'probe');
      out.survived = true;
    } catch (error) {
      out.threw = String(error);
    }
    // eslint-disable-next-line no-new-func
    new Function(restore)();
    return out;
  }, { block: BLOCK, restore: RESTORE });

  expect(r.survived).toBe(true);
  expect(r.threw).toBeUndefined();
  // A failure means the value is NOT KEPT, never that the caller sees an error.
  expect(r.readText).toBeNull();
  expect(r.readJson).toEqual({ fell: 'back' });
});

test('a stored value this code cannot read is FORGOTTEN, not returned', async ({ page }) => {
  const r = await page.evaluate(async () => {
    const { readJson } = (await import('/dist/core/browser/web-storage.js')) as {
      readJson: <T>(k: string, key: string, fallback: T, guard?: (v: unknown) => boolean) => T;
    };

    // A stored object outlives the code that wrote it, and a hand-edited one
    // is a plain string. Both must leave the reader where they started.
    localStorage.setItem('probe-a', 'not json at all');
    const notJson = readJson('local', 'probe-a', 'FALLBACK');
    const notJsonCleared = localStorage.getItem('probe-a') === null;

    localStorage.setItem('probe-b', '"a plain string"');
    const wrongShape = readJson(
      'local', 'probe-b', 'FALLBACK',
      (v) => typeof v === 'object' && v !== null,
    );
    const wrongShapeCleared = localStorage.getItem('probe-b') === null;

    localStorage.setItem('probe-c', '{"real":true}');
    const good = readJson('local', 'probe-c', { real: false });
    const goodKept = localStorage.getItem('probe-c') !== null;
    localStorage.removeItem('probe-c');

    return { notJson, notJsonCleared, wrongShape, wrongShapeCleared, good, goodKept };
  });

  expect(r.notJson).toBe('FALLBACK');
  expect(r.notJsonCleared).toBe(true);
  // The guard is what makes a SHAPE check possible; without one any parsed
  // value passes, which is right for a caller taking `unknown` and wrong here.
  expect(r.wrongShape).toBe('FALLBACK');
  expect(r.wrongShapeCleared).toBe(true);
  // …and a value it CAN read is kept, not swept along with the rest.
  expect(r.good).toEqual({ real: true });
  expect(r.goodKept).toBe(true);
});
