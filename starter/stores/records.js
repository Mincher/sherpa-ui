/**
 * The app's one store: IndexedDB where the browser has it, memory where not,
 * seeded on a first run. Bump seedVersion when the seed rows change.
 */
import { localRecords, number, oneOf, required, rules } from 'sherpa-ui';

const seed = [
  { id: 1, name: 'Contoso', status: 'active', owner: 'Dana Whitlock', seats: 120 },
  { id: 2, name: 'Northwind', status: 'active', owner: 'Ravi Menon', seats: 45 },
  { id: 3, name: 'Fabrikam', status: 'trial', owner: 'Dana Whitlock', seats: 12 },
  { id: 4, name: 'Tailspin', status: 'trial', owner: 'Mei Chen', seats: 8 },
  { id: 5, name: 'Wingtip', status: 'active', owner: 'Mei Chen', seats: 64 },
  { id: 6, name: 'Litware', status: 'churned', owner: 'Ravi Menon', seats: 30 },
];

export const { store: records, ready: recordsReady } = localRecords({
  name: 'records', database: 'my-app', key: 'id',
  // The schema says what a field may hold: oneOf is the list a filter offers, in order.
  schema: rules({ name: required(), status: oneOf(['active', 'trial', 'churned']), seats: number() }),
  seed, seedVersion: 1,
});
