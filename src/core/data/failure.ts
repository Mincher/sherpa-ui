/**
 * failure.ts — what KIND of failure a read was, read from the error's shape: the
 * store's own failure, never `navigator`. DOM-free. TRAP T-a-failure-has-a-kind
 *
 * Map:
 * - FailureKind — Why a read failed, as a kind a page can act on.
 * - Failure — One failure: its kind, its message, and its HTTP status where it had one.
 * - failureOf — The kind of a thrown error, read by its shape.
 * - unreached — Could the store not be REACHED — offline, too slow, or a server that failed?
 */

/** Why a read failed, as a kind a page can act on. */
export type FailureKind = 'offline' | 'timeout' | 'server' | 'refused' | 'invalid' | 'unknown';

/** One failure: its kind, its message, and its HTTP status where it had one. */
export interface Failure {
  readonly kind: FailureKind;
  readonly message: string;
  readonly status?: number;
}

/** The kind of a thrown error, read by its shape: an `HttpError`'s `status`, a
 *  name a platform or Sherpa gives. Nothing is imported, so any store's errors count. */
export function failureOf(error: unknown): Failure {
  const { name, status, message } = (error ?? {}) as { name?: unknown; status?: unknown; message?: unknown };
  const text = typeof message === 'string' ? message : String(error);
  const at = (kind: FailureKind): Failure => (typeof status === 'number' ? { kind, message: text, status } : { kind, message: text });
  if (name === 'TimeoutError') return at('timeout');
  if (typeof status === 'number') {
    if (status === 408 || status === 504 || status === 524) return at('timeout');
    if (status === 429 || (status >= 500 && status < 600)) return at('server');
    if (status === 401 || status === 403 || status === 407) return at('refused');
    return at('invalid');
  }
  if (name === 'ValidationError' || name === 'SyntaxError') return at('invalid');
  // fetch's own network failure — and a refused CORS request looks the same.
  if (name === 'TypeError') return at('offline');
  return at('unknown');
}

/** Could the store not be REACHED — offline, too slow, or a server that failed?
 *  Data held before is still worth showing then; after a refusal it is not. */
export function unreached(failure: Failure): boolean {
  return failure.kind === 'offline' || failure.kind === 'timeout' || failure.kind === 'server';
}
