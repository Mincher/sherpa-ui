/**
 * task-queue.ts — a small, GENERIC queue of async tasks, shaped like a task manager and agnostic of what each runs. A task
 * is `{ id, kind, requestedBy, state, history[], outcome }`; it is queued, running, then ok or failed, and a run may say
 * its own named states. Tasks with one `key` are exclusive: a second request while one is queued or running is BLOCKED, not
 * queued. The queue is asked (`get`, `list`, `busy`) and heard (`task-change`, `task-blocked`, and `task-notice`, which
 * sums what finished in a short while into ONE summary). In memory, with a light history. Pure: no DOM. Will, TODOs 843, 844
 * · docs/history/plan-836-data-through-nodes.md · TRAP T-a-task-queue-knows-nothing-of-what-it-runs
 *
 * Map:
 * - TaskState — Where a task is: queued, running, ok, failed, or a name a run gave.
 * - TaskOutcome — What a run came to: whether it went well, its words for a notice, and a value.
 * - Task — One task as the queue tells it: a copy, never the queue's own.
 * - TaskContext — What a run is given: a signal that stops it, and a way to say a named state.
 * - TaskSpec — A task asked for: its kind, who asks, an exclusive key, and its run.
 * - TaskNotice — What finished in a while, summed in words.
 * - TaskQueueOptions — How many run at once, how long a notice waits, how much history is kept.
 * - TaskQueue — The queue: submit, get, list, busy, cancel; and its three events.
 * - .submit — Ask for a task.
 * - .get — One task by id, or none.
 * - .list — Every task still held, oldest first; narrowed by kind, state or who asked.
 * - .busy — Is a task of this key (or, with none given, any task) queued or running?
 * - .cancel — Stop a task: a queued one never runs; a running one is signalled, and ends failed as "Stopped".
 */

/** Where a task is: queued, running, ok, failed, or a name a run gave. */
export type TaskState = 'queued' | 'running' | 'ok' | 'failed' | (string & {});

/** What a run came to: whether it went well (left out, it did), its words for a notice, and a value. */
export interface TaskOutcome {
  ok?: boolean;
  words?: string;
  value?: unknown;
}

/** One task as the queue tells it: a copy, never the queue's own. */
export interface Task {
  readonly id: string;
  readonly kind: string;
  readonly requestedBy: string;
  readonly key?: string;
  readonly state: TaskState;
  readonly history: readonly { state: TaskState; at: number }[];
  readonly outcome?: TaskOutcome;
  /** Why it failed, in words: its error, or "Stopped". */
  readonly error?: string;
}

/** What a run is given: a signal that stops it, and a way to say a named state. */
export interface TaskContext {
  signal: AbortSignal;
  state(name: string): void;
}

/** A task asked for: its kind, who asks, an exclusive key (none, any number run), and its run. */
export interface TaskSpec {
  kind: string;
  requestedBy: string;
  key?: string;
  /** What it returns, if an outcome (`TaskOutcome`), is its outcome; nothing, it went well. */
  run(context: TaskContext): unknown;
}

/** What finished in a while, summed in words: one task says its own words, several are counted. */
export interface TaskNotice {
  tasks: readonly Task[];
  failed: number;
  words: string;
}

/** How many run at once (default 1: the rest are queued), how long a notice waits to sum what ends (ms, default 400), and how
 *  many finished tasks the history keeps (default 100). */
export interface TaskQueueOptions {
  limit?: number;
  wait?: number;
  history?: number;
  now?: () => number;
}

/** What the queue holds of a task beyond what it tells. */
interface Held {
  task: { -readonly [K in keyof Task]: Task[K] } & { history: { state: TaskState; at: number }[] };
  spec: TaskSpec;
  stop: AbortController;
}

/** The queue: submit, get, list, busy, cancel; and it fires `task-change` (a task moved), `task-blocked` (a second request
 *  met an exclusive one) and `task-notice` (what ended, summed), each a CustomEvent whose detail is the task or the notice. */
export class TaskQueue extends EventTarget {
  /** Its options, filled. */
  readonly #options: Required<TaskQueueOptions>;
  /** Every task it holds, by id. */
  readonly #held = new Map<string, Held>();
  /** How many tasks were asked for: the next id. */
  #n = 0;
  /** How many are running now. */
  #running = 0;
  /** The ids that wait, in order. */
  #pending: string[] = [];
  /** What ended since the last notice. */
  #ended: Task[] = [];
  /** The wait that sums the next notice. */
  #timer: ReturnType<typeof setTimeout> | undefined;

  constructor(options: TaskQueueOptions = {}) {
    super();
    this.#options = { limit: options.limit ?? 1, wait: options.wait ?? 400, history: options.history ?? 100, now: options.now ?? Date.now };
  }

  /** Ask for a task. A key that a task queued or running holds already blocks it: `accepted` is false, and `task` is the one
   *  in its way. Otherwise it is queued, and runs when a place is free. */
  submit(spec: TaskSpec): { task: Task; accepted: boolean } {
    const inWay = spec.key === undefined ? undefined : [...this.#held.values()].find((h) => h.task.key === spec.key && (h.task.state !== 'ok' && h.task.state !== 'failed'));
    if (inWay) {
      this.#say('task-blocked', this.#view(inWay));
      return { task: this.#view(inWay), accepted: false };
    }
    const id = `task-${++this.#n}`;
    const held: Held = {
      task: { id, kind: spec.kind, requestedBy: spec.requestedBy, ...(spec.key !== undefined ? { key: spec.key } : {}), state: 'queued', history: [{ state: 'queued', at: this.#options.now() }] },
      spec, stop: new AbortController(),
    };
    this.#held.set(id, held);
    this.#pending.push(id);
    this.#say('task-change', this.#view(held));
    this.#pump();
    return { task: this.#view(held), accepted: true };
  }

  /** One task by id, or none. */
  get(id: string): Task | undefined {
    const held = this.#held.get(id);
    return held && this.#view(held);
  }

  /** Every task still held, oldest first; narrowed by kind, state or who asked. */
  list(filter: { kind?: string; state?: TaskState; requestedBy?: string } = {}): Task[] {
    return [...this.#held.values()].map((h) => this.#view(h)).filter((t) =>
      (filter.kind === undefined || t.kind === filter.kind) && (filter.state === undefined || t.state === filter.state)
      && (filter.requestedBy === undefined || t.requestedBy === filter.requestedBy));
  }

  /** Is a task of this key (or, with none given, any task) queued or running? */
  busy(key?: string): boolean {
    return [...this.#held.values()].some((h) => (key === undefined || h.task.key === key) && h.task.state !== 'ok' && h.task.state !== 'failed');
  }

  /** Stop a task: a queued one never runs; a running one is signalled, and ends failed as "Stopped". */
  cancel(id: string): void {
    const held = this.#held.get(id);
    if (!held || held.task.state === 'ok' || held.task.state === 'failed') return;
    held.stop.abort();
    if (held.task.state === 'queued') {
      this.#pending = this.#pending.filter((p) => p !== id);
      this.#end(held, { ok: false }, 'Stopped');
    }
  }

  /** A task as a copy, for whoever asks. */
  #view(held: Held): Task {
    const t = held.task;
    return { ...t, history: t.history.map((h) => ({ ...h })), ...(t.outcome ? { outcome: { ...t.outcome } } : {}) };
  }

  /** Tell those who listen. */
  #say(type: string, detail: unknown): void {
    this.dispatchEvent(new CustomEvent(type, { detail }));
  }

  /** A task moves to a state, in its history. */
  #move(held: Held, state: TaskState): void {
    held.task.state = state;
    held.task.history.push({ state, at: this.#options.now() });
    this.#say('task-change', this.#view(held));
  }

  /** Start what waits, while a place is free. */
  #pump(): void {
    while (this.#running < this.#options.limit && this.#pending.length) {
      const held = this.#held.get(this.#pending.shift()!)!;
      this.#running++;
      this.#move(held, 'running');
      const context: TaskContext = { signal: held.stop.signal, state: (name) => { if (held.task.state !== 'ok' && held.task.state !== 'failed' && held.task.state !== name) this.#move(held, name); } };
      void Promise.resolve().then(() => held.spec.run(context)).then(
        (returned) => this.#end(held, typeof returned === 'object' && returned !== null ? (returned as TaskOutcome) : {}, undefined),
        (error: unknown) => this.#end(held, { ok: false }, held.stop.signal.aborted ? 'Stopped' : error instanceof Error ? error.message : String(error)),
      );
    }
  }

  /** A task is over: ok or failed, with its words. */
  #end(held: Held, outcome: TaskOutcome, error: string | undefined): void {
    const ok = outcome.ok !== false && error === undefined;
    const wasRunning = held.task.history.some((h) => h.state === 'running');
    held.task.outcome = ok ? outcome : { ...outcome, ok: false };
    if (error !== undefined) held.task.error = error;
    this.#move(held, ok ? 'ok' : 'failed');
    if (wasRunning) this.#running--;
    this.#ended.push(this.#view(held));
    this.#forget();
    this.#schedule();
    this.#pump();
  }

  /** The history is light: the oldest finished tasks go. */
  #forget(): void {
    const done = [...this.#held.values()].filter((h) => h.task.state === 'ok' || h.task.state === 'failed');
    for (const h of done.slice(0, Math.max(0, done.length - this.#options.history))) this.#held.delete(h.task.id);
  }

  /** What ends within the wait is ONE notice. */
  #schedule(): void {
    clearTimeout(this.#timer);
    this.#timer = setTimeout(() => {
      const tasks = this.#ended;
      this.#ended = [];
      if (!tasks.length) return;
      const failed = tasks.filter((t) => t.state === 'failed').length;
      const one = tasks.length === 1 ? tasks[0]! : undefined;
      const words = one ? (one.outcome?.words ?? (one.state === 'failed' ? `${one.kind} failed${one.error ? `: ${one.error}` : ''}` : `${one.kind} done`))
        : `${tasks.length} tasks finished${failed ? `, ${failed} failed` : ''}`;
      this.#say('task-notice', { tasks, failed, words } satisfies TaskNotice);
    }, this.#options.wait);
  }
}
