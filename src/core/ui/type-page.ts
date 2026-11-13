/**
 * type-page.ts — a type's own page, for a Context that names a `type` and no template: its markup (a container with the
 * filter toolbar, a grid and a pager, as the records-list pattern lays them) and its page definition (the type's store
 * and words, a data scope that holds its status fields, the grid's columns). Will, plan 960 U3 (D2 A)
 *
 * Map:
 * - typePage — A type's own page: its markup and its page definition.
 */
import type { PageDefinition } from '../data/page-definition.js';
import { typeColumns, type TypeDefinition } from '../data/type-definition.js';

/** The page's markup: the same for every type, as its definition says the rest. */
const MARKUP = `<sherpa-container data-scope="data" data-grow data-fill data-padding="none" data-padding-inline="md">
  <sherpa-stack data-gap="md" data-grow data-fill>
    <sherpa-quick-filter-toolbar data-scope="data"></sherpa-quick-filter-toolbar>
    <sherpa-data-grid id="grid" data-scope="data" data-grow data-column-filters></sherpa-data-grid>
  </sherpa-stack>
  <sherpa-pagination slot="footer"></sherpa-pagination>
</sherpa-container>`;

/** A type's own page, under the Context's id: its markup and its page definition. A graph type's rows lead with each
 *  entity's name. */
export function typePage(type: TypeDefinition, id: string): { markup: string; definition: PageDefinition } {
  const status = Object.entries(type.fields ?? {}).filter(([, f]) => f.type === 'status').map(([name]) => name);
  const columns = [...(type.graph ? [{ field: 'label', sortable: true as const }] : []), ...typeColumns(type)];
  return {
    markup: MARKUP,
    definition: {
      v: 1, id,
      source: { type: type.id, pageSize: 50, scopes: { data: { label: type.label, offers: 'all', ...(status.length ? { holds: status } : {}) } } },
      ui: { grid: { key: type.key ?? 'id', columns } },
    },
  };
}
