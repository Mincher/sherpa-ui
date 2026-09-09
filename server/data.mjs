/**
 * data.mjs — the swappable datastore.
 *
 * In a real app this is your DB / API layer. The starter ships an in-memory list
 * so the boilerplate runs with zero setup. Replace these with real queries; the
 * fragment renderers only depend on this shape. Includes a mutation (toggleDone)
 * to exercise the write path (hx-post) in the example app.
 */

let SEQ = 5;
const TASKS = [
  { id: 'alpha', label: 'Alpha project', description: 'Kickoff pending', status: 'info', done: false },
  { id: 'bravo', label: 'Bravo rollout', description: 'On track', status: 'success', done: false },
  { id: 'charlie', label: 'Charlie migration', description: 'Blocked on review', status: 'warning', done: false },
  { id: 'delta', label: 'Delta sunset', description: 'Escalated', status: 'critical', done: true },
];

export const listTasks = ({ filter } = {}) =>
  filter === 'open' ? TASKS.filter((t) => !t.done)
    : filter === 'done' ? TASKS.filter((t) => t.done)
      : TASKS;

export const getTask = (id) => TASKS.find((t) => t.id === id) ?? null;

export function toggleDone(id) {
  const t = getTask(id);
  if (t) t.done = !t.done;
  return t;
}

export function addTask(label) {
  const id = `task-${++SEQ}`;
  const t = { id, label: label || 'Untitled task', description: 'New', status: 'info', done: false };
  TASKS.push(t);
  return t;
}

export const counts = () => ({
  all: TASKS.length,
  open: TASKS.filter((t) => !t.done).length,
  done: TASKS.filter((t) => t.done).length,
});
