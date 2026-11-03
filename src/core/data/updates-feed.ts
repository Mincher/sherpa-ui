/**
 * updates-feed.ts — the app server's "what is new" feed: one small stream of
 * Server-Sent Events that every open app follows. It says THAT something CHANGED — a
 * new build, a store — never the data: a cause, which one tab acts on, never what
 * waits for a reader (`UpdateNotice`). DOM-free: a Node server or a
 * worker answers it with a web `Request` and `Response`. Plan 687 U2, U3
 * TRAP T-news-is-pushed-by-the-server
 *
 * Map:
 * - FeedNotice — What the feed says: a new build, a store that changed, or a gap.
 * - UpdatesFeed — The feed: say a notice to every follower, and answer a request to follow it.
 * - updatesFeed — Make the feed; it keeps its last notices, so a follower that reconnects hears what it missed.
 */

/** What the feed says: a new build, a store that changed — or, to a follower that
 *  missed more than it can say again, a gap. */
export type FeedNotice = { kind: 'app' } | { kind: 'data'; store: string } | { kind: 'gap' };

/** The feed: say a notice to every follower, and answer a request to follow it. */
export interface UpdatesFeed {
  /** Say a notice to every page that follows. */
  say(notice: FeedNotice): void;
  /** Answer a request to follow: an event stream that first says what a follower
   *  missed since its `Last-Event-ID` — or one gap, where it no longer keeps it all. */
  answer(request: Request): Response;
}

/** Make the feed. `keep`: how many notices it keeps to say again; `beat`: how
 *  often an idle stream says a comment, so no proxy shuts it. */
export function updatesFeed(options: { keep?: number; beat?: number } = {}): UpdatesFeed {
  const keep = options.keep ?? 100;
  // An id names this start of the server, so a follower from before hears a gap.
  const boot = Date.now().toString(36);
  const kept: { n: number; data: string }[] = [];
  let next = 1;
  const followers = new Set<ReadableStreamDefaultController<Uint8Array>>();
  const text = new TextEncoder();
  const frame = (n: number, data: string): Uint8Array => text.encode(`id: ${boot}-${n}\ndata: ${data}\n\n`);
  // A follower whose stream shut is dropped.
  const send = (bytes: Uint8Array): void => {
    for (const follower of followers) {
      try {
        follower.enqueue(bytes);
      } catch {
        followers.delete(follower);
        beating();
      }
    }
  };
  let beat: ReturnType<typeof setInterval> | undefined;
  const beating = (): void => {
    if (followers.size && !beat) beat = setInterval(() => send(text.encode(': beat\n\n')), options.beat ?? 25_000);
    if (!followers.size && beat) {
      clearInterval(beat);
      beat = undefined;
    }
  };
  return {
    say(notice) {
      const entry = { n: next++, data: JSON.stringify(notice) };
      kept.push(entry);
      if (kept.length > keep) kept.shift();
      send(frame(entry.n, entry.data));
    },
    answer(request) {
      const [from, seen] = (request.headers.get('Last-Event-ID') ?? '').split('-');
      const after = Number(seen);
      /* What it missed is said again where all of it is kept. Where some is not — the
         server started since, or let it go — it hears one gap, and checks everything. */
      const gap = !!from && (from !== boot || !Number.isFinite(after) || after < (kept[0]?.n ?? next) - 1);
      const missed = !from || gap ? [] : kept.filter((e) => e.n > after);
      let mine: ReadableStreamDefaultController<Uint8Array> | undefined;
      const body = new ReadableStream<Uint8Array>({
        start(controller) {
          mine = controller;
          controller.enqueue(text.encode('retry: 3000\n\n'));
          if (gap) controller.enqueue(frame(next - 1, JSON.stringify({ kind: 'gap' })));
          for (const e of missed) controller.enqueue(frame(e.n, e.data));
          followers.add(controller);
          beating();
        },
        cancel() {
          if (mine) followers.delete(mine);
          beating();
        },
      });
      return new Response(body, { headers: { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-cache' } });
    },
  };
}
