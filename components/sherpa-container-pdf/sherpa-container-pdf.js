/**
 * sherpa-container-pdf — ARCHIVED (no-op stub)
 *
 * PDF export functionality is archived for rework.
 * This stub registers the custom element so existing imports don't break.
 * See components/archive/sherpa-container-pdf/ for the original implementation.
 */

class SherpaContainerPdf extends HTMLElement {
  /** @param {HTMLElement} _sourceContainer */
  async setData(_sourceContainer) {
    console.warn("sherpa-container-pdf is archived — setData() is a no-op.");
  }
}

if (!customElements.get("sherpa-container-pdf")) {
  customElements.define("sherpa-container-pdf", SherpaContainerPdf);
}

export { SherpaContainerPdf };
