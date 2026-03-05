/**
 * drag-sort.js — Lightweight drag-and-drop reordering for sibling elements.
 *
 * Usage:
 *   setupDragSort(container, {
 *     itemSelector: '.nav-section',
 *     handleSelector: '.drag',
 *     isEnabled: () => true,
 *     onReorder: (orderedIds) => { ... }
 *   });
 *
 * Items must have a `data-*` attribute used to build the ordered ID list.
 * Drag is constrained to the container boundaries.
 */

/**
 * @param {HTMLElement} container - Parent element whose children will be reorderable.
 * @param {Object} options
 * @param {string} options.itemSelector - CSS selector for draggable items.
 * @param {string} options.handleSelector - CSS selector for drag handle within each item.
 * @param {string} [options.idAttribute='sectionId'] - dataset key used as the item ID.
 * @param {() => boolean} [options.isEnabled] - Predicate; drag only starts when true.
 * @param {(orderedIds: string[]) => void} [options.onReorder] - Called after drop with new order.
 */
export function setupDragSort(container, {
  itemSelector,
  handleSelector,
  idAttribute = 'sectionId',
  isEnabled = () => true,
  onReorder = () => {}
} = {}) {

  // Delegated mousedown — crosses shadow boundaries via composedPath()
  container.addEventListener('mousedown', (e) => {
    if (!isEnabled()) return;
    const isHandle = e.composedPath().some(
      n => n instanceof HTMLElement && n.matches?.(handleSelector)
    );
    if (!isHandle) return;
    // Find the draggable item (direct child of container)
    const item = e.composedPath().find(n => n instanceof HTMLElement && n.parentElement === container);
    if (!item) return;
    item.draggable = true;
    const reset = () => { item.draggable = false; document.removeEventListener('mouseup', reset, true); };
    document.addEventListener('mouseup', reset, true);
  });

  container.querySelectorAll(itemSelector).forEach(item => {
    item.draggable = false;

    item.addEventListener('dragstart', (e) => {
      if (!isEnabled()) { e.preventDefault(); return; }
      item.setAttribute('data-dragging', '');
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', item.dataset[idAttribute]);
    });

    item.addEventListener('dragend', () => {
      item.draggable = false;
      item.removeAttribute('data-dragging');
    });
  });

  container.addEventListener('dragover', (e) => {
    if (!isEnabled()) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    const dragging = container.querySelector('[data-dragging]');
    if (!dragging) return;
    const siblings = [...container.querySelectorAll(`${itemSelector}:not([data-dragging])`)];
    const next = siblings.find(s =>
      e.clientY - s.getBoundingClientRect().top - s.getBoundingClientRect().height / 2 < 0
    );
    container.insertBefore(dragging, next);
  });

  container.addEventListener('drop', (e) => {
    e.preventDefault();
    const orderedIds = [...container.querySelectorAll(itemSelector)].map(
      el => el.dataset[idAttribute]
    );
    onReorder(orderedIds);
  });
}
