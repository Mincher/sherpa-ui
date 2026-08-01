/**
 * drag-sort.ts — reorderable-list drag helper.
 *
 * Wires native HTML drag-and-drop on a container so its direct children can be
 * reordered by dragging a handle. Framework-free; works across shadow DOM via
 * composedPath(). Extracted from sherpa-nav so any list (nav sections, tabs,
 * transfer-list, etc.) can reuse it.
 *
 *   setupDragSort(listEl, {
 *     itemSelector: '.item',
 *     handleSelector: '.drag-handle',
 *     idAttribute: 'itemId',
 *     isEnabled: () => this.isEditing,
 *     onReorder: (ids) => this.persist(ids),
 *   });
 */

export interface DragSortOptions {
  /** Selector for the reorderable items (direct children of the container). */
  itemSelector: string;
  /** Selector for the drag handle within an item (drag starts only from here). */
  handleSelector: string;
  /** dataset key holding each item's id (default: 'id'). */
  idAttribute?: string;
  /** Gate: return false to disable dragging (e.g. only in edit mode). */
  isEnabled?: () => boolean;
  /** Called on drop with the resulting ordered ids. */
  onReorder?: (orderedIds: (string | undefined)[]) => void;
}

/** Attach drag-to-reorder behaviour to a container's items. */
export function setupDragSort(container: HTMLElement, {
  itemSelector,
  handleSelector,
  idAttribute = 'id',
  isEnabled = (): boolean => true,
  onReorder = (): void => {},
}: DragSortOptions): void {
  // Drag starts only from the handle: arm draggable on mousedown over a handle.
  container.addEventListener('mousedown', (e) => {
    if (!isEnabled()) return;
    const isHandle = e.composedPath().some(
      (n) => n instanceof HTMLElement && n.matches?.(handleSelector)
    );
    if (!isHandle) return;
    const item = e.composedPath().find(
      (n): n is HTMLElement => n instanceof HTMLElement && n.parentElement === container
    );
    if (!item) return;
    item.draggable = true;
    const reset = (): void => { item.draggable = false; document.removeEventListener('mouseup', reset, true); };
    document.addEventListener('mouseup', reset, true);
  });

  container.querySelectorAll<HTMLElement>(itemSelector).forEach((item) => {
    item.draggable = false;
    item.addEventListener('dragstart', (e) => {
      if (!isEnabled()) { e.preventDefault(); return; }
      item.setAttribute('data-dragging', '');
      if (e.dataTransfer) {
        e.dataTransfer.effectAllowed = 'move';
        e.dataTransfer.setData('text/plain', item.dataset[idAttribute] || '');
      }
    });
    item.addEventListener('dragend', () => {
      item.draggable = false;
      item.removeAttribute('data-dragging');
    });
  });

  container.addEventListener('dragover', (e) => {
    if (!isEnabled()) return;
    e.preventDefault();
    if (e.dataTransfer) e.dataTransfer.dropEffect = 'move';
    const dragging = container.querySelector('[data-dragging]');
    if (!dragging) return;
    const siblings = [...container.querySelectorAll(`${itemSelector}:not([data-dragging])`)];
    const next = siblings.find((s) =>
      e.clientY - s.getBoundingClientRect().top - s.getBoundingClientRect().height / 2 < 0
    );
    container.insertBefore(dragging, next ?? null);
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const orderedIds = [...container.querySelectorAll<HTMLElement>(itemSelector)].map(
      (el) => el.dataset[idAttribute]
    );
    onReorder(orderedIds);
  });
}
